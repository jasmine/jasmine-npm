const path = require('path');
const EventEmitter = require('node:events');
const sharedRunnerBehaviors = require('./shared_runner_behaviors');
const ParallelRunner = require("../lib/parallel_runner");

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
        'setOptions',
        ...forwardedReporterEvents,
        ...nonForwardedReporterEvents
      ]
    );
    const consoleReporter = this.consoleReporter;
    this.ConsoleReporter = function() {
      return consoleReporter;
    };
    this.testJasmine = new ParallelRunner({
      cluster: this.cluster,
      ConsoleReporter: this.ConsoleReporter,
    });
    this.testJasmine.exit = dontExit;

    this.execute = execute;

    this.emitBooted = worker => worker.emit('message', {type: 'booted'});

    this.emitAllBooted = () => {
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

  sharedRunnerBehaviors(function(options) {
    return new ParallelRunner(options);
  });

  it('registers a console reporter upon construction', function() {
    this.testJasmine.reportDispatcher_.specStarted('payload');
    expect(this.consoleReporter.specStarted).toHaveBeenCalledWith('payload');
  });

  it('can add and clear reporters', function() {
    spyOn(this.testJasmine.reportDispatcher_, 'addReporter');
    spyOn(this.testJasmine.reportDispatcher_, 'clearReporters');
    this.testJasmine.clearReporters();
    expect(this.testJasmine.reportDispatcher_.clearReporters).toHaveBeenCalled();
    const reporter = {someProperty: 'some value'};
    this.testJasmine.addReporter(reporter);
    expect(this.testJasmine.reportDispatcher_.addReporter)
      .toHaveBeenCalledWith(jasmine.is(reporter));
  });

  it('can tell jasmine-core to stop spec on no expectations');

  it('can use a caller-specified jasmine-core', async function() {
    const jasmineCorePath = 'my-custom-jasmine-core.js';
    const bootedCore = jasmine.createSpyObj('bootedCore', [
      'ReportDispatcher',
      'Timer',
    ]);
    bootedCore.ReportDispatcher.and.returnValue({
      addReporter() {}
    });
    bootedCore.Timer.and.returnValue({
      start() {}
    });
    const jasmineCore = {
      boot: () => bootedCore,
      files: {
        self: jasmineCorePath
      }
    };
    this.testJasmine = new ParallelRunner({
      jasmineCore,
      cluster: this.cluster,
      ConsoleReporter: this.ConsoleReporter,
    });
    this.testJasmine.exit = dontExit;

    expect(bootedCore.ReportDispatcher).toHaveBeenCalled();
    expect(bootedCore.Timer).toHaveBeenCalled();

    this.testJasmine.execute();
    await poll(() => Object.values(this.cluster.workers).length > 0);

    for (const worker of Object.values(this.cluster.workers)) {
      expect(worker.send).toHaveBeenCalledWith(
        {
          type: 'configure',
          configuration: jasmine.objectContaining({jasmineCorePath}),
        }
      );
    }
  });

  describe('#execute', function() {
    it('creates the configured number of worker processes', function() {
      this.testJasmine = new ParallelRunner({
        cluster: this.cluster,
        numWorkers: 17,
        ConsoleReporter: this.ConsoleReporter
      });
      this.testJasmine.exit = dontExit;
      this.testJasmine.execute();
      const expectedPath = path.join(__dirname, '../bin/worker.js');
      expect(this.cluster.setupPrimary).toHaveBeenCalledWith({
        exec: expectedPath,
        // TODO: probably windowsHide: true
      });
      expect(this.cluster.fork).toHaveBeenCalledTimes(17);
    });

    it('configures the workers and waits for them to acknowledge', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'spec/fixtures/parallel_helpers',
        helpers: ['helper*.js'],
      });
      this.testJasmine.addSpecFile('aSpec.js');
      spyOn(this.testJasmine, 'runSpecFiles_')
        .and.returnValue(new Promise(() => {}));
      this.testJasmine.execute();

      const workers = this.cluster.fork.calls.all().map(c => c.returnValue);
      const configuration = {
        // TODO: other properties, including env config, requires,
        // jsLoader, etc. Basically everything that shouldn't intentionally
        // be excluded.
        spec_dir: 'spec/fixtures/parallel_helpers',
        helpers: [
          jasmine.stringMatching(/spec\/fixtures\/parallel_helpers\/helper1\.js$/)
        ]
      };
      expect(workers[0].send).toHaveBeenCalledWith(
        {type: 'configure', configuration}
      );
      expect(workers[1].send).toHaveBeenCalledWith(
        {type: 'configure', configuration}
      );

      this.emitBooted(workers[0]);
      await new Promise(resolve => setTimeout(resolve));
      expect(this.testJasmine.runSpecFiles_).not.toHaveBeenCalled();

      this.emitBooted(workers[1]);
      await new Promise(resolve => setTimeout(resolve));
      expect(this.testJasmine.runSpecFiles_).toHaveBeenCalled();
    });

    it('initially assigns one spec file to each process', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      this.testJasmine.addSpecFile('spec3.js');
      this.testJasmine.execute();
      this.emitAllBooted();
      await new Promise(resolve => setTimeout(resolve));

      expect(this.cluster.workers[0].send).toHaveBeenCalledWith(
        {type: 'runSpecFile', filePath: 'spec1.js'}
      );
      expect(this.cluster.workers[1].send).toHaveBeenCalledWith(
        {type: 'runSpecFile', filePath: 'spec2.js'}
      );
      expect(this.cluster.workers[0].send).not.toHaveBeenCalledWith(
        {type: 'runSpecFile', filePath: 'spec3.js'}
      );
      expect(this.cluster.workers[1].send).not.toHaveBeenCalledWith(
        {type: 'runSpecFile', filePath: 'spec3.js'}
      );
    });

    it('randomizes spec file assignment');

    describe('When a worker finishes processing a spec file', function() {
      it('assigns another spec file', async function() {
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.addSpecFile('spec2.js');
        this.testJasmine.addSpecFile('spec3.js');
        this.testJasmine.execute();
        this.emitAllBooted();
        await new Promise(resolve => setTimeout(resolve));

        this.emitFileDone(this.cluster.workers[0]);
        expect(this.cluster.workers[0].send).toHaveBeenCalledWith(
          {type: 'runSpecFile', filePath: 'spec3.js'}
        );
      });

      it('finishes when all workers are idle', async function() {
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.addSpecFile('spec2.js');
        this.testJasmine.addSpecFile('spec3.js');
        const executePromise = this.testJasmine.execute();
        this.emitAllBooted();

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

    it('handles worker crashes');
    it('handles worker exec failures');

    it('dispatches an empty jasmineStarted event at the start of execution', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.execute();
      this.emitAllBooted();
      await new Promise(resolve => setTimeout(resolve));

      expect(this.consoleReporter.jasmineStarted).toHaveBeenCalledWith({});
    });

    describe('When all workers are idle', function() {
      beforeEach(async function() {
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.addSpecFile('spec2.js');
        this.testJasmine.addSpecFile('spec3.js');
        this.executePromise = this.testJasmine.execute();
        this.emitAllBooted();

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

      it('dispatches a jasmineDone event', async function() {
        await this.executePromise;
        expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith(
          this.expectedJasmineDoneEvent);
      });

      it('resolves the returned promise to the jasmineDone event', async function() {
        await expectAsync(this.executePromise).toBeResolvedTo(
          this.expectedJasmineDoneEvent
        );
      });
    });

    it('sets the jasmineDone event status to failed when there are spec failures', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      const executePromise = this.testJasmine.execute();
      this.emitAllBooted();

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

    it('sets the jasmineDone event status to failed when there are suite failures', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      const executePromise = this.testJasmine.execute();
      this.emitAllBooted();

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

    it('sets the jasmineDone event status to incomplete when there are focused runables', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      const executePromise = this.testJasmine.execute();
      this.emitAllBooted();

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

    it('sets the jasmineDone event status to incomplete when there are no specs', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      const executePromise = this.testJasmine.execute();
      this.emitAllBooted();

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

    it('does not set the jasmineDone event status to incomplete when one file has no specs', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      const executePromise = this.testJasmine.execute();
      this.emitAllBooted();

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

    it('merges top level failedExpectations and deprecationWarnings from workers', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      this.testJasmine.addSpecFile('spec3.js');
      const executePromise = this.testJasmine.execute();
      this.emitAllBooted();

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

    describe('Handling reporter events from workers', function() {
      beforeEach(async function() {
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.execute();
        this.emitAllBooted();
        await poll(() => {
          return this.cluster.workers[0].listeners('message').length > 0;
        });

      });

      for (const eventName of forwardedReporterEvents) {
        it(`forwards the ${eventName} event to reporters`, async function() {
          const reporter = jasmine.createSpyObj('reporter', [eventName]);
          this.testJasmine.addReporter(reporter);

          const payload = 'arbitrary event payload';
          this.cluster.workers[0].emit(
            'message', {type: 'reporterEvent', eventName, payload}
          );

          expect(reporter[eventName]).toHaveBeenCalledWith(payload);
        });
      }

      for (const eventName of nonForwardedReporterEvents) {
        it(`does not forward the ${eventName} event to reporters`, async function() {
          const reporter = jasmine.createSpyObj('reporter', [eventName]);
          this.testJasmine.addReporter(reporter);

          this.cluster.workers[0].emit(
            'message',
            {type: 'reporterEvent', eventName, payload: 'arbitrary event payload'}
          );

          expect(reporter[eventName]).not.toHaveBeenCalled();
        });
      }
    });

    describe('When a worker reports a fatal error', function() {
      it('fails', async function() {
        spyOn(console, 'error');
        spyOn(this.testJasmine, 'exit');
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');

        const executePromise = this.testJasmine.execute();
        this.emitAllBooted();
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

      it('does not send additional runSpecFile messages after a fatal error', async function() {
        spyOn(console, 'error');
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.addSpecFile('spec2.js');
        this.testJasmine.addSpecFile('spec3.js');

        const executePromise = this.testJasmine.execute();
        this.emitAllBooted();
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

    describe('Handling worker exit', function() {
      it('fails if the worker exits before the suite is finished', async function() {
        spyOn(console, 'error');
        spyOn(this.testJasmine, 'exit');
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');

        const executePromise = this.testJasmine.execute();
        this.emitAllBooted();
        await new Promise(resolve => setTimeout(resolve));
        this.cluster.workers[0].emit('exit', {});

        await expectAsync(executePromise).toBeRejectedWithError(
          /Fatal error in Jasmine worker process/
        );
        expect(this.testJasmine.exit).toHaveBeenCalledWith(1);
      });

      it('does not fail when the worker exits after the suite is finished', async function() {
        spyOn(console, 'error');
        spyOn(this.testJasmine, 'exit');
        this.testJasmine.numWorkers = 2;
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.addSpecFile('spec2.js');

        const executePromise = this.testJasmine.execute();
        this.emitAllBooted();
        await new Promise(resolve => setTimeout(resolve));
        this.emitFileDone(this.cluster.workers[0]);
        this.emitFileDone(this.cluster.workers[1]);
        this.cluster.workers[0].emit('exit', {});
        await executePromise;

        expect(this.testJasmine.exit).toHaveBeenCalledWith(0);
        expect(console.error).not.toHaveBeenCalled();
      });
    });
  });
});

async function poll(predicate) {
  return new Promise(function(resolve, reject) {
    function check() {
      try {
        if (predicate()) {
          resolve();
        } else {
          setTimeout(check);
        }
      } catch (e) {
        reject(e);
      }
    }

    check();
  });
}

async function execute(options = {}) {
  if (options.overallStatus) {
    pending();
  }

  const executeArgs = options.executeArgs || [];
  return this.testJasmine.execute.apply(this.testJasmine, executeArgs);
}

function dontExit() {
}
