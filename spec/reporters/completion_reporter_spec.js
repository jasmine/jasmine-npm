describe('CompletionReporter', function() {
  var CompletionReporter = require('../../lib/reporters/completion_reporter');

  beforeEach(function() {
    this.reporter = new CompletionReporter();
    this.onComplete = jasmine.createSpy('onComplete');
    this.reporter.onComplete(this.onComplete);
    this.processOn = spyOn(process, 'on').and.callThrough();
    this.processOff = spyOn(process, 'off').and.callThrough();
  });

  describe('When the overall status is "passed"', function() {
    it('calls the completion callback with true', function() {
      this.reporter.jasmineDone({overallStatus: 'passed'});
      expect(this.onComplete).toHaveBeenCalledWith(true);
    });
  });

  describe('When the overall status is anything else', function() {
    it('calls the completion callback with false', function() {
      this.reporter.jasmineDone({overallStatus: 'incomplete'});
      expect(this.onComplete).toHaveBeenCalledWith(false);
    });
  });

  describe('When jasmine is started and done', function() {
    it('adds and removes the exit handler', function() {
      this.reporter.exitHandler = function() {};
      this.reporter.jasmineStarted();
      this.reporter.jasmineDone({overallStatus: 'passed'});
      expect(this.processOn).toHaveBeenCalledWith('exit', this.reporter.exitHandler);
      expect(this.processOff).toHaveBeenCalledWith('exit', this.reporter.exitHandler);
    });

    it('ignores the exit event if there is no exit handler', function() {
      this.reporter.jasmineStarted();
      this.reporter.jasmineDone({overallStatus: 'passed'});
      expect(this.processOn).toHaveBeenCalledTimes(0);
      expect(this.processOff).toHaveBeenCalledTimes(0);
    });
  });
});
