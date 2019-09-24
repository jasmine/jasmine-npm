var WorkerReporter = require('../../lib/reporters/worker_reporter');

describe("WorkerReporter", function() {
  beforeEach(function() {
    this.reporter = new WorkerReporter();
    process.send = this.fakeSend = jasmine.createSpy("fakeSend");
  });

  afterEach(function() {
    delete process.send;
  });

  it("should register all callback ''jasmineStarted', 'jasmineDone', 'specStarted', 'specDone', 'suiteStarted', 'suiteDone'", function() {
    ['jasmineStarted', 'jasmineDone', 'specStarted', 'specDone', 'suiteStarted', 'suiteDone'].forEach(function(kind) {
      expect(this.reporter[kind]).toBeDefined();
    }.bind(this));
  });

  it("should send the right payload", function() {
    ['jasmineStarted', 'jasmineDone', 'specStarted', 'specDone', 'suiteStarted', 'suiteDone'].forEach(function(kind) {
      this.reporter[kind]({});
      expect(this.fakeSend).toHaveBeenCalledWith({ kind: kind, result: {}});
    }.bind(this));
  });
});