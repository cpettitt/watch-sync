"use strict";

var expect = require("chai").expect;
var fs = require("fs");
var path = require("path");
var temp = require("temp");
var watchSync = require("./");

describe("watchSync", function() {
  describe("sync", function() {
    var initialDir = process.cwd();
    var tempRoot;
    var srcDir;
    var destDir;
    var content;
    var watcher;

    beforeEach(function() {
      tempRoot = temp.mkdirSync();
      srcDir = path.join(tempRoot, "src");
      fs.mkdirSync(srcDir);
      destDir = path.join(tempRoot, "dest");
      fs.mkdirSync(destDir);
      content = "test content";
      process.chdir(srcDir);
    });

    afterEach(function() {
      process.chdir(initialDir);
      if (watcher) {
        watcher.close();
        watcher = null;
      }
    });

    describe("before ready", function() {
      it("copies initial files from src to dest", function(done) {
        fs.writeFileSync(path.join(srcDir, "test.txt"), content, "utf8");
        watcher = watchSync.sync(".", destDir);
        watcher.on("ready", function() {
          var destFile = path.join(destDir, "test.txt");
          fs.statSync(destFile);
          expect(fs.readFileSync(destFile, "utf8")).equals(content);
          done();
        });
      });

      it("creates directories from src in dest", function(done) {
        fs.mkdirSync(path.join(srcDir, "testDir"));
        watcher = watchSync.sync(".", destDir);
        watcher.on("ready", function() {
          var stat = fs.statSync(path.join(destDir, "testDir"));
          expect(stat.isDirectory()).is.true;
          done();
        });
      });
    });

    describe("after ready", function() {
      it("copies files added", function(done) {
        watcher = watchSync.sync(".", destDir);
        watcher.on("ready", function() {
          fs.writeFileSync(path.join(srcDir, "test.txt"), content, "utf8");
          watcher.on("add", function(filePath, destPath) {
            expect(filePath).equals("test.txt");
            expect(destPath).equals(path.join(destDir, "test.txt"));
            expect(fs.readFileSync(destPath, "utf8")).equals(content);
            done();
          });
        });
      });

      it("copies files changed", function(done) {
        var srcPath = path.join(srcDir, "test.txt");
        fs.writeFileSync(srcPath, "initial content", "utf8");
        watcher = watchSync.sync(".", destDir);
        watcher.on("ready", function() {
          watcher.on("change", function(filePath, destPath) {
            expect(filePath).equals("test.txt");
            expect(destPath).equals(path.join(destDir, "test.txt"));
            expect(fs.readFileSync(destPath, "utf8")).equals(content);
            done();
          });
          fs.writeFileSync(path.join(srcDir, "test.txt"), content, "utf8");
        });
      });

      it("creates directories from src in dest", function(done) {
        watcher = watchSync.sync(".", destDir);
        watcher.on("ready", function() {
          fs.mkdirSync(path.join(srcDir, "testDir"));
          watcher.on("addDir", function(filePath, destPath) {
            expect(filePath).equals("testDir");
            expect(destPath).equals(path.join(destDir, "testDir"));
            var stat = fs.statSync(path.join(destDir, "testDir"));
            expect(stat.isDirectory()).is.true;
            done();
          });
        });
      });
    });

    it("works from another directory with cwd option", function(done) {
      var otherDir = path.join(tempRoot, "other");
      fs.mkdirSync(otherDir);
      process.chdir(otherDir);
      fs.writeFileSync(path.join(srcDir, "test.txt"), content, "utf8");
      watcher = watchSync.sync(".", destDir, { cwd: srcDir });
      watcher.on("ready", function() {
        var destFile = path.join(destDir, "test.txt");
        fs.statSync(destFile);
        expect(fs.readFileSync(destFile, "utf8")).equals(content);
        done();
      });
    });

    it("preserves file timestamps with preserveTimestamps = file", function(done) {
      var srcFile = path.join(srcDir, "test.txt");
      fs.writeFileSync(srcFile, content, "utf8");
      setTimeout(function() {
        watcher = watchSync.sync(".", destDir, { preserveTimestamps: "file" });
        watcher.on("ready", function() {
          var destFile = path.join(destDir, "test.txt");
          var srcStat = fs.statSync(srcFile);
          var destStat = fs.statSync(destFile);
          expect(destStat.mtime.getTime()).equals(srcStat.mtime.getTime());
          done();
        });
      }, 1000);
    });

    it("preserves directory timestamps with preserveTimestamps = dir", function(done) {
      var src = path.join(srcDir, "test.txt");
      fs.mkdirSync(src);
      setTimeout(function() {
        watcher = watchSync.sync(".", destDir, { preserveTimestamps: "dir" });
        watcher.on("ready", function() {
          var dest = path.join(destDir, "test.txt");
          var srcStat = fs.statSync(src);
          var destStat = fs.statSync(dest);
          expect(destStat.mtime.getTime()).equals(srcStat.mtime.getTime());
          done();
        });
      }, 1000);
    });

    it("doesn't preserve file timestamps with preserveTimestamps = dir", function(done) {
      var srcFile = path.join(srcDir, "test.txt");
      fs.writeFileSync(srcFile, content, "utf8");
      setTimeout(function() {
        watcher = watchSync.sync(".", destDir, { preserveTimestamps: "dir" });
        watcher.on("ready", function() {
          var destFile = path.join(destDir, "test.txt");
          var srcStat = fs.statSync(srcFile);
          var destStat = fs.statSync(destFile);
          expect(destStat.mtime.getTime()).not.equals(srcStat.mtime.getTime());
          done();
        });
      }, 1000);
    });

    it("doesn't preserve directory timestamps with preserveTimestamps = file", function(done) {
      var src = path.join(srcDir, "test.txt");
      fs.mkdirSync(src);
      setTimeout(function() {
        watcher = watchSync.sync(".", destDir, { preserveTimestamps: "file" });
        watcher.on("ready", function() {
          var dest = path.join(destDir, "test.txt");
          var srcStat = fs.statSync(src);
          var destStat = fs.statSync(dest);
          expect(destStat.mtime.getTime()).not.equals(srcStat.mtime.getTime());
          done();
        });
      }, 1000);
    });

  });

  describe("version", function() {
    it("returns the current version in package.json", function() {
      var version = JSON.parse(fs.readFileSync("package.json")).version;
      expect(watchSync.version).equals(version);
    });
  });
});
