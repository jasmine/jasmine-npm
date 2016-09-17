describe('CompletionReporter', function() {
  var CompletionReporter = require('../../lib/reporters/completion_reporter');

  beforeEach(function() {
    this.reporter = new CompletionReporter();
    this.onComplete = jasmine.createSpy('onComplete');
    this.reporter.onComplete(this.onComplete);
  });

  it('should report success with no specs', function() {
    this.reporter.jasmineDone();

    expect(this.onComplete).toHaveBeenCalledWith(true);
  });

  it('should report success with all successful specs', function() {
    this.reporter.specDone({status: 'passed'});
    this.reporter.specDone({status: 'pending'});

    this.reporter.jasmineDone();

    expect(this.onComplete).toHaveBeenCalledWith(true);
  });

  it('should report failure with any failing specs', function() {
    this.reporter.specDone({status: 'passed'});
    this.reporter.specDone({status: 'pending'});
    this.reporter.specDone({status: 'failed'});

    this.reporter.jasmineDone();

    expect(this.onComplete).toHaveBeenCalledWith(false);
  });

  it('should report success with all passing suites', function() {
    this.reporter.suiteDone({failedExpectations: []});
    this.reporter.suiteDone({});

    this.reporter.jasmineDone();

    expect(this.onComplete).toHaveBeenCalledWith(true);
  });

  it('should report failure with any failing suites', function() {
    this.reporter.suiteDone({failedExpectations: [{"some": 'stuff'}]});

    this.reporter.jasmineDone();

    expect(this.onComplete).toHaveBeenCalledWith(false);
  });

  it('should report failure with failures in jasmineDone', function() {
    this.reporter.jasmineDone({
      failedExpectations: ['foo']
    });

    expect(this.onComplete).toHaveBeenCalledWith(false);
  });

  it('should report success with empty failures in jasmineDone', function() {
    this.reporter.jasmineDone({
      failedExpectations: []
    });

    expect(this.onComplete).toHaveBeenCalledWith(true);
  });
});
