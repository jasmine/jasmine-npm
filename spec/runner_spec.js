var path = require("path");
var Runner = require("../src/runner");

describe("runner", function() {
  var runner, print, config, env, done, flags;

  beforeEach(function() {
    print = jasmine.createSpy("printSpy");
    config = jasmine.createSpyObj("jasmineConfig", ["specFiles"]);
    env = jasmine.createSpyObj("fakeJasmineEnv", ["addReporter", "execute"]);
    done = jasmine.createSpy("doneCallback");
    flags = [];

    config.specFiles.and.callFake(function() {
      return [path.resolve("spec/fixtures/sample_project/spec/fixture_spec.js")];
    });

    runner = new Runner(print, config, env, done, flags);
  });

  it("requires the user files", function() {
    expect(require.cache[path.resolve("spec/fixtures/sample_project/spec/fixture_spec.js")]).toBeDefined();
  });

  it("adds a console reporter", function() {
    var reporter = env.addReporter.calls.first().args[0];
    expect(reporter instanceof jasmine.ConsoleReporter).toBe(true);

    spyOn(jasmine, "ConsoleReporter");
    runner = new Runner(print, config, env, done, flags);

    expect(jasmine.ConsoleReporter).toHaveBeenCalledWith({
      print: print,
      onComplete: done,
      showColors: true,
      timer: jasmine.any(jasmine.Timer)
    });
  });

  describe("with a --no-color flag", function() {
    it("doesn't print in color", function() {
      spyOn(jasmine, "ConsoleReporter");
      flags = ["", "", "--no-color"];
      runner = new Runner(print, config, env, done, flags);

      expect(jasmine.ConsoleReporter).toHaveBeenCalledWith({
        print: print,
        onComplete: done,
        showColors: false,
        timer: jasmine.any(jasmine.Timer)
      });
    });
  });
});
