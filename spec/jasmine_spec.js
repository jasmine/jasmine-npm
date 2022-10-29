const path = require('path');
const slash = require('slash');
const Jasmine = require('../lib/jasmine');
const Loader = require("../lib/loader");

describe('Jasmine', function() {
  beforeEach(function() {
    this.bootedJasmine = {
      getEnv: jasmine.createSpy('getEnv').and.returnValue({
        addReporter: jasmine.createSpy('addReporter'),
        clearReporters: jasmine.createSpy('clearReporters'),
        addMatchers: jasmine.createSpy('addMatchers'),
        provideFallbackReporter: jasmine.createSpy('provideFallbackReporter'),
        execute: jasmine.createSpy('execute')
          .and.callFake(function(ignored, callback) {
            callback();
          }),
        configure: jasmine.createSpy('configure')
      }),
      Timer: jasmine.createSpy('Timer')
    };

    this.fakeJasmineCore = {
      boot: jasmine.createSpy('boot').and.returnValue(this.bootedJasmine),
      files: {
        path: 'fake/jasmine/path'
      }
    };

    this.testJasmine = new Jasmine({ jasmineCore: this.fakeJasmineCore });
    this.testJasmine.exit = function() {
      // Don't actually exit the node process
    };

    this.execute = async function(options = {}) {
      const overallStatus = options.overallStatus || 'passed';
      const executeArgs = options.executeArgs || [];

      let executePromise;
      let resolveEnvExecutePromise;
      const envExecutePromise = new Promise(resolve => {
        resolveEnvExecutePromise = resolve;
      });
      await new Promise(resolve => {
        this.testJasmine.env.execute.and.callFake(function() {
          resolve();
          return envExecutePromise;
        });
        executePromise = this.testJasmine.execute.apply(this.testJasmine, executeArgs);
      });

      resolveEnvExecutePromise({overallStatus});
      return executePromise;
    };
  });

  describe('constructor options', function() {
    it('have defaults', function() {
      expect(this.testJasmine.projectBaseDir).toEqual(path.resolve());
    });
  });

  describe('#addSpecFile', function() {
    it('adds the provided path to the list of spec files', function () {
      expect(this.testJasmine.specFiles).toEqual([]);
      this.testJasmine.addSpecFile('some/file/path.js');
      expect(this.testJasmine.specFiles).toEqual(['some/file/path.js']);
    });
  });

  describe('#addHelperFile', function() {
    it('adds the provided path to the list of helper files', function () {
      expect(this.testJasmine.helperFiles).toEqual([]);
      this.testJasmine.addHelperFile('some/file/path.js');
      expect(this.testJasmine.helperFiles).toEqual(['some/file/path.js']);
    });
  });

  describe('Methods that specify files via globs', function() {
    describe('#addMatchingSpecFiles', function() {
      hasCommonFileGlobBehavior('addMatchingSpecFiles', 'specFiles');
    });

    describe('#addMatchingHelperFiles', function() {
      hasCommonFileGlobBehavior('addMatchingHelperFiles', 'helperFiles');
    });

    function hasCommonFileGlobBehavior(method, destProp) {
      it('adds a file with an absolute path', function() {
        const aFile = path.join(this.testJasmine.projectBaseDir, this.testJasmine.specDir, 'spec/command_spec.js')
          .replace(/\\/g, '/');
        expect(this.testJasmine[destProp]).toEqual([]);
        this.testJasmine[method]([aFile]);
        expect(this.testJasmine[destProp]).toEqual([slash(aFile)]);
      });

      it('adds files that match a glob pattern', function() {
        expect(this.testJasmine[destProp]).toEqual([]);
        this.testJasmine[method](['spec/fixtures/jasmine_spec/*.js']);
        expect(this.testJasmine[destProp].map(basename)).toEqual([
          'c.js',
          'd.js',
          'e.js',
          'f.js',
        ]);
      });

      it('can exclude files that match another glob', function() {
        expect(this.testJasmine[destProp]).toEqual([]);
        this.testJasmine[method]([
          'spec/fixtures/jasmine_spec/*.js',
          '!spec/fixtures/jasmine_spec/c*'
        ]);
        expect(this.testJasmine[destProp].map(basename)).toEqual([
          'd.js',
          'e.js',
          'f.js',
        ]);
      });

      it('adds new files to existing files', function() {
        const aFile = path.join(this.testJasmine.projectBaseDir, this.testJasmine.specDir, 'spec/command_spec.js');
        this.testJasmine[destProp] = [aFile, 'b'];
        this.testJasmine[method](['spec/fixtures/jasmine_spec/*.js']);
        expect(this.testJasmine[destProp].map(basename)).toEqual([
          'command_spec.js',
          'b',
          'c.js',
          'd.js',
          'e.js',
          'f.js',
        ]);
      });
    }

    function basename(name) { return path.basename(name); }
  });

  it('delegates #coreVersion to jasmine-core', function() {
    this.fakeJasmineCore.version = jasmine.createSpy('coreVersion').and.returnValue('a version');
    expect(this.testJasmine.coreVersion()).toEqual('a version');
  });

  it('registers a console reporter upon construction', function() {
    spyOn(Jasmine, 'ConsoleReporter').and.returnValue({someProperty: 'some value'});

    const testJasmine = new Jasmine({ jasmineCore: this.fakeJasmineCore });

    expect(testJasmine.env.addReporter).toHaveBeenCalledWith({someProperty: 'some value'});
  });

  it('exposes #addReporter and #clearReporters', function() {
    const testJasmine = new Jasmine({ jasmineCore: this.fakeJasmineCore });
    expect(testJasmine.reportersCount).toEqual(1);
    testJasmine.clearReporters();
    expect(testJasmine.reportersCount).toEqual(0);
    expect(testJasmine.env.clearReporters).toHaveBeenCalled();
    testJasmine.addReporter({someProperty: 'some value'});
    expect(testJasmine.reportersCount).toEqual(1);
    expect(testJasmine.env.addReporter).toHaveBeenCalledWith({someProperty: 'some value'});
  });

  describe('#configureDefaultReporter', function() {
    beforeEach(function() {
      spyOn(this.testJasmine.reporter, 'setOptions');
    });

    it('sets the options on the console reporter', function() {
      const reporterOptions = {
        print: 'printer',
        showColors: true,
      };

      const expectedReporterOptions = Object.keys(reporterOptions).reduce(function(options, key) {
        options[key] = reporterOptions[key];
        return options;
      }, {});

      this.testJasmine.configureDefaultReporter(reporterOptions);

      expect(this.testJasmine.reporter.setOptions).toHaveBeenCalledWith(expectedReporterOptions);
    });

    it('creates a reporter with a default option if an option is not specified', function() {
      const reporterOptions = {};

      this.testJasmine.configureDefaultReporter(reporterOptions);

      const expectedReporterOptions = {
        print: jasmine.any(Function),
        showColors: true,
      };

      expect(this.testJasmine.reporter.setOptions).toHaveBeenCalledWith(expectedReporterOptions);
    });
  });

  it('adds matchers to the jasmine env', function() {
    this.testJasmine.addMatchers(['fake matcher 1', 'fake matcher 2']);
    expect(this.testJasmine.env.addMatchers).toHaveBeenCalledWith(['fake matcher 1', 'fake matcher 2']);
  });

  describe('loading configurations', function() {
    beforeEach(function() {
      this.fixtureJasmine = new Jasmine({
        jasmineCore: this.fakeJasmineCore,
        projectBaseDir: 'spec/fixtures/sample_project'
      });
    });

    describe('from an object', function() {
      beforeEach(function() {
        this.loader = this.fixtureJasmine.loader = jasmine.createSpyObj('loader', ['load']);
        this.configObject = {
          spec_dir: "spec",
          spec_files: [
            "fixture_spec.js",
            "**/*spec.js"
          ],
          helpers: [
            "helper.js"
          ],
          requires: [
            "ts-node/register"
          ]
        };
      });

      it('adds unique specs to the jasmine runner', function() {
        this.fixtureJasmine.loadConfig(this.configObject);
        expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
        expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
        expect(this.fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/fixture_spec.js',
          'spec/fixtures/sample_project/spec/other_fixture_spec.js'
        ]);
      });

      it('can tell jasmine-core to stop spec on no expectations', function() {
        this.configObject.failSpecWithNoExpectations = true;
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({failSpecWithNoExpectations: true});
      });

      it('can tell jasmine-core to stop spec on expectation failure', function() {
        this.configObject.stopSpecOnExpectationFailure = true;
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({stopSpecOnExpectationFailure: true});
      });

      it('does not configure jasmine-core for stopping spec on expectation failure by default', function() {
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).not.toHaveBeenCalled();
      });

      it('can tell jasmine-core to stop execution when a spec fails', function() {
        this.configObject.stopOnSpecFailure = true;
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({stopOnSpecFailure: true});
      });

      it('does not configure jasmine-core for stopping execution by default', function() {
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).not.toHaveBeenCalled();
      });

      it('can tell jasmine-core to run random specs', function() {
        this.configObject.random = true;
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({random: true});
      });

      it('uses jasmine-core defaults if no config options specified', function() {
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).not.toHaveBeenCalled();
      });

      it('can configure the env with arbitrary properties', function() {
        this.configObject.env = {someProp: 'someVal'};
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({someProp: 'someVal'});
      });

      describe('with options', function() {
        it('instantiates spec_dir with the provided value', function() {
          this.fixtureJasmine.loadConfig(this.configObject);

          expect(this.fixtureJasmine.specDir).toEqual('spec');
        });
      });

      describe('without options', function() {
        it('falls back to an empty string with an undefined spec_dir', function() {
          const config = this.configObject;
          delete config.spec_dir;

          this.fixtureJasmine.loadConfig(config);

          expect(this.fixtureJasmine.specDir).toEqual('');
        });
      });

      it('passes verboseDeprecations to jasmine-core when specified', function() {
        this.configObject.verboseDeprecations = true;
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith(
          jasmine.objectContaining({verboseDeprecations: true})
        );
      });

      it('does not pass verboseDeprecations to jasmine-core when not specified', function() {
        this.configObject.random = true; // or set any other property
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalled();
        expect(this.fixtureJasmine.env.configure.calls.argsFor(0)[0].verboseDeprecations)
          .toBeUndefined();
      });

      describe('with jsLoader: "require"', function () {
        it('tells the loader not to always import', async function() {
          this.configObject.jsLoader = 'require';

          this.fixtureJasmine.loadConfig(this.configObject);
          await this.fixtureJasmine.loadSpecs();

          expect(this.loader.load).toHaveBeenCalledWith(jasmine.any(String));
          expect(this.loader.alwaysImport).toBeFalse();
        });
      });

      describe('with jsLoader: "import"', function () {
        it('tells the loader to always import', async function() {
          this.configObject.jsLoader = 'import';

          this.fixtureJasmine.loadConfig(this.configObject);
          await this.fixtureJasmine.loadSpecs();

          expect(this.loader.load).toHaveBeenCalledWith(jasmine.any(String));
          expect(this.loader.alwaysImport).toBeTrue();
        });
      });

      describe('with jsLoader set to an invalid value', function () {
        it('throws an error', function() {
          this.configObject.jsLoader = 'bogus';
          expect(() => {
            this.fixtureJasmine.loadConfig(this.configObject);
          }).toThrowError(/"bogus" is not a valid value/);
        });
      });

      describe('with jsLoader undefined', function () {
        it('tells the loader to always import', async function() {
          this.configObject.jsLoader = undefined;

          this.fixtureJasmine.loadConfig(this.configObject);
          await this.fixtureJasmine.loadSpecs();

          expect(this.loader.load).toHaveBeenCalledWith(jasmine.any(String));
          expect(this.loader.alwaysImport).toBeTrue();
        });
      });

      it('sets alwaysListPendingSpecs when present', function() {
        this.configObject.alwaysListPendingSpecs = false;

        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.alwaysListPendingSpecs_).toBeFalse();
      });

      it('does not set alwaysListPendingSpecs when absent', function() {
        delete this.configObject.alwaysListPendingSpecs;

        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.alwaysListPendingSpecs_).toBeTrue();
      });

      it('adds specified reporters', function() {
        const reporter1 = {id: 'reporter1'};
        const reporter2 = {id: 'reporter2'};
        this.configObject.reporters = [reporter1, reporter2];

        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.addReporter).toHaveBeenCalledWith(reporter1);
        expect(this.fixtureJasmine.env.addReporter).toHaveBeenCalledWith(reporter2);
      });
    });

    describe('from a file', function() {
      it('adds unique specs to the jasmine runner', async function() {
        await this.fixtureJasmine.loadConfigFile('spec/support/jasmine_alternate.json');
        expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
        expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
        expect(this.fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/fixture_spec.js',
          'spec/fixtures/sample_project/spec/other_fixture_spec.js'
        ]);
      });

      it('can use an ES module', async function() {
        await this.fixtureJasmine.loadConfigFile('spec/support/jasmine_alternate.mjs');
        expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
        expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
        expect(this.fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/fixture_spec.js',
          'spec/fixtures/sample_project/spec/other_fixture_spec.js'
        ]);
      });

      it('can use a CommonJS module', async function() {
        await this.fixtureJasmine.loadConfigFile('spec/support/jasmine_alternate.cjs');
        expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
        expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
        expect(this.fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/fixture_spec.js',
          'spec/fixtures/sample_project/spec/other_fixture_spec.js'
        ]);
      });

      it('loads the specified configuration file from an absolute path', async function() {
        const absoluteConfigPath = path.join(__dirname, 'fixtures/sample_project/spec/support/jasmine_alternate.json');
        await this.fixtureJasmine.loadConfigFile(absoluteConfigPath);
        expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
        expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
        expect(this.fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/fixture_spec.js',
          'spec/fixtures/sample_project/spec/other_fixture_spec.js'
        ]);
      });

      it("throws an error if the specified configuration file doesn't exist", async function() {
        await expectAsync(this.fixtureJasmine.loadConfigFile('missing.json')).toBeRejected();
      });

      it("does not throw if the default configuration files don't exist", async function() {
        this.fixtureJasmine.projectBaseDir += '/missing';
        await expectAsync(this.fixtureJasmine.loadConfigFile()).toBeResolved();
      });

      it('loads the default .json configuration file', async function() {
        await this.fixtureJasmine.loadConfigFile();
        expect(this.fixtureJasmine.specFiles).toEqual([
          jasmine.stringMatching('^spec[\\/]fixtures[\\/]sample_project[\\/]spec[\\/]fixture_spec.js$')
        ]);
      });

      it('loads the default .js configuration file', async function() {
        const config = require('./fixtures/sample_project/spec/support/jasmine.json');
        spyOn(Loader.prototype, 'load').and.callFake(function(path) {
          if (path.endsWith('jasmine.js')) {
            return Promise.resolve(config);
          } else {
            const e = new Error(`Module not found: ${path}`);
            e.code = 'MODULE_NOT_FOUND';
            return Promise.reject(e);
          }
        });

        await this.fixtureJasmine.loadConfigFile();
        expect(Loader.prototype.load).toHaveBeenCalledWith(jasmine.stringMatching(
          'jasmine\.js$'
        ));
        expect(this.fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/fixture_spec.js'
        ]);
      });
    });
  });

  describe('#stopSpecOnExpectationFailure', function() {
    it('sets the stopSpecOnExpectationFailure value on the jasmine-core env', function() {
      this.testJasmine.stopSpecOnExpectationFailure('foobar');
      expect(this.testJasmine.env.configure).toHaveBeenCalledWith({stopSpecOnExpectationFailure: 'foobar'});
    });
  });

  describe('#stopOnSpecFailure', function() {
    it('sets the stopOnSpecFailure value on the jasmine-core env', function() {
      this.testJasmine.stopOnSpecFailure('blah');
      expect(this.testJasmine.env.configure).toHaveBeenCalledWith({stopOnSpecFailure: 'blah'});
    });
  });

  describe('#randomizeTests', function() {
    it('sets the randomizeTests value on the jasmine-core env', function() {
      this.testJasmine.randomizeTests('foobar');
      expect(this.testJasmine.env.configure).toHaveBeenCalledWith({random: 'foobar'});
    });
  });

  it("showing colors can be configured", function() {
    expect(this.testJasmine.showingColors).toBe(true);

    this.testJasmine.showColors(false);

    expect(this.testJasmine.showingColors).toBe(false);
  });

  describe('#execute',  function() {
    it('uses the default console reporter if no reporters were added', async function() {
      spyOn(this.testJasmine, 'configureDefaultReporter');
      spyOn(this.testJasmine, 'loadSpecs');

      await this.execute();

      expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalledWith({
        showColors: true,
        alwaysListPendingSpecs: true
      });
      expect(this.testJasmine.loadSpecs).toHaveBeenCalled();
      expect(this.testJasmine.env.execute).toHaveBeenCalled();
    });

    it('configures the default console reporter with the right settings', async function() {
      spyOn(this.testJasmine, 'configureDefaultReporter');
      spyOn(this.testJasmine, 'loadSpecs');
      this.testJasmine.showColors(false);
      this.testJasmine.alwaysListPendingSpecs(false);

      await this.execute();

      expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalledWith({
        showColors: false,
        alwaysListPendingSpecs: false
      });
      expect(this.testJasmine.loadSpecs).toHaveBeenCalled();
      expect(this.testJasmine.env.execute).toHaveBeenCalled();
    });

    it('does not configure the default reporter if this was already done', async function() {
      spyOn(this.testJasmine, 'loadSpecs');

      this.testJasmine.configureDefaultReporter({showColors: false});

      spyOn(this.testJasmine, 'configureDefaultReporter');

      await this.execute();

      expect(this.testJasmine.configureDefaultReporter).not.toHaveBeenCalled();
      expect(this.testJasmine.loadSpecs).toHaveBeenCalled();
      expect(this.testJasmine.env.execute).toHaveBeenCalled();
    });

    it('loads helper files before checking if any reporters were added', async function() {
      const loadHelpers = spyOn(this.testJasmine, 'loadHelpers');
      spyOn(this.testJasmine, 'configureDefaultReporter').and.callFake(function() {
        expect(loadHelpers).toHaveBeenCalled();
      });
      spyOn(this.testJasmine, 'loadSpecs');

      await this.execute();

      expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalled();
    });

    it('can run only specified files', async function() {
      await this.execute({
        executeArgs: [['spec/fixtures/sample_project/**/*spec.js']]
      });

      const relativePaths = this.testJasmine.specFiles.map(function(filePath) {
        return slash(path.relative(__dirname, filePath));
      });

      expect(relativePaths).toEqual(['fixtures/sample_project/spec/fixture_spec.js', 'fixtures/sample_project/spec/other_fixture_spec.js']);
    });

    it('should add spec filter if filterString is provided', async function() {
      await this.execute({
        executeArgs: [['spec/fixtures/example/*spec.js'], 'interesting spec']
      });

      expect(this.testJasmine.env.configure).toHaveBeenCalledWith({specFilter: jasmine.any(Function)});
    });

    describe('completion behavior', function() {
      beforeEach(function() {
        spyOn(this.testJasmine, 'exit');
      });

      describe('default', function() {
        it('exits successfully when the whole suite is green', async function () {
          await this.execute({overallStatus: 'passed'});
          expect(this.testJasmine.exit).toHaveBeenCalledWith(0);
        });

        it('exits with a distinct status code when anything in the suite is not green', async function () {
          await this.execute({overallStatus: 'failed'});
          expect(this.testJasmine.exit).toHaveBeenCalledWith(3);
        });

        it('exits with a distinct status code when anything in the suite is focused', async function() {
          await this.execute({overallStatus: 'incomplete'});
          expect(this.testJasmine.exit).toHaveBeenCalledWith(2);
        });
      });

      describe('When exitOnCompletion is set to false', function() {
        it('does not exit', async function() {
          this.testJasmine.exitOnCompletion = false;
          await this.execute();
          expect(this.testJasmine.exit).not.toHaveBeenCalled();
        });
      });
    });

    describe('The returned promise', function() {
      it('is resolved with the overall suite status', async function() {
        await expectAsync(this.execute({overallStatus: 'failed'}))
          .toBeResolvedTo(jasmine.objectContaining({overallStatus: 'failed'}));
      });

      it('is resolved with the overall suite status even if clearReporters was called', async function() {
        this.testJasmine.clearReporters();

        await expectAsync(this.execute({overallStatus: 'incomplete'}))
          .toBeResolvedTo(jasmine.objectContaining({overallStatus: 'incomplete'}));
      });
    });
  });

  describe('When running on Windows', function() {
    beforeEach(function() {
      spyOn(console, 'warn');
    });

    function windows() {
      return 'win32';
    }

    it('warns about backslashes in the configured project base dir', function() {
      new Jasmine({
        projectBaseDir: 'c:\\foo\\bar',
        platform: windows,
        jasmineCore: this.fakeJasmineCore,
      });
      expect(console.warn).toHaveBeenCalledWith('Backslashes in ' +
        'file paths behave inconsistently between platforms and might not be ' +
        'treated as directory separators in a future version. Consider ' +
        'changing c:\\foo\\bar to c:/foo/bar.');
    });

    it('does not warn about backslashes in the current working directory', function() {
      const jasmine = new Jasmine({
        getcwd: () => 'c:\\foo\\bar',
        platform: windows,
        jasmineCore: this.fakeJasmineCore,
      });
      expect(jasmine.projectBaseDir).toEqual('c:\\foo\\bar');
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('warns about backslashes in spec_dir', function() {
      const jasmine = new Jasmine({
        platform: windows,
        jasmineCore: this.fakeJasmineCore,
      });
      jasmine.loadConfig({
        spec_dir: 'foo\\bar',
      });

      expect(console.warn).toHaveBeenCalledWith('Backslashes in ' +
        'file paths behave inconsistently between platforms and might not be ' +
        'treated as directory separators in a future version. Consider ' +
        'changing foo\\bar to foo/bar.');
    });

    it('warns about backslashes in helpers', function() {
      const jasmine = new Jasmine({
        platform: windows,
        jasmineCore: this.fakeJasmineCore,
      });

      jasmine.loadConfig({
        helpers: ['foo\\bar']
      });
      expect(console.warn).toHaveBeenCalledWith('Backslashes in ' +
        'file paths behave inconsistently between platforms and might not be ' +
        'treated as directory separators in a future version. Consider ' +
        'changing foo\\bar to foo/bar.');

      jasmine.addMatchingHelperFiles(['foo\\baz']);
      expect(console.warn).toHaveBeenCalledWith('Backslashes in ' +
        'file paths behave inconsistently between platforms and might not be ' +
        'treated as directory separators in a future version. Consider ' +
        'changing foo\\baz to foo/baz.');
    });

    it('warns about backslashes in spec_files', function() {
      const jasmine = new Jasmine({
        platform: windows,
        jasmineCore: this.fakeJasmineCore,
      });

      jasmine.loadConfig({
        spec_files: ['foo\\bar']
      });
      expect(console.warn).toHaveBeenCalledWith('Backslashes in ' +
        'file paths behave inconsistently between platforms and might not be ' +
        'treated as directory separators in a future version. Consider ' +
        'changing foo\\bar to foo/bar.');

      jasmine.addMatchingSpecFiles(['foo\\baz']);
      expect(console.warn).toHaveBeenCalledWith('Backslashes in ' +
        'file paths behave inconsistently between platforms and might not be ' +
        'treated as directory separators in a future version. Consider ' +
        'changing foo\\baz to foo/baz.');
    });

    it('does not warn if no configured path contains backslashes', function() {
      const jasmine = new Jasmine({
        projectBaseDir: 'c:/foo/bar',
        platform: windows,
        jasmineCore: this.fakeJasmineCore,
      });
      jasmine.loadConfig({
        spec_dir: 'foo/bar',
        spec_files: ['baz/qux'],
        helpers: ['waldo/fred']
      });
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  it('does not warn about backslashes when not running on Windows', function() {
    spyOn(console, 'warn');
    const jasmine = new Jasmine({
      projectBaseDir: 'foo\\bar',
      platform: () => 'NetWare',
      jasmineCore: this.fakeJasmineCore,
    });
    jasmine.loadConfig({
      spec_dir: 'foo\\bar',
      spec_files: ['baz\\qux'],
      helpers: ['waldo\\fred']
    });
    expect(console.warn).not.toHaveBeenCalled();
  });
});
