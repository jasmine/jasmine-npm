describe("ConsoleReporter", function() {
  var out,
    path = require('path'),
    ConsoleReporter = require('../lib/console_reporter'),
    jasmineCorePath = 'path/to/jasmine/core/jasmine.js';

  var fakeStack = ['foo' + jasmineCorePath,
    'bar ' + jasmineCorePath,
    'line of useful stack trace',
    'baz ' + jasmineCorePath].join('\n');

  beforeEach(function() {
    out = (function() {
      var output = "";
      return {
        print: function(str) {
          output += str;
        },
        getOutput: function() {
          return output;
        },
        clear: function() {
          output = "";
        }
      };
    }());
  });

  describe('when an onComplete function is passed in', function() {
    it('warns the user of deprecation', function() {
      spyOn(console, 'warn');
      new ConsoleReporter({
        onComplete: function () {}
      });

      expect(console.warn).toHaveBeenCalledWith('Passing in an onComplete function to the ConsoleReporter is deprecated.');
    });
  });

  it("reports that the suite has started to the console", function() {
    var reporter = new ConsoleReporter({
      print: out.print
    });

    reporter.jasmineStarted();

    expect(out.getOutput()).toEqual("Started\n");
  });

  it("starts the provided timer when jasmine starts", function() {
    var timerSpy = jasmine.createSpyObj('timer', ['start']),
        reporter = new ConsoleReporter({
          print: out.print,
          timer: timerSpy
        });

    reporter.jasmineStarted();

    expect(timerSpy.start).toHaveBeenCalled();
  });

  it("reports a passing spec as a dot", function() {
    var reporter = new ConsoleReporter({
      print: out.print
    });

    reporter.specDone({status: "passed"});

    expect(out.getOutput()).toEqual(".");
  });

  it("does not report a disabled spec", function() {
    var reporter = new ConsoleReporter({
      print: out.print
    });

    reporter.specDone({status: "disabled"});

    expect(out.getOutput()).toEqual("");
  });

  it("reports a failing spec as an 'F'", function() {
    var reporter = new ConsoleReporter({
      print: out.print
    });

    reporter.specDone({status: "failed"});

    expect(out.getOutput()).toEqual("F");
  });

  it("reports a pending spec as a '*'", function() {
    var reporter = new ConsoleReporter({
      print: out.print
    });

    reporter.specDone({status: "pending"});

    expect(out.getOutput()).toEqual("*");
  });

  it("alerts user if there are no specs", function(){
    var reporter = new ConsoleReporter({
          print: out.print
        });

    reporter.jasmineStarted();
    out.clear();
    reporter.jasmineDone();

    expect(out.getOutput()).toMatch(/No specs found/);
  });

  it("reports a summary when done (singular spec and time)", function() {
    var timerSpy = jasmine.createSpyObj('timer', ['start', 'elapsed']),
        reporter = new ConsoleReporter({
          print: out.print,
          timer: timerSpy
        });

    reporter.jasmineStarted();
    reporter.specDone({status: "passed"});

    timerSpy.elapsed.and.returnValue(1000);

    out.clear();
    reporter.jasmineDone();

    expect(out.getOutput()).toMatch(/1 spec, 0 failures/);
    expect(out.getOutput()).not.toMatch(/0 pending specs/);
    expect(out.getOutput()).toMatch("Finished in 1 second\n");
  });

  it("reports a summary when done (pluralized specs and seconds)", function() {
    var timerSpy = jasmine.createSpyObj('timer', ['start', 'elapsed']),
        reporter = new ConsoleReporter({
          print: out.print,
          timer: timerSpy
        });

    reporter.jasmineStarted();
    reporter.specDone({status: "passed"});
    reporter.specDone({status: "pending"});
    reporter.specDone({
      status: "failed",
      description: "with a failing spec",
      fullName: "A suite with a failing spec",
      failedExpectations: [
        {
          passed: false,
          message: "Expected true to be false.",
          expected: false,
          actual: true,
          stack: fakeStack
        }
      ]
    });

    out.clear();

    timerSpy.elapsed.and.returnValue(100);

    reporter.jasmineDone();

    expect(out.getOutput()).toMatch(/3 specs, 1 failure, 1 pending spec/);
    expect(out.getOutput()).toMatch("Finished in 0.1 seconds\n");
  });

  it("reports a summary when done that includes the failed spec number before the full name of a failing spec", function() {
    var reporter = new ConsoleReporter({
      print: out.print,
      jasmineCorePath: jasmineCorePath
    });

    reporter.jasmineStarted();
    reporter.specDone({status: "passed"});
    reporter.specDone({
      status: "failed",
      description: "with a failing spec",
      fullName: "A suite with a failing spec",
      failedExpectations: [
        {
          passed: false,
          message: "Expected true to be false.",
          expected: false,
          actual: true,
          stack: fakeStack
        }
      ]
    });

    out.clear();

    reporter.jasmineDone();

    expect(out.getOutput()).toMatch(/1\) A suite with a failing spec/);
  });

  it("reports a summary when done that includes stack traces without jasmine internals for a failing suite", function() {
    var reporter = new ConsoleReporter({
      print: out.print,
      jasmineCorePath: jasmineCorePath
    });

    reporter.jasmineStarted();
    reporter.specDone({status: "passed"});
    reporter.specDone({
      status: "failed",
      description: "with a failing spec",
      fullName: "A suite with a failing spec",
      failedExpectations: [
        {
          passed: false,
          message: "Expected true to be false.",
          expected: false,
          actual: true,
          stack: fakeStack
        }
      ]
    });

    out.clear();

    reporter.jasmineDone();

    expect(out.getOutput()).toMatch(/true to be false/);
    expect(out.getOutput()).toMatch(/line of useful stack trace/);
    expect(out.getOutput()).not.toMatch(jasmineCorePath);
  });

  it("reports a summary when done that includes which specs are pending and their reasons", function() {
    var reporter = new ConsoleReporter({
      print: out.print,
      jasmineCorePath: jasmineCorePath
    });

    reporter.jasmineStarted();

    reporter.specDone({
      status: "pending",
      description: "with a pending spec",
      fullName: "A suite with a pending spec",
      pendingReason: "It's not ready yet!"
    });

    out.clear();

    reporter.jasmineDone();

    expect(out.getOutput()).toContain("A suite with a pending spec");
    expect(out.getOutput()).toContain("It's not ready yet!");
  });

  describe('onComplete callback', function(){
    var onComplete, reporter;

    beforeEach(function() {
      spyOn(console, 'warn');
      onComplete = jasmine.createSpy('onComplete');
      reporter = new ConsoleReporter({
        print: out.print,
        onComplete: onComplete
      });
      reporter.jasmineStarted();
    });

    it("is called when the suite is done", function() {
      reporter.jasmineDone();
      expect(onComplete).toHaveBeenCalledWith(true);
    });

    it('calls it with false if there are spec failures', function() {
      reporter.specDone({status: "failed", failedExpectations: []});
      reporter.jasmineDone();
      expect(onComplete).toHaveBeenCalledWith(false);
    });

    it('calls it with false if there are suite failures', function() {
      reporter.specDone({status: "passed"});
      reporter.suiteDone({failedExpectations: [{ message: 'bananas' }] });
      reporter.jasmineDone();
      expect(onComplete).toHaveBeenCalledWith(false);
    });
  });

  describe("with color", function() {
    it("reports that the suite has started to the console", function() {
      var reporter = new ConsoleReporter({
        print: out.print,
        showColors: true
      });

      reporter.jasmineStarted();

      expect(out.getOutput()).toEqual("Started\n");
    });

    it("reports a passing spec as a dot", function() {
      var reporter = new ConsoleReporter({
        print: out.print,
        showColors: true
      });

      reporter.specDone({status: "passed"});

      expect(out.getOutput()).toEqual("\x1B[32m.\x1B[0m");
    });

    it("does not report a disabled spec", function() {
      var reporter = new ConsoleReporter({
        print: out.print,
        showColors: true
      });

      reporter.specDone({status: 'disabled'});

      expect(out.getOutput()).toEqual("");
    });

    it("reports a failing spec as an 'F'", function() {
      var reporter = new ConsoleReporter({
        print: out.print,
        showColors: true
      });

      reporter.specDone({status: 'failed'});

      expect(out.getOutput()).toEqual("\x1B[31mF\x1B[0m");
    });

    it("displays all afterAll exceptions", function() {
        var reporter = new ConsoleReporter({
          print: out.print,
          showColors: true
        });

        reporter.suiteDone({ failedExpectations: [{ message: 'After All Exception' }] });
        reporter.suiteDone({ failedExpectations: [{ message: 'Some Other Exception' }] });
        reporter.jasmineDone();

        expect(out.getOutput()).toMatch(/After All Exception/);
        expect(out.getOutput()).toMatch(/Some Other Exception/);
    });
  });
});
