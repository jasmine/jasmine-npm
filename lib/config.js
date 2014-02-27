var fs = require("fs"),
  path = require("path"),
  glob = require("glob");

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

module.exports = function(projectBaseDir) {
  var config = JSON.parse(fs.readFileSync(path.join(projectBaseDir, "spec/support/jasmine.json")));
  this.userFiles = function() {
    return getFiles(config.spec_dir, config.helper_files).concat(getFiles(config.spec_dir, config.spec_files));
  };
};
