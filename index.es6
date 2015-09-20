// Get stack traces that point to the original ES6 code.
import "source-map-support/register";

if (typeof _babelPolyfill === "undefined") {
  // Include babel polyfill
  require("babel/polyfill");
}

import chokidar from "chokidar";
import defaults from "lodash/object/defaults";
import fs from "fs-extra";
import path from "path";
import { EventEmitter } from "events";
import { Logger } from "eazy-logger";

const DEFAULT_OPTS = {
  logLevel: "debug",
  persistent: true,
  preserveTimestamps: false,
  delete: true
};

class FSSyncer extends EventEmitter {
  constructor(srcDir, destDir, opts) {
    super();

    opts = defaults(opts || {}, DEFAULT_OPTS);
    this._srcDir = srcDir;
    this._destDir = destDir;

    this._logger = new Logger({
      level: opts.logLevel,
      prefix: "[{blue:watch-sync}] "
    });

    // Have we hit the ready state?
    this._ready = false;

    this._delete = opts.delete;

    const globs = opts.glob || ".";

    this._copyOpts = {
      preserveTimestamps: opts.preserveTimestamps
    };

    const chokidarOpts = {
      cwd: srcDir,
      persistent: opts.persistent
    };

    this._watcher = chokidar.watch(globs, chokidarOpts)
      .on("all", (e, p, s) => this._handleWatchEvent(e, p, s))
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
    this._ready = true;
    this._logger.info("{cyan:Watching} {magenta:%s}", this._srcDir);
    this.emit("ready");
  }

  _handleError(e) {
    this._logger.error("{red:Error: %s}", e);
    this.emit("error", e);
  }

  _handleWatchEvent(event, filePath, stat) {
    if (!filePath.length) {
      filePath = ".";
    }
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
        this._logger.debug("{cyan:Copy} {green:%s} -> {green:%s})", srcPath, destPath);
        break;
      case "addDir":
        fs.ensureDirSync(destPath);
        this._logger.debug("{cyan:Make dir} {green:%s})", destPath);
        break;
      case "unlink":
      case "unlinkDir":
        if (!this._delete) {
          // Do not fire an event since we did not actually delete the file.
          return;
        }
        fs.removeSync(destPath);
        this._logger.debug("{cyan:Delete} {green:%s})", destPath);
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

function watchSync(src, dest, opts) {
  return new FSSyncer(src, dest, opts);
}
// Read version in from package.json
watchSync.version = require("./package.json").version;

export default watchSync;
