var path = require("path");
var Runner = require("../src/runner");

describe("runner", function() {
  var runner, print, config, env, done;

  beforeEach(function() {
    print = jasmine.createSpy("printSpy");
    config = jasmine.createSpyObj("jasmineConfig", ["userFiles"]);
    env = jasmine.createSpyObj("fakeJasmineEnv", ["addReporter", "execute"]);
    done = jasmine.createSpy("doneCallback");

    config.userFiles.and.callFake(function() {
      return [path.resolve("spec/fixtures/sample_project/spec/fixture_spec.js")];
    });

    runner = new Runner(print, config, env, done);
  });

  it("requires the user files", function() {
    expect(require.cache[path.resolve("spec/fixtures/sample_project/spec/fixture_spec.js")]).toBeDefined();
  });

  it("adds a console reporter", function() {
    var reporter = env.addReporter.calls.first().args[0];
    expect(reporter instanceof jasmine.ConsoleReporter).toBe(true);

    reporter.jasmineStarted();
    reporter.jasmineDone();

    expect(done).toHaveBeenCalled();
    expect(print).toHaveBeenCalledWith("0 specs, 0 failures");
  });
});
