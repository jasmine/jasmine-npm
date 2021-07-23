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
  });

  describe('constructor options', function() {
    it('have defaults', function() {
      expect(this.testJasmine.projectBaseDir).toEqual(path.resolve());
    });
  });

  it('adds spec files', function() {
    expect(this.testJasmine.specFiles).toEqual([]);
    this.testJasmine.addSpecFile('some/file/path.js');
    expect(this.testJasmine.specFiles).toEqual(['some/file/path.js']);
  });

  describe('file handler', function() {
    function basename(name) { return path.basename(name); }

    it('add spec files with absolute glob pattern', function() {
      if (!path.isAbsolute) { return; }
      var aFile = path.join(this.testJasmine.projectBaseDir, this.testJasmine.specDir, 'spec/command_spec.js');
      expect(this.testJasmine.specFiles).toEqual([]);
      this.testJasmine.addSpecFiles([aFile]);
      expect(this.testJasmine.specFiles).toEqual([slash(aFile)]);
    });

    it('add spec files with glob pattern', function() {
      expect(this.testJasmine.specFiles).toEqual([]);
      this.testJasmine.addSpecFiles(['spec/fixtures/jasmine_spec/*.js']);
      expect(this.testJasmine.specFiles.map(basename)).toEqual([
        'c.js',
        'd.js',
        'e.js',
        'f.js',
      ]);
    });

    it('add spec files with excluded files', function() {
      expect(this.testJasmine.specFiles).toEqual([]);
      this.testJasmine.addSpecFiles([
        'spec/fixtures/jasmine_spec/*.js',
        '!spec/fixtures/jasmine_spec/c*'
      ]);
      expect(this.testJasmine.specFiles.map(basename)).toEqual([
        'd.js',
        'e.js',
        'f.js',
      ]);
    });

    it('add spec files with glob pattern to existings files', function() {
      var aFile = path.join(this.testJasmine.projectBaseDir, this.testJasmine.specDir, 'spec/command_spec.js');
      this.testJasmine.specFiles = [aFile, 'b'];
      this.testJasmine.addSpecFiles(['spec/fixtures/jasmine_spec/*.js']);
      expect(this.testJasmine.specFiles.map(basename)).toEqual([
        'command_spec.js',
        'b',
        'c.js',
        'd.js',
        'e.js',
        'f.js',
      ]);
    });

    it('add helper files with glob pattern to existings files', function() {
      var aFile = path.join(this.testJasmine.projectBaseDir, this.testJasmine.specDir, 'spec/command_spec.js');
      this.testJasmine.helperFiles = [aFile, 'b'];
      this.testJasmine.addHelperFiles(['spec/fixtures/jasmine_spec/*.js']);
      expect(this.testJasmine.helperFiles.map(basename)).toEqual([
        'command_spec.js',
        'b',
        'c.js',
        'd.js',
        'e.js',
        'f.js',
      ]);
    });
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
        it('tells the loader not to always import', async function() {
          this.configObject.jsLoader = undefined;
          
          this.fixtureJasmine.loadConfig(this.configObject);
          await this.fixtureJasmine.loadSpecs();

          expect(this.loader.load).toHaveBeenCalledWith(jasmine.any(String), false);
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

  describe('#onComplete', function() {
    it('stores an onComplete function', function() {
      var fakeOnCompleteCallback = function() {};
      spyOn(this.testJasmine.completionReporter, 'onComplete');

      this.testJasmine.onComplete(fakeOnCompleteCallback);
      expect(this.testJasmine.completionReporter.onComplete).toHaveBeenCalledWith(fakeOnCompleteCallback);
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

    describe('default completion behavior', function() {
      it('exits successfully when the whole suite is green', function() {
        var exitSpy = jasmine.createSpy('exit');
        this.testJasmine.exit = exitSpy;

        this.testJasmine.exitCodeCompletion(true);
        sleep(10).then(function() {
          expect(exitSpy).toHaveBeenCalledWith(0);
        });
      });

      it('exits with a failure when anything in the suite is not green', function() {
        var exitSpy = jasmine.createSpy('exit');
        this.testJasmine.exit = exitSpy;

        this.testJasmine.exitCodeCompletion(false);
        sleep(10).then(function() {
          expect(exitSpy).toHaveBeenCalledWith(1);
        });
      });

      function sleep(ms) {
        return new Promise(function(resolve) {
          setTimeout(resolve, ms);
        });
      }
    });
  });
});
