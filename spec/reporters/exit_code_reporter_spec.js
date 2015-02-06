describe('ExitCodeReporter', function() {
  var ExitCodeReporter = require('../../lib/reporters/exit_code_reporter');

  beforeEach(function() {
    this.reporter = new ExitCodeReporter();
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
});