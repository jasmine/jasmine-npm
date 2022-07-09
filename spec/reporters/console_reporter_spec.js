const ConsoleReporter = require('../../lib/reporters/console_reporter');

describe("ConsoleReporter", function() {
  beforeEach(function() {
    this.out = (function() {
      let output = "";
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
    const reporter = new ConsoleReporter();

    reporter.setOptions({
      print: this.out.print
    });

    reporter.jasmineStarted();

    expect(this.out.getOutput()).toEqual("Started\n");
  });

  describe("When order information is passed to jasmineStarted", function() {
    it("reports the seed number when randomized", function() {
      const reporter = new ConsoleReporter();
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
      const reporter = new ConsoleReporter();
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
    const reporter = new ConsoleReporter();

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
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print
    });

    reporter.specDone({status: "passed"});

    expect(this.out.getOutput()).toEqual(".");
  });

  it("does not report a disabled spec", function() {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print
    });

    reporter.specDone({status: "disabled"});

    expect(this.out.getOutput()).toEqual("");
  });

  it("reports a failing spec as an 'F'", function() {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print
    });

    reporter.specDone({status: "failed"});

    expect(this.out.getOutput()).toEqual("F");
  });

  it("reports a pending spec as a '*'", function() {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print
    });

    reporter.specDone({status: "pending"});

    expect(this.out.getOutput()).toEqual("*");
  });

  it("alerts user if there are no specs", function() {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print
    });

    reporter.jasmineStarted();
    this.out.clear();
    reporter.jasmineDone({});

    expect(this.out.getOutput()).toMatch(/No specs found/);
  });

  it("reports the seed number when running in random order", function() {
    const reporter = new ConsoleReporter();
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

  it("allows the seed reproduction command to be overridden", function() {
    const reporter = new ConsoleReporter("jasmine-some-other-tool");
    reporter.setOptions({
      print: this.out.print,
      randomSeedReproductionCmd: function(seed) {
        return `jasmine-some-other-tool --randomSeed=${seed}`;
      }
    });

    reporter.jasmineDone({
      order: {
        random: true,
        seed: '12345'
      }
    });

    expect(this.out.getOutput()).toMatch(/Randomized with seed 12345 \(jasmine-some-other-tool --randomSeed=12345\)/);
  });

  it("reports a summary when done (singular spec and time)", function() {
    const reporter = new ConsoleReporter();
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
    const reporter = new ConsoleReporter();
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
          stack: ''
        }
      ],
      passedExpectations: []
    });

    this.out.clear();

    reporter.jasmineDone({ totalTime: 100 });

    expect(this.out.getOutput()).toMatch(/3 specs, 1 failure, 1 pending spec/);
    expect(this.out.getOutput()).toMatch("Finished in 0.1 seconds\n");
  });

  it('counts failures that are reported in the jasmineDone event', function() {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
    });

    reporter.jasmineStarted();
    reporter.specDone({
      status: "failed",
      description: "with a failing spec",
      fullName: "with a failing spec",
      failedExpectations: [
        {
          message: "Expected true to be false.",
        }
      ],
      passedExpectations: []
    });

    this.out.clear();

    reporter.jasmineDone({
      totalTime: 100,
      failedExpectations: [
        {
          message: "Expected true to be false.",
        },
        {
          message: "Expected true to be false.",
        }
      ],
    });

    expect(this.out.getOutput()).toMatch(/1 spec, 3 failures/);
  });

  it("reports a summary when done that indicates the number of specs run (when it's less that the full number of specs)", function() {
    const reporter = new ConsoleReporter();
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
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
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
          stack: ''
        }
      ],
      passedExpectations: []
    });

    this.out.clear();

    reporter.jasmineDone({});

    expect(this.out.getOutput()).toMatch(/1\) A suite with a failing spec/);
  });

  it("reports a summary when done that includes stack traces for a failing suite", function() {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print
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
          stack: 'line 1\nline 2'
        }
      ],
      passedExpectations: []
    });

    this.out.clear();

    reporter.jasmineDone({});

    expect(this.out.getOutput()).toMatch(/true to be false/);
    expect(this.out.getOutput()).toMatch(/line 1/);
    expect(this.out.getOutput()).toMatch(/line 2/);
  });

  it("reports a summary when done in case that stack is somehow undefined", function() {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
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
      ],
      passedExpectations: []
    });

    this.out.clear();

    reporter.jasmineDone({});

    expect(this.out.getOutput()).toMatch(/true to be false/);
  });

  it("reports a summary when done that includes custom filtered stack traces for a failing suite", function() {
    const stackLine = 'custom line of stack';
    const customStackFilter = function(stack) {
      return stackLine;
    };
    const reporter = new ConsoleReporter();
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
          stack: 'the original stack trace'
        }
      ],
      passedExpectations: []
    });

    this.out.clear();

    reporter.jasmineDone({});

    expect(this.out.getOutput()).toMatch(/true to be false/);
    expect(this.out.getOutput()).toMatch(stackLine);
  });

  describe('When the overall status is passed', function() {
    it('includes pending specs in the summary even if alwaysListPendingSpecs is false', function() {
      const reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print,
        alwaysListPendingSpecs: false
      });

      reporter.jasmineStarted();

      reporter.specDone({
        status: "pending",
        description: "with a pending spec",
        fullName: "A suite with a pending spec",
        pendingReason: "It's not ready yet!"
      });

      this.out.clear();

      reporter.jasmineDone({overallStatus: 'passed'});

      expect(this.out.getOutput()).toContain("Pending:");
      expect(this.out.getOutput()).toContain("A suite with a pending spec");
      expect(this.out.getOutput()).toContain("It's not ready yet!");
    });
  });

  describe('When the overall status is failed', function() {
    it('includes pending specs in the summary when alwaysListPendingSpecs is true', function() {
      const reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print,
        alwaysListPendingSpecs: true
      });

      reporter.jasmineStarted();

      reporter.specDone({
        status: "pending",
        description: "with a pending spec",
        fullName: "A suite with a pending spec",
        pendingReason: "It's not ready yet!"
      });

      this.out.clear();

      reporter.jasmineDone({overallStatus: 'failed'});

      expect(this.out.getOutput()).toContain("Pending:");
      expect(this.out.getOutput()).toContain("A suite with a pending spec");
      expect(this.out.getOutput()).toContain("It's not ready yet!");
    });

    it('omits pending specs in the summary when alwaysListPendingSpecs is false', function() {
      const reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print,
        alwaysListPendingSpecs: false
      });

      reporter.jasmineStarted();

      reporter.specDone({
        status: "pending",
        description: "with a pending spec",
        fullName: "A suite with a pending spec",
        pendingReason: "It's not ready yet!"
      });

      this.out.clear();

      reporter.jasmineDone({overallStatus: 'failed'});

      expect(this.out.getOutput()).not.toContain("Pending:");
      expect(this.out.getOutput()).not.toContain("A suite with a pending spec");
      expect(this.out.getOutput()).not.toContain("It's not ready yet!");
    });

    it('includes pending specs in the summary when alwaysListPendingSpecs is unspecified', function() {
      const reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print,
      });

      reporter.jasmineStarted();

      reporter.specDone({
        status: "pending",
        description: "with a pending spec",
        fullName: "A suite with a pending spec",
        pendingReason: "It's not ready yet!"
      });

      this.out.clear();

      reporter.jasmineDone({overallStatus: 'failed'});

      expect(this.out.getOutput()).toContain("Pending:");
      expect(this.out.getOutput()).toContain("A suite with a pending spec");
      expect(this.out.getOutput()).toContain("It's not ready yet!");
    });
  });

  it("reports a summary when done that includes the reason for an incomplete suite", function() {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
    });

    reporter.jasmineStarted();

    this.out.clear();

    reporter.jasmineDone({
      overallStatus: "incomplete",
      incompleteReason: "not all bars were frobnicated"
    });

    expect(this.out.getOutput()).toContain("Incomplete: not all bars were frobnicated");
  });

  it("reports a summary when done that shows info for a failed spec with no expectations", function() {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
    });

    reporter.jasmineStarted();
    reporter.specDone({status: "passed"});
    reporter.specDone({
      status: "failed",
      description: "with a failing spec",
      fullName: "A suite with a failing spec that has no expectations",
      failedExpectations: [],
      passedExpectations: []
    });

    this.out.clear();

    reporter.jasmineDone({});

    expect(this.out.getOutput()).toContain("Spec has no expectations");
  });

  it('reports a summary without "no expectations" message for a spec having failed expectations', function () {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
    });

    reporter.jasmineStarted();
    reporter.specDone({
      status: "failed",
      description: "with a failing spec",
      fullName: "A suite with a failing spec that has a failing expectation",
      failedExpectations: [{
        passed: false,
        message: "Expected true to be false.",
        expected: false,
        actual: true,
        stack: undefined
      }],
      passedExpectations: []
    });

    this.out.clear();

    reporter.jasmineDone({});

    expect(this.out.getOutput()).not.toContain("Spec has no expectations");
  });

  it('reports a summary with debug log info for a failed spec with debug logs', function() {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
    });

    reporter.jasmineStarted();
    reporter.specDone({
      status: "failed",
      description: "with a failing spec",
      fullName: "A suite with a failing spec that has a trace",
      failedExpectations: [],
      passedExpectations: [],
      debugLogs: [
        {timestamp: 1, message: 'msg 1'},
        {timestamp: 100, message: 'msg 2'},
      ]
    });
    reporter.jasmineDone({});

    expect(this.out.getOutput()).toContain('  Debug logs:\n    1ms: msg 1\n    100ms: msg 2');
  });

  it('reports a summary without a "no expectations" message for a spec having passed expectations', function () {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
    });

    reporter.jasmineStarted();
    reporter.specDone({
      status: "passed",
      description: "with a passed spec",
      fullName: "A suite with a passed spec",
      passedExpectations: [{
        passed: true,
        message: "Expected true to be true.",
        expected: true,
        actual: true
      }]
    });
    reporter.specDone({
      status: "failed",
      description: "with a failing spec",
      fullName: "A suite with a failing spec that has both passed and failing expectations",
      failedExpectations: [],
      passedExpectations: [{
        passed: true,
        message: "Expected true to be true.",
        expected: true,
        actual: true
      }]
    });

    this.out.clear();

    reporter.jasmineDone({});

    expect(this.out.getOutput()).not.toContain("Spec has no expectations");
  });

  it("displays all afterAll exceptions", function() {
    const reporter = new ConsoleReporter();
    reporter.setOptions({
      print: this.out.print,
      showColors: false
    });

    reporter.suiteDone({
      fullName: 'suite 1',
      failedExpectations: [{ message: 'After All Exception' }]
    });
    reporter.suiteDone({
      fullName: 'suite 2',
      failedExpectations: [{ message: 'Some Other Exception' }]
    });
    reporter.jasmineDone({ failedExpectations: [{ message: 'Global Exception' }] });

    expect(this.out.getOutput()).toMatch(/Suite error: suite 1\s+Message:\s+After All Exception/);
    expect(this.out.getOutput()).toMatch(/Suite error: suite 2\s+Message:\s+Some Other Exception/);
    expect(this.out.getOutput()).toMatch(/Suite error: top suite\s+Message:\s+Global Exception/);
  });

  describe("with color", function() {
    it("reports that the suite has started to the console", function() {
      const reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print,
        showColors: true
      });

      reporter.jasmineStarted();

      expect(this.out.getOutput()).toEqual("Started\n");
    });

    it("reports a passing spec as a dot", function() {
      const reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print,
        showColors: true
      });

      reporter.specDone({status: "passed"});

      expect(this.out.getOutput()).toEqual("\x1B[32m.\x1B[0m");
    });

    it("does not report a disabled spec", function() {
      const reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print,
        showColors: true
      });

      reporter.specDone({status: 'disabled'});

      expect(this.out.getOutput()).toEqual("");
    });

    it("reports a failing spec as an 'F'", function() {
      const reporter = new ConsoleReporter();
      reporter.setOptions({
        print: this.out.print,
        showColors: true
      });

      reporter.specDone({status: 'failed'});

      expect(this.out.getOutput()).toEqual("\x1B[31mF\x1B[0m");
    });
  });
});
