const Jasmine = require('../lib/jasmine');
const sharedRunnerBehaviors = require('./shared_runner_behaviors');

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

    this.execute = execute;
  });

  sharedRunnerBehaviors(function(options) {
    return new Jasmine({
      jasmineCore: this.fakeJasmineCore,
      ...options,
    });
  });

  it('delegates #coreVersion to jasmine-core', function () {
    this.fakeJasmineCore.version = () => 'a version';
    expect(this.testJasmine.coreVersion()).toEqual('a version');
  });

  it('registers a console reporter upon construction', function () {
    const testJasmine = new Jasmine({jasmineCore: this.fakeJasmineCore});

    expect(testJasmine.env.addReporter).toHaveBeenCalledWith(jasmine.any(Jasmine.ConsoleReporter));
  });

  it('can add and clear reporters', function() {
    const testJasmine = new Jasmine({ jasmineCore: this.fakeJasmineCore });
    expect(testJasmine.reportersCount).toEqual(1);
    testJasmine.clearReporters();
    expect(testJasmine.reportersCount).toEqual(0);
    expect(testJasmine.env.clearReporters).toHaveBeenCalled();
    testJasmine.addReporter({someProperty: 'some value'});
    expect(testJasmine.reportersCount).toEqual(1);
    expect(testJasmine.env.addReporter).toHaveBeenCalledWith({someProperty: 'some value'});
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

      // TODO move these to shared
      it('can tell jasmine-core to stop spec on no expectations', function() {
        this.fixtureJasmine.loadConfig({failSpecWithNoExpectations: true});

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({failSpecWithNoExpectations: true});
      });

      it('can tell jasmine-core to stop spec on expectation failure', function() {
        this.fixtureJasmine.loadConfig({stopSpecOnExpectationFailure: true});

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({stopSpecOnExpectationFailure: true});
      });

      it('can tell jasmine-core to stop execution when a spec fails', function() {
        this.fixtureJasmine.loadConfig({stopOnSpecFailure: true});

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({stopOnSpecFailure: true});
      });

      it('can tell jasmine-core to run random specs', function() {
        this.fixtureJasmine.loadConfig({random: true});

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({random: true});
      });

      it('uses jasmine-core defaults if no config options specified', function() {
        this.fixtureJasmine.loadConfig({});

        expect(this.fixtureJasmine.env.configure).not.toHaveBeenCalled();
      });

      it('can configure the env with arbitrary properties', function() {
        const envConfig = {someProp: 'someVal'};
        this.fixtureJasmine.loadConfig({env: envConfig});

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith(envConfig);
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

      it('sets alwaysListPendingSpecs when present', function() {
        this.fixtureJasmine.loadConfig({alwaysListPendingSpecs: false});
        expect(this.fixtureJasmine.alwaysListPendingSpecs_).toBeFalse();
      });

      it('does not set alwaysListPendingSpecs when absent', function() {
        this.fixtureJasmine.loadConfig({});
        expect(this.fixtureJasmine.alwaysListPendingSpecs_).toBeTrue();
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

  // TODO: not supported in parallel
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
    it('executes the env', async function() {
      await this.execute();
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

    it('should add spec filter if filterString is provided', async function() {
      await this.execute({
        executeArgs: [['spec/fixtures/example/*spec.js'], 'interesting spec']
      });

      expect(this.testJasmine.env.configure).toHaveBeenCalledWith({specFilter: jasmine.any(Function)});
    });

    it('loads specs', async function() {
      spyOn(this.testJasmine, 'loadSpecs');

      await this.execute();

      expect(this.testJasmine.loadSpecs).toHaveBeenCalled();
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
});

async function execute(options = {}) {
  const overallStatus = options.overallStatus || 'passed';
  const executeArgs = options.executeArgs || [];

  let executePromise;
  let resolveEnvExecutePromise;
  const envExecutePromise = new Promise(resolve => {
    resolveEnvExecutePromise = resolve;
  });
  await new Promise(resolve => {
    this.testJasmine.env.execute.and.callFake(function () {
      resolve();
      return envExecutePromise;
    });
    executePromise = this.testJasmine.execute.apply(this.testJasmine, executeArgs);
  });

  resolveEnvExecutePromise({overallStatus});
  return executePromise;
}
