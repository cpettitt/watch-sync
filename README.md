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
watcher.on("ready", function() { console.log("ready"); });
watcher.on("add", function(filepath, destDir, stat) {
  console.log("File / directory added", filepath, "in", destDir);
});
watcher.on("change", function(filepath, destDir, stat) {
  console.log("File / directory changed", filepath, "in", destDir);
});
watcher.on("delete", function(filepath, destDir) {
  console.log("File / directory removed", filepath, "from", destDir);
});
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
- `delete` (default: `true`). When `true` a delete of a file in `srcDir` after
  the `ready` event will cause the associated file in `destDir` to be removed.
- `preserveTimestamps` (default: `false`). If enabled sets the modified time
  of synchronized files to the modified time of the source file.

#### Events

- `ready` is fired after the initial sync of the file system.
- `add` is fired when a file or directory is added. This is only fired after `ready`.
- `change` is fired when a file or directory is changed. This is only fired
  after `ready`.
- `delete` is fired when a file or directory is removed. This is only fired
  after `ready`.

### `watchSync.version()`

Returns the version of the `watchSync` library.
