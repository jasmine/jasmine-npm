describe("worker", function() {
  it("should handle message correctly", function() {
    var fakeRunJasmine = jasmine.createSpy("fakeRunJasmine"),
        fakeJasmine = jasmine.createSpyObj('jasmine', ["execute", "onComplete"]),
        env = {};

    process.removeAllListeners("message");
    require("../lib/worker.js")(fakeJasmine, fakeRunJasmine);
    process.emit("message", env);

    expect(fakeJasmine.execute).toHaveBeenCalled();
    expect(fakeJasmine.onComplete).toHaveBeenCalled();
    expect(fakeJasmine.onComplete.calls.allArgs()[0][0].toString()).toBe(function(){}.toString());
    expect(fakeRunJasmine).toHaveBeenCalledWith(fakeJasmine, env, console.log);
  });
});