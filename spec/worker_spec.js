var noop = require("../lib/noop");

describe("worker", function() {
  it("should handle message correctly", function() {
    var fakeJasmine = jasmine.createSpyObj("fakeJasmine", ["onComplete"]),
        fakeNewJasmine = jasmine.createSpy("fakeNewJasmine").and.returnValue(fakeJasmine),
        fakeRunJasmine = jasmine.createSpy("fakeRunJasmine"),
        fakeRequire = {
          "./new": fakeNewJasmine,
          "./run": fakeRunJasmine
        },
        env = {};
    
    spyOn(require("module"), "_load").and.callFake(function() {
      if (fakeRequire[arguments[0]]) {
        return fakeRequire[arguments[0]];
      } else {
        return this._load.and.originalFn.apply(this, arguments);
      }
    });

    process.removeAllListeners("message");
    require("../lib/worker.js")();
    process.emit("message", env);

    expect(fakeNewJasmine).toHaveBeenCalled();
    expect(fakeJasmine.onComplete).toHaveBeenCalledWith(noop);
    expect(fakeRunJasmine).toHaveBeenCalledWith(fakeJasmine, env, console.log);
  });
});