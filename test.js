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

      it("removes files from dest that don't exist in src with delete=true", function(done) {
        var destFile = path.join(destDir, "test.txt");
        fs.writeFileSync(destFile, content, "utf8");
        watcher = watchSync.sync(".", destDir, { delete: true });
        watcher.on("ready", function() {
          expect(function() { fs.statSync(destFile); }).to.throw(Error);
          done();
        });
      });

      it("removes directories from dest that don't exist in src with delete=true", function(done) {
        var dest = path.join(destDir, "testDir");
        fs.mkdirSync(dest);
        watcher = watchSync.sync(".", destDir, { delete: true });
        watcher.on("ready", function() {
          expect(function() { fs.statSync(dest); }).to.throw(Error);
          done();
        });
      });

      it("does not remove files from dest that don't exist in src with delete=false", function(done) {
        var destFile = path.join(destDir, "test.txt");
        fs.writeFileSync(destFile, content, "utf8");
        watcher = watchSync.sync(".", destDir, { delete: false });
        watcher.on("ready", function() {
          var stat = fs.statSync(destFile);
          expect(stat.isFile()).is.true;
          done();
        });
      });

      it("does not remove directories from dest that don't exist in src with delete=false", function(done) {
        var dest = path.join(destDir, "testDir");
        fs.mkdirSync(dest);
        watcher = watchSync.sync(".", destDir, { delete: false });
        watcher.on("ready", function() {
          var stat = fs.statSync(dest);
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

      it("removes files from dest with delete=true", function(done) {
        var srcFile = path.join(srcDir, "test.txt");
        fs.writeFileSync(srcFile, content, "utf8");
        watcher = watchSync.sync(".", destDir, { delete: true });
        watcher.on("ready", function() {
          watcher.on("unlink", function(filePath, destPath) {
            expect(filePath).equals("test.txt");
            expect(destPath).equals(path.join(destDir, "test.txt"));
            expect(function() {
              fs.statSync(path.join(destDir, "test.txt"));
            }).to.throw(Error);
            done();
          });
          fs.unlinkSync(srcFile);
        });
      });

      it("removes directories from dest with delete=true", function(done) {
        var src = path.join(srcDir, "testDir");
        fs.mkdirSync(src);
        watcher = watchSync.sync(".", destDir, { delete: true });
        watcher.on("ready", function() {
          watcher.on("unlinkDir", function(filePath, destPath) {
            expect(filePath).equals("testDir");
            expect(destPath).equals(path.join(destDir, "testDir"));
            expect(function() {
              fs.statSync(path.join(destDir, "testDir"));
            }).to.throw(Error);
            done();
          });
          fs.rmdirSync(src);
        });
      });

      it("does not remove files from dest with delete=false", function(done) {
        var srcFile = path.join(srcDir, "test.txt");
        fs.writeFileSync(srcFile, content, "utf8");
        watcher = watchSync.sync(".", destDir, { delete: false });
        watcher.on("ready", function() {
          watcher.on("unlink", function() {
            done(new Error("Received unlink event - should not have deleted file"));
          });
          fs.unlinkSync(srcFile);
          setTimeout(function() {
            var stat = fs.statSync(path.join(destDir, "test.txt"));
            expect(stat.isFile()).is.true;
            done();
          }, 500);
        });
      });

      it("does not remove directories with delete=false", function(done) {
        var src = path.join(srcDir, "testDir");
        fs.mkdirSync(src);
        watcher = watchSync.sync(".", destDir, { delete: false });
        watcher.on("ready", function() {
          watcher.on("unlinkDir", function(filePath, destPath) {
            done(new Error("Received unlinkDir event - should not have deleted file"));
          });
          fs.rmdirSync(src);
          setTimeout(function() {
            var stat = fs.statSync(path.join(destDir, "testDir"));
            expect(stat.isDirectory()).is.true;
            done();
          }, 500);
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

    it("does not allow globs with absolute directories", function() {
      expect(function() {
        watcher = watchSync.sync(path.resolve("."), destDir);
      }).to.throw(Error);
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
