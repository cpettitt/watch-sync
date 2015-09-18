// Get stack traces that point to the original ES6 code.
import "source-map-support/register";

// Include babel polyfill
import "babel/polyfill";

import { EventEmitter } from "events";
import chokidar from "chokidar";
import defaults from "lodash/object/defaults";
import fs from "fs-extra";
import path from "path";

const DEFAULT_OPTS = {
  persistent: true,
  preserveTimestamps: false,
  delete: false
};

class FSSyncer extends EventEmitter {
  constructor(srcDir, destDir, opts) {
    super();

    opts = defaults(opts || {}, DEFAULT_OPTS);
    this._srcDir = srcDir;
    this._destDir = destDir;

    // Have we hit the ready state?
    this._ready = false;

    this._delete = opts.delete;

    this._copyOpts = {
      preserveTimestamps: opts.preserveTimestamps
    };

    const globs = opts.glob || ".";
    const chokidarOpts = {
      cwd: srcDir,
      persistent: opts.persistent,
      ignoreInitial: true
    };

    this._watcher = chokidar.watch(globs, chokidarOpts)
      .on("error", e => this._handleError(e))
      .on("ready", () => this._handleReady());
  }

  get ready() {
    return this._ready;
  }

  get srcDir() {
    return this._srcDir;
  }

  get destDir() {
    return this._destDir;
  }

  close() {
    this._watcher.close();
    this.removeAllListeners();
  }

  _handleReady() {
    fs.copySync(this._srcDir, this._destDir, this._copyOpts);
    this._ready = true;
    this._watcher.on("all", (e, p, s) => this._handleWatchEvent(e, p, s));
    this.emit("ready");
  }

  _handleError(e) {
    this.emit("error", e);
  }

  _handleWatchEvent(event, filePath, stat) {
    const srcPath = path.join(this._srcDir, filePath);
    const destPath = path.join(this._destDir, filePath);

    if (!stat && event !== "unlink" && event !== "unlinkDir") {
      // Chokidar only sends stats if it gets them from the underlying
      // watch events. I tried using Chokidar's `alwaysStat` option but it
      // appeared to break some watches, so instead we stat here.
      // TODO investigate why always stat is breaking watches.
      stat = fs.statSync(srcPath);
    }

    switch (event) {
      case "add":
      case "change":
        fs.copySync(srcPath, destPath, this._copyOpts);
        break;
      case "addDir":
        fs.ensureDirSync(destPath);
        if (this._preserveTimestamps) {
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

    if (stat) {
      this.emit(event, filePath, this._destDir, stat);
      this.emit("all", event, filePath, this._destDir, stat);
    } else {
      this.emit(event, filePath, this._destDir);
      this.emit("all", event, filePath, this._destDir);
    }
  }
}

function watchSync(glob, dest, opts) {
  return new FSSyncer(glob, dest, opts);
}
// Read version in from package.json
watchSync.version = require("./package.json").version;

export default watchSync;
