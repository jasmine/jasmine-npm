const path = require('path');
const EventEmitter = require('node:events');
const ConsoleReporter = require('@jasminejs/reporters/console');
const {sharedRunnerBehaviors, pathEndingWith} = require('./shared_runner_behaviors');
const ParallelRunner = require("../lib/parallel_runner");
const {poll, shortPoll} = require('./poll');
const realJasmineCore = require('jasmine-core');

describe('ParallelRunner', function() {
  const forwardedReporterEvents = ['suiteStarted', 'suiteDone', 'specStarted', 'specDone'];
  const nonForwardedReporterEvents = ['jasmineStarted', 'jasmineDone'];

  beforeEach(function () {
    this.cluster = jasmine.createSpyObj(
      'cluster',
      ['fork', 'setupPrimary', 'disconnect']
    );
    this.cluster.workers = {};
    this.cluster.disconnect.and.callFake(function (cb) {
      cb();
    });
    let nextWorkerId = 0;
    this.cluster.fork.and.callFake(() => {
      const worker = new EventEmitter();
      worker.id = nextWorkerId++;
      worker.send = jasmine.createSpy('worker.send');
      this.cluster.workers[worker.id] = worker;
      return worker;
    });
    this.consoleReporter = jasmine.createSpyObj(
      'consoleReporter',
      [
        'configure',
        ...forwardedReporterEvents,
        ...nonForwardedReporterEvents
      ]
    );
    const consoleReporter = this.consoleReporter;
    this.ConsoleReporter = function() {
      return consoleReporter;
    };
    this.globalSetupOrTeardownRunner = jasmine.createSpyObj(
      'globalSetupOrTeardownRunner', ['run']
    );
    // Use the real ParallelReportDispatcher but prevent it from overriding
    // global error handling so that we don't accidentally ignore errors in
    // the specs
    function ParallelReportDispatcher(onError) {
      return new realJasmineCore.jasmine.ParallelReportDispatcher(
        onError,
        {globalErrors: new StubGlobalErrors()}
      );
    }
    this.testJasmine = new ParallelRunner({
      jasmineCore: stubCore(),
      cluster: this.cluster,
      ConsoleReporter: this.ConsoleReporter,
      ParallelReportDispatcher,
      globalSetupOrTeardownRunner: this.globalSetupOrTeardownRunner
    });
    this.testJasmine.exit = dontExit;

    this.execute = execute;

    this.emitBooted = worker => worker.emit('message', {type: 'booted'});
    this.emitReadyForConfig = worker =>  worker.emit('message', {type: 'readyForConfig'});

    this.emitAllBooted = async () => {
      await shortPoll(
        () => Object.values(this.cluster.workers).length > 0,
        'workers to be created'
      );

      for (const worker of Object.values(this.cluster.workers)) {
        this.emitBooted(worker);
      }
    };

    this.emitSpecDone = (worker, payload) => {
      worker.emit(
        'message',
        {type: 'reporterEvent', eventName: 'specDone', payload}
      );
    };

    this.emitSuiteDone = (worker, payload) => {
      worker.emit(
        'message',
        {type: 'reporterEvent', eventName: 'suiteDone', payload}
      );
    };

    this.emitFileDone = (worker, payload) => {
      worker.emit('message', {
        type: 'specFileDone',
        failedExpectations: [],
        deprecationWarnings: [],
        ...payload
      });
    };

    this.disconnect = async () => {
      await new Promise(resolve => setTimeout(resolve));
      expect(this.cluster.disconnect).toHaveBeenCalled();
      this.cluster.disconnect.calls.argsFor(0)[0]();
    };
  });

  sharedRunnerBehaviors(function (options) {
    return new ParallelRunner({
      ...options,
      jasmineCore: stubCore(),
    });
  });

  it('registers a console reporter upon construction', function() {
    this.testJasmine.reportDispatcher_.specStarted('payload');
    expect(this.consoleReporter.specStarted).toHaveBeenCalledWith('payload');
  });

  it('can add and clear reporters', function() {
    const reporter = {
      someProperty: 'some value',
      reporterCapabilities: {parallel: true},
      jasmineStarted: jasmine.createSpy('reporter.jasmineStarted')
    };

    this.testJasmine.addReporter(reporter);
    this.testJasmine.reportDispatcher_.jasmineStarted({});
    expect(reporter.jasmineStarted).toHaveBeenCalled();

    reporter.jasmineStarted.calls.reset();
    this.testJasmine.clearReporters();
    this.testJasmine.reportDispatcher_.jasmineStarted({});
    expect(reporter.jasmineStarted).not.toHaveBeenCalled();
  });

  describe('Reporter validation', function() {
    it('rejects reporters that do not declare parallel support', function () {
      const expectedMsg = "Can't use this reporter because it doesn't support " +
        'parallel mode. (Add reporterCapabilities: {parallel: true} if ' +
        'the reporter meets the requirements for parallel mode.)';

      const reporter = jasmine.createSpyObj('reporter', ['jasmineStarted']);
      expect(() => this.testJasmine.addReporter(reporter))
        .withContext('no reporterCapabilities')
        .toThrowError(expectedMsg);

      reporter.reporterCapabilities = {};
      expect(() => this.testJasmine.addReporter(reporter))
        .withContext('no reporterCapabilities.parallel')
        .toThrowError(expectedMsg);

      reporter.reporterCapabilities.parallel = false;
      expect(() => this.testJasmine.addReporter(reporter))
        .withContext('reporterCapabilities.parallel = false')
        .toThrowError(expectedMsg);

      this.testJasmine.reportDispatcher_.jasmineStarted({});
      expect(reporter.jasmineStarted).not.toHaveBeenCalled();
    });

    it('provides additional context when the reporter is in the config file', function() {
      expect(() => {
        this.testJasmine.loadConfig({
          reporters: [
            {reporterCapabilities: {parallel: true}},
            {}
          ]
        });
      }).toThrowError("Can't use the reporter in position 1 of " +
        "the configuration's reporters array because it doesn't support " +
        'parallel mode. (Add reporterCapabilities: {parallel: true} if ' +
        'the reporter meets the requirements for parallel mode.)');
    });

    it('accepts the built-in console reporter', function() {
      this.testJasmine.addReporter(new ConsoleReporter());
    });
  });

  it('can use a caller-specified jasmine-core', async function() {
    const jasmineCorePath = 'my-custom-jasmine-core.js';
    const callerSpecifiedCore = {
      jasmine: jasmine.createSpyObj('callerSpecifiedCore.jasmine', [
        'ParallelReportDispatcher',
        'Timer',
      ]),
      files: {
        self: jasmineCorePath
      }
    };
    callerSpecifiedCore.jasmine.ParallelReportDispatcher.and.returnValue({
      addReporter() {}
    });
    callerSpecifiedCore.jasmine.Timer.and.returnValue({
      start() {}
    });
    this.testJasmine = new ParallelRunner({
      jasmineCore: callerSpecifiedCore,
      cluster: this.cluster,
      ConsoleReporter: this.ConsoleReporter,
    });
    this.testJasmine.exit = dontExit;

    expect(callerSpecifiedCore.jasmine.ParallelReportDispatcher).toHaveBeenCalled();
    expect(callerSpecifiedCore.jasmine.Timer).toHaveBeenCalled();

    this.testJasmine.execute();
    await poll(() => Object.values(this.cluster.workers).length > 0);

    for (const worker of Object.values(this.cluster.workers)) {
      this.emitReadyForConfig(worker);
      expect(worker.send).toHaveBeenCalledWith(
        {
          type: 'configure',
          configuration: jasmine.objectContaining({jasmineCorePath}),
        }
      );
    }
  });

  describe('#execute', function() {
    it('creates the configured number of worker processes', async function () {
      this.testJasmine = new ParallelRunner({
        jasmineCore: stubCore(),
        cluster: this.cluster,
        numWorkers: 17,
        ConsoleReporter: this.ConsoleReporter,
      });
      this.testJasmine.exit = dontExit;
      this.testJasmine.execute();
      await shortPoll(
        () => this.cluster.fork.calls.any(),
        'cluster.fork to have been called'
      );
      const expectedPath = path.join(__dirname, '../bin/worker.js');
      expect(this.cluster.setupPrimary).toHaveBeenCalledWith({
        exec: expectedPath,
      });
      expect(this.cluster.fork).toHaveBeenCalledTimes(17);
    });

    it('configures the workers and waits for them to acknowledge', async function () {
      this.testJasmine = new ParallelRunner({
        jasmineCore: stubCore(),
        cluster: this.cluster,
        ConsoleReporter: this.ConsoleReporter,
        numWorkers: 2,
        globals: false,
      });
      const envConfig = {
        stopSpecOnExpectationFailure: true,
      };
      this.testJasmine.loadConfig({
        jsLoader: 'require',
        spec_dir: 'spec/fixtures/parallel_helpers',
        helpers: ['helper*.js'],
        requires: ['require1', 'require2'],
        env: envConfig,
      });
      this.testJasmine.addSpecFile('aSpec.js');
      spyOn(this.testJasmine, 'runSpecFiles_')
        .and.returnValue(new Promise(() => {
      }));
      this.testJasmine.execute(null, 'myFilterString');

      await shortPoll(
        () => this.cluster.fork.calls.any(),
        'cluster.fork to have been called'
      );
      const workers = this.cluster.fork.calls.all().map(c => c.returnValue);
      expect(workers[0].send).not.toHaveBeenCalled();
      expect(workers[1].send).not.toHaveBeenCalled();

      const expectedConfig = {
        filter: 'myFilterString',
        jsLoader: 'require',
        spec_dir: 'spec/fixtures/parallel_helpers',
        helpers: [
          pathEndingWith('spec/fixtures/parallel_helpers/helper1.js')
        ],
        requires: ['require1', 'require2'],
        globals: false,
        env: envConfig,
      };

      this.emitReadyForConfig(workers[0]);
      expect(workers[0].send).toHaveBeenCalledWith(
        {type: 'configure', configuration: expectedConfig}
      );
      expect(workers[1].send).not.toHaveBeenCalled();

      this.emitReadyForConfig(workers[1]);
      expect(workers[1].send).toHaveBeenCalledWith(
        {type: 'configure', configuration: expectedConfig}
      );

      this.emitBooted(workers[0]);
      await new Promise(resolve => setTimeout(resolve));
      expect(this.testJasmine.runSpecFiles_).not.toHaveBeenCalled();

      this.emitBooted(workers[1]);
      await new Promise(resolve => setTimeout(resolve));
      expect(this.testJasmine.runSpecFiles_).toHaveBeenCalled();
    });

    it('initially assigns one spec file to each process', async function () {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      const specFiles = ['spec1.js', 'spec2.js', 'spec3.js'];

      for (const f of specFiles) {
        this.testJasmine.addSpecFile(f);
      }

      this.testJasmine.execute();
      await this.emitAllBooted();
      await new Promise(resolve => {
        this.cluster.workers[0].send
          .withArgs(jasmine.objectContaining({type: 'runSpecFile'}))
          .and.callFake(() => resolve());
      });

      expect(this.cluster.workers[0].send).toHaveBeenCalledWith(
        {type: 'runSpecFile', filePath: jasmine.any(String)}
      );
      expect(this.cluster.workers[1].send).toHaveBeenCalledWith(
        {type: 'runSpecFile', filePath: jasmine.any(String)}
      );
      const specFilesRan = new Set(getSpecFilesRan(this.cluster.workers));
      expect(specFilesRan.size).toEqual(2);

      for (const f of specFilesRan) {
        expect(specFiles).toContain(f);
      }
    });

    describe('When a worker finishes processing a spec file', function () {
      it('assigns another spec file', async function () {
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        const specFiles = ['spec1.js', 'spec2,js', 'spec3.js'];

        for (const f of specFiles) {
          this.testJasmine.addSpecFile(f);
        }

        this.testJasmine.execute();
        await this.emitAllBooted();
        await new Promise(resolve => setTimeout(resolve));

        const alreadyRanSpecs = getSpecFilesRan(this.cluster.workers);
        expect(alreadyRanSpecs.length).withContext('number of spec files initially ran').toEqual(2);
        const remainingSpec = specFiles.filter(f => !alreadyRanSpecs.includes(f))[0];

        this.emitFileDone(this.cluster.workers[0]);
        expect(this.cluster.workers[0].send).toHaveBeenCalledWith(
          {type: 'runSpecFile', filePath: remainingSpec}
        );
      });

      it('finishes when all workers are idle', async function () {
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.addSpecFile('spec2.js');
        this.testJasmine.addSpecFile('spec3.js');
        const executePromise = this.testJasmine.execute();
        await this.emitAllBooted();

        await new Promise(resolve => setTimeout(resolve));
        this.emitFileDone(this.cluster.workers[0]);
        this.emitFileDone(this.cluster.workers[1]);
        await expectAsync(executePromise).toBePending();
        this.emitFileDone(this.cluster.workers[0]);
        await new Promise(resolve => setTimeout(resolve));
        await this.disconnect();
        await expectAsync(executePromise).toBeResolved();
      });
    });

    it('dispatches a jasmineStarted event at the start of execution', async function () {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.execute();
      await this.emitAllBooted();
      await new Promise(resolve => setTimeout(resolve));

      expect(this.consoleReporter.jasmineStarted).toHaveBeenCalledWith({
        parallel: true
      });
    });

    describe('When all workers are idle', function () {
      beforeEach(async function () {
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.addSpecFile('spec2.js');
        this.testJasmine.addSpecFile('spec3.js');
        this.executePromise = this.testJasmine.execute();
        await this.emitAllBooted();

        await new Promise(resolve => setTimeout(resolve));
        this.emitSpecDone(this.cluster.workers[0], {status: 'passed'});
        this.emitFileDone(this.cluster.workers[0]);
        this.emitSpecDone(this.cluster.workers[1], {status: 'passed'});
        this.emitFileDone(this.cluster.workers[1]);
        this.emitSpecDone(this.cluster.workers[0], {status: 'passed'});
        this.emitFileDone(this.cluster.workers[0]);
        await this.disconnect();

        this.expectedJasmineDoneEvent = {
          overallStatus: 'passed',
          totalTime: jasmine.any(Number),
          numWorkers: 2,
          failedExpectations: [],
          deprecationWarnings: []
        };
      });

      it('dispatches a jasmineDone event', async function () {
        await this.executePromise;
        expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith(
          this.expectedJasmineDoneEvent);
      });

      it('resolves the returned promise to the jasmineDone event', async function () {
        await expectAsync(this.executePromise).toBeResolvedTo(
          this.expectedJasmineDoneEvent
        );
      });
    });

    it('sets the jasmineDone event status to failed when there are spec failures', async function () {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      const executePromise = this.testJasmine.execute();
      await this.emitAllBooted();

      await new Promise(resolve => setTimeout(resolve));
      this.emitSpecDone(this.cluster.workers[0], {status: 'passed'});
      this.emitFileDone(this.cluster.workers[0]);
      this.emitSpecDone(this.cluster.workers[1], {status: 'passed'});
      this.emitSpecDone(this.cluster.workers[1], {status: 'failed'});
      this.emitFileDone(this.cluster.workers[1]);
      await this.disconnect();
      await executePromise;

      expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith(
        jasmine.objectContaining({
          overallStatus: 'failed'
        })
      );
    });

    it('sets the jasmineDone event status to failed when there are suite failures', async function () {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      const executePromise = this.testJasmine.execute();
      await this.emitAllBooted();

      await new Promise(resolve => setTimeout(resolve));
      this.emitSuiteDone(this.cluster.workers[0], {status: 'passed'});
      this.emitFileDone(this.cluster.workers[0]);
      this.emitSuiteDone(this.cluster.workers[1], {status: 'passed'});
      this.emitSuiteDone(this.cluster.workers[1], {status: 'failed'});
      this.emitFileDone(this.cluster.workers[1]);
      await this.disconnect();
      await executePromise;

      expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith(
        jasmine.objectContaining({
          overallStatus: 'failed'
        })
      );
    });

    it('sets the jasmineDone event status to incomplete when there are focused runables', async function () {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      const executePromise = this.testJasmine.execute();
      await this.emitAllBooted();

      await new Promise(resolve => setTimeout(resolve));
      this.emitFileDone(this.cluster.workers[0], {
        overallStatus: 'incomplete',
        incompleteCode: 'focused',
        incompleteReason: 'fit() or fdescribe() was found'
      });
      this.emitFileDone(this.cluster.workers[1]);
      await this.disconnect();
      await executePromise;

      expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith(
        jasmine.objectContaining({
          overallStatus: 'incomplete',
          incompleteCode: 'focused',
          incompleteReason: 'fit() or fdescribe() was found'
        })
      );
    });

    it('sets the jasmineDone event status to incomplete when there are no specs', async function () {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      const executePromise = this.testJasmine.execute();
      await this.emitAllBooted();

      await new Promise(resolve => setTimeout(resolve));
      this.emitFileDone(this.cluster.workers[0], {
        overallStatus: 'incomplete',
        incompleteCode: 'noSpecsFound',
      });
      this.emitFileDone(this.cluster.workers[1], {
        overallStatus: 'incomplete',
        incompleteCode: 'noSpecsFound',
      });
      await this.disconnect();
      await executePromise;

      expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith(
        jasmine.objectContaining({
          overallStatus: 'incomplete',
          incompleteCode: 'noSpecsFound',
          incompleteReason: 'No specs found'
        })
      );
    });

    it('does not set the jasmineDone event status to incomplete when one file has no specs', async function () {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      const executePromise = this.testJasmine.execute();
      await this.emitAllBooted();

      await new Promise(resolve => setTimeout(resolve));
      this.emitFileDone(this.cluster.workers[0], {
        overallStatus: 'incomplete',
        incompleteCode: 'noSpecsFound',
      });
      this.emitFileDone(this.cluster.workers[1]);
      await this.disconnect();
      await executePromise;

      expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith(
        jasmine.objectContaining({
          overallStatus: 'passed',
        })
      );
    });

    it('merges top level failedExpectations and deprecationWarnings from workers', async function () {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      this.testJasmine.addSpecFile('spec3.js');
      const executePromise = this.testJasmine.execute();
      await this.emitAllBooted();

      await new Promise(resolve => setTimeout(resolve));
      this.emitFileDone(this.cluster.workers[0], {
        failedExpectations: ['failed expectation 1'],
        deprecationWarnings: ['deprecation 1'],
      });
      this.emitFileDone(this.cluster.workers[1], {
        failedExpectations: ['failed expectation 2'],
        deprecationWarnings: ['deprecation 2'],
      });
      this.emitFileDone(this.cluster.workers[0], {
        failedExpectations: ['failed expectation 3'],
        deprecationWarnings: ['deprecation 3'],
      });

      await this.disconnect();
      await executePromise;

      expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith(
        jasmine.objectContaining({
          overallStatus: 'failed',
          failedExpectations: [
            'failed expectation 1',
            'failed expectation 2',
            'failed expectation 3',
          ],
          deprecationWarnings: [
            'deprecation 1',
            'deprecation 2',
            'deprecation 3',
          ]
        })
      );
    });

    describe('Handling reporter events from workers', function () {
      beforeEach(async function () {
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.execute();
        await this.emitAllBooted();
        await poll(() => {
          return this.cluster.workers[0].listeners('message').length > 0;
        });
      });

      for (const eventName of forwardedReporterEvents) {
        it(`forwards the ${eventName} event to reporters`, async function () {
          const reporter = jasmine.createSpyObj('reporter', [eventName]);
          reporter.reporterCapabilities = {parallel: true};
          this.testJasmine.addReporter(reporter);

          const payload = 'arbitrary event payload';
          this.cluster.workers[0].emit(
            'message', {type: 'reporterEvent', eventName, payload}
          );

          expect(reporter[eventName]).toHaveBeenCalledWith(payload);
        });
      }

      for (const eventName of nonForwardedReporterEvents) {
        it(`does not forward the ${eventName} event to reporters`, async function () {
          const reporter = jasmine.createSpyObj('reporter', [eventName]);
          reporter.reporterCapabilities = {parallel: true};
          this.testJasmine.addReporter(reporter);

          this.cluster.workers[0].emit(
            'message',
            {type: 'reporterEvent', eventName, payload: 'arbitrary event payload'}
          );

          expect(reporter[eventName]).not.toHaveBeenCalled();
        });
      }
    });

    it('reports unhandled exceptions and promise rejections from workers', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      const executePromise = this.testJasmine.execute();
      await this.emitAllBooted();

      await new Promise(resolve => setTimeout(resolve));
      this.emitFileDone(this.cluster.workers[0], {
        failedExpectations: ['failed expectation 1'],
        deprecationWarnings: [],
      });
      this.cluster.workers[0].emit('message', {
        type: 'uncaughtException',
        error: {
          message: 'not caught',
          stack: 'it happened here'
        },
      });
      this.cluster.workers[0].emit('message', {
        type: 'unhandledRejection',
        error: {
          message: 'not handled',
          stack: 'it happened there'
        },
      });
      this.emitFileDone(this.cluster.workers[1], {
        failedExpectations: ['failed expectation 2'],
        deprecationWarnings: [''],
      });

      await this.disconnect();
      await executePromise;

      expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith(
        jasmine.objectContaining({
          overallStatus: 'failed',
          failedExpectations: [
            'failed expectation 1',
            // We don't just pass these through from jasmine-core,
            // so verify the actual output format.
            {
              actual: '',
              expected: '',
              globalErrorType: 'lateError',
              matcherName: '',
              message: 'Uncaught exception in worker process: not caught',
              passed: false,
              stack: 'it happened here',
            },
            {
              actual: '',
              expected: '',
              globalErrorType: 'lateError',
              matcherName: '',
              message: 'Unhandled promise rejection in worker process: not handled',
              passed: false,
              stack: 'it happened there',
            },
            'failed expectation 2',
          ],
        })
      );
    });

    describe('When a spec file fails to load', function() {
      function captor(valueCb) {
        return {
          asymmetricMatch(v) {
            valueCb(v);
            return true;
          },
          jasmineToString() {
            return '<captor>';
          }
        };
      }

      it('moves on to the next file', async function() {
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        const specFiles = ['spec1.js', 'spec2.js', 'spec3.js'];

        for (const f of specFiles) {
          this.testJasmine.addSpecFile(f);
        }

        this.testJasmine.execute();
        await this.emitAllBooted();

        await new Promise(resolve => setTimeout(resolve));
        let worker0SpecFile, worker1SpecFile;
        expect(this.cluster.workers[0].send).toHaveBeenCalledWith(
          jasmine.objectContaining({
            type: 'runSpecFile',
            filePath: captor(v => worker0SpecFile = v)
          })
        );
        expect(this.cluster.workers[1].send).toHaveBeenCalledWith(
          jasmine.objectContaining({
            type: 'runSpecFile',
            filePath: captor(v => worker1SpecFile = v)
          })
        );
        this.cluster.workers[0].send.calls.reset();
        const remainingSpecFile = specFiles
          .filter(f => f !== worker0SpecFile && f !== worker1SpecFile)[0];
        this.cluster.workers[0].emit('message',
          {
            type: 'specFileLoadError',
            filePath: worker0SpecFile,
            error: {
              message: 'not caught',
              stack: 'it happened here'
            },
          }
        );

        expect(this.cluster.workers[0].send).toHaveBeenCalledWith(
          {type: 'runSpecFile', filePath: remainingSpecFile}
        );
      });

      it('reports the error', async function () {
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.addSpecFile('spec2.js');
        const executePromise = this.testJasmine.execute();
        await this.emitAllBooted();

        await new Promise(resolve => setTimeout(resolve));
        let worker1SpecFile;
        expect(this.cluster.workers[1].send).toHaveBeenCalledWith(
          jasmine.objectContaining({
            type: 'runSpecFile',
            filePath: captor(v => worker1SpecFile = v)
          })
        );
        this.emitFileDone(this.cluster.workers[0], {
          failedExpectations: ['failed expectation 1'],
          deprecationWarnings: [],
        });
        this.cluster.workers[1].emit('message',
          {
            type: 'specFileLoadError',
            filePath: worker1SpecFile,
            error: {
              message: 'not caught',
              stack: 'it happened here'
            },
          }
        );

        await this.disconnect();
        await executePromise;

        expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith(
          jasmine.objectContaining({
            overallStatus: 'failed',
            failedExpectations: [
              'failed expectation 1',
              // We don't just pass this through from jasmine-core,
              // so verify the actual output format.
              {
                actual: '',
                expected: '',
                globalErrorType: 'load',
                matcherName: '',
                message: `Error loading ${worker1SpecFile}: not caught`,
                passed: false,
                stack: 'it happened here',
              }
            ],
          })
        );
      });
    });

    it('handles errors from reporters', async function() {
      const reportDispatcher = new StubParallelReportDispatcher();
      spyOn(reportDispatcher, 'installGlobalErrors');
      spyOn(reportDispatcher, 'uninstallGlobalErrors');
      let reportDispatcherOnError;
      this.testJasmine = new ParallelRunner({
        jasmineCore: stubCore(),
        cluster: this.cluster,
        ParallelReportDispatcher: function(onError) {
          reportDispatcherOnError = onError;
          return reportDispatcher;
        }
      });
      spyOn(this.testJasmine, 'exit');

      spyOn(this.testJasmine, 'runSpecFiles_').and.callFake(function() {
        expect(reportDispatcher.installGlobalErrors).toHaveBeenCalled();
        expect(reportDispatcher.uninstallGlobalErrors).not.toHaveBeenCalled();
        reportDispatcherOnError(new Error('nope'));
        return Promise.resolve();
      });

      spyOn(console, 'error');
      const executePromise = this.testJasmine.execute();
      await this.emitAllBooted();
      await expectAsync(executePromise).toBeRejectedWithError(
        'Unhandled exceptions, unhandled promise rejections, or reporter ' +
        'errors were encountered during execution'
      );

      expect(console.error).toHaveBeenCalledWith(new Error('nope'));
      expect(this.testJasmine.exit).toHaveBeenCalledWith(1);
      expect(reportDispatcher.uninstallGlobalErrors).toHaveBeenCalled();
    });

    describe('When stopSpecOnExpectationFailure is true', function () {
      beforeEach(async function () {
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir',
          stopOnSpecFailure: true,
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.addSpecFile('spec2.js');
        this.testJasmine.addSpecFile('spec3.js');
        this.testJasmine.addSpecFile('spec4.js');
        this.executePromise = this.testJasmine.execute();

        await this.emitAllBooted();
        await poll(() => {
          return numRunSpecFileCalls(this.cluster.workers[0]) === 1
            && numRunSpecFileCalls(this.cluster.workers[1]) === 1;
        });
      });

      it('makes a best effort to stop after a spec failure', async function () {
        this.emitSpecDone(this.cluster.workers[0], {status: 'failed'});
        this.emitFileDone(this.cluster.workers[0]);
        this.emitFileDone(this.cluster.workers[1]);

        await this.executePromise;

        expect(numRunSpecFileCalls(this.cluster.workers[0])).toEqual(1);
        expect(numRunSpecFileCalls(this.cluster.workers[1])).toEqual(1);
      });

      it('makes a best effort to stop after a suite failure', async function () {
        this.emitSuiteDone(this.cluster.workers[0], {status: 'failed'});
        this.emitFileDone(this.cluster.workers[0]);
        this.emitFileDone(this.cluster.workers[1]);

        await this.executePromise;

        expect(numRunSpecFileCalls(this.cluster.workers[0])).toEqual(1);
        expect(numRunSpecFileCalls(this.cluster.workers[1])).toEqual(1);
      });

      function numRunSpecFileCalls(worker) {
        return worker.send.calls.all()
          .filter(call => call.args[0].type === 'runSpecFile')
          .length;
      }
    });

    describe('When a worker reports a fatal error', function () {
      describe('When exitOnCompletion is true', function() {
        it('exits', async function () {
          spyOn(console, 'error');
          spyOn(this.testJasmine, 'exit');
          expect(this.testJasmine.exitOnCompletion).toBeTrue();
          this.testJasmine.numWorkers = 2;
          this.testJasmine.loadConfig({
            spec_dir: 'some/spec/dir'
          });
          this.testJasmine.addSpecFile('spec1.js');

          const executePromise = this.testJasmine.execute();
          await this.emitAllBooted();
          await new Promise(resolve => setTimeout(resolve));
          this.cluster.workers[0].emit('message', {
            type: 'fatalError',
            error: new Error('nope'),
          });

          await expectAsync(executePromise).toBeRejectedWithError(
            /Fatal error in Jasmine worker process/
          );
          expect(this.testJasmine.exit).toHaveBeenCalledWith(1);
        });
      });

      describe('When exitOnCompletion is false', function() {
        it('fails without exiting', async function () {
          spyOn(console, 'error');
          spyOn(this.testJasmine, 'exit');
          this.testJasmine.exitOnCompletion = false;
          this.testJasmine.numWorkers = 2;
          this.testJasmine.loadConfig({
            spec_dir: 'some/spec/dir'
          });
          this.testJasmine.addSpecFile('spec1.js');

          const executePromise = this.testJasmine.execute();
          await this.emitAllBooted();
          await new Promise(resolve => setTimeout(resolve));
          this.cluster.workers[0].emit('message', {
            type: 'fatalError',
            error: new Error('nope'),
          });

          await expectAsync(executePromise).toBeRejectedWithError(
            /Fatal error in Jasmine worker process/
          );
          expect(this.testJasmine.exit).not.toHaveBeenCalled();
        });
      });

      it('does not send additional runSpecFile messages after a fatal error', async function () {
        spyOn(console, 'error');
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.addSpecFile('spec2.js');
        this.testJasmine.addSpecFile('spec3.js');

        const executePromise = this.testJasmine.execute();
        await this.emitAllBooted();
        await new Promise(resolve => setTimeout(resolve));
        this.cluster.workers[0].emit('message', {
          type: 'fatalError',
          error: new Error('nope'),
        });
        this.cluster.workers[0].send.calls.reset();
        this.cluster.workers[1].send.calls.reset();
        this.emitFileDone(this.cluster.workers[1]);
        await expectAsync(executePromise).toBeRejectedWithError(
          /Fatal error in Jasmine worker process/
        );

        expect(this.cluster.workers[0].send).not.toHaveBeenCalled();
        expect(this.cluster.workers[1].send).not.toHaveBeenCalled();
      });
    });

    describe('Handling worker exit', function () {
      it('fails if the worker exits before the suite is finished', async function () {
        spyOn(console, 'error');
        spyOn(this.testJasmine, 'exit');
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');

        const executePromise = this.testJasmine.execute();
        await this.emitAllBooted();
        await new Promise(resolve => setTimeout(resolve));
        this.cluster.workers[0].emit('exit', {});

        await expectAsync(executePromise).toBeRejectedWithError(
          /Fatal error in Jasmine worker process/
        );
        expect(this.testJasmine.exit).toHaveBeenCalledWith(4);
      });

      it('does not fail when the worker exits after the suite is finished', async function () {
        spyOn(console, 'error');
        spyOn(this.testJasmine, 'exit');
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.addSpecFile('spec2.js');

        const executePromise = this.testJasmine.execute();
        await this.emitAllBooted();
        await new Promise(resolve => setTimeout(resolve));
        this.emitFileDone(this.cluster.workers[0]);
        this.emitFileDone(this.cluster.workers[1]);
        this.cluster.workers[0].emit('exit', {});
        await executePromise;

        expect(this.testJasmine.exit).toHaveBeenCalledWith(0);
        expect(console.error).not.toHaveBeenCalled();
      });
    });

    it('rejects if called more than once', async function () {
      this.testJasmine.execute();
      await expectAsync(this.testJasmine.execute()).toBeRejectedWithError(
        'Parallel runner instance can only be executed once'
      );
    });

    describe('when a globalSetup is configured', function () {
      it('waits for globalSetup to complete before creating workers', async function () {
        let resolve;
        this.globalSetupOrTeardownRunner.run.and.returnValue(
          new Promise(res => resolve = res)
        );
        function globalSetup() {}
        this.testJasmine.loadConfig({globalSetup});
        this.testJasmine.execute();
        await new Promise(res => setTimeout(res));
        expect(this.cluster.fork).not.toHaveBeenCalled();
        expect(this.globalSetupOrTeardownRunner.run).toHaveBeenCalledWith(
          'globalSetup', globalSetup, undefined
        );
        resolve();
        await poll(() => this.cluster.fork.calls.any());
      });

      it('fails if globalSetup fails', async function() {
        this.globalSetupOrTeardownRunner.run.and.rejectWith(new Error('nope'));
        this.testJasmine.loadConfig({
          globalSetup() {}
        });

        await expectAsync(this.testJasmine.execute()).toBeRejectedWithError('nope');
      });

      it('uses a configured timeout', function() {
        this.globalSetupOrTeardownRunner.run.and.returnValue(
          new Promise(() => {})
        );
        function globalSetup() {}
        this.testJasmine.loadConfig({
          globalSetup,
          globalSetupTimeout: 17
        });
        this.testJasmine.execute();

        expect(this.globalSetupOrTeardownRunner.run).toHaveBeenCalledWith(
          'globalSetup', globalSetup, 17
        );
      });
    });

    describe('when a globalTeardown is configured', function () {
      it('waits for globalTeardown to complete after execution finishes', async function () {
        let reportedDone = false;
        let resolveTeardown;
        this.globalSetupOrTeardownRunner.run.and.callFake(function() {
          return new Promise(function(res) {
            resolveTeardown = res;
            expect(reportedDone).toBeTrue();
          });
        });
        function globalTeardown() {}
        this.testJasmine.loadConfig({
          globalTeardown,
          reporters: [{
            jasmineDone() {
              reportedDone = true;
            },
            reporterCapabilities: {parallel: true}
          }]
        });
        const executePromise = this.testJasmine.execute();
        await this.emitAllBooted();
        expect(this.globalSetupOrTeardownRunner.run).not.toHaveBeenCalled();
        await new Promise(res => setTimeout(res));
        expect(this.globalSetupOrTeardownRunner.run).toHaveBeenCalledWith(
          'globalTeardown', globalTeardown, undefined
        );
        await new Promise(res => setTimeout(res));
        await expectAsync(executePromise).toBePending();
        resolveTeardown();
        await executePromise;
      });

      it('fails if globalTeardown fails', async function() {
        this.globalSetupOrTeardownRunner.run.and.rejectWith(new Error('nope'));
        this.testJasmine.loadConfig({
          globalTeardown() {}
        });
        const executePromise = this.testJasmine.execute();
        await this.emitAllBooted();
        await expectAsync(executePromise).toBeRejectedWithError('nope');
      });

      it('runs globalTeardown even if execution fails', async function() {
        spyOn(this.testJasmine, 'runSpecFiles_')
          .and.rejectWith(new Error('spec running failed'));
        this.globalSetupOrTeardownRunner.run.and.resolveTo();
        this.testJasmine.loadConfig({
          globalTeardown() {}
        });
        const executePromise = this.testJasmine.execute();
        await this.emitAllBooted();
        await expectAsync(executePromise)
          .toBeRejectedWithError('spec running failed');
        expect(this.globalSetupOrTeardownRunner.run).toHaveBeenCalled();
      });


      it('uses a configured timeout', async function() {
        this.globalSetupOrTeardownRunner.run.and.returnValue(
          new Promise(() => {})
        );
        function globalTeardown() {}
        this.testJasmine.loadConfig({
          globalTeardown,
          globalTeardownTimeout: 17
        });
        this.testJasmine.execute();
        await this.emitAllBooted();
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

  describe('#configureEnv', function() {
    it('throws if called after execution starts', function() {
      this.testJasmine.execute();
      expect(() => this.testJasmine.configureEnv({}))
        .toThrowError("Can't call configureEnv() after execute()");
    });

    it('throws if specFilter is set', function() {
      const config = {
        specFilter: function() {}
      };
      expect(() => this.testJasmine.configureEnv(config))
        .toThrowError('The specFilter config property is not supported in ' +
          'parallel mode');
    });
  });

  describe('Loading configuration', function() {
    it('adds specified reporters', function () {
      const reporters = [
        {id: 'reporter1', reporterCapabilities: {parallel: true},
          jasmineStarted: jasmine.createSpy('reporter1.jasmineStarted')},
        {id: 'reporter2', reporterCapabilities: {parallel: true},
          jasmineStarted: jasmine.createSpy('reporter2.jasmineStarted')},
      ];

      this.testJasmine.loadConfig({reporters});
      this.testJasmine.reportDispatcher_.jasmineStarted({});

      expect(reporters[0].jasmineStarted).toHaveBeenCalled();
      expect(reporters[1].jasmineStarted).toHaveBeenCalled();
    });
  });

  it('does not allow randomization to be disabled', function() {
    expect(() => this.testJasmine.randomizeTests(false))
      .toThrowError('Randomization cannot be disabled in parallel mode');
    expect(() => this.testJasmine.randomizeTests(true))
      .not.toThrow();
  });

  it('does not allow random seed to be set', function() {
    expect(() => this.testJasmine.seed(1234))
      .toThrowError('Random seed cannot be set in parallel mode');
  });

  describe('When running on Windows', function () {
    function windows() {
      return 'win32';
    }

    it('converts backslashes in the project base dir to slashes, for compatibility with glob', function () {
      const subject = new ParallelRunner({
        jasmineCore: stubCore(),
        projectBaseDir: 'c:\\foo\\bar',
        platform: windows,
        cluster: this.cluster,
      });
      expect(subject.projectBaseDir).toEqual('c:/foo/bar');
    });
  });
});

async function execute(options = {}) {
  if (this.testJasmine.specFiles.length === 0) {
    this.testJasmine.addSpecFile('aSpec.js');
  } else if (this.testJasmine.specFiles.length > 1) {
    // The code below could be adapted to work with an arbitrary nonzero number
    // of spec files, but so far there's been no need.
    throw new Error('Need exactly one spec file');
  }

  const executeArgs = options.executeArgs || [];
  const promise = this.testJasmine.execute.apply(this.testJasmine, executeArgs);
  await this.emitAllBooted();
  await shortPoll(
    () => getSpecFilesRan(this.cluster.workers).length === 1,
    'spec file to have been started'
  );

  const msg = {};
  switch (options.overallStatus) {
    case undefined:
    case 'passed':
      break;
    case 'failed':
      msg.failedExpectations = ['a failed expectation 1'];
      break;
    case 'incomplete':
      msg.incompleteCode = 'focused';
      msg.incompleteReason = 'fit() or fdescribe() was found';
      break;
    default:
      throw new Error(`Unsupported overallStatus ${overallStatus}`);
  }

  this.emitFileDone(this.cluster.workers[0], msg);
  await this.disconnect();
  const result = await promise;

  if (options.overallStatus) {
    expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith(
      jasmine.objectContaining({overallStatus: options.overallStatus})
    );
  }

  return result;
}

function dontExit() {
}

function getSpecFilesRan(workers) {
  return Object.values(workers)
    .flatMap(worker => worker.send.calls.allArgs())
    .map(args => args[0])
    .filter(msg => msg.type === 'runSpecFile')
    .map(msg => msg.filePath);
}

function stubCore() {
  return {
    jasmine: {
      Timer,
      ParallelReportDispatcher: StubParallelReportDispatcher
    },
    files: []
  };
}

class Timer {
  start() {}
  elapsed() {
    return 0;
  }
}

class StubParallelReportDispatcher {
  installGlobalErrors() {}
  uninstallGlobalErrors() {}
  addReporter() {}
  clearReporters() {}
  jasmineStarted() {}
  jasmineDone() {}
  suiteStarted() {}
  suiteDone() {}
  specStarted() {}
  specDone() {}
}

class StubGlobalErrors {
  install() {
    this.uninstall = function() {};
  }
  pushListener() {}
  popListener() {}
}
