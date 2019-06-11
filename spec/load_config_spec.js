describe('loadConfig', function() {
  var path = require('path'),
      loadConfig = require('../lib/loadConfig');

  it('should configure the jasmine object based on env and call execute', function() {
    var fakeJasmine = jasmine.createSpyObj('jasmine', ['loadConfigFile', 'addHelperFiles', 'addRequires', 'showColors', 'execute', 'stopSpecOnExpectationFailure',
      'stopOnSpecFailure', 'randomizeTests', 'seed', 'coreVersion', 'clearReporters', 'addReporter']),
        env = {
          configPath: 'somewhere.json',
          stopOnFailure: true,
          failFast: true,
          seed: 12345,
          random: true,
          helpers: 'helpers/**/*.js',
          requires: 'requires/**/*.js',
          reporter: path.resolve(path.join(__dirname, 'fixtures', 'customReporter.js')),
          color: true,
          files: 'specs/**/*.spec.js',
          filter: 'filter'
        };
    loadConfig(fakeJasmine, env, console.log);

    expect(fakeJasmine.loadConfigFile).toHaveBeenCalledWith(env.configPath);
    expect(fakeJasmine.stopSpecOnExpectationFailure).toHaveBeenCalledWith(env.stopOnFailure);
    expect(fakeJasmine.stopOnSpecFailure).toHaveBeenCalledWith(env.failFast);
    expect(fakeJasmine.seed).toHaveBeenCalledWith(env.seed);
    expect(fakeJasmine.randomizeTests).toHaveBeenCalledWith(env.random);
    expect(fakeJasmine.addHelperFiles).toHaveBeenCalledWith(env.helpers);
    expect(fakeJasmine.addRequires).toHaveBeenCalledWith(env.requires);
    expect(fakeJasmine.clearReporters).toHaveBeenCalled();
    expect(fakeJasmine.addReporter).toHaveBeenCalled();
    expect(fakeJasmine.showColors).toHaveBeenCalledWith(env.color);
    expect(fakeJasmine.execute).toHaveBeenCalledWith(env.files, env.filter);
  });

  it('should not configure the jasmine object when env is an empty object and call execute', function() {
    var fakeJasmine = jasmine.createSpyObj('jasmine', ['loadConfigFile', 'addHelperFiles', 'addRequires', 'showColors', 'execute', 'stopSpecOnExpectationFailure',
      'stopOnSpecFailure', 'randomizeTests', 'seed', 'coreVersion', 'clearReporters', 'addReporter']),
        env = {};
    loadConfig(fakeJasmine, env, console.log);

    expect(fakeJasmine.loadConfigFile).toHaveBeenCalled();
    expect(fakeJasmine.stopSpecOnExpectationFailure).not.toHaveBeenCalled();
    expect(fakeJasmine.stopOnSpecFailure).not.toHaveBeenCalled();
    expect(fakeJasmine.seed).not.toHaveBeenCalled();
    expect(fakeJasmine.randomizeTests).not.toHaveBeenCalled();
    expect(fakeJasmine.addHelperFiles).not.toHaveBeenCalled();
    expect(fakeJasmine.addRequires).not.toHaveBeenCalled();
    expect(fakeJasmine.clearReporters).not.toHaveBeenCalled();
    expect(fakeJasmine.addReporter).not.toHaveBeenCalled();
    expect(fakeJasmine.showColors).toHaveBeenCalled();
    expect(fakeJasmine.execute).toHaveBeenCalled();
  });
});