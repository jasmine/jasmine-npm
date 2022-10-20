const EventEmitter = require('node:events');
const ParallelWorker = require('../lib/parallel_worker');

describe('ParallelWorker', function() {
  beforeEach(function() {
    this.clusterWorker = new EventEmitter();
    this.clusterWorker.send = jasmine.createSpy('clusterWorker.send');
    this.clusterWorker.isConnected = jasmine.createSpy(
      'clusterWorker.isConnected'
    ).and.returnValue(true);
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

    it('creates and configures an env', async function() {
      const env = jasmine.createSpyObj('env', [
        'configure', 'addReporter', 'setParallelLoadingState'
      ]);
      const loader = {
        load() {
          return Promise.resolve(dummyCore(env));
        }
      };
      new ParallelWorker({loader, clusterWorker: this.clusterWorker});
      const envConfig = {
        stopSpecOnExpectationFailure: true,
      };

      this.clusterWorker.emit('message', {
        type: 'configure',
        configuration: {
          helpers: [],
          env: envConfig,
        }
      });
      await new Promise(res => setTimeout(res));

      expect(env.configure).toHaveBeenCalledWith(envConfig);
    });

    it('uses the configured jsLoader setting', async function() {
      const loader = {
        load() {
          return Promise.resolve(dummyCore());
        }
      };
      new ParallelWorker({loader, clusterWorker: this.clusterWorker});
      this.clusterWorker.emit('message', {
        type: 'configure',
        configuration: {
          jsLoader: 'require'
        }
      });
      await new Promise(res => setTimeout(res));

      expect(loader.alwaysImport).toBeFalse();
    });

    it('defaults to import if jsLoader is not specified', async function() {
      const loader = {
        load() {
          return Promise.resolve(dummyCore());
        }
      };
      new ParallelWorker({loader, clusterWorker: this.clusterWorker});
      this.clusterWorker.emit('message', {
        type: 'configure',
        configuration: {}
      });
      await new Promise(res => setTimeout(res));

      expect(loader.alwaysImport).toBeTrue();
    });

    it('applies a spec filter if specified', async function() {
      const env = jasmine.createSpyObj('env', [
        'addReporter', 'setParallelLoadingState'
      ]);
      let envConfig = {};
      env.configure = function(config) {
        envConfig = {
          ...envConfig,
          ...config
        };
      };
      const loader = {
        load() {
          return Promise.resolve(dummyCore(env));
        }
      };
      new ParallelWorker({loader, clusterWorker: this.clusterWorker});

      this.clusterWorker.emit('message', {
        type: 'configure',
        configuration: {
          filter: '^foo',
        }
      });
      await new Promise(res => setTimeout(res));

      expect(envConfig.specFilter).toEqual(jasmine.any(Function));
      expect(envConfig.specFilter({getFullName: () => 'foobar'})).toEqual(true);
      expect(envConfig.specFilter({getFullName: () => ' foo'})).toEqual(false);
    });

    it('loads helper files after booting the core', async function() {
      const loader = jasmine.createSpyObj('loader', ['load']);
      const core = dummyCore();
      spyOn(core, 'boot').and.callThrough();
      const helperPromises = [], resolveHelperPromises = [];

      for (let i = 0; i < 2; i++) {
        helperPromises[i] = new Promise(function(resolve) {
          resolveHelperPromises[i] = resolve;
        });
      }

      loader.load.withArgs('jasmine-core')
        .and.returnValue(Promise.resolve(core));
      loader.load.withArgs('/some/dir/helper0.js')
        .and.returnValue(helperPromises[0]);
      loader.load.withArgs('/some/dir/helper1.js')
        .and.returnValue(helperPromises[1]);
      new ParallelWorker({loader, clusterWorker: this.clusterWorker});

      this.clusterWorker.emit('message', {
        type: 'configure',
        configuration: {
          helpers: [
            '/some/dir/helper0.js',
            '/some/dir/helper1.js',
          ]
        }
      });

      await poll(() => loader.load.calls.count() === 2);
      expect(loader.load).toHaveBeenCalledWith('/some/dir/helper0.js');

      resolveHelperPromises[0]();
      await poll(() => loader.load.calls.count() === 3);
      expect(loader.load).toHaveBeenCalledWith('/some/dir/helper1.js');
      expect(this.clusterWorker.send).not.toHaveBeenCalledWith({type: 'booted'});

      resolveHelperPromises[1]();
      await poll(() => this.clusterWorker.send.calls.any());
      expect(this.clusterWorker.send).toHaveBeenCalledWith({type: 'booted'});
    });

    it('loads requires before helpers', async function() {
      const loader = jasmine.createSpyObj('loader', ['load']);
      const core = dummyCore();
      spyOn(core, 'boot').and.callThrough();
      const requirePromises = [], resolveRequirePromises = [];

      for (let i = 0; i < 2; i++) {
        requirePromises[i] = new Promise(function(resolve) {
          resolveRequirePromises[i] = resolve;
        });
      }

      loader.load.withArgs('jasmine-core')
        .and.returnValue(Promise.resolve(core));
      loader.load.withArgs('/some/dir/require0.js')
        .and.returnValue(requirePromises[0]);
      loader.load.withArgs('/some/dir/require1.js')
        .and.returnValue(requirePromises[1]);
      loader.load.withArgs('/some/dir/helper.js')
        .and.returnValue(new Promise(() => {}));

      new ParallelWorker({loader, clusterWorker: this.clusterWorker});

      this.clusterWorker.emit('message', {
        type: 'configure',
        configuration: {
          helpers: [
            '/some/dir/helper.js',
          ],
          requires: [
            '/some/dir/require0.js',
            '/some/dir/require1.js',
          ]
        }
      });
      await poll(() => loader.load.calls.count() === 2);

      expect(loader.load).toHaveBeenCalledWith('/some/dir/require0.js');
      resolveRequirePromises[0]();
      await poll(() => loader.load.calls.count() === 3);
      expect(loader.load).toHaveBeenCalledWith('/some/dir/require1.js');
      expect(loader.load).not.toHaveBeenCalledWith('/some/dir/helper.js');

      resolveRequirePromises[1]();
      await poll(() => loader.load.calls.count() === 4);
      expect(loader.load).toHaveBeenCalledWith('/some/dir/helper.js');
    });
  });

  describe('When a runSpecFile message is received', function() {
    beforeEach(async function() {
      this.loader = jasmine.createSpyObj('loader', ['load']);
      this.env = jasmine.createSpyObj(
        'env', ['execute', 'parallelReset', 'addReporter', 'setParallelLoadingState']
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

    it('does not try to report completion if disconnected', async function() {
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

      this.clusterWorker.isConnected.and.returnValue(false);
      spyOn(console, 'error');
      resolveExecute();

      await Promise.resolve();
      await Promise.resolve();
      // No other messages should have been sent
      expect(this.clusterWorker.send).toHaveBeenCalledOnceWith({type: 'booted'});
      expect(console.error).toHaveBeenCalledOnceWith(
        'Jasmine worker not sending specFileDone message after disconnect'
      );
    });
  });

  describe('Handling reporter events', function() {
    const forwardedEvents = ['suiteStarted', 'suiteDone', 'specStarted', 'specDone'];
    const nonForwardedEvents = ['jasmineStarted', 'jasmineDone'];

    for (const eventName of forwardedEvents) {
      it(`forwards ${eventName} to the primary if connected`, async function() {
        const env = jasmine.createSpyObj(
          'env', ['execute', 'parallelReset', 'addReporter']
        );
        const loader = jasmine.createSpyObj('loader', ['load']);
        loader.load.withArgs('jasmine-core')
          .and.returnValue(Promise.resolve(dummyCore(env)));
        this.clusterWorker.id = 17;
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

        const payload = {
          id: 'foo',
          description: 'a spec or suite'
        };
        dispatchRepoterEvent(env, eventName, payload);

        expect(this.clusterWorker.send).toHaveBeenCalledWith({
          type: 'reporterEvent',
          eventName,
          payload: {
            id: '17-foo',
            description: 'a spec or suite'
          }
        });

        this.clusterWorker.send.calls.reset();
        this.clusterWorker.isConnected.and.returnValue(false);
        spyOn(console, 'error');
        dispatchRepoterEvent(env, eventName, payload);

        expect(this.clusterWorker.send).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledOnceWith(
          `Jasmine worker not sending ${eventName} reporter event after disconnect`
        );
      });
    }

    for (const eventName of nonForwardedEvents) {
      it(`does not forward ${eventName}`, async function () {
        const env = jasmine.createSpyObj(
          'env', ['execute', 'parallelReset', 'addReporter', 'setParallelLoadingState']
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

        // No other messages should have been sent
        expect(this.clusterWorker.send).toHaveBeenCalledOnceWith({type: 'booted'});
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
            addReporter() {},
            parallelReset() {},
            setParallelLoadingState() {},
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
