var exit = require('exit');

module.exports = function() {
  var results = true;
  var onCompleteCallback = function() {};
  var completed = false;
  this.exit = exit;

  this.onComplete = function(callback) {
    onCompleteCallback = callback;
  };

  this.jasmineStarted = function() {
    if (!onCompleteCallback) {
      onCompleteCallback = this.defaultOnCompleteCallback;
    }
    process.on('exit', this.exitHandler);
  };

  this.jasmineDone = function(result) {
    completed = true;
    process.removeListener('exit', this.exitHandler);
    onCompleteCallback(result.overallStatus === 'passed');
  };

  this.isComplete = function() {
    return completed;
  };

  this.specDone = function(result) {
    if(result.status === 'failed') {
      results = false;
    }
  };

  this.suiteDone = function(result) {
    if (result.failedExpectations && result.failedExpectations.length > 0) {
      results = false;
    }
  };

  var reporter = this;
  this.defaultOnCompleteCallback = function(passed) {
    if(passed) {
      reporter.exit(0, process.platform, process.version, process.exit, require('exit'));
    }
    else {
      reporter.exit(1, process.platform, process.version, process.exit, require('exit'));
    }
  };

  this.exitHandler = function() {
    if (!this.isComplete()) {
      process.exitCode = 4;
    }
  };

};
