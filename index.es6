// Get stack traces that point to the original ES6 code.
import "source-map-support/register";

// Include babel polyfill
import "babel/polyfill";

import { EventEmitter } from "events";
import chokidar from "chokidar";
import defaults from "lodash/object/defaults";
import fs from "fs-extra";
import isAbsolute from "path-is-absolute";
import path from "path";
import pick from "lodash/object/pick";

// Read version in from package.json
const version = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"))).version;

const DEFAULT_OPTS = {
  preserveTimestamps: "all",
  delete: false
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

    this._preserveTimestamps = opts.preserveTimestamps;

    this._delete = opts.delete;
    if (this._delete) {
      this._visited = new Set();
    }

    if (!dest) {
      throw new Error("A destination must be specified!");
    }
    fs.ensureDirSync(dest);

    this._watcher = chokidar.watch(glob, filterChokidarOptions(opts))
      .on("all", (e, p, s) => this._handleWatchEvent(e, p, s))
      .on("error", e => this._handleError(e))
      .on("ready", () => this._handleReady());
  }

  close() {
    this._watcher.close();
  }

  _handleReady() {
    // If we were tracking visited files before the "ready" event then we
    // have the delete option enabled. Time to visit the destination and
    // ensure we remove everything not visited. We do this synchronously
    // to ensure we're in a consistent state when we get subsequent updates
    // from Chokidar.
    this._deleteUnvisitedFiles();
    this.emit("ready");
  }

  _handleError(e) {
    this.emit("error", e);
  }

  _handleWatchEvent(event, filePath, stat) {
    // If we're tracking visited files add filePath to the visited set.
    if (this._visited && event !== "unlink" && event !== "unlinkDir") {
      this._visited.add(filePath);
    }

    const timestamps = this._preserveTimestamps;
    const destPath = path.join(this._dest, filePath);
    switch (event) {
      case "add":
      case "change":
        fs.copySync(path.join(this._cwd, filePath), destPath, {
          preserveTimestamps: timestamps === "all" || timestamps === "file" 
        });
        break;
      case "addDir":
        fs.ensureDirSync(destPath);
        if (timestamps === "all" || timestamps === "dir") {
          if (!stat) {
            // BUG it seems we sometimes do not get a stat from chokidar, so get it again.
            stat = fs.statSync(filePath);
          }
          fs.utimesSync(destPath, stat.atime, stat.mtime);
        }
        break;
      case "unlink":
      case "unlinkDir":
        if (!this._delete) {
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
    if (!this._visited || !this._delete) {
      delete this._visited;
      return;
    }

    const visitStack = fs.readdirSync(this._dest);
    while (visitStack.length) {
      const f = visitStack.pop();
      if (!this._visited.has(f)) {
        // We did not visit this file so delete it.
        fs.removeSync(path.join(this._dest, f));
      } else if (fs.statSync(f).isDirectory()) {
        fs.readdirSync(f).forEach(subfile => visitStack.push(path.join(f, subfile)));
      }
    }

    delete this._visited;
  }
}

function sync(glob, dest, opts) {
  return new FSSyncer(glob, dest, opts);
}

function filterChokidarOptions(opts) {
  return pick(opts, [
    "cwd",
    "depth",
    "ignored",
    "persistent",
  ]);
}

export default {
  sync,
  version
};
