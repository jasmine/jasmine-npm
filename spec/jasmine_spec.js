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

  it('#addSpecFile', function() {
    expect(testJasmine.specFiles).toEqual([]);
    testJasmine.addSpecFile('some/file/path.js');
    expect(testJasmine.specFiles).toEqual(['some/file/path.js']);
  });

  describe('#addReporter', function() {
    it('creates a reporter with the passed in options', function() {
      spyOn(jasmine, 'ConsoleReporter').and.returnValue({someProperty: 'some value'});;
      spyOn(testJasmine.env, 'addReporter');

      var reporterOptions = {
        print: 'printer',
        onComplete: 'on complete method',
        showColors: true
      };

      testJasmine.addReporter(reporterOptions);

      expect(jasmine.ConsoleReporter).toHaveBeenCalledWith(reporterOptions);
      expect(testJasmine.env.addReporter).toHaveBeenCalledWith({someProperty: 'some value'});
    });

    it('creates a reporter with a default option if an option is not specified', function() {
      spyOn(jasmine, 'ConsoleReporter').and.returnValue({someProperty: 'some value'});;
      spyOn(testJasmine.env, 'addReporter');

      var reporterOptions = {};

      testJasmine.addReporter(reporterOptions);

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

  it('#addMatchers', function() {
    spyOn(jasmine.Expectation, 'addMatchers');
    testJasmine.addMatchers(['fake matcher 1', 'fake matcher 2']);
    expect(jasmine.Expectation.addMatchers).toHaveBeenCalledWith(['fake matcher 1', 'fake matcher 2']);
  });

  describe('#loadConfigFile', function() {
    it('loads the specified configuration file and adds specs to the jasmine runner', function() {
      spyOn(testJasmine, 'addSpecFile');

      testJasmine.loadConfigFile('spec/support/jasmine.json');

      expect(testJasmine.specFiles).toEqual([path.resolve('spec/jasmine_spec.js')]);
    });

    it('loads the default configuration file', function() {
      spyOn(testJasmine, 'addSpecFile');

      testJasmine.loadConfigFile();

      expect(testJasmine.specFiles).toEqual([path.resolve('spec/jasmine_spec.js')]);
    });
  });

  it('#execute', function() {
    spyOn(testJasmine, 'loadSpecs');
    spyOn(testJasmine.env, 'execute');

    testJasmine.execute();

    expect(testJasmine.loadSpecs).toHaveBeenCalled();
    expect(testJasmine.env.execute).toHaveBeenCalled();
  });
});
