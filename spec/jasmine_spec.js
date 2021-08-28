describe('Jasmine', function() {
  var path = require('path'),
      slash = require('slash'),
      Jasmine = require('../lib/jasmine');

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
    describe('#addSpecFiles', function() {
      hasCommonFileGlobBehavior('addSpecFiles', 'specFiles');
    });

    describe('#addMatchingSpecFiles', function() {
      hasCommonFileGlobBehavior('addMatchingSpecFiles', 'specFiles');
    });

    describe('#addHelperFiles', function() {
      hasCommonFileGlobBehavior('addHelperFiles', 'helperFiles');
    });

    describe('#addMatchingHelperFiles', function() {
      hasCommonFileGlobBehavior('addMatchingHelperFiles', 'helperFiles');
    });


    function hasCommonFileGlobBehavior(method, destProp) {
      it('adds a file with an absolute path', function() {
        var aFile = path.join(this.testJasmine.projectBaseDir, this.testJasmine.specDir, 'spec/command_spec.js');
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
        var aFile = path.join(this.testJasmine.projectBaseDir, this.testJasmine.specDir, 'spec/command_spec.js');
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

    var testJasmine = new Jasmine({ jasmineCore: this.fakeJasmineCore });

    expect(testJasmine.env.addReporter).toHaveBeenCalledWith({someProperty: 'some value'});
  });

  it('exposes #addReporter and #clearReporters', function() {
    var testJasmine = new Jasmine({ jasmineCore: this.fakeJasmineCore });
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
      var reporterOptions = {
        print: 'printer',
        showColors: true,
        jasmineCorePath: 'path',
      };

      var expectedReporterOptions = Object.keys(reporterOptions).reduce(function(options, key) {
        options[key] = reporterOptions[key];
        return options;
      }, {});

      this.testJasmine.configureDefaultReporter(reporterOptions);

      expect(this.testJasmine.reporter.setOptions).toHaveBeenCalledWith(expectedReporterOptions);
    });

    it('creates a reporter with a default option if an option is not specified', function() {
      var reporterOptions = {};

      this.testJasmine.configureDefaultReporter(reporterOptions);

      var expectedReporterOptions = {
        print: jasmine.any(Function),
        showColors: true,
        jasmineCorePath: path.normalize('fake/jasmine/path/jasmine.js')
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
      this.loader = jasmine.createSpyObj('loader', ['load']);
      this.fixtureJasmine = new Jasmine({
        jasmineCore: this.fakeJasmineCore,
        loader: this.loader,
        projectBaseDir: 'spec/fixtures/sample_project'
      });
    });

    describe('from an object', function() {
      beforeEach(function() {
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

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({oneFailurePerSpec: true});
      });

      it('does not configure jasmine-core for stopping spec on expectation failure by default', function() {
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).not.toHaveBeenCalled();
      });

      it('can tell jasmine-core to stop execution when a spec fails', function() {
        this.configObject.stopOnSpecFailure = true;
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({failFast: true});
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
          var config = this.configObject;
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

          expect(this.loader.load).toHaveBeenCalledWith(jasmine.any(String), false);
        });
      });

      describe('with jsLoader: "import"', function () {
        it('tells the loader to always import', async function() {
          this.configObject.jsLoader = 'import';

          this.fixtureJasmine.loadConfig(this.configObject);
          await this.fixtureJasmine.loadSpecs();

          expect(this.loader.load).toHaveBeenCalledWith(jasmine.any(String), true);
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

          expect(this.loader.load).toHaveBeenCalledWith(jasmine.any(String), true);
        });
      });
    });

    describe('from a file', function() {
      it('adds unique specs to the jasmine runner', function() {
        this.fixtureJasmine.loadConfigFile('spec/support/jasmine_alternate.json');
        expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
        expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
        expect(this.fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/fixture_spec.js',
          'spec/fixtures/sample_project/spec/other_fixture_spec.js'
        ]);
      });

      it('loads the specified configuration file from an absolute path', function() {
        var absoluteConfigPath = path.join(__dirname, 'fixtures/sample_project/spec/support/jasmine_alternate.json');
        this.fixtureJasmine.loadConfigFile(absoluteConfigPath);
        expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
        expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
        expect(this.fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/fixture_spec.js',
          'spec/fixtures/sample_project/spec/other_fixture_spec.js'
        ]);
      });

      it('throw error if specified configuration file doesn\'t exist', function() {
        var jasmine = this.fixtureJasmine;
        function load() { jasmine.loadConfigFile('missing.json'); }
        expect(load).toThrow();
      });

      it('no error if default configuration file doesn\'t exist', function() {
        var jasmine = this.fixtureJasmine;
        function load() {
          jasmine.projectBaseDir += '/missing';
          jasmine.loadConfigFile();
        }
        expect(load).not.toThrow();
      });

      it('loads the default configuration file', function() {
        this.fixtureJasmine.loadConfigFile();
        expect(this.fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/fixture_spec.js'
        ]);
      });
    });
  });

  describe('#stopSpecOnExpectationFailure', function() {
    it('sets the throwOnExpectationFailure value on the jasmine-core env', function() {
      this.testJasmine.stopSpecOnExpectationFailure('foobar');
      expect(this.testJasmine.env.configure).toHaveBeenCalledWith({oneFailurePerSpec: 'foobar'});
    });
  });

  describe('#stopOnSpecFailure', function() {
    it('sets the stopOnSpecFailure value on the jasmine-core env', function() {
      this.testJasmine.stopOnSpecFailure('blah');
      expect(this.testJasmine.env.configure).toHaveBeenCalledWith({failFast: 'blah'});
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

      await this.testJasmine.execute();

      expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalledWith({showColors: true});
      expect(this.testJasmine.loadSpecs).toHaveBeenCalled();
      expect(this.testJasmine.env.execute).toHaveBeenCalled();
    });

    it('configures the default console reporter with the right color settings', async function() {
      spyOn(this.testJasmine, 'configureDefaultReporter');
      spyOn(this.testJasmine, 'loadSpecs');
      this.testJasmine.showColors(false);

      await this.testJasmine.execute();

      expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalledWith({showColors: false});
      expect(this.testJasmine.loadSpecs).toHaveBeenCalled();
      expect(this.testJasmine.env.execute).toHaveBeenCalled();
    });

    it('does not configure the default reporter if this was already done', async function() {
      spyOn(this.testJasmine, 'loadSpecs');

      this.testJasmine.configureDefaultReporter({showColors: false});

      spyOn(this.testJasmine, 'configureDefaultReporter');

      await this.testJasmine.execute();

      expect(this.testJasmine.configureDefaultReporter).not.toHaveBeenCalled();
      expect(this.testJasmine.loadSpecs).toHaveBeenCalled();
      expect(this.testJasmine.env.execute).toHaveBeenCalled();
    });

    it('loads helper files before checking if any reporters were added', async function() {
      var loadHelpers = spyOn(this.testJasmine, 'loadHelpers');
      spyOn(this.testJasmine, 'configureDefaultReporter').and.callFake(function() {
        expect(loadHelpers).toHaveBeenCalled();
      });
      spyOn(this.testJasmine, 'loadSpecs');

      await this.testJasmine.execute();

      expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalled();
    });

    it('can run only specified files', async function() {
      spyOn(this.testJasmine, 'configureDefaultReporter');
      spyOn(this.testJasmine, 'loadSpecs');

      this.testJasmine.loadConfigFile();

      await this.testJasmine.execute(['spec/fixtures/sample_project/**/*spec.js']);

      var relativePaths = this.testJasmine.specFiles.map(function(filePath) {
        return slash(path.relative(__dirname, filePath));
      });

      expect(relativePaths).toEqual(['fixtures/sample_project/spec/fixture_spec.js', 'fixtures/sample_project/spec/other_fixture_spec.js']);
    });

    it('should add spec filter if filterString is provided', async function() {
      this.testJasmine.loadConfigFile();

      await this.testJasmine.execute(['spec/fixtures/example/*spec.js'], 'interesting spec');
      expect(this.testJasmine.env.configure).toHaveBeenCalledWith({specFilter: jasmine.any(Function)});
    });

    it('adds an exit code reporter', async function() {
      var completionReporterSpy = jasmine.createSpyObj('reporter', ['onComplete']);
      this.testJasmine.completionReporter = completionReporterSpy;
      spyOn(this.testJasmine, 'addReporter');

      await this.testJasmine.execute();

      expect(this.testJasmine.addReporter).toHaveBeenCalledWith(completionReporterSpy);
      expect(this.testJasmine.completionReporter.exitHandler).toBe(this.testJasmine.checkExit);
    });

    describe('when exit is called prematurely', function() {
      beforeEach(function() {
        this.originalCode = process.exitCode;
      });

      afterEach(function() {
        process.exitCode = this.originalCode;
      });

      it('sets the exit code to failure', function() {
        this.testJasmine.checkExit();
        expect(process.exitCode).toEqual(4);
      });

      it('leaves it if the suite has completed', function() {
        var completionReporterSpy = jasmine.createSpyObj('reporter', ['isComplete']);
        completionReporterSpy.isComplete.and.returnValue(true);
        this.testJasmine.completionReporter = completionReporterSpy;

        this.testJasmine.checkExit();
        expect(process.exitCode).toBeUndefined();
      });
    });

    describe('completion behavior', function() {
      beforeEach(function() {
        this.runWithOverallStatus = async function(overallStatus) {
          const reporters = [];
          this.testJasmine.env = {
            execute: jasmine.createSpy('env.execute'),
            addReporter: reporter => {
              reporters.push(reporter);
            }
          };
          spyOn(this.testJasmine, 'exit');

          await new Promise(resolve => {
            this.testJasmine.env.execute.and.callFake(resolve);
            this.testJasmine.execute();
          });

          for (const reporter of reporters) {
            reporter.jasmineDone({overallStatus});
          }

          await sleep(10);
        };

        function sleep(ms) {
          return new Promise(function (resolve) {
            setTimeout(resolve, ms);
          });
        }
      });

      describe('default', function() {
        it('exits successfully when the whole suite is green', async function () {
          await this.runWithOverallStatus('passed');
          expect(this.testJasmine.exit).toHaveBeenCalledWith(0);
        });

        it('exits with a failure when anything in the suite is not green', async function () {
          await this.runWithOverallStatus('failed');
          expect(this.testJasmine.exit).toHaveBeenCalledWith(1);
        });
      });

      describe('When exitOnCompletion is set to false', function() {
        it('does not exit', async function() {
          this.testJasmine.exitOnCompletion = false;
          await this.runWithOverallStatus('anything');
          expect(this.testJasmine.exit).not.toHaveBeenCalled();
        });
      });
    });

    describe('The returned promise', function() {
      beforeEach(function() {
        this.autocompletingFakeEnv = function(overallStatus) {
          let reporters = [];
          return {
            execute: function(ignored, callback) {
              for (const reporter of reporters) {
                reporter.jasmineDone({overallStatus});
              }
              callback();
            },
            addReporter: reporter => {
              reporters.push(reporter);
            },
            clearReporters: function() {
              reporters = [];
            }
          };
        };
      });

      it('is resolved with the overall suite status', async function() {
        this.testJasmine.env = this.autocompletingFakeEnv('failed');

        await expectAsync(this.testJasmine.execute())
          .toBeResolvedTo(jasmine.objectContaining({overallStatus: 'failed'}));
      });

      it('is resolved with the overall suite status even if clearReporters was called', async function() {
        this.testJasmine.env = this.autocompletingFakeEnv('incomplete');
        this.testJasmine.clearReporters();

        await expectAsync(this.testJasmine.execute())
          .toBeResolvedTo(jasmine.objectContaining({overallStatus: 'incomplete'}));
      });
    });
  });
});
