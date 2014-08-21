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
  this.reportersCount = 0;
}

Jasmine.prototype.addSpecFile = function(filePath) {
  this.specFiles.push(filePath);
};

Jasmine.prototype.addReporter = function(reporter) {
  this.env.addReporter(reporter);
  this.reportersCount++;
};

Jasmine.prototype.configureDefaultReporter = function(options) {
  var defaultOnComplete = function(passed) {
    if(passed) {
      process.exit(0);
    }
    else {
      process.exit(1);
    }
  };

  options.timer = new jasmine.Timer();
  options.print = options.print || util.print;
  options.showColors = options.hasOwnProperty('showColors') ? options.showColors : true;
  options.onComplete = options.onComplete || defaultOnComplete;

  var consoleReporter = new jasmine.ConsoleReporter(options);
  this.addReporter(consoleReporter);
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
  var absoluteConfigFilePath = path.resolve(this.projectBaseDir, configFilePath || 'spec/support/jasmine.json');
  var config = require(absoluteConfigFilePath);
  var specDir = config.spec_dir;
  var jasmineRunner = this;

  if(config.helpers) {
    config.helpers.forEach(function(helperFile) {
      var filePaths = glob.sync(path.join(jasmineRunner.projectBaseDir, specDir, helperFile));
      filePaths.forEach(function(filePath) {
        if(jasmineRunner.specFiles.indexOf(filePath) === -1) {
          jasmineRunner.specFiles.push(filePath);
        }
      });
    });
  }

  if(config.spec_files) {
    config.spec_files.forEach(function(specFile) {
      var filePaths = glob.sync(path.join(jasmineRunner.projectBaseDir, specDir, specFile));
      filePaths.forEach(function(filePath) {
        if(jasmineRunner.specFiles.indexOf(filePath) === -1) {
          jasmineRunner.specFiles.push(filePath);
        }
      });
    });
  }
};

Jasmine.prototype.execute = function() {
  if(this.reportersCount === 0) {
    this.configureDefaultReporter({});
  }
  this.loadSpecs();
  this.env.execute();
};
