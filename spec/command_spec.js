const fs = require('fs');
const path = require('path');
const Command = require('../lib/command');
const Loader = require("../lib/loader");

const projectBaseDir = 'spec/fixtures/sample_empty_project/';
const spec = path.join(projectBaseDir, 'spec');

function deleteDirectory(dir) {
  if (fs.existsSync(dir)) {
    const dirFiles = fs.readdirSync(dir);
    dirFiles.forEach(function(file) {
      const fullPath = path.join(dir, file);
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

async function withValueForIsTTY(value, func) {
  const wasTTY = process.stdout.isTTY;
  try {
    process.stdout.isTTY = value;
    await func();
  } finally {
    process.stdout.isTTY = wasTTY;
  }
}


describe('command', function() {
  beforeEach(function() {
    const examplesDir = path.resolve(path.join(__dirname, 'fixtures', 'example'));

    fs.mkdirSync(projectBaseDir);

    this.out = (function() {
      let output = "";
      return {
        print: function(str) {
          output += str;
        },
        getOutput: function() {
          return output;
        }
      };
    }());

    this.command = new Command(projectBaseDir, examplesDir, {
      print: this.out.print,
      platform: () => 'Oberon'
    });

    this.fakeJasmine = jasmine.createSpyObj('jasmine', ['loadConfigFile', 'addMatchingHelperFiles', 'addRequires', 'showColors', 'execute',
      'randomizeTests', 'seed', 'coreVersion', 'clearReporters', 'addReporter']);
    this.fakeJasmine.loader = new Loader();
    this.fakeJasmine.env = jasmine.createSpyObj('env', ['configure']);
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
      const realJson = fs.readFileSync(path.join(spec, 'support/', 'jasmine.json'), 'utf-8');
      const fixtureJson = fs.readFileSync(path.join(__dirname, '../', 'lib/', 'examples/', 'jasmine.json'), 'utf-8');
      expect(realJson).toEqual(fixtureJson);
    });
  });

  describe('version', function() {
    beforeEach(function() {
      this.fakeJasmine.coreVersion.and.returnValue('fake core version');
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'version']);
    });

    it('displays the version of jasmine', function() {
      const packageVersion = require('../package.json').version;
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
      const packageVersion = require('../package.json').version;
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
    it('skips anything after it', async function() {
      await withValueForIsTTY(true, async function () {
        await this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', '--', '--no-color']);
        expect(this.out.getOutput()).toBe('');
        expect(this.fakeJasmine.showColors).toHaveBeenCalledWith(true);
      }.bind(this));
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

    it('should load the default config file', async function() {
      await this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
      expect(this.fakeJasmine.loadConfigFile).toHaveBeenCalledWith(undefined);
    });

    it('should load a custom config file specified by env variable', async function() {
      await this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'JASMINE_CONFIG_PATH=somewhere.json']);
      expect(this.fakeJasmine.loadConfigFile).toHaveBeenCalledWith('somewhere.json');
    });

    it('should load a custom config file specified by option', async function() {
      await this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', '--config=somewhere.json']);
      expect(this.fakeJasmine.loadConfigFile).toHaveBeenCalledWith('somewhere.json');
    });

    it('should show colors by default if stdout is a TTY', async function() {
      await withValueForIsTTY(true, async function () {
        await this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
        expect(this.fakeJasmine.showColors).toHaveBeenCalledWith(true);
      }.bind(this));
    });

    it('should not show colors by default if stdout is not a TTY', async function() {
      await withValueForIsTTY(undefined, async function () {
        await this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
        expect(this.fakeJasmine.showColors).toHaveBeenCalledWith(false);
      }.bind(this));
    });

    it('should allow colors to be turned off', async function() {
      await this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', '--no-color']);
      expect(this.fakeJasmine.showColors).toHaveBeenCalledWith(false);
    });

    it('should be able to force colors to be turned on', async function() {
      await withValueForIsTTY(undefined, async function () {
        await this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', '--color']);
        expect(this.fakeJasmine.showColors).toHaveBeenCalledWith(true);
      }.bind(this));
    });

    it('should execute the jasmine suite', async function() {
      await this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
      expect(this.fakeJasmine.execute).toHaveBeenCalled();
    });

    it('should be able to run only specified specs', async function() {
      await this.command.run(this.fakeJasmine, ['spec/some/fileSpec.js', 'SOME_ENV=SOME_VALUE', '--no-color']);
      expect(this.fakeJasmine.execute).toHaveBeenCalledWith(['spec/some/fileSpec.js'], undefined);
    });

    it('should be able filter by spec name', async function() {
      await this.command.run(this.fakeJasmine, ['--filter=interesting spec']);
      expect(this.fakeJasmine.execute).toHaveBeenCalledWith(jasmine.any(Array), 'interesting spec');
    });

    it('should be able to add one helper pattern', async function() {
      await this.command.run(this.fakeJasmine, ['--helper=helpers/**/*.js']);
      expect(this.fakeJasmine.addMatchingHelperFiles).toHaveBeenCalledWith(['helpers/**/*.js']);
    });

    it('should be able to add many helper patterns', async function() {
      await this.command.run(this.fakeJasmine, ['--helper=helpers/**/*.js', '--helper=other.js']);
      expect(this.fakeJasmine.addMatchingHelperFiles).toHaveBeenCalledWith(['helpers/**/*.js', 'other.js']);
    });

    it('should not modify helper patterns if no argument given', async function() {
      await this.command.run(this.fakeJasmine, []);
      expect(this.fakeJasmine.addMatchingHelperFiles).not.toHaveBeenCalled();
    });

    it('should be able to add one require', async function() {
      await this.command.run(this.fakeJasmine, ['--require=ts-node/require']);
      expect(this.fakeJasmine.addRequires).toHaveBeenCalledWith(['ts-node/require']);
    });

    it('should be able to add multiple requires', async function() {
      await this.command.run(this.fakeJasmine, ['--require=ts-node/require', '--require=@babel/register']);
      expect(this.fakeJasmine.addRequires).toHaveBeenCalledWith(['ts-node/require', '@babel/register']);
    });

    it('can specify a reporter', async function() {
      const reporterPath = path.resolve(path.join(__dirname, 'fixtures', 'customReporter.js'));
      const Reporter = require(reporterPath);
      await this.command.run(this.fakeJasmine, ['--reporter=' + reporterPath]);
      expect(this.fakeJasmine.clearReporters).toHaveBeenCalled();
      expect(this.fakeJasmine.addReporter).toHaveBeenCalledWith(jasmine.any(Reporter));
    });

    it('uses the provided loader to load reporters', async function() {
      const reporterPath = path.resolve(path.join(__dirname, 'fixtures', 'customReporter.js'));
      spyOn(this.fakeJasmine.loader, 'load').and.callThrough();

      await this.command.run(this.fakeJasmine, ['--reporter=' + reporterPath]);

      expect(this.fakeJasmine.loader.load).toHaveBeenCalledWith(reporterPath);
    });

    it('can specify a reporter that is an ES module', async function() {
      await this.command.run(this.fakeJasmine, ['--reporter=./spec/fixtures/customReporter.mjs']);
      expect(this.fakeJasmine.clearReporters).toHaveBeenCalled();
      expect(this.fakeJasmine.addReporter.calls.argsFor(0)[0].isCustomReporterDotMjs).toBe(true);
    });

    describe('When the reporter path is relative', function() {
      beforeEach(function() {
        this.originalWd = process.cwd();
      });

      afterEach(function() {
        process.chdir(this.originalWd);
      });

      it('evaluates the path based on the cwd', async function() {
        const Reporter = require('./fixtures/customReporter.js');
        process.chdir('spec/fixtures');
        await this.command.run(this.fakeJasmine, ['--reporter=./customReporter.js']);
        expect(this.fakeJasmine.clearReporters).toHaveBeenCalled();
        expect(this.fakeJasmine.addReporter).toHaveBeenCalledWith(jasmine.any(Reporter));

        this.fakeJasmine.clearReporters.calls.reset();
        this.fakeJasmine.addReporter.calls.reset();
        process.chdir('example');
        await this.command.run(this.fakeJasmine, ['--reporter=../customReporter.js']);
        expect(this.fakeJasmine.clearReporters).toHaveBeenCalled();
        expect(this.fakeJasmine.addReporter).toHaveBeenCalledWith(jasmine.any(Reporter));
      });
    });

    it('throws with context if the file does not export a reporter', async function() {
      const reporterPath = path.resolve(path.join(__dirname, 'fixtures', 'badReporter.js'));
      await expectAsync(
        this.command.run(this.fakeJasmine, ['--reporter=' + reporterPath])
      ).toBeRejectedWithError(new RegExp(
        'Failed to instantiate reporter from ' +
        escapeStringForRegexp(reporterPath) + '\nUnderlying error: .' +
        '*Reporter is not a constructor'
      ));
      expect(this.fakeJasmine.clearReporters).not.toHaveBeenCalled();
      expect(this.fakeJasmine.addReporter).not.toHaveBeenCalled();
    });

    it('throws with context if the reporter file does not exist', async function() {
      const reporterPath = path.resolve(path.join(__dirname, 'fixtures', 'missingReporter.js'));

      await expectAsync(
        this.command.run(this.fakeJasmine, ['--reporter=' + reporterPath])
      ).toBeRejectedWithError(new RegExp(
        'Failed to load reporter module ' +
          escapeStringForRegexp(reporterPath) + '\nUnderlying error: ' +
        '.*Cannot find module'
      ));

      expect(this.fakeJasmine.clearReporters).not.toHaveBeenCalled();
      expect(this.fakeJasmine.addReporter).not.toHaveBeenCalled();
    });

    it('should not configure fail fast by default', async function() {
      await this.command.run(this.fakeJasmine, []);
      expect(this.fakeJasmine.env.configure).not.toHaveBeenCalledWith(jasmine.objectContaining({
        stopOnSpecFailure: jasmine.anything()
      }));
      expect(this.fakeJasmine.env.configure).not.toHaveBeenCalledWith(jasmine.objectContaining({
        stopSpecOnExpectationFailure: jasmine.anything()
      }));
    });

    it('should be able to turn on fail fast', async function() {
      await this.command.run(this.fakeJasmine, ['--fail-fast']);
      expect(this.fakeJasmine.env.configure).toHaveBeenCalledWith({
        stopOnSpecFailure: true,
        stopSpecOnExpectationFailure: true
      });
    });
    
    it('uses jasmine-core defaults if random is unspecified', async function() {
      await this.command.run(this.fakeJasmine, []);
      expect(this.fakeJasmine.randomizeTests).not.toHaveBeenCalled();
    });

    it('should be able to turn on random tests', async function() {
      await this.command.run(this.fakeJasmine, ['--random=true']);
      expect(this.fakeJasmine.randomizeTests).toHaveBeenCalledWith(true);
    });

    it('should be able to turn off random tests', async function() {
      await this.command.run(this.fakeJasmine, ['--random=false']);
      expect(this.fakeJasmine.randomizeTests).toHaveBeenCalledWith(false);
    });

    it('should not configure seed by default', async function() {
      await this.command.run(this.fakeJasmine, []);
      expect(this.fakeJasmine.seed).not.toHaveBeenCalled();
    });

    it('should be able to set a seed', async function() {
      await this.command.run(this.fakeJasmine, ['--seed=12345']);
      expect(this.fakeJasmine.seed).toHaveBeenCalledWith('12345');
    });
  });

  describe('Path handling', function() {
    describe('On Windows', function () {
      beforeEach(function() {
        this.deps = {
          print: this.out.print,
          platform: () => 'win32'
        };
      });

      it('replaces backslashes in the project base dir with slashes', function() {
        const subject = new Command('foo\\bar', '', this.deps);
        expect(subject.projectBaseDir).toEqual('foo/bar');
        expect(subject.specDir).toEqual('foo/bar/spec');
      });

      it('replaces backslashes in spec file paths from the command line', async function() {
        const subject = new Command('arbitrary', '', this.deps);
        await subject.run(this.fakeJasmine, ['somedir\\somespec.js']);
        expect(this.fakeJasmine.execute).toHaveBeenCalledWith(['somedir/somespec.js'], undefined);
      });
    });

    describe('On non-Windows systems', function () {
      beforeEach(function() {
        this.deps = {
          print: this.out.print,
          platform: () => 'BeOS'
        };
      });

      it('does not replace backslashes in the project base dir', function() {
        const subject = new Command('foo\\bar', '', this.deps);
        expect(subject.projectBaseDir).toEqual('foo\\bar');
        expect(subject.specDir).toEqual('foo\\bar/spec');
      });

      it('does not replace backslashes in spec file paths from the command line', async function() {
        const subject = new Command('arbitrary', '', this.deps);
        await subject.run(this.fakeJasmine, ['somedir\\somespec.js']);
        expect(this.fakeJasmine.execute).toHaveBeenCalledWith(['somedir\\somespec.js'], undefined);
      });
    });
  });
});

// Adapted from Sindre Sorhus's escape-string-regexp (MIT license)
function escapeStringForRegexp(string) {
  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    .replace(/-/g, '\\x2d');
}
