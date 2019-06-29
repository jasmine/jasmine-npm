describe("ConsoleReporter", function() {
  var path = require('path'),
      ConsoleReporter = require('../../lib/reporters/console_reporter'),
      jasmineCorePath = 'path/to/jasmine/core/jasmine.js';

  var fakeStack = ['foo' + jasmineCorePath,
    'bar ' + jasmineCorePath,
    'line of useful stack trace',
    'baz ' + jasmineCorePath].join('\n');

  beforeEach(function() {
    this.out = (function() {
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

  it("reports that the suite has started to the console", function() {
    var reporter = new ConsoleReporter();

    reporter.setOptions({
      print: this.out.print
    });

    reporter.jasmineStarted();

    expect(this.out.getOutput()).toEqual("Started\n");
  });

  describe("When order information is passed to jasmineStarted", function() {
    it("reports the seed number when randomized", function() {
      var reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print
      });

      reporter.jasmineStarted({
        order: {
          random: true,
          seed: '12345'
        }
      });

      expect(this.out.getOutput()).toMatch(/Randomized with seed 12345/);
    });

    it("does not report order info when not randomized", function() {
      var reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print
      });

      reporter.jasmineStarted({
        order: {
          random: false
        }
      });

      expect(this.out.getOutput()).not.toMatch(/Randomized/);
    });
  });

  it("setOptions should not override existing options if set multiple times", function() {
    var reporter = new ConsoleReporter();

    reporter.setOptions({
      print: this.out.print,
      showColors: false
    });

    reporter.jasmineStarted();
    expect(this.out.getOutput()).toEqual("Started\n");

    // clean up this.out.output
    this.out.clear();
    expect(this.out.getOutput()).toEqual("");

    // set options that does not include print, should still print with this.out.print
    reporter.setOptions({
      showColors: true
    });

    reporter.jasmineStarted();
    expect(this.out.getOutput()).toEqual("Started\n");
  });

  it("reports a passing spec as a dot", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print
    });

    reporter.specDone({status: "passed"});

    expect(this.out.getOutput()).toEqual(".");
  });

  it("does not report a disabled spec", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print
    });

    reporter.specDone({status: "disabled"});

    expect(this.out.getOutput()).toEqual("");
  });

  it("reports a failing spec as an 'F'", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print
    });

    reporter.specDone({status: "failed"});

    expect(this.out.getOutput()).toEqual("F");
  });

  it("reports a pending spec as a '*'", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print
    });

    reporter.specDone({status: "pending"});

    expect(this.out.getOutput()).toEqual("*");
  });

  it("alerts user if there are no specs", function(){
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print
    });

    reporter.jasmineStarted();
    this.out.clear();
    reporter.jasmineDone();

    expect(this.out.getOutput()).toMatch(/No specs found/);
  });

  it("reports the seed number when running in random order", function(){
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print
    });

    reporter.jasmineDone({
      order: {
        random: true,
        seed: '12345'
      }
    });

    expect(this.out.getOutput()).toMatch(/Randomized with seed 12345 \(jasmine --random=true --seed=12345\)/);
  });

  it("reports a summary when done (singular spec and time)", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
    });

    reporter.jasmineStarted();
    reporter.specDone({status: "passed"});

    this.out.clear();
    reporter.jasmineDone({ totalTime: 1000 });

    expect(this.out.getOutput()).not.toMatch(/Ran 1/);
    expect(this.out.getOutput()).toMatch(/1 spec, 0 failures/);
    expect(this.out.getOutput()).not.toMatch(/0 pending specs/);
    expect(this.out.getOutput()).toMatch("Finished in 1 second\n");
  });

  it("reports a summary when done (pluralized specs and seconds)", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
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

    this.out.clear();

    reporter.jasmineDone({ totalTime: 100 });

    expect(this.out.getOutput()).toMatch(/3 specs, 1 failure, 1 pending spec/);
    expect(this.out.getOutput()).toMatch("Finished in 0.1 seconds\n");
  });

  it("reports a summary when done that indicates the number of specs run (when it's less that the full number of specs)", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
    });

    reporter.jasmineStarted();
    reporter.specDone({status: "passed"});
    reporter.specDone({status: "disabled"});

    this.out.clear();
    reporter.jasmineDone({ totalTime: 1000 });

    expect(this.out.getOutput()).toMatch(/Ran 1 of 2 specs/);
    expect(this.out.getOutput()).toMatch(/1 spec, 0 failures/);
  });

  it("reports a summary when done that includes the failed spec number before the full name of a failing spec", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
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

    this.out.clear();

    reporter.jasmineDone();

    expect(this.out.getOutput()).toMatch(/1\) A suite with a failing spec/);
  });

  it("reports a summary when done that includes stack traces without jasmine internals for a failing suite", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
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

    this.out.clear();

    reporter.jasmineDone();

    expect(this.out.getOutput()).toMatch(/true to be false/);
    expect(this.out.getOutput()).toMatch(/line of useful stack trace/);
    expect(this.out.getOutput()).not.toMatch(jasmineCorePath);
  });

  it("reports a summary when done in case that stack is somehow undefined", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
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
          stack: undefined
        }
      ]
    });

    this.out.clear();

    reporter.jasmineDone();

    expect(this.out.getOutput()).toMatch(/true to be false/);
  });

  it("reports a summary when done that includes custom filtered stack traces for a failing suite", function() {
    var stackLine = 'custom line of stack';
    var customStackFilter = function(stack) {
      return stackLine;
    };
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
      stackFilter: customStackFilter
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

    this.out.clear();

    reporter.jasmineDone();

    expect(this.out.getOutput()).toMatch(/true to be false/);
    expect(this.out.getOutput()).toMatch(stackLine);
  });

  it("reports a summary when done that includes which specs are pending and their reasons", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
      jasmineCorePath: jasmineCorePath
    });

    reporter.jasmineStarted();

    reporter.specDone({
      status: "pending",
      description: "with a pending spec",
      fullName: "A suite with a pending spec",
      pendingReason: "It's not ready yet!"
    });

    this.out.clear();

    reporter.jasmineDone();

    expect(this.out.getOutput()).toContain("A suite with a pending spec");
    expect(this.out.getOutput()).toContain("It's not ready yet!");
  });

  it("reports a summary when done that includes the reason for an incomplete suite", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
      jasmineCorePath: jasmineCorePath
    });

    reporter.jasmineStarted();

    this.out.clear();

    reporter.jasmineDone({
      overallStatus: "incomplete",
      incompleteReason: "not all bars were frobnicated"
    });

    expect(this.out.getOutput()).toContain("Incomplete: not all bars were frobnicated");
  });

  it("displays all afterAll exceptions", function() {
    var reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
      showColors: true
    });

    reporter.suiteDone({ failedExpectations: [{ message: 'After All Exception' }] });
    reporter.suiteDone({ failedExpectations: [{ message: 'Some Other Exception' }] });
    reporter.jasmineDone({ failedExpectations: [{ message: 'Global Exception' }] });

    expect(this.out.getOutput()).toMatch(/After All Exception/);
    expect(this.out.getOutput()).toMatch(/Some Other Exception/);
    expect(this.out.getOutput()).toMatch(/Global Exception/);
  });

  describe("with color", function() {
    it("reports that the suite has started to the console", function() {
      var reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print,
        showColors: true
      });

      reporter.jasmineStarted();

      expect(this.out.getOutput()).toEqual("Started\n");
    });

    it("reports a passing spec as a dot", function() {
      var reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print,
        showColors: true
      });

      reporter.specDone({status: "passed"});

      expect(this.out.getOutput()).toEqual("\x1B[32m.\x1B[0m");
    });

    it("does not report a disabled spec", function() {
      var reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print,
        showColors: true
      });

      reporter.specDone({status: 'disabled'});

      expect(this.out.getOutput()).toEqual("");
    });

    it("reports a failing spec as an 'F'", function() {
      var reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print,
        showColors: true
      });

      reporter.specDone({status: 'failed'});

      expect(this.out.getOutput()).toEqual("\x1B[31mF\x1B[0m");
    });
  });
});
