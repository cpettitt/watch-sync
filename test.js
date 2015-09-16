"use strict";

var expect = require("chai").expect;
var fs = require("fs-extra");
var path = require("path");
var temp = require("temp");
var watchSync = require("./");

describe("watchSync", function() {
  var initialDir = process.cwd();
  var tempRoot;
  var srcDir;
  var destDir;
  var createdWatchers;

  beforeEach(function(done) {
    tempRoot = temp.mkdirSync();
    srcDir = path.join(tempRoot, "src");
    fs.copySync("test-fs", srcDir);

    // We want test-fd/sd1/sd1-1 to be empty, but git doesn't track empty
    // directories, so we delete a dummy file after copying it to `srcDir`.
    fs.unlinkSync(path.join(srcDir, "sd1", "sd1-1", "README"));

    destDir = path.join(tempRoot, "dest");
    fs.mkdirsSync(destDir);
    createdWatchers = [];

    // I've observed an apparent race occassionally on OSX where we copy the
    // test-fs directory synchronously above, add a watcher in tests below, and
    // get duplicated watch events. I've only reproduced this with `useFsEvents
    // = true`, so it may be a problem with fsevents. For now, this incredibly
    // lame timeout seems to have stabilized the tests.
    setTimeout(function() { done(); }, 10);
  });

  afterEach(function() {
    process.chdir(initialDir);
    createdWatchers.forEach(function(watcher) {
      watcher.close();
    });
  });

  describe("before ready", function() {
    it("copies initial structure from src to dest", function(done) {
      createWatcher(".", destDir, { cwd: srcDir })
        .on("ready", function() {
          expectFileSynced("test.txt");
          expectDirExists("sd1");
          expectFileSynced(path.join("sd1", "test.json"));
          expectDirExists(path.join("sd1", "sd1-1"));
          done();
        });
    });

    describe("delete objects", function() {
      var dirToDelete;
      var fileToDelete;

      beforeEach(function() {
        dirToDelete = path.join(destDir, "delete-me-dir");
        fs.mkdirsSync(dirToDelete);
        fileToDelete = path.join(destDir, "delete-me-file");
        fs.writeJsonSync(fileToDelete);
      });

      it("happens if delete='all'", function(done) {
        createWatcher(".", destDir, { cwd: srcDir, delete: "all" })
          .on("ready", function() {
            expectNotExists("delete-me-dir");
            expectNotExists("delete-me-file");
            done();
          });
      });

      it("does not happen if delete='none'", function(done) {
        createWatcher(".", destDir, { cwd: srcDir, delete: "none" })
          .on("ready", function() {
            expectDirExists("delete-me-dir");
            expectFileExists("delete-me-file");
            done();
          });
      });
    });
  });

  describe("after ready", function() {
    it("copies new files from src to dest", function(done) {
      var newFile = "new-file";
      createWatcher(".", destDir, { cwd: srcDir })
        .on("ready", function() {
          this.on("add", function(filePath, destPath) {
            expect(filePath).equals(newFile);
            expect(destPath).equals(path.join(destDir, newFile));
            expectFileSynced(newFile);
            done();
          });
          fs.writeJsonSync(path.join(srcDir, newFile), { json: "sure!" });
        });
    });

    it("copies new directories from src to dest", function(done) {
      var newDir = "new-dir";
      createWatcher(".", destDir, { cwd: srcDir })
        .on("ready", function() {
          this.on("addDir", function(filePath, destPath) {
            expect(filePath).equals(newDir);
            expect(destPath).equals(path.join(destDir, newDir));
            expectDirExists(newDir);
            done();
          });
          fs.mkdirSync(path.join(srcDir, newDir));
        });
    });

    it("copies changed files from src to dest", function(done) {
      var file = "test.txt";
      createWatcher(".", destDir, { cwd: srcDir })
        .on("ready", function() {
          this.on("change", function(filePath, destPath) {
            expect(filePath).equals(file);
            expect(destPath).equals(path.join(destDir, file));
            expectFileSynced(file);
            done();
          });
          fs.writeFileSync(path.join(srcDir, file), "New Content!");
        });
    });

    it("deletes file if delete='all'", function(done) {
      var file = "test.txt";
      createWatcher(".", destDir, { cwd: srcDir, delete: "all" })
        .on("ready", function() {
          this.on("unlink", function(filePath, destPath) {
            expect(filePath).equals(file);
            expect(destPath).equals(path.join(destDir, file));
            expectNotExists(file);
            done();
          });
          fs.unlinkSync(path.join(srcDir, file));
        });
    });

    it("does not delete files if delete='none'", function(done) {
      var file = "test.txt";
      createWatcher(".", destDir, { cwd: srcDir, delete: "none" })
        .on("ready", function() {
          this.on("unlink", function(filePath, destPath) {
            throw new Error("Received unlink event - should not have deleted file");
          });
          fs.unlinkSync(path.join(srcDir, file));
          setTimeout(function() {
            expectFileExists(file);
            done();
          }, 200);
        });
    });

    it("deletes directories if delete='all'", function(done) {
      var dir = path.join("sd1", "sd1-1");
      createWatcher(".", destDir, { cwd: srcDir, delete: "all" })
        .on("ready", function() {
          this.on("unlinkDir", function(filePath, destPath) {
            expect(filePath).equals(dir);
            expect(destPath).equals(path.join(destDir, dir));
            expectNotExists(dir);
            done();
          });
          fs.rmdirSync(path.join(srcDir, dir));
        });
    });

    it("does not delete directories if delete='none'", function(done) {
      var dir = path.join("sd1", "sd1-1");
      createWatcher(".", destDir, { cwd: srcDir, delete: "none" })
        .on("ready", function() {
          this.on("unlinkDir", function(filePath, destPath) {
            throw new Error("Received unlinkDir event - should not have deleted directory");
          });
          fs.rmdirSync(path.join(srcDir, dir));
          setTimeout(function() {
            expectDirExists(dir);
            done();
          }, 200);
        });
    });
  });

  it("uses the current directory if none is specified via `cwd`", function() {
    process.chdir(srcDir);
    createWatcher(".", destDir)
      .on("ready", function() {
        expectFileSynced("test.txt");
        expectDirExists("sd1");
        expectFileSynced(path.join("sd1", "test.json"));
        expectDirExists(path.join("sd1", "sd1-1"));
        done();
      });
  });

  it("does not allow globs with absolute paths", function() {
    expect(function() {
      createWatcher(path.resolve("."), destDir, { cwd: srcDir });
    }).to.throw();
  });

  describe("preserveTimestamps", function() {
    var yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);

    describe("= 'all'", function() {
      preserveFileTimestamps("all", true);
      preserveDirTimestamps("all", true);
    });

    describe("= 'file'", function() {
      preserveFileTimestamps("file", true);
      preserveDirTimestamps("file", false);
    });

    describe("= 'dir'", function() {
      preserveFileTimestamps("dir", false);
      preserveDirTimestamps("dir", true);
    });

    describe("= 'none'", function() {
      preserveFileTimestamps("none", false);
      preserveDirTimestamps("none", false);
    });

    function preserveFileTimestamps(preserveTimestamps, does) {
      it("does" + (does ? "" : "n't") + " preserve file timestamps", function(done) {
        var file = "test.txt";
        var srcFile = path.join(srcDir, file);
        var destFile = path.join(destDir, file);

        fs.utimesSync(srcFile, yesterday, yesterday);

        createWatcher(".", destDir, { cwd: srcDir, preserveTimestamps: preserveTimestamps })
          .on("ready", function() {
            var expectation = expect(fs.statSync(destFile).mtime.getTime());
            if (!does) {
              expectation = expectation.not;
            }
            expectation.equals(fs.statSync(srcFile).mtime.getTime());
            done();
          });
      });
    }

    function preserveDirTimestamps(preserveTimestamps, does) {
      it("does" + (does ? "" : "n't") + " preserve directory timestamps", function(done) {
        var dir = "sd1";
        var src  = path.join(srcDir, dir);
        var dest  = path.join(destDir, dir);

        fs.utimesSync(src, yesterday, yesterday);

        createWatcher(".", destDir, { cwd: srcDir, preserveTimestamps: preserveTimestamps })
          .on("ready", function() {
            var expectation = expect(fs.statSync(dest).mtime.getTime());
            if (!does) {
              expectation = expectation.not;
            }
            expectation.equals(fs.statSync(src).mtime.getTime());
            done();
          });
      });
    }
  });

  function readFile(path) {
    return fs.readFileSync(path, "utf8");
  }

  function expectFileSynced(relativePath) {
    expectFileExists(relativePath);

    var srcFile = path.join(srcDir, relativePath);
    var destFile = path.join(destDir, relativePath);
    expect(readFile(destFile)).equals(readFile(srcFile));
  }

  function expectFileExists(relativePath) {
    var destFile = path.join(destDir, relativePath);
    expect(fs.statSync(destFile).isFile()).is.true;
  }

  function expectDirExists(relativePath) {
    expect(fs.statSync(path.join(destDir, relativePath)).isDirectory()).is.true;
  }

  function expectNotExists(relativePath) {
    expect(function() {
      fs.statSync(path.join(destDir, relativePath));
    }).to.throw();
  }

  function createWatcher() {
    var args = Array.prototype.slice.call(arguments);
    var watcher = watchSync.apply(watchSync, args);
    createdWatchers.push(watcher);
    return watcher;
  }
});

describe("watchSync.version", function() {
  it("returns the current version in package.json", function() {
    var version = JSON.parse(fs.readFileSync("package.json")).version;
    expect(watchSync.version).equals(version);
  });
});

