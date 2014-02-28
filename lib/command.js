var path = require('path'),
  fs = require('fs');

module.exports = function(projectBaseDir, commands) {
  var jasmineStop = false;
  var jasmineJSON = JSON.stringify({
      "spec_dir": "spec",
      "spec_files": ["**/*.js"]
    }, null, '  ');

  if(commands.indexOf('init') !== -1) {
    fs.mkdirSync(path.join(projectBaseDir, "spec/"));
    fs.mkdirSync(path.join(projectBaseDir, "spec/", "support/"));
    fs.writeFileSync(path.join(projectBaseDir, "spec/", "support/", "jasmine.json"), jasmineJSON);
    jasmineStop = true;
  }

  this.jasmineStop = jasmineStop;
};
