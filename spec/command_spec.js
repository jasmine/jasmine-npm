const fs = require('fs');
const path = require('path');
const os = require('os');
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
          output += str + '\n';
        },
        getOutput: function() {
          return output;
        }
      };
    }());

    const commonMethods = [
      'loadConfigFile',
      'execute',
      'showColors',
      'verbose',
      'coreVersion',
      'clearReporters',
      'addReporter',
      'addRequires',
      'addMatchingHelperFiles'
    ];
    this.fakeJasmine = jasmine.createSpyObj(
      'jasmine',
      [...commonMethods, 'seed', 'randomizeTests', 'configureEnv', 'enumerate']
    );
    this.fakeJasmine.loader = new Loader();
    this.Jasmine = jasmine.createSpy('Jasmine')
      .and.returnValue(this.fakeJasmine);
      this.parallelRunner = jasmine.createSpyObj(
      'parallelRunner',
      commonMethods
    );
    this.parallelRunner.loader = new Loader();
    this.ParallelRunner = jasmine.createSpy('ParallelRunner')
      .and.returnValue(this.parallelRunner);
    this.fakeJasmine.execute.and.returnValue(Promise.resolve());
    this.command = new Command(projectBaseDir, examplesDir, {
      print: this.out.print,
      Jasmine: this.Jasmine,
      ParallelRunner: this.ParallelRunner,
      platform: () => 'Oberon'
    });
  });

  afterEach(function() {
    deleteDirectory(projectBaseDir);
  });

  describe('passing in environment variables', function() {
    beforeEach(function () {
      this.command.run(['node', 'bin/jasmine.js', 'TESTKEY=TESTVALUE']);
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
      this.command.run(['node', 'bin/jasmine.js', 'init']);
    });

    it('creates setup folders and files for specs', function() {
      expect(fs.existsSync(path.join(spec, 'support/', 'jasmine.mjs'))).toBe(true);
    });

    it('writes default settings to jasmine.mjs', function() {
      const realJson = fs.readFileSync(path.join(spec, 'support/', 'jasmine.mjs'), 'utf-8');
      const fixtureJson = fs.readFileSync(path.join(__dirname, '../', 'lib/', 'examples/', 'jasmine.mjs'), 'utf-8');
      expect(realJson).toEqual(fixtureJson);
    });
  });

  describe('version', function() {
    beforeEach(function() {
      this.fakeJasmine.coreVersion.and.returnValue('fake core version');
      this.command.run(['node', 'bin/jasmine.js', 'version']);
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
      this.command.run(['node', 'bin/jasmine.js', '-v']);
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
      this.command.run(['node', 'bin/jasmine.js',
        '--some-option', '--no-color', '--another-option', '--another=option'
      ]);
      expect(this.out.getOutput()).toContain(
        'Unknown options: --some-option, --another-option, --another=option'
      );
      expect(this.out.getOutput()).toContain('Usage');
      expect(process.exitCode).toBe(1);
    });
  });

  describe('--', function() {
    it('skips anything after it', async function() {
      await withValueForIsTTY(true, async function () {
        await this.command.run(['node', 'bin/jasmine.js', '--', '--no-color']);
        expect(this.out.getOutput()).toBe('');
        expect(this.fakeJasmine.showColors).toHaveBeenCalledWith(true);
      }.bind(this));
    });
  });

  describe('examples', function() {
    beforeEach(function() {
      this.command.run(['node', 'bin/jasmine.js', 'examples']);
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
    beforeEach(function () {
      this.originalConfigPath = process.env.JASMINE_CONFIG_PATH;
    });

    afterEach(function () {
      if (this.originalConfigPath) {
        process.env.JASMINE_CONFIG_PATH = this.originalConfigPath;
      } else {
        delete process.env.JASMINE_CONFIG_PATH;
      }
    });

    function sharedRunBehavior(extraArg) {
      beforeEach(function() {
        this.run = async function(args) {
          if (extraArg) {
            args.push(extraArg);
          }

          await this.command.run(args);
        };
      });

      it('should load the default config file', async function () {
        await this.run(['node', 'bin/jasmine.js']);
        expect(this.runner.loadConfigFile).toHaveBeenCalledWith(undefined);
      });

      it('should load a custom config file specified by env variable', async function () {
        await this.run(['node', 'bin/jasmine.js', 'JASMINE_CONFIG_PATH=somewhere.json']);
        expect(this.runner.loadConfigFile).toHaveBeenCalledWith('somewhere.json');
      });

      it('should load a custom config file specified by option', async function () {
        await this.run(['node', 'bin/jasmine.js', '--config=somewhere.json']);
        expect(this.runner.loadConfigFile).toHaveBeenCalledWith('somewhere.json');
      });

      it('should show colors by default if stdout is a TTY', async function () {
        await withValueForIsTTY(true, async function () {
          await this.run(['node', 'bin/jasmine.js']);
          expect(this.runner.showColors).toHaveBeenCalledWith(true);
        }.bind(this));
      });

      it('should not show colors by default if stdout is not a TTY', async function () {
        await withValueForIsTTY(undefined, async function () {
          await this.run(['node', 'bin/jasmine.js']);
          expect(this.runner.showColors).toHaveBeenCalledWith(false);
        }.bind(this));
      });

      it('should allow colors to be turned off', async function () {
        await this.run(['node', 'bin/jasmine.js', '--no-color']);
        expect(this.runner.showColors).toHaveBeenCalledWith(false);
      });

      it('should be able to force colors to be turned on', async function () {
        await withValueForIsTTY(undefined, async function () {
          await this.run(['node', 'bin/jasmine.js', '--color']);
          expect(this.runner.showColors).toHaveBeenCalledWith(true);
        }.bind(this));
      });

      it('does not enable verbose mode by default', async function() {
        await this.run(['node', 'bin/jasmine.js']);
        expect(this.runner.verbose).toHaveBeenCalledWith(false);
        expect(this.runner.verbose).toHaveBeenCalledBefore(this.runner.loadConfigFile);
      });

      it('can enable verbose mode', async function() {
        await this.run(['node', 'bin/jasmine.js', '--verbose']);
        expect(this.runner.verbose).toHaveBeenCalledWith(true);
        expect(this.runner.verbose).toHaveBeenCalledBefore(this.runner.loadConfigFile);
      });

      it('should execute the jasmine suite', async function () {
        await this.run(['node', 'bin/jasmine.js']);
        expect(this.runner.execute).toHaveBeenCalled();
      });

      it('should be able to run only specified specs', async function () {
        await this.run(['spec/some/fileSpec.js', 'SOME_ENV=SOME_VALUE', '--no-color']);
        expect(this.runner.execute).toHaveBeenCalledWith(['spec/some/fileSpec.js'], undefined);
      });

      it('should be able filter by spec name', async function () {
        await this.run(['--filter=interesting spec']);
        expect(this.runner.execute).toHaveBeenCalledWith(jasmine.any(Array), 'interesting spec');
      });

      it('should be able to add one helper pattern', async function () {
        await this.run(['--helper=helpers/**/*.js']);
        expect(this.runner.addMatchingHelperFiles).toHaveBeenCalledWith(['helpers/**/*.js']);
      });

      it('should be able to add many helper patterns', async function () {
        await this.run(['--helper=helpers/**/*.js', '--helper=other.js']);
        expect(this.runner.addMatchingHelperFiles).toHaveBeenCalledWith(['helpers/**/*.js', 'other.js']);
      });

      it('should not modify helper patterns if no argument given', async function () {
        await this.run([]);
        expect(this.runner.addMatchingHelperFiles).not.toHaveBeenCalled();
      });

      it('should be able to add one require', async function () {
        await this.run(['--require=ts-node/require']);
        expect(this.runner.addRequires).toHaveBeenCalledWith(['ts-node/require']);
      });

      it('should be able to add multiple requires', async function () {
        await this.run(['--require=ts-node/require', '--require=@babel/register']);
        expect(this.runner.addRequires).toHaveBeenCalledWith(['ts-node/require', '@babel/register']);
      });

      it('can specify a reporter', async function () {
        const reporterPath = path.resolve(path.join(__dirname, 'fixtures', 'customReporter.js'));
        const Reporter = require(reporterPath);
        await this.run(['--reporter=' + reporterPath]);
        expect(this.runner.clearReporters).toHaveBeenCalled();
        expect(this.runner.addReporter).toHaveBeenCalledWith(jasmine.any(Reporter));
      });

      it('uses the provided loader to load reporters', async function () {
        const reporterPath = path.resolve(path.join(__dirname, 'fixtures', 'customReporter.js'));
        spyOn(this.runner.loader, 'load').and.callThrough();

        await this.run(['--reporter=' + reporterPath]);

        expect(this.runner.loader.load).toHaveBeenCalledWith(reporterPath);
      });

      it('can specify a reporter that is an ES module', async function () {
        await this.run(['--reporter=./spec/fixtures/customReporter.mjs']);
        expect(this.runner.clearReporters).toHaveBeenCalled();
        expect(this.runner.addReporter.calls.argsFor(0)[0].isCustomReporterDotMjs).toBe(true);
      });

      describe('When the reporter path is relative', function () {
        beforeEach(function () {
          this.originalWd = process.cwd();
        });

        afterEach(function () {
          process.chdir(this.originalWd);
        });

        it('evaluates the path based on the cwd', async function () {
          const Reporter = require('./fixtures/customReporter.js');
          process.chdir('spec/fixtures');
          await this.run(['--reporter=./customReporter.js']);
          expect(this.runner.clearReporters).toHaveBeenCalled();
          expect(this.runner.addReporter).toHaveBeenCalledWith(jasmine.any(Reporter));

          this.runner.clearReporters.calls.reset();
          this.runner.addReporter.calls.reset();
          process.chdir('example');
          await this.run(['--reporter=../customReporter.js']);
          expect(this.runner.clearReporters).toHaveBeenCalled();
          expect(this.runner.addReporter).toHaveBeenCalledWith(jasmine.any(Reporter));
        });
      });

      it('throws with context if the file does not export a reporter', async function () {
        const reporterPath = path.resolve(path.join(__dirname, 'fixtures', 'badReporter.js'));
        await expectAsync(
          this.run(['--reporter=' + reporterPath])
        ).toBeRejectedWithError(new RegExp(
          'Failed to instantiate reporter from ' +
          escapeStringForRegexp(reporterPath) + '\nUnderlying error: .' +
          '*Reporter is not a constructor'
        ));
        expect(this.runner.clearReporters).not.toHaveBeenCalled();
        expect(this.runner.addReporter).not.toHaveBeenCalled();
      });

      it('throws with context if the reporter file does not exist', async function () {
        const reporterPath = path.resolve(path.join(__dirname, 'fixtures', 'missingReporter.js'));

        await expectAsync(
          this.run(['--reporter=' + reporterPath])
        ).toBeRejectedWithError(new RegExp(
          'Failed to load reporter module ' +
          escapeStringForRegexp(reporterPath) + '\nUnderlying error: ' +
          '.*Cannot find module'
        ));

        expect(this.runner.clearReporters).not.toHaveBeenCalled();
        expect(this.runner.addReporter).not.toHaveBeenCalled();
      });
    }

    it('runs in normal mode if --parallel is not specified', async function() {
      await this.command.run(['node', 'bin/jasmine.js']);
      expect(this.fakeJasmine.execute).toHaveBeenCalled();
      expect(this.ParallelRunner).not.toHaveBeenCalled();
    });

    it('runs in parallel mode if --parallel is >1', async function() {
      await this.command.run(['node', 'bin/jasmine.js', '--parallel=2']);
      expect(this.fakeJasmine.execute).not.toHaveBeenCalled();
      expect(this.ParallelRunner).toHaveBeenCalledWith({
        projectBaseDir,
        numWorkers: 2
      });
      expect(this.parallelRunner.execute).toHaveBeenCalled();
    });

    it('sets the number of workers to 1 less than CPUs if --paralell is auto', async function() {
      await this.command.run(['node', 'bin/jasmine.js', '--parallel=auto']);
      expect(this.fakeJasmine.execute).not.toHaveBeenCalled();
      expect(this.ParallelRunner).toHaveBeenCalledWith({
        projectBaseDir,
        numWorkers: os.cpus().length - 1
      });
      expect(this.parallelRunner.execute).toHaveBeenCalled();
    });

    it('shows usage if --parallel is not a number', async function() {
      this.command.run(['node', 'bin/jasmine.js', '--parallel=twelve']);
      expect(this.out.getOutput()).toContain(
        'Argument to --parallel= must be an integer greater than 1'
      );
      expect(this.out.getOutput()).toContain('Usage');
      expect(process.exitCode).toBe(1);
    });

    it('shows usage if --parallel is not an integer', async function() {
      this.command.run(['node', 'bin/jasmine.js', '--parallel=1.23']);
      expect(this.out.getOutput()).toContain(
        'Argument to --parallel= must be an integer greater than 1'
      );
      expect(this.out.getOutput()).toContain('Usage');
      expect(process.exitCode).toBe(1);
    });

    it('shows usage if --parallel is 1', async function() {
      await this.command.run(['node', 'bin/jasmine.js', '--parallel=1']);
      expect(this.out.getOutput()).toContain(
        'Argument to --parallel= must be an integer greater than 1'
      );
      expect(this.out.getOutput()).toContain('Usage');
      expect(process.exitCode).toBe(1);
    });

    it('shows usage if --parallel is not positive', async function() {
      this.command.run(['node', 'bin/jasmine.js', '--parallel=0']);
      expect(this.out.getOutput()).toContain(
        'Argument to --parallel= must be an integer greater than 1'
      );
      expect(this.out.getOutput()).toContain('Usage');
      expect(process.exitCode).toBe(1);
    });

    describe('In normal mode', function () {
      beforeEach(function() {
        this.runner = this.fakeJasmine;
      });

      sharedRunBehavior();

      it('uses jasmine-core defaults if random is unspecified', async function () {
        await this.run([]);
        expect(this.runner.randomizeTests).not.toHaveBeenCalled();
      });

      it('should be able to turn on random tests', async function () {
        await this.run(['--random=true']);
        expect(this.runner.randomizeTests).toHaveBeenCalledWith(true);
      });

      it('should be able to turn off random tests', async function () {
        await this.run(['--random=false']);
        expect(this.runner.randomizeTests).toHaveBeenCalledWith(false);
      });

      it('should not configure seed by default', async function () {
        await this.run([]);
        expect(this.runner.seed).not.toHaveBeenCalled();
      });

      it('should be able to set a seed', async function () {
        await this.run(['--seed=12345']);
        expect(this.runner.seed).toHaveBeenCalledWith('12345');
      });

      it('should not configure fail fast by default', async function () {
        await this.run([]);
        expect(this.runner.configureEnv).not.toHaveBeenCalledWith(jasmine.objectContaining({
          stopOnSpecFailure: jasmine.anything()
        }));
        expect(this.runner.configureEnv).not.toHaveBeenCalledWith(jasmine.objectContaining({
          stopSpecOnExpectationFailure: jasmine.anything()
        }));
      });

      it('should be able to turn on fail fast', async function () {
        await this.run(['--fail-fast']);
        expect(this.runner.configureEnv).toHaveBeenCalledWith({
          stopOnSpecFailure: true,
          stopSpecOnExpectationFailure: true
        });
      });
    });

    describe('In parallel mode', function() {
      beforeEach(function() {
        this.runner = this.parallelRunner;
      });

      sharedRunBehavior('--parallel=2');
    });
  });

  describe('enumerate', function() {
    it('outputs the result of enumerating specs', async function() {
      const result = [{type: 'spec', description: 'foo'}];
      this.fakeJasmine.enumerate.and.returnValue(result);
      await this.command.run(['enumerate']);
      expect(JSON.parse(this.out.getOutput())).toEqual(result);
    });
  });

  describe('Path handling', function() {
    describe('On Windows', function () {
      beforeEach(function() {
        this.deps = {
          print: this.out.print,
          platform: () => 'win32',
          Jasmine: this.Jasmine,
          ParallelRunner: this.ParallelRunner,
        };
      });

      it('replaces backslashes in the project base dir with slashes', function() {
        const subject = new Command('foo\\bar', '', this.deps);
        expect(subject.projectBaseDir).toEqual('foo/bar');
        expect(subject.specDir).toEqual('foo/bar/spec');
      });

      it('replaces backslashes in spec file paths from the command line', async function() {
        const subject = new Command('arbitrary', '', this.deps);
        await subject.run(['somedir\\somespec.js']);
        expect(this.fakeJasmine.execute).toHaveBeenCalledWith(['somedir/somespec.js'], undefined);
      });
    });

    describe('On non-Windows systems', function () {
      beforeEach(function() {
        this.deps = {
          print: this.out.print,
          platform: () => 'BeOS',
          Jasmine: this.Jasmine,
          ParallelRunner: this.ParallelRunner,
        };
      });

      it('does not replace backslashes in the project base dir', function() {
        const subject = new Command('foo\\bar', '', this.deps);
        expect(subject.projectBaseDir).toEqual('foo\\bar');
        expect(subject.specDir).toEqual('foo\\bar/spec');
      });

      it('does not replace backslashes in spec file paths from the command line', async function() {
        const subject = new Command('arbitrary', '', this.deps);
        await subject.run(['somedir\\somespec.js']);
        expect(this.fakeJasmine.execute).toHaveBeenCalledWith(['somedir\\somespec.js'], undefined);
      });
    });
  });

  describe('help', function() {
    it('wraps text to the terminal width', async function() {
      this.command = new Command(projectBaseDir, '', {
        print: this.out.print,
        terminalColumns: 50,
        platform() {
          return 'arbitrary';
        }
      });

      await this.command.run(['help']);

      const output = this.out.getOutput();
      expect(output).toContain('version,-v    show jasmine and jasmine-core\n' +
        '              versions\n');
      expect(output).toContain('   --parallel=auto    Run in parallel with an\n' +
        '                      automatically chosen number\n' +
        '                      of workers\n' +
        '        --no-color    turn off color in spec\n' +
        '                      output\n' +
        '           --color    force turn on color in spec\n' +
        '                      output\n');
      expect(output).toContain('The given arguments take precedence over options\n' +
        'in your jasmine.json.\n' +
        'The path to your optional jasmine.json can also be\n' +
        'configured by setting the JASMINE_CONFIG_PATH\n' +
        'environment variable.\n');
    });

    it('wraps text to 80 columns when the terminal width is unknown', function() {
      this.command = new Command(projectBaseDir, '', {
        print: this.out.print,
        terminalColumns: undefined,
        platform() {
          return 'arbitrary';
        }
      });

      this.command.run(['help']);

      const output = this.out.getOutput();
      expect(output).toContain('   --parallel=auto    Run in parallel with an automatically chosen number of\n' +
        '                      workers\n');
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
