describe('exit', function () {
  var exit = require('../lib/exit');
  describe('when the platform is windows and the node version is v0.12.0 or lower', function () {
    it('exits with node-exit', function () {
      var nodeExitSpy = jasmine.createSpy('nodeExit');
      exit(0, 'win32', 'v0.10.0', null, nodeExitSpy);
      expect(nodeExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('when the platform is windows and the node version is v0.12.0 or greater', function () {
    it('exits with process.exit', function () {
      var exitSpy = jasmine.createSpy('exit');
      exit(0, 'win32', 'v0.12.0', exitSpy, null);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('when the platform is not windows', function () {
    it('exits with process.exit', function () {
      var exitSpy = jasmine.createSpy('exit');
      exit(0, 'darwin', 'v0.12.0', exitSpy, null);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });
});