var cluster = require("cluster"),
    runMasterJasmine = require("../lib/master"),
    noop = function(){};

describe("master", function() {
  beforeEach(function() {
    this.fakeRunJasmine = jasmine.createSpy("fakeRunJasmine");

    var fakeSend = this.fakeSend = jasmine.createSpy("fakeSend");
    spyOn(cluster, "fork").and.returnValue({
      send: fakeSend
    });
  });

  it("messege callback 'jasmineDone' should send for this first jasmineDone callback and kill for the second jasmineDone callback", function() {
    var fakeJasmine = jasmine.createSpyObj('jasmine', ["execute", "configureDefaultReporter", "addSpecFiles"]);

    fakeJasmine.specFiles = [
      "./master_spec.js",
      "./worker_spec.js"
    ];
    fakeJasmine.reporter = jasmine.createSpyObj('reporter', ['jasmineDone']);
    var fakeSend = jasmine.createSpy("fakeSend"),
        fakeKill = jasmine.createSpy("fakeKill"),
        env = { 
          workerCount: 1,
          files: []
        },
        allArgs = null;
    cluster.removeAllListeners("message");
    runMasterJasmine(fakeJasmine, env, noop, this.fakeRunJasmine);

    cluster.emit("message", { send: fakeSend, kill: fakeKill }, { kind: "jasmineDone" });
    expect(fakeJasmine.reporter.jasmineDone).not.toHaveBeenCalled();
    expect(fakeKill).not.toHaveBeenCalled();
    allArgs = (fakeSend.calls.allArgs());
    expect(allArgs[0][0].workerCount).toBe(env.workerCount);
    expect(allArgs[0][0].files[0]).toBe(fakeJasmine.specFiles[1]);
    expect(allArgs[0][0].seed).toBe(env.seed);

    cluster.emit("message", { send: fakeSend, kill: fakeKill }, { kind: "jasmineDone" });
    expect(fakeKill).toHaveBeenCalled();
    expect(fakeSend).toHaveBeenCalledTimes(1);
  });

  describe("reporter callback", function() {
    beforeEach(function() {
      cluster.removeAllListeners("message");
      cluster.removeAllListeners("exit");
    });

    it("'specStarted' should forward the payload directly", function() {
      var env = { workerCount: 1 },
          fakeJasmine = jasmine.createSpyObj('jasmine', ["execute", "configureDefaultReporter", "addSpecFiles"]);

      fakeJasmine.specFiles = [];
      fakeJasmine.reporter = jasmine.createSpyObj('reporter', ['specStarted']);
      runMasterJasmine(fakeJasmine, env, noop, this.fakeRunJasmine);

      var result = "jasmine";
      cluster.emit("message", { send: noop, kill: noop }, { kind: "specStarted", result: result });
      expect(fakeJasmine.reporter.specStarted).toHaveBeenCalledWith(result);
    });

    it("'specDone' should forward the payload directly", function() {
      var env = { workerCount: 1 },
          fakeJasmine = jasmine.createSpyObj('jasmine', ["execute", "configureDefaultReporter", "addSpecFiles"]);

      fakeJasmine.specFiles = [];
      fakeJasmine.reporter = jasmine.createSpyObj('reporter', ['specDone']);
      runMasterJasmine(fakeJasmine, env, noop, this.fakeRunJasmine);

      var result = "jasmine";
      cluster.emit("message", { send: noop, kill: noop }, { kind: "specDone", result: result });
      expect(fakeJasmine.reporter.specDone).toHaveBeenCalledWith(result);
    });

    it("'suiteStarted' should forward the payload directly", function() {
      var env = { workerCount: 1 },
          fakeJasmine = jasmine.createSpyObj('jasmine', ["execute", "configureDefaultReporter", "addSpecFiles"]);

      fakeJasmine.specFiles = [];
      fakeJasmine.reporter = jasmine.createSpyObj('reporter', ['suiteStarted']);
      runMasterJasmine(fakeJasmine, env, noop, this.fakeRunJasmine);

      var result = "jasmine";
      cluster.emit("message", { send: noop, kill: noop }, { kind: "suiteStarted", result: result });
      expect(fakeJasmine.reporter.suiteStarted).toHaveBeenCalledWith(result);
    });

    it("'suiteDone' should forward the payload directly", function() {
      var env = { workerCount: 1 },
          fakeJasmine = jasmine.createSpyObj('jasmine', ["execute", "configureDefaultReporter", "addSpecFiles"]);

      fakeJasmine.specFiles = [];
      fakeJasmine.reporter = jasmine.createSpyObj('reporter', ['suiteDone']);
      runMasterJasmine(fakeJasmine, env, noop, this.fakeRunJasmine);

      var result = "jasmine";
      cluster.emit("message", { send: noop, kill: noop }, { kind: "suiteDone", result: result });
      expect(fakeJasmine.reporter.suiteDone).toHaveBeenCalledWith(result);
    });

    it("'jasmineStarted' should call once", function() {
      var result = "passed",
          fakeJasmine = jasmine.createSpyObj('jasmine', ["execute", "configureDefaultReporter", "addSpecFiles"]);

      fakeJasmine.specFiles = [];
      fakeJasmine.reporter = jasmine.createSpyObj('reporter', ['jasmineStarted']);
      runMasterJasmine(fakeJasmine, {}, noop, this.fakeRunJasmine);

      cluster.emit("message", { send: noop, kill: noop }, { kind: "jasmineStarted", result: result });
      expect(fakeJasmine.reporter.jasmineStarted.toString()).toBe(noop.toString());

      expect(function () {
        cluster.emit("message", { send: noop, kill: noop }, { kind: "jasmineStarted", result: result });
      }).not.toThrow();
    });

    it("'jasmineDone' should not be forwarded", function() {
      var fakeJasmine = jasmine.createSpyObj('jasmine', ["execute", "configureDefaultReporter", "addSpecFiles"]);
      
      fakeJasmine.specFiles = [];
      fakeJasmine.reporter = jasmine.createSpyObj('reporter', ['jasmineDone']);
      runMasterJasmine(fakeJasmine, {}, noop, this.fakeRunJasmine);
  
      cluster.emit("message", { send: noop, kill: noop }, { kind: "jasmineDone", result: 1 });
      expect(fakeJasmine.reporter.jasmineDone).not.toHaveBeenCalled();

      cluster.emit("message", { send: noop, kill: noop }, { kind: "jasmineDone", result: 2 });
      expect(fakeJasmine.reporter.jasmineDone).not.toHaveBeenCalled();

      cluster.emit("exit");
      expect(fakeJasmine.reporter.jasmineDone).toHaveBeenCalledWith([1, 2]);
    });
  });

  it("should configure the env, jasmine and fork correctly", function() {
    var fakeJasmine = jasmine.createSpyObj('jasmine', ["execute", "configureDefaultReporter", "addSpecFiles"]),
        env = { 
          workerCount: 2,
          files: [],
        };
    
    fakeJasmine.specFiles = [];
    runMasterJasmine(fakeJasmine, env, noop, this.fakeRunJasmine);

    expect(this.fakeRunJasmine).toHaveBeenCalled();
    expect(fakeJasmine.configureDefaultReporter).toHaveBeenCalled();
    expect(this.fakeSend).toHaveBeenCalledTimes(env.workerCount);

    var allArgs = (this.fakeSend.calls.allArgs());
    expect(allArgs.length).toBe(env.workerCount);
    expect(allArgs[0][0].workerCount).toBe(env.workerCount);
    expect(allArgs[0][0].seed).toBe(env.seed);
    expect(allArgs[0][0].reporter).toBe("./reporters/worker_reporter.js");
    expect(allArgs[0][0].files[0]).toBe(fakeJasmine.specFiles[0]);

    expect(allArgs[1][0].workerCount).toBe(env.workerCount);
    expect(allArgs[1][0].seed).toBe(env.seed);
    expect(allArgs[1][0].reporter).toBe("./reporters/worker_reporter.js");
    expect(allArgs[1][0].files[0]).toBe(fakeJasmine.specFiles[1]);
  });
});