// Get stack traces that point to the original ES6 code.
import "source-map-support/register";

// Include babel polyfill
import "babel/polyfill";

import { EventEmitter } from "events";
import chokidar from "chokidar";
import defaults from "lodash/object/defaults";
import fs from "fs-extra";
import globParent from "glob-parent";
import isAbsolute from "path-is-absolute";
import path from "path";
import pick from "lodash/object/pick";

// Read version in from package.json
const version = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"))).version;

const DEFAULT_OPTS = {
  preserveTimestamps: "all"
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
        fs.removeSync(destPath);
        break;
    }

    this.emit(event, filePath, destPath, stat);
    this.emit("all", event, filePath, destPath, stat);
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
