var fs = require('fs'),
  path = require('path');

var Command = require('../lib/command');

var projectBaseDir = 'spec/fixtures/sample_empty_project/';
var spec = path.join(projectBaseDir, 'spec');

function deleteDirectory(dir) {
  if(fs.existsSync(dir)) {
    var dirFiles = fs.readdirSync(dir);
    dirFiles.forEach(function(file) {
      var fullPath = path.join(dir, file);
      if(fs.statSync(fullPath).isDirectory()) {
        deleteDirectory(fullPath);
      }
      else if(fs.statSync(fullPath).isFile()){
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

    this.fakeJasmine = jasmine.createSpyObj('jasmine', ['loadConfigFile', 'showColors', 'execute', 'stopSpecOnExpectationFailure']);
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
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'version']);
    });

    it('displays the version of jasmine', function() {
      var packageVersion = require('../package.json').version;
      expect(this.out.getOutput()).toContain('jasmine v' + packageVersion);
    });

    it('displays the version of jasmine-core', function() {
      var coreVersion = require('../node_modules/jasmine-core/package.json').version;
      expect(this.out.getOutput()).toContain('jasmine-core v' + coreVersion);
    });
  });

  describe('-v', function() {
    beforeEach(function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', '-v']);
    });

    it('displays the version of jasmine', function() {
      var packageVersion = require('../package.json').version;
      expect(this.out.getOutput()).toContain('jasmine v' + packageVersion);
    });

    it('displays the version of jasmine-core', function() {
      var coreVersion = require('../node_modules/jasmine-core/package.json').version;
      expect(this.out.getOutput()).toContain('jasmine-core v' + coreVersion);
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
      process.env.JASMINE_CONFIG_PATH = this.originalConfigPath;
    });

    it('should load the default config file', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
      expect(this.fakeJasmine.loadConfigFile).toHaveBeenCalledWith(undefined);
    });

    it('should load a custom config file', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'JASMINE_CONFIG_PATH=somewhere.json']);
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

    it('should execute the jasmine suite', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
      expect(this.fakeJasmine.execute).toHaveBeenCalled();
    });

    it('should be able to run only specified specs', function() {
      this.command.run(this.fakeJasmine, ['spec/some/fileSpec.js', 'SOME_ENV=SOME_VALUE', '--some-option']);
      expect(this.fakeJasmine.execute).toHaveBeenCalledWith(['spec/some/fileSpec.js'], undefined);
    });

    it('should be able filter by spec name', function() {
      this.command.run(this.fakeJasmine, ['--filter=interesting spec']);
      expect(this.fakeJasmine.execute).toHaveBeenCalledWith(jasmine.any(Array), 'interesting spec');
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
  });
});
