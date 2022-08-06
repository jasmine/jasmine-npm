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
    this.autoFinishSend = true;
    let nextWorkerId = 0;
    this.cluster.fork.and.callFake(() => {
      const worker = new EventEmitter();
      worker.id = nextWorkerId++;
      worker.send = jasmine.createSpy('worker.send');

      if (this.autoFinishSend) {
        // Most specs for execute() will need this
        worker.send.and.callFake(function (name, cb) {
          if (cb) {
            cb();
          }
        });
      }

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

    this.emitFileDone = (worker, filename) => {
      worker.emit('message', {type: 'specFileDone', filename});
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

    it('configures the workers', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('aSpec.js');
      spyOn(this.testJasmine, 'runSpecFiles_')
        .and.returnValue(new Promise(() => {}));
      this.autoFinishSend = false;
      this.testJasmine.execute();

      const workers = this.cluster.fork.calls.all().map(c => c.returnValue);
      const configuration = {
        // TODO: other properties, including env config, requires, helpers,
        // jsLoader, etc. Basically everything that shouldn't intentionally
        // be excluded.
        spec_dir: 'some/spec/dir',
        spec_files: []
      };
      expect(workers[0].send).toHaveBeenCalledWith(
        {type: 'configure', configuration}, jasmine.any(Function)
      );
      expect(workers[1].send).toHaveBeenCalledWith(
        {type: 'configure', configuration}, jasmine.any(Function)
      );
      workers[0].send.calls.argsFor(0)[1]();
      await Promise.resolve();
      expect(this.testJasmine.runSpecFiles_).not.toHaveBeenCalled();
      workers[1].send.calls.argsFor(0)[1]();
      await new Promise(resolve => setTimeout(resolve));
      expect(this.testJasmine.runSpecFiles_).toHaveBeenCalled();
    });

    it('passes a custom jasmineCore path to the workers',  function() {
      const jasmineCorePath = './path/to/jasmine-core.js';
      this.testJasmine = new ParallelRunner({
        cluster: this.cluster,
        jasmineCorePath,
        ConsoleReporter: this.ConsoleReporter
      });
      this.testJasmine.exit = dontExit;
      this.testJasmine.execute();

      for (const worker of Object.values(this.cluster.workers)) {
        expect(worker.send).toHaveBeenCalledWith(
          {
            type: 'configure',
            configuration: jasmine.objectContaining({jasmineCorePath}),
          },
          jasmine.any(Function)
        );
      }
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
        await new Promise(resolve => setTimeout(resolve));

        this.cluster.workers[0].emit(
          'message', {type: 'specFileDone', filename: 'spec1.js'}
        );
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

        await new Promise(resolve => setTimeout(resolve));
        this.cluster.workers[0].emit(
          'message', {type: 'specFileDone', filename: 'spec1.js'}
        );
        this.cluster.workers[1].emit(
          'message', {type: 'specFileDone', filename: 'spec2.js'}
        );
        await expectAsync(executePromise).toBePending();
        this.cluster.workers[0].emit(
          'message', {type: 'specFileDone', filename: 'spec3.js'}
        );
        await new Promise(resolve => setTimeout(resolve));
        await this.disconnect();
        await expectAsync(executePromise).toBeResolved();
      });
    });

    it('handles worker crashes');
    it('handles worker exec failures');
    it('terminates workers if the parent crashes');

    it('dispatches an empty jasmineStarted event at the start of execution', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.execute();
      await new Promise(resolve => setTimeout(resolve));

      expect(this.consoleReporter.jasmineStarted).toHaveBeenCalledWith({});
    });

    it('dispatches a jasmineDone event when all workers are idle', async function() {
      this.testJasmine.numWorkers = 2;
      this.testJasmine.loadConfig({
        spec_dir: 'some/spec/dir'
      });
      this.testJasmine.addSpecFile('spec1.js');
      this.testJasmine.addSpecFile('spec2.js');
      this.testJasmine.addSpecFile('spec3.js');
      const executePromise = this.testJasmine.execute();

      await new Promise(resolve => setTimeout(resolve));
      this.emitSpecDone(this.cluster.workers[0], {status: 'passed'});
      this.emitFileDone(this.cluster.workers[0], 'spec1.js');
      this.emitSpecDone(this.cluster.workers[1], {status: 'passed'});
      this.emitFileDone(this.cluster.workers[1], 'spec2.js');
      this.emitSpecDone(this.cluster.workers[0], {status: 'passed'});
      this.emitFileDone(this.cluster.workers[0], 'spec3.js');
      await this.disconnect();
      await executePromise;

      expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith({
        overallStatus: 'passed',
        totalTime: jasmine.any(Number),
        failedExpectations: [],
        passedExpectations: []
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

      await new Promise(resolve => setTimeout(resolve));
      this.emitSpecDone(this.cluster.workers[0], {status: 'passed'});
      this.emitFileDone(this.cluster.workers[0], 'spec1.js');
      this.emitSpecDone(this.cluster.workers[1], {status: 'passed'});
      this.emitSpecDone(this.cluster.workers[1], {status: 'failed'});
      this.emitFileDone(this.cluster.workers[1], 'spec2.js');
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

      await new Promise(resolve => setTimeout(resolve));
      this.emitSuiteDone(this.cluster.workers[0], {status: 'passed'});
      this.emitFileDone(this.cluster.workers[0], 'spec1.js');
      this.emitSuiteDone(this.cluster.workers[1], {status: 'passed'});
      this.emitSuiteDone(this.cluster.workers[1], {status: 'failed'});
      this.emitFileDone(this.cluster.workers[1], 'spec2.js');
      await this.disconnect();
      await executePromise;

      expect(this.consoleReporter.jasmineDone).toHaveBeenCalledWith(
        jasmine.objectContaining({
          overallStatus: 'failed'
        })
      );
    });

    it('sets the jasmineDone event status to incomplete when there are focused suites');
    it('sets the jasmineDone event status to incomplete when there are focused specs');
    it('sets the jasmineDone event status to incomplete when there are no specs');
    it('includes failedExpectations in the jasmineDone event');
    it('includes deprecationWarnings in the jasmineDone event');


    describe('Handling reporter events from workers', function() {
      beforeEach(async function() {
        this.testJasmine.loadConfig({
          spec_dir: 'some/spec/dir'
        });
        this.testJasmine.addSpecFile('spec1.js');
        this.testJasmine.execute();
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
