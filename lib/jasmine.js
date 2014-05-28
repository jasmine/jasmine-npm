var path = require('path'),
    util = require('util'),
    glob = require('glob'),
    jasmineCore = require('jasmine-core'),
    jasmine = jasmineCore.boot(jasmineCore);

module.exports = exports = Jasmine;

function Jasmine(options) {
  options = options || {};

  this.projectBaseDir = options.projectBaseDir || path.resolve();
  this.specFiles = [];
  this.env = jasmine.getEnv();
}

Jasmine.prototype.addSpecFile = function(filePath) {
  this.specFiles.push(filePath);
};

Jasmine.prototype.addReporter = function(reporter) {
  var defaultOnComplete = function(passed) {
    if(passed) {
      process.exit(0);
    }
    else {
      process.exit(1);
    }
  };

  reporter.timer = new jasmine.Timer();
  reporter.print = reporter.print || util.print;
  reporter.showColors = reporter.showColors || true;
  reporter.onComplete = reporter.onComplete || defaultOnComplete;

  var consoleReporter = new jasmine.ConsoleReporter(reporter);
  this.env.addReporter(consoleReporter);
};

Jasmine.prototype.addMatchers = function(matchers) {
  jasmine.Expectation.addMatchers(matchers);
};

Jasmine.prototype.loadSpecs = function() {
  this.specFiles.forEach(function(file) {
    require(file);
  });
};

Jasmine.prototype.loadConfigFile = function(configFilePath) {
  var config = require(path.join(this.projectBaseDir, configFilePath || 'spec/support/jasmine.json'));
  var specDir = config.spec_dir;
  var jasmineRunner = this;

  if(config.helpers) {
    config.helpers.forEach(function(helperFile) {
      var filePaths = glob.sync(path.join(specDir, helperFile));
      filePaths.forEach(function(filePath) {
        jasmineRunner.specFiles.push(path.join(jasmineRunner.projectBaseDir, filePath));
      });
    });
  }

  if(config.spec_files) {
    config.spec_files.forEach(function(specFile) {
      var filePaths = glob.sync(path.join(specDir, specFile));
      filePaths.forEach(function(filePath) {
        jasmineRunner.specFiles.push(path.join(jasmineRunner.projectBaseDir, filePath));
      });
    });
  }
};

Jasmine.prototype.execute = function() {
  this.loadSpecs();
  this.env.execute();
};
