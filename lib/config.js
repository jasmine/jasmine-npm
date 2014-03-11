var fs = require("fs"),
  path = require("path"),
  glob = require("glob");

module.exports = function(projectBaseDir) {
  var config = JSON.parse(fs.readFileSync(path.join(projectBaseDir, process.env.JASMINE_CONFIG_PATH || "spec/support/jasmine.json")));
  this.userFiles = function() {
    var files = getFiles(config.spec_dir, config.helpers).concat(getFiles(config.spec_dir, config.spec_files));
    return removeDuplicates(files);
  };
};

function getFiles(baseDir, patterns) {
  patterns = patterns || [];
  var files = [];
  patterns.forEach(function(pattern) {
    var filepaths = glob.sync(path.join(baseDir, pattern));
    filepaths.forEach(function(file) {
      files.push(path.resolve(file));
    });
  });
  return files;
}

function removeDuplicates(arr) {
  for (var i = arr.length - 1; i >= 0; i--) {
    var item = arr[i];
    if (i > arr.indexOf(item)) {
      arr = arr.slice(0, i).concat(arr.slice(i+1, arr.length));
    }
  }

  return arr;
}
