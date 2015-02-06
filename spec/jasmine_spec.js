describe('Jasmine', function() {
  var path = require('path'),
      util = require('util'),
      Jasmine = require('../lib/jasmine'),
      bootedJasmine,
      fakeJasmineCore,
      testJasmine;

  beforeEach(function() {
    bootedJasmine = {
      getEnv: jasmine.createSpy('getEnv').and.returnValue({
        addReporter: jasmine.createSpy('addReporter'),
        execute: jasmine.createSpy('execute')
      }),
      Timer: jasmine.createSpy('Timer'),
      Expectation: {
        addMatchers: jasmine.createSpy('addMatchers')
      }
    };

    fakeJasmineCore = {
      boot: jasmine.createSpy('boot').and.returnValue(bootedJasmine),
      files: {
        path: 'fake/jasmine/path'
      }
    };

    testJasmine = new Jasmine({ jasmineCore: fakeJasmineCore });
  });

  describe('constructor options', function() {
    it('have defaults', function() {
      expect(testJasmine.projectBaseDir).toEqual(path.resolve());
    });
  });

  it('adds spec files', function() {
    expect(testJasmine.specFiles).toEqual([]);
    testJasmine.addSpecFile('some/file/path.js');
    expect(testJasmine.specFiles).toEqual(['some/file/path.js']);
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

      testJasmine.configureDefaultReporter(reporterOptions);

      expect(Jasmine.ConsoleReporter).toHaveBeenCalledWith(expectedReporterOptions);
      expect(testJasmine.env.addReporter).toHaveBeenCalledWith({someProperty: 'some value'});
    });

    it('creates a reporter with a default option if an option is not specified', function() {
      var reporterOptions = {};

      testJasmine.configureDefaultReporter(reporterOptions);

      var expectedReporterOptions = {
        print: jasmine.any(Function),
        showColors: true,
        timer: jasmine.any(Object),
        jasmineCorePath: 'fake/jasmine/path/jasmine.js'
      };

      expect(Jasmine.ConsoleReporter).toHaveBeenCalledWith(expectedReporterOptions);
      expect(testJasmine.env.addReporter).toHaveBeenCalledWith({someProperty: 'some value'});
    });

    describe('passing in an onComplete function', function() {
      it('warns the user of deprecation', function() {
        testJasmine.printDeprecation = jasmine.createSpy('printDeprecation');
        var reporterOptions = {
          onComplete: function() {}
        };

        testJasmine.configureDefaultReporter(reporterOptions);

        expect(testJasmine.printDeprecation).toHaveBeenCalledWith('Passing in an onComplete function to configureDefaultReporter is deprecated.');
      });
    });
  });

  it('adds matchers to the jasmine env', function() {
    testJasmine.addMatchers(['fake matcher 1', 'fake matcher 2']);
    expect(bootedJasmine.Expectation.addMatchers).toHaveBeenCalledWith(['fake matcher 1', 'fake matcher 2']);
  });

  describe('loading configurations', function() {
    var fixtureJasmine;
    beforeEach(function() {
      fixtureJasmine = new Jasmine({
        jasmineCore: fakeJasmineCore,
        projectBaseDir: 'spec/fixtures/sample_project'
      });
    });

    describe('from an object', function() {
      var configObject = {
        spec_dir: "spec",
        spec_files: [
          "fixture_spec.js",
          "**/*.js"
        ],
        helpers: [
          "helper.js"
        ]
      };

      it('adds unique specs to the jasmine runner', function() {
        fixtureJasmine.loadConfig(configObject);
        expect(fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/helper.js',
          'spec/fixtures/sample_project/spec/fixture_spec.js',
          'spec/fixtures/sample_project/spec/other_fixture_spec.js'
        ]);
      });
    });

    describe('from a file', function() {
      it('adds unique specs to the jasmine runner', function() {
        fixtureJasmine.loadConfigFile('spec/support/jasmine_alternate.json');
        expect(fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/helper.js',
          'spec/fixtures/sample_project/spec/fixture_spec.js',
          'spec/fixtures/sample_project/spec/other_fixture_spec.js'
        ]);
      });

      it('loads the specified configuration file from an absolute path', function() {
        var absoluteConfigPath = path.join(__dirname, 'fixtures/sample_project/spec/support/jasmine_alternate.json');
        fixtureJasmine.loadConfigFile(absoluteConfigPath);
        expect(fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/helper.js',
          'spec/fixtures/sample_project/spec/fixture_spec.js',
          'spec/fixtures/sample_project/spec/other_fixture_spec.js'
        ]);
      });

      it('loads the default configuration file', function() {
        fixtureJasmine.loadConfigFile();
        expect(fixtureJasmine.specFiles).toEqual([
          'spec/fixtures/sample_project/spec/fixture_spec.js',
        ]);
      });
    });
  });

  describe('#onComplete', function() {
    it('stores an onComplete function', function() {
      var fakeOnCompleteCallback = function() {};
      spyOn(testJasmine.exitCodeReporter, 'onComplete');

      testJasmine.onComplete(fakeOnCompleteCallback);
      expect(testJasmine.exitCodeReporter.onComplete).toHaveBeenCalledWith(fakeOnCompleteCallback);
    });
  });

  describe('#execute', function() {
    it('uses the default console reporter if no reporters were added', function() {
      spyOn(testJasmine, 'configureDefaultReporter');
      spyOn(testJasmine, 'loadSpecs');

      testJasmine.execute();

      expect(testJasmine.configureDefaultReporter).toHaveBeenCalledWith({});
      expect(testJasmine.loadSpecs).toHaveBeenCalled();
      expect(testJasmine.env.execute).toHaveBeenCalled();
    });

    it('does not add a default reporter if a reporter was already added', function() {
      testJasmine.addReporter(new Jasmine.ConsoleReporter({}));

      spyOn(testJasmine, 'configureDefaultReporter');
      spyOn(testJasmine, 'loadSpecs');

      testJasmine.execute();

      expect(testJasmine.configureDefaultReporter).not.toHaveBeenCalled();
      expect(testJasmine.loadSpecs).toHaveBeenCalled();
      expect(testJasmine.env.execute).toHaveBeenCalled();
    });

    it('can run only specified files', function() {
      spyOn(testJasmine, 'configureDefaultReporter');
      spyOn(testJasmine, 'loadSpecs');

      testJasmine.loadConfigFile();

      testJasmine.execute(['spec/fixtures/**/*spec.js']);

      var relativePaths = testJasmine.specFiles.map(function(path) {
        return path.replace(__dirname, '');
      });

      expect(relativePaths).toEqual(['/fixtures/sample_project/spec/fixture_spec.js', '/fixtures/sample_project/spec/other_fixture_spec.js']);
    });

    it('adds an exit code reporter', function() {
      var exitCodeReporterSpy = jasmine.createSpyObj('reporter', ['onComplete']);
      testJasmine.exitCodeReporter = exitCodeReporterSpy;
      spyOn(testJasmine, 'addReporter');

      testJasmine.execute();

      expect(testJasmine.addReporter).toHaveBeenCalledWith(exitCodeReporterSpy);
    });

    describe('default completion behavior', function() {
      it('exits successfully when the whole suite is green', function() {
        var exitSpy = jasmine.createSpy('exit');
        testJasmine.exit = exitSpy;

        var exitCodeReporterSpy = jasmine.createSpyObj('reporter', ['onComplete']);
        testJasmine.exitCodeReporter = exitCodeReporterSpy;

        testJasmine.execute();
        exitCodeReporterSpy.onComplete.calls.mostRecent().args[0](true);
        expect(exitSpy).toHaveBeenCalledWith(0);
      });

      it('exits with a failure when anything in the suite is not green', function() {
        var exitSpy = jasmine.createSpy('exit');
        testJasmine.exit = exitSpy;

        var exitCodeReporterSpy = jasmine.createSpyObj('reporter', ['onComplete']);
        testJasmine.exitCodeReporter = exitCodeReporterSpy;

        testJasmine.execute();
        exitCodeReporterSpy.onComplete.calls.mostRecent().args[0](false);
        expect(exitSpy).toHaveBeenCalledWith(1);
      });
    });
  });
});
