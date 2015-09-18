# watch-sync

Watch for file changes and replicate them to a new location.

Performs initial synchronization between the src and dest directories and then
sets a watcher that updates the dest directory any time a change is made.

## Getting Started

Install `watch-sync` via `NPM`:

```
npm install watch-sync
```

Then require it to use it:

```js
var watchSync = require("watch-sync");

var srcDir = ".";
var destDir = "/tmp/watchSync";
var options = {};
var watcher = watchSync(srcDir, destDir, options);
```

By default watchSync is persistent, which means it will run even after the
initial sync. You can close the watcher with `watcher.close()`.

## API

### `watchSync(srcDir, destDir, [options])`

- `srcDir` is the source directory to watch.
- `destDir` is the path to the destination directory. The directory will be
  created if it does not already exist.
- `options` is an optional set of configuration entries, as described in the
  Options section below.

#### Options

- `persistent` (default: `true`). If `true` continue to watch the srcDir for
  changes after the initial sync. To close a persistent watcher use
  `watcher.close()`.
- `delete` (default: `"none"`).  If `"none"` never delete an object from the
  dest dir. If `"after-ready"` only delete objects that are removed after the
  "ready" event has been fired. If `"all"` delete all objects not in the src
  dir during initial sync and then delete all files removed after the "ready"
  event has fired. If `"all"` delete files during the initial sync that are
  in `destDir` but not in `srcDir`. After initial sync delete files from
  `destDir` as they are removed from `srcDir`.
- `preserveTimestamps` (default: `"all"`). If enabled sets the `atime` and
  `mtime` for synchronized files to their source; otherwise `atime` and `mtime`
  reflect the creation of the destination object (file or directory). Use
  `preserveTimestamps = "file"` to enable this for files. Use
  `preserveTimestamps = "dir"` to enable this for directories. Use
  `preserveTimestamps = "all"` to enable this for both files and directories.
  Use `preserveTimestamps = "non"` to disable this feature.

### `watchSync.version()`

Returns the version of the `watchSync` library.
