describe('ExitCodeReporter', function() {
  var ExitCodeReporter = require('../lib/exit_code_reporter');
  var reporter, onComplete;

  beforeEach(function() {
    reporter = new ExitCodeReporter();
    onComplete = jasmine.createSpy('onComplete');
    reporter.onComplete(onComplete);
  });

  it('should report success with no specs', function() {
    reporter.jasmineDone();

    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('should report success with all successful specs', function() {
    reporter.specDone({status: 'passed'});
    reporter.specDone({status: 'pending'});

    reporter.jasmineDone();

    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('should report failure with any failing specs', function() {
    reporter.specDone({status: 'passed'});
    reporter.specDone({status: 'pending'});
    reporter.specDone({status: 'failed'});

    reporter.jasmineDone();

    expect(onComplete).toHaveBeenCalledWith(false);
  });

  it('should report success with all passing suites', function() {
    reporter.suiteDone({failedExpectations: []});
    reporter.suiteDone({});

    reporter.jasmineDone();

    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('should report failure with any failing suites', function() {
    reporter.suiteDone({failedExpectations: [{"some": 'stuff'}]});

    reporter.jasmineDone();

    expect(onComplete).toHaveBeenCalledWith(false);
  });
});