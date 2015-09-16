// Get stack traces that point to the original ES6 code.
import "source-map-support/register";

// Include babel polyfill
import "babel/polyfill";

import { EventEmitter } from "events";
import chokidar from "chokidar";
import defaults from "lodash/object/defaults";
import includes from "lodash/collection/includes";
import fs from "fs-extra";
import isAbsolute from "path-is-absolute";
import path from "path";
import pick from "lodash/object/pick";

const DEFAULT_OPTS = {
  preserveTimestamps: "all",
  delete: "none"
};

class FSSyncer extends EventEmitter {
  constructor(glob, dest, opts) {
    super();

    if (isAbsolute(glob)) {
      throw new Error("Glob cannot be an absolute path. Use cwd option to set the base directory.");
    }

    opts = defaults(opts || {}, DEFAULT_OPTS);
    this._cwd = opts.cwd || ".";
    this._dest = dest;

    this._preserveFileTimestamps = includes(["all", "file"], opts.preserveTimestamps);
    this._preserveDirTimestamps = includes(["all", "dir"], opts.preserveTimestamps);

    this._delete = opts.delete;
    this._visited = new Set();

    if (!dest) {
      throw new Error("A destination must be specified!");
    }
    fs.ensureDirSync(dest);

    // Have we hit the ready state?
    this._ready = false;

    // Functions to execute after we hit the ready state.
    this._postReadyFunctions = [];

    if (this._delete === "all") {
      // If we were tracking visited files before the "ready" event then we
      // have the delete option enabled. Time to visit the destination and
      // ensure we remove everything not visited. We do this synchronously
      // to ensure we're in a consistent state when we get subsequent updates
      // from Chokidar.
      this._postReadyFunctions.push(() => this._deleteUnvisitedFiles());
    }

    this._watcher = chokidar.watch(glob, filterChokidarOptions(opts))
      .on("all", (e, p, s) => this._handleWatchEvent(e, p, s))
      .on("error", e => this._handleError(e))
      .on("ready", () => this._handleReady());
  }

  close() {
    this._watcher.close();
  }

  _handleReady() {
    this._ready = true;
    this._postReadyFunctions.forEach(fn => fn());
    delete this._postReadyFunctions;
    this.emit("ready");
  }

  _handleError(e) {
    this.emit("error", e);
  }

  _handleWatchEvent(event, filePath, stat) {
    // If we're tracking visited files add filePath to the visited set.
    if (!this._ready && event !== "unlink" && event !== "unlinkDir") {
      this._visited.add(filePath);
    }

    const srcPath = path.join(this._cwd, filePath);
    const destPath = path.join(this._dest, filePath);
    switch (event) {
      case "add":
      case "change":
        fs.copySync(srcPath, destPath, { preserveTimestamps: this._preserveFileTimestamps });
        break;
      case "addDir":
        fs.ensureDirSync(destPath);
        if (this._preserveDirTimestamps) {
          if (!stat) {
            // Chokidar only sends stats if it gets them from the underlying
            // watch events. We don't want to force stats if we don't need
            // them, so we do not use Chokidar's `alwaysStat` option. Instead
            // we stat here if needed.
            stat = fs.statSync(srcPath);
          }

          const updateTimes = () => fs.utimesSync(destPath, stat.atime, stat.mtime);
          if (this._ready) {
            updateTimes();
          } else {
            // If we're not in the ready state then we defer updating the times
            // for the directory. If we update immediately then it is possible
            // that some other change to the directory (e.g. adding a file)
            // will change its modify time.
            this._postReadyFunctions.push(updateTimes);
          }
        }
        break;
      case "unlink":
      case "unlinkDir":
        if (this._delete !== "all") {
          // Do not fire an event since we did not actually delete the file.
          return;
        }
        fs.removeSync(destPath);
        break;
    }

    this.emit(event, filePath, destPath, stat);
    this.emit("all", event, filePath, destPath, stat);
  }

  _deleteUnvisitedFiles() {
    if (this._delete === "all") {
      const visitStack = fs.readdirSync(this._dest);
      while (visitStack.length) {
        const f = visitStack.pop();
        const qualifiedF = path.join(this._dest, f);
        if (!this._visited.has(f)) {
          // We did not visit this file so delete it.
          fs.removeSync(qualifiedF);
        } else if (fs.statSync(qualifiedF).isDirectory()) {
          fs.readdirSync(qualifiedF).forEach(subfile => visitStack.push(path.join(f, subfile)));
        }
      }
    }

    delete this._visited;
  }
}

function watchSync(glob, dest, opts) {
  return new FSSyncer(glob, dest, opts);
}
// Read version in from package.json
watchSync.version = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"))).version;

function filterChokidarOptions(opts) {
  return pick(opts, [
    "cwd",
    "depth",
    "ignored",
    "persistent",
  ]);
}

export default watchSync;
