const EventEmitter = require('node:events');
const ParallelWorker = require('../lib/parallel_worker');

describe('ParallelWorker', function() {
  beforeEach(function() {
    this.clusterWorker = new EventEmitter();
    this.clusterWorker.send = jasmine.createSpy('clusterWorker.send');
  });

  describe('When a configure event is received', function() {
    it('can use a caller-supplied jasmine-core', async function () {
      const loader = jasmine.createSpyObj('loader', ['load']);
      const core = dummyCore();
      spyOn(core, 'boot').and.callThrough();
      loader.load.and.returnValue(Promise.resolve(core));
      new ParallelWorker({loader, clusterWorker: this.clusterWorker});

      this.clusterWorker.emit('message', {
        type: 'configure',
        configuration: {
          jasmineCorePath: './path/to/jasmine-core.js',
          helpers: [],
        }
      });
      await Promise.resolve();

      expect(loader.load).toHaveBeenCalledWith('./path/to/jasmine-core.js');
      expect(loader.load).not.toHaveBeenCalledWith('jasmine-core');
      expect(core.boot).toHaveBeenCalledWith(jasmine.is(core));
    });

    it('can use the default jasmine-core', async function () {
      const loader = jasmine.createSpyObj('loader', ['load']);
      const core = dummyCore();
      spyOn(core, 'boot').and.callThrough();
      loader.load.and.returnValue(Promise.resolve(core));
      new ParallelWorker({loader, clusterWorker: this.clusterWorker});

      this.clusterWorker.emit('message', {
        type: 'configure',
        configuration: {
          helpers: [],
        }
      });
      await Promise.resolve();

      expect(loader.load).toHaveBeenCalledWith('jasmine-core');
      expect(core.boot).toHaveBeenCalledWith(jasmine.is(core));
    });

    it('does something reasonable when the core module fails to load');

    it('creates and configures an env');

    it('loads helper files after booting the core', async function() {
      const loader = jasmine.createSpyObj('loader', ['load']);
      const core = dummyCore();
      spyOn(core, 'boot').and.callThrough();
      loader.load.withArgs('jasmine-core')
        .and.returnValue(Promise.resolve(core));
      loader.load.withArgs(jasmine.stringContaining('/some/dir/helper'))
        .and.returnValue(Promise.resolve({}));
      new ParallelWorker({loader, clusterWorker: this.clusterWorker});

      this.clusterWorker.emit('message', {
        type: 'configure',
        configuration: {
          helpers: [
            '/some/dir/helper1.js',
            '/some/dir/helper2.js',
          ]
        }
      });
      await Promise.resolve();

      expect(loader.load).toHaveBeenCalledWith('/some/dir/helper1.js');
      expect(loader.load).toHaveBeenCalledWith('/some/dir/helper2.js');
    });
  });

  describe('When a runSpecFile message is received', function() {
    beforeEach(async function() {
      this.loader = jasmine.createSpyObj('loader', ['load']);
      this.env = jasmine.createSpyObj(
        'env', ['execute', 'parallelReset', 'addReporter']
      );
      this.core = dummyCore(this.env);
      this.loader.load.withArgs('jasmine-core')
        .and.returnValue(Promise.resolve(this.core));
      this.jasmineWorker = new ParallelWorker({
        loader: this.loader,
        clusterWorker: this.clusterWorker
      });

      this.configure = async () => {
        this.clusterWorker.emit('message', {
          type: 'configure',
          configuration: {
            helpers: [],
          }
        });
        await this.jasmineWorker.envPromise_;
        this.loader.load.calls.reset();
      };
    });

    it('waits for configuration to finish', async function() {
      let resolveLoader;
      await this.configure();

      this.loader.load.withArgs('aSpec.js').and.returnValue(
        new Promise(resolve => {
            resolveLoader = resolve;
          }
        ));
      this.env.execute.and.returnValue(new Promise(() => {}));
      this.clusterWorker.emit('message', {
        type: 'runSpecFile',
        filePath: 'aSpec.js'
      });
      await Promise.resolve();
      expect(this.env.execute).not.toHaveBeenCalled();

      resolveLoader();
      await Promise.resolve();
      await Promise.resolve();
      expect(this.env.execute).toHaveBeenCalledWith();
    });

    it('loads and runs the spec file', async function() {
      this.loader.load.withArgs('jasmine-core')
        .and.returnValue(Promise.resolve(dummyCore(this.env)));
      await this.configure();

      this.loader.load.withArgs('aSpec.js').and.returnValue(Promise.resolve());
      this.env.execute.and.returnValue(new Promise(() => {}));
      this.clusterWorker.emit('message', {type: 'runSpecFile', filePath: 'aSpec.js'});
      await new Promise(resolve => setTimeout(resolve));
      expect(this.loader.load).toHaveBeenCalledWith('aSpec.js');
      expect(this.env.execute).toHaveBeenCalledWith();
    });

    describe('When the spec file fails to load', function() {
      it('reports the failure', async function() {
        this.loader.load.withArgs('jasmine-core')
          .and.returnValue(Promise.resolve(dummyCore(this.env)));
        await this.configure();

        const error = new Error('nope');
        this.loader.load.withArgs('aSpec.js')
          .and.returnValue(Promise.reject(error));

        this.clusterWorker.emit('message', {type: 'runSpecFile', filePath: 'aSpec.js'});
        await Promise.resolve();
        await Promise.resolve();

        expect(this.clusterWorker.send).toHaveBeenCalledWith(
          {
            type: 'fatalError',
            error: {
              message: error.message,
              stack: error.stack
            },
          }
        );
        expect(this.env.execute).not.toHaveBeenCalled();
      });
    });

    it('resets state from previous spec files', async function() {
      this.loader.load.withArgs('jasmine-core')
        .and.returnValue(Promise.resolve(dummyCore(this.env)));
      await this.configure();

      this.loader.load.and.returnValue(Promise.resolve());
      let resolveExecute;
      this.env.execute.and.callFake(function() {
        return new Promise(function(res) {
          resolveExecute = res;
        });
      });
      let doneCalls = 0;
      this.clusterWorker.send.and.callFake(function(event) {
        if (event.type === 'specFileDone') {
          doneCalls++;
        }
      });
      this.jasmineWorker.runSpecFile('aSpec.js');
      await poll(() => !!resolveExecute);
      dispatchRepoterEvent(this.env, 'jasmineDone', {});
      resolveExecute();
      await poll(() => doneCalls === 1);
      this.env.parallelReset.calls.reset();
      resolveExecute = null;
      this.jasmineWorker.runSpecFile('bSpec.js');
      await poll(() => !!resolveExecute);

      expect(this.env.parallelReset).toHaveBeenCalled();
    });

    it('reports completion', async function() {
      this.loader.load.withArgs('jasmine-core')
        .and.returnValue(Promise.resolve(dummyCore(this.env)));
      await this.configure();
      this.loader.load.withArgs('aSpec.js').and.returnValue(Promise.resolve());

      let resolveExecute;
      this.env.execute
        .and.returnValue(new Promise(res => resolveExecute = res));
      this.clusterWorker.emit('message', {type: 'runSpecFile', filePath: 'aSpec.js'});

      await Promise.resolve();
      expect(this.clusterWorker.send).not.toHaveBeenCalledWith(
        {type: 'specFileDone'}
      );

      dispatchRepoterEvent(this.env, 'jasmineDone', {
        overallStatus: 'incomplete',
        incompleteCode: 'focused',
        incompleteReason: 'fit',
        order: 'should be ignored',
        failedExpectations: ['failed expectations'],
        deprecationWarnings: ['deprecations'],
      });
      resolveExecute();
      await Promise.resolve();
      await Promise.resolve();
      expect(this.clusterWorker.send).toHaveBeenCalledWith({
        type: 'specFileDone',
        overallStatus: 'incomplete',
        incompleteCode: 'focused',
        incompleteReason: 'fit',
        failedExpectations: ['failed expectations'],
        deprecationWarnings: ['deprecations'],
      });
    });
  });

  describe('Handling reporter events', function() {
    const forwardedEvents = ['suiteStarted', 'suiteDone', 'specStarted', 'specDone'];
    const nonForwardedEvents = ['jasmineStarted', 'jasmineDone'];

    for (const eventName of forwardedEvents) {
      it(`forwards ${eventName} to the primary`, async function() {
        const env = jasmine.createSpyObj(
          'env', ['execute', 'parallelReset', 'addReporter']
        );
        const loader = jasmine.createSpyObj('loader', ['load']);
        loader.load.withArgs('jasmine-core')
          .and.returnValue(Promise.resolve(dummyCore(env)));
        const jasmineWorker = new ParallelWorker({
          loader,
          clusterWorker: this.clusterWorker
        });

        this.clusterWorker.emit('message', {
          type: 'configure',
          configuration: {
            helpers: [],
          }
        });
        await jasmineWorker.envPromise_;

        const payload = 'arbitrary reporter event payload';
        dispatchRepoterEvent(env, eventName, payload);

        expect(this.clusterWorker.send).toHaveBeenCalledWith({
          type: 'reporterEvent',
          eventName,
          payload
        });
      });
    }

    for (const eventName of nonForwardedEvents) {
      it(`does not forward ${eventName}`, async function () {
        const env = jasmine.createSpyObj(
          'env', ['execute', 'parallelReset', 'addReporter']
        );
        const loader = jasmine.createSpyObj('loader', ['load']);
        loader.load.withArgs('jasmine-core')
          .and.returnValue(Promise.resolve(dummyCore(env)));
        const jasmineWorker = new ParallelWorker({
          loader,
          clusterWorker: this.clusterWorker
        });

        this.clusterWorker.emit('message', {
          type: 'configure',
          configuration: {
            helpers: [],
          }
        });
        await jasmineWorker.envPromise_;

        dispatchRepoterEvent(env, eventName, {});

        expect(this.clusterWorker.send).not.toHaveBeenCalled();
      });
    }
  });


  it('exits on disconnect');
});

function dispatchRepoterEvent(env, eventName, payload) {
  expect(env.addReporter).toHaveBeenCalled();

  for (const [reporter] of env.addReporter.calls.allArgs()) {
    if (reporter[eventName]) {
      reporter[eventName](payload);
      dispatched = true;
    }
  }
}


function dummyCore(env) {
  return {
    boot: function() {
      return {
        getEnv: function() {
          return env || {
            addReporter: function() {},
            parallelReset: function() {}
          };
        },
      };
    }
  };
}

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
