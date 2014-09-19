describe('Jasmine', function() {
  var path = require('path'),
      util = require('util'),
      Jasmine = require('../lib/jasmine'),
      testJasmine;

  beforeEach(function() {
    testJasmine = new Jasmine();
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
    it('creates a reporter with the passed in options', function() {
      spyOn(jasmine, 'ConsoleReporter').and.returnValue({someProperty: 'some value'});
      spyOn(testJasmine.env, 'addReporter');

      var reporterOptions = {
        print: 'printer',
        onComplete: 'on complete method',
        showColors: true
      };

      testJasmine.configureDefaultReporter(reporterOptions);

      expect(jasmine.ConsoleReporter).toHaveBeenCalledWith(reporterOptions);
      expect(testJasmine.env.addReporter).toHaveBeenCalledWith({someProperty: 'some value'});
    });

    it('creates a reporter with a default option if an option is not specified', function() {
      spyOn(jasmine, 'ConsoleReporter').and.returnValue({someProperty: 'some value'});
      spyOn(testJasmine.env, 'addReporter');

      var reporterOptions = {};

      testJasmine.configureDefaultReporter(reporterOptions);

      var expectedReporterOptions = {
        print: util.print,
        showColors: true,
        onComplete: jasmine.any(Function),
        timer: jasmine.any(Object)
      };

      expect(jasmine.ConsoleReporter).toHaveBeenCalledWith(expectedReporterOptions);
      expect(testJasmine.env.addReporter).toHaveBeenCalledWith({someProperty: 'some value'});
    });
  });

  it('adds matchers to the jasmine env', function() {
    spyOn(jasmine.Expectation, 'addMatchers');
    testJasmine.addMatchers(['fake matcher 1', 'fake matcher 2']);
    expect(jasmine.Expectation.addMatchers).toHaveBeenCalledWith(['fake matcher 1', 'fake matcher 2']);
  });

  describe('loading configurations', function() {
    var fixtureJasmine;
    beforeEach(function() {
      fixtureJasmine = new Jasmine({projectBaseDir: 'spec/fixtures/sample_project'});
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

  describe('#execute', function() {
    it('uses the default console reporter if no reporters were added', function() {
      spyOn(testJasmine, 'configureDefaultReporter');
      spyOn(testJasmine, 'loadSpecs');
      spyOn(testJasmine.env, 'execute');

      testJasmine.execute();

      expect(testJasmine.configureDefaultReporter).toHaveBeenCalledWith({});
      expect(testJasmine.loadSpecs).toHaveBeenCalled();
      expect(testJasmine.env.execute).toHaveBeenCalled();
    });

    it('does not add a default reporter if a reporter was already added', function() {
      testJasmine.addReporter(new jasmine.ConsoleReporter({}));

      spyOn(testJasmine, 'configureDefaultReporter');
      spyOn(testJasmine, 'loadSpecs');
      spyOn(testJasmine.env, 'execute');

      testJasmine.execute();

      expect(testJasmine.configureDefaultReporter).not.toHaveBeenCalled();
      expect(testJasmine.loadSpecs).toHaveBeenCalled();
      expect(testJasmine.env.execute).toHaveBeenCalled();
    });

    it('can run only specified files', function() {
      spyOn(testJasmine, 'configureDefaultReporter');
      spyOn(testJasmine, 'loadSpecs');
      spyOn(testJasmine.env, 'execute');

      testJasmine.loadConfigFile();

      testJasmine.execute(['spec/fixtures/**/*spec.js']);

      var relativePaths = testJasmine.specFiles.map(function(path) {
        return path.replace(__dirname, '');
      });

      expect(relativePaths).toEqual(['/fixtures/sample_project/spec/fixture_spec.js', '/fixtures/sample_project/spec/other_fixture_spec.js']);
    });
  });
});
