const path = require('path');
const ConsoleReporter = require('@jasminejs/reporters/console');
const Jasmine = require('../lib/jasmine');
const {sharedRunnerBehaviors} = require('./shared_runner_behaviors');
const {poll, shortPoll} = require('./poll');

describe('Jasmine', function() {
  beforeEach(function () {
    this.bootedJasmine = {
      getEnv: jasmine.createSpy('getEnv').and.returnValue({
        addReporter: jasmine.createSpy('addReporter'),
        clearReporters: jasmine.createSpy('clearReporters'),
        addMatchers: jasmine.createSpy('addMatchers'),
        provideFallbackReporter: jasmine.createSpy('provideFallbackReporter'),
        execute: jasmine.createSpy('execute')
          .and.callFake(function () {
            return Promise.reject(new Error('Unconfigured call to Env#execute'));
          }),
        configure: jasmine.createSpy('configure'),
        topSuite: jasmine.createSpy('topSuite'),
      }),
      Timer: jasmine.createSpy('Timer')
    };

    this.fakeJasmineCore = {
      boot: jasmine.createSpy('boot').and.returnValue(this.bootedJasmine),
      files: {
        path: 'fake/jasmine/path'
      }
    };

    this.globalSetupOrTeardownRunner = jasmine.createSpyObj(
      'globalSetupOrTeardownRunner', ['run']
    );
    this.testJasmine = new Jasmine({
      jasmineCore: this.fakeJasmineCore,
      globalSetupOrTeardownRunner: this.globalSetupOrTeardownRunner
    });
    this.testJasmine.exit = function () {
      // Don't actually exit the node process
    };

    this.execute = execute;
    this.finishExecution = async () => {
    };
  });

  sharedRunnerBehaviors(function (options) {
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

    expect(testJasmine.env.addReporter).toHaveBeenCalledWith(jasmine.any(ConsoleReporter));
  });

  it('reports how to reproduce the random seed', function() {
    const testJasmine = new Jasmine({jasmineCore: this.fakeJasmineCore});
    const print = jasmine.createSpy('print');
    testJasmine.configureDefaultReporter({print});
    const reporter = testJasmine.env.addReporter.calls.mostRecent().args[0];

    reporter.jasmineDone({order: {random: true, seed: 12345}});

    expect(print).toHaveBeenCalledWith(jasmine.stringContaining(
      '(jasmine --random=true --seed=12345)'));
  });

  it('can add and clear reporters', function () {
    const testJasmine = new Jasmine({jasmineCore: this.fakeJasmineCore});
    expect(testJasmine.reportersCount).toEqual(1);
    testJasmine.clearReporters();
    expect(testJasmine.reportersCount).toEqual(0);
    expect(testJasmine.env.clearReporters).toHaveBeenCalled();
    testJasmine.addReporter({someProperty: 'some value'});
    expect(testJasmine.reportersCount).toEqual(1);
    expect(testJasmine.env.addReporter).toHaveBeenCalledWith({someProperty: 'some value'});
  });

  it('adds matchers to the jasmine env', function () {
    this.testJasmine.addMatchers(['fake matcher 1', 'fake matcher 2']);
    expect(this.testJasmine.env.addMatchers).toHaveBeenCalledWith(['fake matcher 1', 'fake matcher 2']);
  });

  describe('loading configurations', function () {
    beforeEach(function () {
      this.fixtureJasmine = new Jasmine({
        jasmineCore: this.fakeJasmineCore,
        projectBaseDir: 'spec/fixtures/sample_project'
      });
    });

    describe('from an object', function () {
      beforeEach(function () {
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

      it('can tell jasmine-core to stop spec on no expectations', function () {
        this.fixtureJasmine.loadConfig({failSpecWithNoExpectations: true});

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({failSpecWithNoExpectations: true});
      });

      it('can tell jasmine-core to stop spec on expectation failure', function () {
        this.fixtureJasmine.loadConfig({stopSpecOnExpectationFailure: true});

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({stopSpecOnExpectationFailure: true});
      });

      it('can tell jasmine-core to stop execution when a spec fails', function () {
        this.fixtureJasmine.loadConfig({stopOnSpecFailure: true});

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({stopOnSpecFailure: true});
      });

      it('can tell jasmine-core to run random specs', function () {
        this.fixtureJasmine.loadConfig({random: true});

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith({random: true});
      });

      it('uses jasmine-core defaults if no config options specified', function () {
        this.fixtureJasmine.loadConfig({});

        expect(this.fixtureJasmine.env.configure).not.toHaveBeenCalled();
      });

      it('can configure the env with arbitrary properties', function () {
        const envConfig = {someProp: 'someVal'};
        this.fixtureJasmine.loadConfig({env: envConfig});

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith(envConfig);
      });

      it('passes verboseDeprecations to jasmine-core when specified', function () {
        this.configObject.verboseDeprecations = true;
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalledWith(
          jasmine.objectContaining({verboseDeprecations: true})
        );
      });

      it('does not pass verboseDeprecations to jasmine-core when not specified', function () {
        this.configObject.random = true; // or set any other property
        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.configure).toHaveBeenCalled();
        expect(this.fixtureJasmine.env.configure.calls.argsFor(0)[0].verboseDeprecations)
          .toBeUndefined();
      });

      it('sets alwaysListPendingSpecs when present', function () {
        this.fixtureJasmine.loadConfig({alwaysListPendingSpecs: false});
        expect(this.fixtureJasmine.alwaysListPendingSpecs_).toBeFalse();
      });

      it('does not set alwaysListPendingSpecs when absent', function () {
        this.fixtureJasmine.loadConfig({});
        expect(this.fixtureJasmine.alwaysListPendingSpecs_).toBeTrue();
      });

      it('adds specified reporters', function () {
        const reporter1 = {id: 'reporter1'};
        const reporter2 = {id: 'reporter2'};
        this.configObject.reporters = [reporter1, reporter2];

        this.fixtureJasmine.loadConfig(this.configObject);

        expect(this.fixtureJasmine.env.addReporter).toHaveBeenCalledWith(reporter1);
        expect(this.fixtureJasmine.env.addReporter).toHaveBeenCalledWith(reporter2);
      });
    });
  });

  describe('#stopSpecOnExpectationFailure', function () {
    it('sets the stopSpecOnExpectationFailure value on the jasmine-core env', function () {
      this.testJasmine.stopSpecOnExpectationFailure('foobar');
      expect(this.testJasmine.env.configure).toHaveBeenCalledWith({stopSpecOnExpectationFailure: 'foobar'});
    });
  });

  describe('#stopOnSpecFailure', function () {
    it('sets the stopOnSpecFailure value on the jasmine-core env', function () {
      this.testJasmine.stopOnSpecFailure('blah');
      expect(this.testJasmine.env.configure).toHaveBeenCalledWith({stopOnSpecFailure: 'blah'});
    });
  });

  describe('#randomizeTests', function () {
    it('sets the randomizeTests value on the jasmine-core env', function () {
      this.testJasmine.randomizeTests('foobar');
      expect(this.testJasmine.env.configure).toHaveBeenCalledWith({random: 'foobar'});
    });
  });

  it("showing colors can be configured", function () {
    expect(this.testJasmine.showingColors).toBeUndefined();

    this.testJasmine.showColors(false);

    expect(this.testJasmine.showingColors).toBe(false);
  });

  describe('#execute', function () {
    it('executes the env', async function () {
      await this.execute();
      expect(this.testJasmine.env.execute).toHaveBeenCalled();
    });

    it('loads helper files before checking if any reporters were added', async function () {
      const loadHelpers = spyOn(this.testJasmine, 'loadHelpers');
      spyOn(this.testJasmine, 'configureDefaultReporter').and.callFake(function () {
        expect(loadHelpers).toHaveBeenCalled();
      });
      spyOn(this.testJasmine, 'loadSpecs');

      await this.execute();

      expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalled();
    });

    describe('Filtering', function() {
      let specFilter;

      beforeEach(function() {
        this.testJasmine.env.configure.and.callFake(function (config) {
          if (config.specFilter) {
            specFilter = config.specFilter;
          }
        });
      });

      describe('When a filter string is provided', function () {
        it('installs a matching spec filter', async function () {
          await this.execute({
            executeArgs: [['spec/fixtures/example/*spec.js'], 'interesting spec']
          });

          expect(specFilter).toBeTruthy();
          const matchingSpec = {
            getFullName() {
              return 'this is an interesting spec that should match';
            }
          };
          const nonMatchingSpec = {
            getFullName() {
              return 'but this one is not';
            }
          };
          expect(specFilter(matchingSpec)).toBeTrue();
          expect(specFilter(nonMatchingSpec)).toBeFalse();
        });
      });

      describe('When a filter regex is provided', function () {
        it('installs a matching spec filter', async function () {
          await this.execute({
            executeArgs: [['spec/fixtures/example/*spec.js'], /interesting spec/]
          });

          expect(specFilter).toBeTruthy();
          const matchingSpec = {
            getFullName() {
              return 'this is an interesting spec that should match';
            }
          };
          const nonMatchingSpec = {
            getFullName() {
              return 'but this one is not';
            }
          };
          expect(specFilter(matchingSpec)).toBeTrue();
          expect(specFilter(nonMatchingSpec)).toBeFalse();
        });
      });

      describe('When a path filter specification is provided', function () {
        it('installs a matching spec filter', async function () {
          await this.execute({
            executeArgs: [['spec/fixtures/example/*spec.js'], {
              path: ['parent', 'child', 'spec']
            }]
          });

          function stubSpec(path) {
            return {
              getPath() { return path; },
              // getFullName is required, but plays no role in filtering
              getFullName() { return ""; }
            };
          }

          expect(specFilter).toBeTruthy();
          expect(specFilter(stubSpec(['parent', 'child', 'spec'])))
            .toBeTrue();
          expect(specFilter(stubSpec(['parent', 'other child', 'spec'])))
            .toBeFalse();
        });
      });
    });

    it('loads specs', async function () {
      spyOn(this.testJasmine, 'loadSpecs');

      await this.execute();

      expect(this.testJasmine.loadSpecs).toHaveBeenCalled();
    });

    describe('The returned promise', function () {
      it('is resolved with the overall suite status', async function () {
        await expectAsync(this.execute({overallStatus: 'failed'}))
          .toBeResolvedTo(jasmine.objectContaining({overallStatus: 'failed'}));
      });

      it('is resolved with the overall suite status even if clearReporters was called', async function () {
        this.testJasmine.clearReporters();

        await expectAsync(this.execute({overallStatus: 'incomplete'}))
          .toBeResolvedTo(jasmine.objectContaining({overallStatus: 'incomplete'}));
      });
    });

    it('can run only specified files', async function () {
      await this.execute({
        executeArgs: [['spec/fixtures/sample_project/**/*spec.js']]
      });

      const relativePaths = this.testJasmine.specFiles.map(function (filePath) {
        return path.relative(__dirname, filePath).replace(/\\/g, '/');
      });

      expect(relativePaths).toEqual([
        'fixtures/sample_project/spec/fixture_spec.js',
        'fixtures/sample_project/spec/other_fixture_spec.js'
      ]);
    });

    describe('when a globalSetup is configured', function () {
      beforeEach(function () {
        this.bootedJasmine.getEnv().execute.and.returnValue(
          new Promise(() => {
          })
        );
      });

      it('waits for globalSetup to complete before running specs', async function () {
        let resolve;
        this.globalSetupOrTeardownRunner.run.and.returnValue(
          new Promise(res => resolve = res)
        );

        function globalSetup() {
        }

        this.testJasmine.loadConfig({globalSetup});
        this.testJasmine.execute();
        await shortPoll(
          () => this.globalSetupOrTeardownRunner.run.calls.any(),
          'globalSetupOrTeardownRunner.run to be called'
        );
        expect(this.bootedJasmine.getEnv().execute).not.toHaveBeenCalled();
        resolve();
        await poll(() => this.bootedJasmine.getEnv().execute());
      });

      it('fails if globalSetup fails', async function () {
        this.globalSetupOrTeardownRunner.run.and.rejectWith(new Error('nope'));
        this.testJasmine.loadConfig({
          globalSetup() {
          }
        });

        await expectAsync(this.testJasmine.execute()).toBeRejectedWithError('nope');
      });

      it('uses a configured timeout', async function () {
        this.globalSetupOrTeardownRunner.run.and.returnValue(
          new Promise(() => {
          })
        );

        function globalSetup() {
        }

        this.testJasmine.loadConfig({
          globalSetup,
          globalSetupTimeout: 17
        });
        this.testJasmine.execute();

        await shortPoll(
          () => this.globalSetupOrTeardownRunner.run.calls.any(),
          'globalSetupOrTeardownRunner.run to be called'
        );
        expect(this.globalSetupOrTeardownRunner.run).toHaveBeenCalledWith(
          'globalSetup', globalSetup, 17
        );
      });
    });

    describe('when a globalTeardown is configured', function () {
      let resolveEnvExecute;
      let arbitraryOverallResult;

      beforeEach(function () {
        const promise = new Promise(res => resolveEnvExecute = res);
        this.bootedJasmine.getEnv().execute.and.returnValue(promise);
        arbitraryOverallResult = {overallStatus: 'passed'};
      });

      it('waits for globalTeardown to complete after execution finishes', async function () {
        let resolveTeardown;
        this.globalSetupOrTeardownRunner.run.and.returnValue(
          new Promise(res => resolveTeardown = res)
        );

        function globalTeardown() {
        }

        this.testJasmine.loadConfig({globalTeardown});
        const runnerExecutePromise = this.testJasmine.execute();
        await new Promise(res => setTimeout(res));
        expect(this.globalSetupOrTeardownRunner.run).not.toHaveBeenCalled();
        resolveEnvExecute(arbitraryOverallResult);
        await new Promise(res => setTimeout(res));
        await expectAsync(runnerExecutePromise).toBePending();
        resolveTeardown();
        await runnerExecutePromise;
        expect(this.globalSetupOrTeardownRunner.run).toHaveBeenCalledWith(
          'globalTeardown', globalTeardown, undefined
        );
      });

      it('fails if globalTeardown fails', async function () {
        this.globalSetupOrTeardownRunner.run.and.rejectWith(new Error('nope'));
        this.testJasmine.loadConfig({
          globalTeardown() {
          }
        });
        const executePromise = this.testJasmine.execute();
        resolveEnvExecute(arbitraryOverallResult);
        await expectAsync(executePromise).toBeRejectedWithError('nope');
      });

      it('runs globalTeardown even if env execution fails', async function () {
        this.bootedJasmine.getEnv().execute
          .and.rejectWith(new Error('env execute failure'));
        this.globalSetupOrTeardownRunner.run.and.resolveTo();
        this.testJasmine.loadConfig({
          globalTeardown() {
          }
        });
        await expectAsync(this.testJasmine.execute())
          .toBeRejectedWithError('env execute failure');
        expect(this.globalSetupOrTeardownRunner.run).toHaveBeenCalled();
      });

      it('uses a configured timeout', async function () {
        this.globalSetupOrTeardownRunner.run.and.returnValue(
          new Promise(() => {
          })
        );

        function globalTeardown() {
        }

        this.testJasmine.loadConfig({
          globalTeardown,
          globalTeardownTimeout: 17
        });
        this.testJasmine.execute();
        resolveEnvExecute();
        await shortPoll(
          () => this.globalSetupOrTeardownRunner.run.calls.any(),
          'globalTeardown to have been run'
        );

        expect(this.globalSetupOrTeardownRunner.run).toHaveBeenCalledWith(
          'globalTeardown', globalTeardown, 17
        );
      });
    });
  });

  describe('#enumerate', function() {
    it('loads requires, helpers, and specs', async function() {
      const loadRequires = spyOn(this.testJasmine, 'loadRequires');
      const loadHelpers = spyOn(this.testJasmine, 'loadHelpers');
      const loadSpecs = spyOn(this.testJasmine, 'loadSpecs');
      this.bootedJasmine.getEnv().topSuite
        .and.returnValue({children: []});

      await this.testJasmine.enumerate();

      expect(loadRequires).toHaveBeenCalledBefore(loadHelpers);
      expect(loadHelpers).toHaveBeenCalledBefore(loadSpecs);
      expect(loadSpecs).toHaveBeenCalledBefore(
        this.bootedJasmine.getEnv().topSuite);
    });

    it('returns a serializable, id-less suite tree', async function() {
      const topSuite = {
        id: 'a',
        description: 'Jasmine__TopLevel__Suite',
        children: [{
          id: 'b',
          description: 'parent',
          children: [{
            id: 'c',
            description: 'nested',
            children: [{
              id: 'd',
              description: 'a spec'
            }]
          }]
        }]
      };
      topSuite.children[0].parentSuite = topSuite;
      topSuite.children[0].children[0].parentSuite = topSuite.children[0];
      this.bootedJasmine.getEnv().topSuite.and.returnValue(topSuite);

      const result = await this.testJasmine.enumerate();

      expect(JSON.parse(JSON.stringify(result))).toEqual([{
        type: 'suite',
        description: 'parent',
        children: [{
          type: 'suite',
          description: 'nested',
          children: [{
            type: 'spec',
            description: 'a spec'
          }]
        }]
      }]);
    });
  });

  describe('When running on Windows', function () {
    function windows() {
      return 'win32';
    }

    it('converts backslashes in the project base dir to slashes, for compatibility with glob', function () {
      const subject = new Jasmine({
        projectBaseDir: 'c:\\foo\\bar',
        platform: windows,
        jasmineCore: this.fakeJasmineCore,
      });
      expect(subject.projectBaseDir).toEqual('c:/foo/bar');
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
