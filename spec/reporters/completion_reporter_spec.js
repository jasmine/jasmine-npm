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
});
