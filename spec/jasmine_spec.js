describe('Jasmine', function() {
  var path = require('path'),
      util = require('util'),
      Jasmine = require('../lib/jasmine');

  beforeEach(function() {
    this.bootedJasmine = {
      getEnv: jasmine.createSpy('getEnv').and.returnValue({
        addReporter: jasmine.createSpy('addReporter'),
        clearReporters: jasmine.createSpy('clearReporters'),
        addMatchers: jasmine.createSpy('addMatchers'),
        provideFallbackReporter: jasmine.createSpy('provideFallbackReporter'),
        execute: jasmine.createSpy('execute'),
        throwOnExpectationFailure: jasmine.createSpy('throwOnExpectationFailure'),
        randomizeTests: jasmine.createSpy('randomizeTests')
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

  afterEach(function() {
    if (this.testJasmine.checkExit) {
      process.removeListener('exit', this.testJasmine.checkExit);
    }
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
      expect(this.testJasmine.specFiles).toEqual([aFile]);
    });

    it('add spec files with glob pattern', function() {
      expect(this.testJasmine.specFiles).toEqual([]);
      this.testJasmine.addSpecFiles(['spec/*.js']);
      expect(this.testJasmine.specFiles.map(basename)).toEqual(['command_spec.js', 'exit_spec.js', 'jasmine_spec.js']);
    });

    it('add spec files with glob pattern to existings files', function() {
      var aFile = path.join(this.testJasmine.projectBaseDir, this.testJasmine.specDir, 'spec/command_spec.js');
      this.testJasmine.specFiles = [aFile, 'b'];
      this.testJasmine.addSpecFiles(['spec/*.js']);
      expect(this.testJasmine.specFiles.map(basename)).toEqual(['command_spec.js', 'b', 'exit_spec.js', 'jasmine_spec.js']);
    });

    it('add helper files with glob pattern to existings files', function() {
      var aFile = path.join(this.testJasmine.projectBaseDir, this.testJasmine.specDir, 'spec/command_spec.js');
      this.testJasmine.helperFiles = [aFile, 'b'];
      this.testJasmine.addHelperFiles(['spec/*.js']);
      expect(this.testJasmine.helperFiles.map(basename)).toEqual(['command_spec.js', 'b', 'exit_spec.js', 'jasmine_spec.js']);
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
        timer: 'timer'
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
        timer: jasmine.any(Object),
        jasmineCorePath: 'fake/jasmine/path/jasmine.js'
      };

      expect(this.testJasmine.reporter.setOptions).toHaveBeenCalledWith(expectedReporterOptions);
    });

    describe('passing in an onComplete function', function() {
      it('warns the user of deprecation', function() {
        this.testJasmine.printDeprecation = jasmine.createSpy('printDeprecation');
        var reporterOptions = {
          onComplete: function() {}
        };

        this.testJasmine.configureDefaultReporter(reporterOptions);

        expect(this.testJasmine.printDeprecation).toHaveBeenCalledWith('Passing in an onComplete function to configureDefaultReporter is deprecated.');
      });
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
        this.configObject = {
          spec_dir: "spec",
          spec_files: [
            "fixture_spec.js",
            "**/*spec.js"
          ],
          helpers: [
            "helper.js"
          ]
        };
      });

      it('adds unique specs to the jasmine runner', function() {
        this.fixtureJasmine.loadConfig(this.configObject);
        expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
        expect(this.fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/fixture_spec.js',
          'spec/fixtures/sample_project/spec/other_fixture_spec.js'
        ]);
      });

      it('can tell jasmine-core to stop spec on expectation failure', function() {
        this.configObject.stopSpecOnExpectationFailure = true;
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.throwOnExpectationFailure).toHaveBeenCalledWith(true);
      });

      it('tells jasmine-core not to stop spec on expectation failure by default', function() {
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.throwOnExpectationFailure).toHaveBeenCalledWith(undefined);
      });

      it('can tell jasmine-core to run random specs', function() {
        this.configObject.random = true;
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.randomizeTests).toHaveBeenCalledWith(true);
      });

      it('tells jasmine-core not to not run random specs by default', function() {
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.randomizeTests).toHaveBeenCalledWith(undefined);
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

    });

    describe('from a file', function() {
      it('adds unique specs to the jasmine runner', function() {
        this.fixtureJasmine.loadConfigFile('spec/support/jasmine_alternate.json');
        expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
        expect(this.fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/fixture_spec.js',
          'spec/fixtures/sample_project/spec/other_fixture_spec.js'
        ]);
      });

      it('loads the specified configuration file from an absolute path', function() {
        var absoluteConfigPath = path.join(__dirname, 'fixtures/sample_project/spec/support/jasmine_alternate.json');
        this.fixtureJasmine.loadConfigFile(absoluteConfigPath);
        expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
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
          'spec/fixtures/sample_project/spec/fixture_spec.js',
        ]);
      });
    });
  });

  describe('#stopSpecOnExpectationFailure', function() {
    it('sets the throwOnExpectationFailure value on the jasmine-core env', function() {
      this.testJasmine.stopSpecOnExpectationFailure('foobar');
      expect(this.testJasmine.env.throwOnExpectationFailure).toHaveBeenCalledWith('foobar');
    });
  });

  describe('#randomizeTests', function() {
    it('sets the randomizeTests value on the jasmine-core env', function() {
      this.testJasmine.randomizeTests('foobar');
      expect(this.testJasmine.env.randomizeTests).toHaveBeenCalledWith('foobar');
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

  describe('#execute', function() {
    it('uses the default console reporter if no reporters were added', function() {
      spyOn(this.testJasmine, 'configureDefaultReporter');
      spyOn(this.testJasmine, 'loadSpecs');

      this.testJasmine.execute();

      expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalledWith({showColors: true});
      expect(this.testJasmine.loadSpecs).toHaveBeenCalled();
      expect(this.testJasmine.env.execute).toHaveBeenCalled();
    });

    it('configures the default console reporter with the right color settings', function() {
      spyOn(this.testJasmine, 'configureDefaultReporter');
      spyOn(this.testJasmine, 'loadSpecs');
      this.testJasmine.showColors(false);

      this.testJasmine.execute();

      expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalledWith({showColors: false});
      expect(this.testJasmine.loadSpecs).toHaveBeenCalled();
      expect(this.testJasmine.env.execute).toHaveBeenCalled();
    });

    it('does not configure the default reporter if this was already done', function() {
      spyOn(this.testJasmine, 'loadSpecs');

      this.testJasmine.configureDefaultReporter({showColors: false});

      spyOn(this.testJasmine, 'configureDefaultReporter');

      this.testJasmine.execute();

      expect(this.testJasmine.configureDefaultReporter).not.toHaveBeenCalled();
      expect(this.testJasmine.loadSpecs).toHaveBeenCalled();
      expect(this.testJasmine.env.execute).toHaveBeenCalled();
    });

    it('loads helper files before checking if any reporters were added', function() {
      var loadHelpers = spyOn(this.testJasmine, 'loadHelpers');
      spyOn(this.testJasmine, 'configureDefaultReporter').and.callFake(function() {
        expect(loadHelpers).toHaveBeenCalled();
      });
      spyOn(this.testJasmine, 'loadSpecs');

      this.testJasmine.execute();

      expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalled();
    });

    it('can run only specified files', function() {
      spyOn(this.testJasmine, 'configureDefaultReporter');
      spyOn(this.testJasmine, 'loadSpecs');

      this.testJasmine.loadConfigFile();

      this.testJasmine.execute(['spec/fixtures/**/*spec.js']);

      var relativePaths = this.testJasmine.specFiles.map(function(path) {
        return path.replace(__dirname, '');
      });

      expect(relativePaths).toEqual(['/fixtures/sample_project/spec/fixture_spec.js', '/fixtures/sample_project/spec/other_fixture_spec.js']);
    });

    it('should add spec filter if filterString is provided', function() {
      this.testJasmine.loadConfigFile();

      this.testJasmine.execute(['spec/fixtures/**/*spec.js'], 'interesting spec');
      expect(this.testJasmine.env.specFilter).toEqual(jasmine.any(Function));
    });

    it('adds an exit code reporter', function() {
      var completionReporterSpy = jasmine.createSpyObj('reporter', ['onComplete']);
      this.testJasmine.completionReporter = completionReporterSpy;
      spyOn(this.testJasmine, 'addReporter');

      this.testJasmine.execute();

      expect(this.testJasmine.addReporter).toHaveBeenCalledWith(completionReporterSpy);
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
        expect(exitSpy).toHaveBeenCalledWith(0, process.platform, process.version, process.exit, require('exit'));
      });

      it('exits with a failure when anything in the suite is not green', function() {
        var exitSpy = jasmine.createSpy('exit');
        this.testJasmine.exit = exitSpy;

        this.testJasmine.exitCodeCompletion(false);
        expect(exitSpy).toHaveBeenCalledWith(1, process.platform, process.version, process.exit, require('exit'));
      });
    });
  });
});
