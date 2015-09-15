// Get stack traces that point to the original ES6 code.
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

require("source-map-support/register");

// Include babel polyfill

require("babel/polyfill");

var _events = require("events");

var _chokidar = require("chokidar");

var _chokidar2 = _interopRequireDefault(_chokidar);

var _lodashObjectDefaults = require("lodash/object/defaults");

var _lodashObjectDefaults2 = _interopRequireDefault(_lodashObjectDefaults);

var _fsExtra = require("fs-extra");

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _globParent = require("glob-parent");

var _globParent2 = _interopRequireDefault(_globParent);

var _pathIsAbsolute = require("path-is-absolute");

var _pathIsAbsolute2 = _interopRequireDefault(_pathIsAbsolute);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _lodashObjectPick = require("lodash/object/pick");

var _lodashObjectPick2 = _interopRequireDefault(_lodashObjectPick);

// Read version in from package.json
var version = JSON.parse(_fsExtra2["default"].readFileSync(_path2["default"].join(__dirname, "package.json"))).version;

var DEFAULT_OPTS = {
  preserveTimestamps: "all"
};

var FSSyncer = (function (_EventEmitter) {
  _inherits(FSSyncer, _EventEmitter);

  function FSSyncer(glob, dest, opts) {
    var _this = this;

    _classCallCheck(this, FSSyncer);

    _get(Object.getPrototypeOf(FSSyncer.prototype), "constructor", this).call(this);

    if ((0, _pathIsAbsolute2["default"])(glob)) {
      throw new Error("Glob cannot be an absolute path. Use cwd option to set the base directory.");
    }

    opts = (0, _lodashObjectDefaults2["default"])(opts || {}, DEFAULT_OPTS);
    this._cwd = opts.cwd || ".";
    this._dest = dest;

    this._preserveTimestamps = opts.preserveTimestamps;

    if (!dest) {
      throw new Error("A destination must be specified!");
    }
    _fsExtra2["default"].ensureDirSync(dest);

    this._watcher = _chokidar2["default"].watch(glob, filterChokidarOptions(opts)).on("all", function (e, p, s) {
      return _this._handleWatchEvent(e, p, s);
    }).on("error", function (e) {
      return _this._handleError(e);
    }).on("ready", function () {
      return _this._handleReady();
    });
  }

  _createClass(FSSyncer, [{
    key: "close",
    value: function close() {
      this._watcher.close();
    }
  }, {
    key: "_handleReady",
    value: function _handleReady() {
      this.emit("ready");
    }
  }, {
    key: "_handleError",
    value: function _handleError(e) {
      this.emit("error", e);
    }
  }, {
    key: "_handleWatchEvent",
    value: function _handleWatchEvent(event, filePath, stat) {
      // If we're tracking visited files add filePath to the visited set.
      if (this._visited && event !== "unlink" && event !== "unlinkDir") {
        this._visited.add(filePath);
      }

      var timestamps = this._preserveTimestamps;
      var destPath = _path2["default"].join(this._dest, filePath);
      switch (event) {
        case "add":
        case "change":
          _fsExtra2["default"].copySync(_path2["default"].join(this._cwd, filePath), destPath, {
            preserveTimestamps: timestamps === "all" || timestamps === "file"
          });
          break;
        case "addDir":
          _fsExtra2["default"].ensureDirSync(destPath);
          if (timestamps === "all" || timestamps === "dir") {
            if (!stat) {
              // BUG it seems we sometimes do not get a stat from chokidar, so get it again.
              stat = _fsExtra2["default"].statSync(filePath);
            }
            _fsExtra2["default"].utimesSync(destPath, stat.atime, stat.mtime);
          }
          break;
        case "unlink":
        case "unlinkDir":
          _fsExtra2["default"].removeSync(destPath);
          break;
      }

      this.emit(event, filePath, destPath, stat);
      this.emit("all", event, filePath, destPath, stat);
    }
  }]);

  return FSSyncer;
})(_events.EventEmitter);

function sync(glob, dest, opts) {
  return new FSSyncer(glob, dest, opts);
}

function filterChokidarOptions(opts) {
  return (0, _lodashObjectPick2["default"])(opts, ["cwd", "depth", "ignored", "persistent"]);
}

exports["default"] = {
  sync: sync,
  version: version
};
module.exports = exports["default"];

//# sourceMappingURL=index.js.map