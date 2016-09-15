describe('Jasmine', function() {
  var path = require('path'),
      util = require('util'),
      Jasmine = require('../lib/jasmine');

  beforeEach(function() {
    this.bootedJasmine = {
      getEnv: jasmine.createSpy('getEnv').and.returnValue({
        addReporter: jasmine.createSpy('addReporter'),
        provideFallbackReporter: jasmine.createSpy('provideFallbackReporter'),
        execute: jasmine.createSpy('execute'),
        throwOnExpectationFailure: jasmine.createSpy('throwOnExpectationFailure'),
        randomizeTests: jasmine.createSpy('randomizeTests'),
        onComplete: jasmine.createSpy('onComplete')
      }),
      Timer: jasmine.createSpy('Timer'),
      Expectation: {
        addMatchers: jasmine.createSpy('addMatchers')
      }
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

  it('delegates #coreVersion to jasmine-core', function() {
    this.fakeJasmineCore.version = jasmine.createSpy('coreVersion').and.returnValue('a version');
    expect(this.testJasmine.coreVersion()).toEqual('a version');
  });

  describe('#configureDefaultReporter', function() {
    beforeEach(function() {
      spyOn(Jasmine, 'ConsoleReporter').and.returnValue({someProperty: 'some value'});
    });

    it('creates a reporter with the passed in options', function() {
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

      expect(Jasmine.ConsoleReporter).toHaveBeenCalledWith(expectedReporterOptions);
      expect(this.testJasmine.env.provideFallbackReporter).toHaveBeenCalledWith({someProperty: 'some value'});
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

      expect(Jasmine.ConsoleReporter).toHaveBeenCalledWith(expectedReporterOptions);
      expect(this.testJasmine.env.provideFallbackReporter).toHaveBeenCalledWith({someProperty: 'some value'});
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
    expect(this.bootedJasmine.Expectation.addMatchers).toHaveBeenCalledWith(['fake matcher 1', 'fake matcher 2']);
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

    it('adds a default reporter as a fallback reporter', function() {
      this.testJasmine.addReporter(new Jasmine.ConsoleReporter({}));

      //spyOn(this.testJasmine, 'configureDefaultReporter');
      spyOn(this.testJasmine, 'loadSpecs');

      this.testJasmine.execute();

      expect(this.testJasmine.env.provideFallbackReporter).toHaveBeenCalled();
      expect(this.testJasmine.env.addReporter).toHaveBeenCalled();
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

    describe('completion behavior', function() {
      describe('with default onCompleteCallback', function() {
        it('exits successfully when the whole suite is green', function() {
          var exitSpy = jasmine.createSpy('exit');
          this.testJasmine.exit = exitSpy;

          this.testJasmine.onCompleteCallback(true);

          expect(exitSpy).toHaveBeenCalledWith(0, process.platform, process.version, process.exit, require('exit'));
        });

        it('exits with a failure when anything in the suite is not green', function() {
          var exitSpy = jasmine.createSpy('exit');
          this.testJasmine.exit = exitSpy;

          this.testJasmine.onCompleteCallback(false);

          expect(exitSpy).toHaveBeenCalledWith(1, process.platform, process.version, process.exit, require('exit'));
        });
      });

      describe('with custom onCompleteCallback', function() {
        it('delegates exits to custom callback', function() {
          var exitSpy = jasmine.createSpy('exit');
          var onCompleteSpy = jasmine.createSpy('onComplete');
          this.testJasmine.exit = exitSpy;
          var passed = false;

          this.testJasmine.onComplete(onCompleteSpy);
          this.testJasmine.onCompleteCallback(passed);

          expect(exitSpy).not.toHaveBeenCalled();
          expect(onCompleteSpy).toHaveBeenCalledWith(passed);
        });
      });
    });
  });
});
