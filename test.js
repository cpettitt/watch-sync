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

  beforeEach(function() {
    tempRoot = temp.mkdirSync();
    srcDir = path.join(tempRoot, "src");
    fs.copySync("test-fs", srcDir);
    destDir = path.join(tempRoot, "dest");
    fs.mkdirsSync(destDir);
    createdWatchers = [];
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

      it("happens if delete=true", function(done) {
        createWatcher(".", destDir, { cwd: srcDir, delete: true })
          .on("ready", function() {
            expectNotExists("delete-me-dir");
            expectNotExists("delete-me-file");
            done();
          });
      });

      it("does not happen if delete=false", function(done) {
        createWatcher(".", destDir, { cwd: srcDir, delete: false })
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

