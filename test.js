"use strict";

var expect = require("chai").expect;
var fs = require("fs-extra");
var path = require("path");
var watchSync = require("./");

describe("watchSync", function() {
  var nextId = 0;
  var tempRoot;
  var testSrcDir;
  var testDestDir;
  var createdWatchers;
  var yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);

  beforeEach(function(done) {
    tempRoot = path.join("tmp", String(nextId++));
    fs.removeSync(tempRoot);
    fs.mkdirsSync(tempRoot);

    testSrcDir = path.join(tempRoot, "src");
    fs.copySync("test-fs", testSrcDir);

    // We want test-fd/sd1/sd1-1 to be empty, but git doesn't track empty
    // directories, so we delete a dummy file after copying it to `testSrcDir`.
    fs.unlinkSync(path.join(testSrcDir, "sd1", "sd1-1", "README"));

    testDestDir = path.join(tempRoot, "dest");
    fs.mkdirsSync(testDestDir);
    createdWatchers = [];

    // I've observed an apparent race occassionally on OSX where we copy the
    // test-fs directory synchronously above, add a watcher in tests below, and
    // get duplicated watch events. I've only reproduced this with `useFsEvents
    // = true`, so it may be a problem with fsevents. For now, this incredibly
    // lame timeout seems to have stabilized the tests.
    setTimeout(function() { done(); }, 10);
  });

  afterEach(function() {
    createdWatchers.forEach(function(watcher) {
      watcher.close();
    });
  });

  it("exposes the srcDir property", function() {
    expect(createWatcher(testSrcDir, testDestDir, { peristent: false }).srcDir)
      .equals(testSrcDir);
  });

  it("exposes the destDir property", function() {
    expect(createWatcher(testSrcDir, testDestDir, { peristent: false }).destDir)
      .equals(testDestDir);
  });

  it("copies from src to dest during initial sync", function(done) {
    createWatcher(testSrcDir, testDestDir)
      .on("ready", function() {
        expectFileSynced("test.txt");
        expectDirExists("sd1");
        expectFileSynced(path.join("sd1", "test.json"));
        expectDirExists(path.join("sd1", "sd1-1"));
        done();
      });
  });

  it("only copies matching files during initial sync", function(done) {
    createWatcher(testSrcDir, testDestDir, { glob: ["**/test.json"] })
      .on("ready", function() {
        expectNotExists("test.txt");
        expectFileSynced(path.join("sd1", "test.json"));
        expectNotExists(path.join("sd1", "sd1-1"));
        done();
      });
  });

  it("copies new files from src to dest", function(done) {
    var newFile = "new-file";
    createWatcher(testSrcDir, testDestDir)
      .on("ready", function() {
        this.on("add", function(filePath, destDir, stat) {
          expectFileSynced(newFile);
          expect(filePath).equals(newFile);
          expect(destDir).equals(testDestDir);
          expect(stat.isFile()).to.be.true;
          done();
        });
        fs.writeJsonSync(path.join(testSrcDir, newFile), { json: "sure!" });
      });
  });

  it("copies new directories from src to dest", function(done) {
    var newDir = "new-dir";
    createWatcher(testSrcDir, testDestDir)
      .on("ready", function() {
        this.on("addDir", function(filePath, destDir, stat) {
          expectDirExists(newDir);
          expect(filePath).equals(newDir);
          expect(destDir).equals(testDestDir);
          expect(stat.isDirectory()).to.be.true;
          done();
        });
        fs.mkdirSync(path.join(testSrcDir, newDir));
      });
  });

  it("copies changed files from src to dest", function(done) {
    var file = "test.txt";
    createWatcher(testSrcDir, testDestDir)
      .on("ready", function() {
        this.on("change", function(filePath, destDir, stat) {
          expectFileSynced(file);
          expect(filePath).equals(file);
          expect(destDir).equals(testDestDir);
          expect(stat.isFile()).to.be.true;
          done();
        });
        fs.writeFileSync(path.join(testSrcDir, file), "New Content!");
      });
  });

  it("deletes file if delete=true", function(done) {
    var file = "test.txt";
    createWatcher(testSrcDir, testDestDir, { delete: true })
      .on("ready", function() {
        this.on("unlink", function(filePath, destDir) {
          expectNotExists(file);
          expect(filePath).equals(file);
          expect(destDir).equals(testDestDir);
          expect(arguments).to.have.length(2);
          done();
        });
        fs.unlinkSync(path.join(testSrcDir, file));
      });
  });

  it("does not delete files if delete=false", function(done) {
    var file = "test.txt";
    createWatcher(testSrcDir, testDestDir, { delete: false })
      .on("ready", function() {
        this.on("unlink", function() {
          throw new Error("Received unlink event - should not have deleted file");
        });
        fs.unlinkSync(path.join(testSrcDir, file));
        setTimeout(function() {
          expectFileExists(file);
          done();
        }, 200);
      });
  });

  it("deletes directories if delete=true", function(done) {
    var dir = path.join("sd1", "sd1-1");
    createWatcher(testSrcDir, testDestDir, { delete: true })
      .on("ready", function() {
        this.on("unlinkDir", function(filePath, destDir) {
          expectNotExists(dir);
          expect(filePath).equals(dir);
          expect(destDir).equals(testDestDir);
          done();
        });
        fs.rmdirSync(path.join(testSrcDir, dir));
      });
  });

  it("does not delete directories if delete=false", function(done) {
    var dir = path.join("sd1", "sd1-1");
    createWatcher(testSrcDir, testDestDir, { delete: false })
      .on("ready", function() {
        this.on("unlinkedDir", function() {
          throw new Error("Received unlinkDir event - should not have deleted directory");
        });
        fs.rmdirSync(path.join(testSrcDir, dir));
        setTimeout(function() {
          expectDirExists(dir);
          done();
        }, 200);
      });
  });

  it("preserves file timestamps with preserveTimestamps=true", function(done) {
    preserveFileTimestamps(true, done);
  });

  it("doesn't preserve file timestamps with preserveTimestamps=false", function(done) {
    preserveFileTimestamps(false, done);
  });

  function preserveFileTimestamps(preserveTimestamps, done) {
    var file = "test.txt";
    var srcFile = path.join(testSrcDir, file);
    var destFile = path.join(testDestDir, file);

    fs.utimesSync(srcFile, yesterday, yesterday);

    createWatcher(testSrcDir, testDestDir, { preserveTimestamps: preserveTimestamps })
      .on("ready", function() {
        var expectation = expect(fs.statSync(destFile).mtime.getTime());
        if (!preserveTimestamps) {
          expectation = expectation.not;
        }
        expectation.equals(fs.statSync(srcFile).mtime.getTime());
        done();
      });
  }

  function readFile(path) {
    return fs.readFileSync(path, "utf8");
  }

  function expectFileSynced(relativePath) {
    expectFileExists(relativePath);

    var srcFile = path.join(testSrcDir, relativePath);
    var destFile = path.join(testDestDir, relativePath);
    expect(readFile(destFile)).equals(readFile(srcFile));
  }

  function expectFileExists(relativePath) {
    var destFile = path.join(testDestDir, relativePath);
    expect(fs.statSync(destFile).isFile()).is.true;
  }

  function expectDirExists(relativePath) {
    expect(fs.statSync(path.join(testDestDir, relativePath)).isDirectory()).is.true;
  }

  function expectNotExists(relativePath) {
    expect(function() {
      fs.statSync(path.join(testDestDir, relativePath));
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

