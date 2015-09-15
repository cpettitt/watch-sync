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

var srcGlob = ".";
var destDir = "/tmp/watchSync";
var options = {};
var watcher = watchSync.sync(srcGlob, destDir, options);
```

By default watchSync is persistent, which means it will run even after the
initial sync. You can close the watcher with `watcher.close()`.

## API

```
watchSync.sync(srcGlob, destDir, [options])
```

- `srcGlob` is the source glob to watch.
- `destDir` is the path to the destination directory. The directory will be
  created if it does not already exist.
- `options` is an optional set of configuration entries, as described in the
  Options section below.

### Options

- `persistent` (default: `true`). If `true` continue to watch the srcGlob for
  changes after the initial sync. To close a persistent watcher use
  `watcher.close()`.
- `delete` (default: `false`). If `true` delete files during the initial sync
  that are in `destDir` but not in `srcGlob`. After initial sync delete files
  from `destDir` as they are removed from `srcGlob`.
- `cwd` (default: `undefined`). If set, use the `cwd` directory as the base
  directory on which to apply the `srcGlob`.
- `preserveTimestamps` (default: `all`). If enabled sets the `atime` and
  `mtime` for synchronized files to their source; otherwise `atime` and `mtime`
  reflect the creation of the destination object (file or directory). Use
  `preserveTimestamps = "file"` to enable this for files. Use
  `preserveTimestamps = "dir"` to enable this for directories. Use
  `preserveTimestamps = "all"` to enable this for both files and directories.
  Use `preserveTimestamps = "non"` to disable this feature.
