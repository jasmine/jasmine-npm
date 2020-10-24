var fs = require('fs'),
  path = require('path');

var Command = require('../lib/command');

var projectBaseDir = 'spec/fixtures/sample_empty_project/';
var spec = path.join(projectBaseDir, 'spec');

function deleteDirectory(dir) {
  if (fs.existsSync(dir)) {
    var dirFiles = fs.readdirSync(dir);
    dirFiles.forEach(function(file) {
      var fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        deleteDirectory(fullPath);
      }
      else if (fs.statSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
      }
    });
    fs.rmdirSync(dir);
  }
}

describe('command', function() {
  beforeEach(function() {
    var examplesDir = path.resolve(path.join(__dirname, 'fixtures', 'example'));

    fs.mkdirSync(projectBaseDir);

    this.out = (function() {
      var output = "";
      return {
        print: function(str) {
          output += str;
        },
        getOutput: function() {
          return output;
        }
      };
    }());

    this.command = new Command(projectBaseDir, examplesDir, this.out.print);

    this.fakeJasmine = jasmine.createSpyObj('jasmine', ['loadConfigFile', 'addHelperFiles', 'addRequires', 'showColors', 'execute', 'stopSpecOnExpectationFailure',
      'stopOnSpecFailure', 'randomizeTests', 'seed', 'coreVersion', 'clearReporters', 'addReporter']);
    this.fakeJasmine.execute.and.returnValue(Promise.resolve());
  });

  afterEach(function() {
    deleteDirectory(projectBaseDir);
  });

  describe('passing in environment variables', function() {
    beforeEach(function () {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'TESTKEY=TESTVALUE']);
    });

    afterEach(function() {
      delete process.env.TESTKEY;
    });

    it('should run with those environment variables', function() {
      expect(process.env.TESTKEY).toBe('TESTVALUE');
    });
  });

  describe('init', function() {
    beforeEach(function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'init']);
    });

    it('creates setup folders and files for specs', function() {
      expect(fs.existsSync(path.join(spec, 'support/', 'jasmine.json'))).toBe(true);
    });

    it('writes default settings to jasmine.json', function() {
      var realJson = fs.readFileSync(path.join(spec, 'support/', 'jasmine.json'), 'utf-8');
      var fixtureJson = fs.readFileSync(path.join(__dirname, '../', 'lib/', 'examples/', 'jasmine.json'), 'utf-8');
      expect(realJson).toEqual(fixtureJson);
    });
  });

  describe('version', function() {
    beforeEach(function() {
      this.fakeJasmine.coreVersion.and.returnValue('fake core version');
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'version']);
    });

    it('displays the version of jasmine', function() {
      var packageVersion = require('../package.json').version;
      expect(this.out.getOutput()).toContain('jasmine v' + packageVersion);
    });

    it('displays the version of jasmine-core', function() {
      expect(this.out.getOutput()).toContain('jasmine-core vfake core version');
    });
  });

  describe('-v', function() {
    beforeEach(function() {
      this.fakeJasmine.coreVersion.and.returnValue('fake core version');
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', '-v']);
    });

    it('displays the version of jasmine', function() {
      var packageVersion = require('../package.json').version;
      expect(this.out.getOutput()).toContain('jasmine v' + packageVersion);
    });

    it('displays the version of jasmine-core', function() {
      expect(this.out.getOutput()).toContain('jasmine-core vfake core version');
    });
  });

  describe('passing unknown options', function() {
    beforeEach(function() {
      this.exitCode = process.exitCode;
    });

    afterEach(function() {
      process.exitCode = this.exitCode;
    });

    it('displays unknown options and usage', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', '--some-option', '--no-color', '--another-option']);
      expect(this.out.getOutput()).toContain('Unknown options: --some-option, --another-option');
      expect(this.out.getOutput()).toContain('Usage');
      expect(process.exitCode).toBe(1);
    });
  });

  describe('--', function() {
    it('skips anything after it', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', '--', '--no-color']);
      expect(this.out.getOutput()).toBe('');
      expect(this.fakeJasmine.showColors).toHaveBeenCalledWith(true);
    });
  });

  describe('examples', function() {
    beforeEach(function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'examples']);
    });

    it('should create init files if they do not exist', function() {
      expect(fs.existsSync(path.join(spec, 'jasmine_examples'))).toBe(true);
      expect(fs.existsSync(path.join(projectBaseDir, 'lib', 'jasmine_examples'))).toBe(true);
      expect(fs.existsSync(path.join(spec, 'helpers', 'jasmine_examples'))).toBe(true);
    });

    it('should copy files into the appropriate folder', function() {
      expect(fs.existsSync(path.join(projectBaseDir, 'lib', 'jasmine_examples', 'Foo.js'))).toBe(true);
      expect(fs.existsSync(path.join(projectBaseDir, 'lib', 'jasmine_examples', 'Bar.js'))).toBe(true);
      expect(fs.existsSync(path.join(spec, 'jasmine_examples', 'FooSpec.js'))).toBe(true);
      expect(fs.existsSync(path.join(spec, 'helpers', 'jasmine_examples', 'SpecHelper.js'))).toBe(true);
    });
  });

  describe('running specs', function() {
    var withValueForIsTTY = function(value, func) {
      var wasTTY = process.stdout.isTTY;
      try {
        process.stdout.isTTY = value;
        func();
      } finally {
        process.stdout.isTTY = wasTTY;
      }
    };

    beforeEach(function() {
      this.originalConfigPath = process.env.JASMINE_CONFIG_PATH;
    });

    afterEach(function() {
      if (this.originalConfigPath) {
        process.env.JASMINE_CONFIG_PATH = this.originalConfigPath;
      } else {
        delete process.env.JASMINE_CONFIG_PATH;
      }
    });

    it('should load the default config file', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
      expect(this.fakeJasmine.loadConfigFile).toHaveBeenCalledWith(undefined);
    });

    it('should load a custom config file specified by env variable', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'JASMINE_CONFIG_PATH=somewhere.json']);
      expect(this.fakeJasmine.loadConfigFile).toHaveBeenCalledWith('somewhere.json');
    });

    it('should load a custom config file specified by option', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', '--config=somewhere.json']);
      expect(this.fakeJasmine.loadConfigFile).toHaveBeenCalledWith('somewhere.json');
    });

    it('should show colors by default if stdout is a TTY', function() {
      withValueForIsTTY(true, function () {
        this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
        expect(this.fakeJasmine.showColors).toHaveBeenCalledWith(true);
      }.bind(this));
    });

    it('should not show colors by default if stdout is not a TTY', function() {
      withValueForIsTTY(undefined, function () {
        this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
        expect(this.fakeJasmine.showColors).toHaveBeenCalledWith(false);
      }.bind(this));
    });

    it('should allow colors to be turned off', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', '--no-color']);
      expect(this.fakeJasmine.showColors).toHaveBeenCalledWith(false);
    });

    it('should be able to force colors to be turned on', function() {
      withValueForIsTTY(undefined, function () {
        this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', '--color']);
        expect(this.fakeJasmine.showColors).toHaveBeenCalledWith(true);
      }.bind(this));
    });

    it('should execute the jasmine suite', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
      expect(this.fakeJasmine.execute).toHaveBeenCalled();
    });

    it('should be able to run only specified specs', function() {
      this.command.run(this.fakeJasmine, ['spec/some/fileSpec.js', 'SOME_ENV=SOME_VALUE', '--no-color']);
      expect(this.fakeJasmine.execute).toHaveBeenCalledWith(['spec/some/fileSpec.js'], undefined);
    });

    it('should be able filter by spec name', function() {
      this.command.run(this.fakeJasmine, ['--filter=interesting spec']);
      expect(this.fakeJasmine.execute).toHaveBeenCalledWith(jasmine.any(Array), 'interesting spec');
    });

    it('should be able to add one helper pattern', function() {
      this.command.run(this.fakeJasmine, ['--helper=helpers/**/*.js']);
      expect(this.fakeJasmine.addHelperFiles).toHaveBeenCalledWith(['helpers/**/*.js']);
    });

    it('should be able to add many helper patterns', function() {
      this.command.run(this.fakeJasmine, ['--helper=helpers/**/*.js', '--helper=other.js']);
      expect(this.fakeJasmine.addHelperFiles).toHaveBeenCalledWith(['helpers/**/*.js', 'other.js']);
    });

    it('should not modify helper patterns if no argument given', function() {
      this.command.run(this.fakeJasmine, []);
      expect(this.fakeJasmine.addHelperFiles).not.toHaveBeenCalled();
    });

    it('should be able to add one require', function() {
      this.command.run(this.fakeJasmine, ['--require=ts-node/require']);
      expect(this.fakeJasmine.addRequires).toHaveBeenCalledWith(['ts-node/require']);
    });

    it('should be able to add multiple requires', function() {
      this.command.run(this.fakeJasmine, ['--require=ts-node/require', '--require=@babel/register']);
      expect(this.fakeJasmine.addRequires).toHaveBeenCalledWith(['ts-node/require', '@babel/register']);
    });

    it('can specify a reporter', function() {
      var reporterPath = path.resolve(path.join(__dirname, 'fixtures', 'customReporter.js'));
      var Reporter = require(reporterPath);
      this.command.run(this.fakeJasmine, ['--reporter=' + reporterPath]);
      expect(this.fakeJasmine.clearReporters).toHaveBeenCalled();
      expect(this.fakeJasmine.addReporter).toHaveBeenCalledWith(jasmine.any(Reporter));
    });

    it('prints an error if the file does not export a reporter', function() {
      var reporterPath = path.resolve(path.join(__dirname, 'fixtures', 'badReporter.js'));
      this.command.run(this.fakeJasmine, ['--reporter=' + reporterPath]);
      expect(this.fakeJasmine.clearReporters).not.toHaveBeenCalled();
      expect(this.fakeJasmine.addReporter).not.toHaveBeenCalled();
      expect(this.out.getOutput()).toContain('failed to register reporter');
    });

    it('prints an error if the reporter file does not exist', function() {
      var reporterPath = path.resolve(path.join(__dirname, 'fixtures', 'missingReporter.js'));
      this.command.run(this.fakeJasmine, ['--reporter=' + reporterPath]);
      expect(this.fakeJasmine.clearReporters).not.toHaveBeenCalled();
      expect(this.fakeJasmine.addReporter).not.toHaveBeenCalled();
      expect(this.out.getOutput()).toContain('failed to register reporter');
    });

    it('should not configure stopping spec on expectation failure by default', function() {
      this.command.run(this.fakeJasmine, []);
      expect(this.fakeJasmine.stopSpecOnExpectationFailure).not.toHaveBeenCalled();
    });

    it('should be able to turn on stopping spec on expectation failure', function() {
      this.command.run(this.fakeJasmine, ['--stop-on-failure=true']);
      expect(this.fakeJasmine.stopSpecOnExpectationFailure).toHaveBeenCalledWith(true);
    });

    it('should be able to turn off stopping spec on expectation failure', function() {
      this.command.run(this.fakeJasmine, ['--stop-on-failure=false']);
      expect(this.fakeJasmine.stopSpecOnExpectationFailure).toHaveBeenCalledWith(false);
    });

    it('should not configure fail fast by default', function() {
      this.command.run(this.fakeJasmine, []);
      expect(this.fakeJasmine.stopOnSpecFailure).not.toHaveBeenCalled();
    });

    it('should be able to turn on fail fast', function() {
      this.command.run(this.fakeJasmine, ['--fail-fast=true']);
      expect(this.fakeJasmine.stopOnSpecFailure).toHaveBeenCalledWith(true);
    });

    it('should be able to turn off fail fast', function() {
      this.command.run(this.fakeJasmine, ['--fail-fast=false']);
      expect(this.fakeJasmine.stopOnSpecFailure).toHaveBeenCalledWith(false);
    });

    it('uses jasmine-core defaults if random is unspecified', function() {
      this.command.run(this.fakeJasmine, []);
      expect(this.fakeJasmine.randomizeTests).not.toHaveBeenCalled();
    });

    it('should be able to turn on random tests', function() {
      this.command.run(this.fakeJasmine, ['--random=true']);
      expect(this.fakeJasmine.randomizeTests).toHaveBeenCalledWith(true);
    });

    it('should be able to turn off random tests', function() {
      this.command.run(this.fakeJasmine, ['--random=false']);
      expect(this.fakeJasmine.randomizeTests).toHaveBeenCalledWith(false);
    });

    it('should not configure seed by default', function() {
      this.command.run(this.fakeJasmine, []);
      expect(this.fakeJasmine.seed).not.toHaveBeenCalled();
    });

    it('should be able to set a seed', function() {
      this.command.run(this.fakeJasmine, ['--seed=12345']);
      expect(this.fakeJasmine.seed).toHaveBeenCalledWith('12345');
    });
  });
});
