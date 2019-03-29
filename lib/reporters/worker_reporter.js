var kinds = ['jasmineStarted', 'jasmineDone', 'specStarted', 'specDone', 'suiteStarted', 'suiteDone'];

function WorkerReporter() {
  var self = this;
  kinds.forEach(function(kind) {
    self[kind] = function(result) {
      process.send({
        kind: kind,
        result: result
      });
    };
  });
}

module.exports = exports = WorkerReporter;
