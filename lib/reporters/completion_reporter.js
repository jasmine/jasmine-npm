module.exports = function() {
  var onCompleteCallback = function() {};
  var completed = false;

  this.onComplete = function(callback) {
    onCompleteCallback = callback;
  };

  this.jasmineDone = function(result) {
    completed = true;
    onCompleteCallback(result.overallStatus === 'passed');
  };

  this.isComplete = function() {
    return completed;
  };
};
