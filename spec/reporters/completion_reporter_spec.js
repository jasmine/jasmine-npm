describe('CompletionReporter', function() {
  var CompletionReporter = require('../../lib/reporters/completion_reporter');

  beforeEach(function() {
    this.reporter = new CompletionReporter();
    this.onComplete = jasmine.createSpy('onComplete');
    this.reporter.onComplete(this.onComplete);
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

  describe('when exit is called prematurely', function() {
    beforeEach(function() {
      this.originalCode = process.exitCode;
    });

    afterEach(function() {
      process.exitCode = this.originalCode;
    });

    it('sets the exit code to failure', function() {
      this.reporter.exitHandler();
      expect(process.exitCode).toEqual(4);
    });

    it('leaves it unset if the suite has completed', function() {
      this.reporter.jasmineDone({overallStatus: 'passed'});
      this.reporter.exitHandler();
      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('default completion behavior', function() {
    it('exits successfully when the whole suite is green', function() {
      var exitSpy = jasmine.createSpy('exit');
      this.reporter.exit = exitSpy;

      this.reporter.defaultOnCompleteCallback(true);
      expect(exitSpy).toHaveBeenCalledWith(0, process.platform, process.version, process.exit, require('exit'));
    });

    it('exits with a failure when anything in the suite is not green', function() {
      var exitSpy = jasmine.createSpy('exit');
      this.reporter.exit = exitSpy;

      this.reporter.defaultOnCompleteCallback(false);
      expect(exitSpy).toHaveBeenCalledWith(1, process.platform, process.version, process.exit, require('exit'));
    });
  });

  describe('process exit listeners', function() {
    it('adds and removes a process exit listener', function() {
      var onSpy = spyOn(process, 'on').and.callThrough();
      var removeListenerSpy = spyOn(process, 'removeListener').and.callThrough();

      this.reporter.jasmineStarted();
      this.reporter.jasmineDone({overallStatus: 'passed'});
      expect(onSpy).toHaveBeenCalledWith('exit', this.reporter.exitHandler);
      expect(removeListenerSpy).toHaveBeenCalledWith('exit', this.reporter.exitHandler);
    });
  });

});
