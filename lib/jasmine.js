var path = require('path'),
    util = require('util'),
    glob = require('glob'),
    Promise = require('es6-promise').Promise;

module.exports = Jasmine;
module.exports.ConsoleReporter = require('./console_reporter');

function Jasmine(options) {
  options = options || {};
  var jasmineCore = options.jasmineCore || require('jasmine-core');
  this.jasmine = jasmineCore.boot(jasmineCore);
  this.projectBaseDir = options.projectBaseDir || path.resolve();
  this.specFiles = [];
  this.env = this.jasmine.getEnv();
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

  options.timer = new this.jasmine.Timer();
  options.print = options.print || util.print;
  options.showColors = options.hasOwnProperty('showColors') ? options.showColors : true;
  options.onComplete = options.onComplete || defaultOnComplete;

  var consoleReporter = new module.exports.ConsoleReporter(options);
  this.addReporter(consoleReporter);
};

Jasmine.prototype.addMatchers = function(matchers) {
  this.jasmine.Expectation.addMatchers(matchers);
};

Jasmine.prototype.loadSpecs = function() {
  var loader = require;

  if (this.loader) {
    loader = this.loader;
  }

  return loadFilesUsingLoader(loader, this.specFiles);
};

Jasmine.prototype.loadConfigFile = function(configFilePath) {
  var absoluteConfigFilePath = path.resolve(this.projectBaseDir, configFilePath || 'spec/support/jasmine.json');
  var config = require(absoluteConfigFilePath);
  this.loadConfig(config);
};

Jasmine.prototype.loadConfig = function(config) {
  this.specDir = config.spec_dir;

  if(config.helpers) {
    config.helpers.forEach(registerHelperFiles, this);
  }

  if(config.spec_files) {
    this.addSpecFiles(config.spec_files);
  }

  if (config.loader) {
    this.loader = require(path.join(this.projectBaseDir, config.loader));
  }
};

Jasmine.prototype.addSpecFiles = function(files) {
  var jasmineRunner = this;

  files.forEach(function(specFile) {
    var filePaths = glob.sync(path.join(jasmineRunner.projectBaseDir, jasmineRunner.specDir, specFile));
    filePaths.forEach(function(filePath) {
      if(jasmineRunner.specFiles.indexOf(filePath) === -1) {
        jasmineRunner.specFiles.push(filePath);
      }
    });
  });
};

Jasmine.prototype.execute = function(files) {
  if(this.reportersCount === 0) {
    this.configureDefaultReporter({});
  }

  if (files && files.length > 0) {
    this.specDir = '';
    this.specFiles = [];
    this.addSpecFiles(files);
  }

  this.loadSpecs()
    .then(function() {
      this.env.execute();
    }.bind(this))
    .catch(function(error) {
      console.error(error);
    });
};

/**
 * Registers helper files to be loaded along with spec files on execution.
 *
 * @param {string} helperFile - Helper file location or glob.
 */
function registerHelperFiles(helperFile) {
  var filePaths = glob.sync(path.join(this.projectBaseDir, this.specDir, helperFile));

  filePaths.forEach(function(filePath) {
    if(this.specFiles.indexOf(filePath) === -1) {
      this.specFiles.push(filePath);
    }
  }, this);
}

/**
 * Loads all spec and helper files into environment, in preparation for test execution.
 *
 * @param   {Function} loader - Function used to load files.
 * @param   {string[]} filesToLoad - Fully qualified file paths to load.
 * @returns {Promise} Promise that will resolve once all required files are loaded.
 */
function loadFilesUsingLoader(loader, filesToLoad) {
  var fileLoadingPromises = filesToLoad.map(function (filePath) {
    return loader(filePath);
  });

  return Promise.all(fileLoadingPromises);
}
