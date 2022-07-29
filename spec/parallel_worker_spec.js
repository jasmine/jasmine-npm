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
        configuration: {jasmineCorePath: './path/to/jasmine-core.js'}
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

      this.clusterWorker.emit('message', {type: 'configure', configuration: {}});
      await Promise.resolve();

      expect(loader.load).toHaveBeenCalledWith('jasmine-core');
      expect(core.boot).toHaveBeenCalledWith(jasmine.is(core));
    });

    it('does something reasonable when the core module fails to load');

    it('creates and configures an env'); // incl. autoCleanClosures: false

    it('loads helper files');
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
        this.clusterWorker.emit('message', {type: 'configure', configuration: {}});
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
      this.env.execute.and.returnValue(Promise.resolve());
      this.clusterWorker.emit('message', {
        type: 'runSpecFile',
        filePath: 'aSpec.js'
      });
      await Promise.resolve();
      expect(this.env.execute).not.toHaveBeenCalled();

      resolveLoader();
      await Promise.resolve();
      expect(this.env.execute).toHaveBeenCalledWith();
    });

    it('loads and runs the spec file', async function() {
      this.loader.load.withArgs('jasmine-core')
        .and.returnValue(Promise.resolve(dummyCore(this.env)));
      await this.configure();

      this.loader.load.withArgs('aSpec.js').and.returnValue(Promise.resolve());
      this.env.execute.and.returnValue(Promise.resolve());
      this.clusterWorker.emit('message', {type: 'runSpecFile', filePath: 'aSpec.js'});
      await new Promise(resolve => setTimeout(resolve));
      expect(this.loader.load).toHaveBeenCalledWith('aSpec.js');
      expect(this.env.execute).toHaveBeenCalledWith();
    });

    it('resets state from previous spec files', async function() {
      this.loader.load.withArgs('jasmine-core')
        .and.returnValue(Promise.resolve(dummyCore(this.env)));
      await this.configure();

      this.loader.load.and.returnValue(Promise.resolve());
      this.env.execute.and.returnValue(Promise.resolve());
      await this.jasmineWorker.runSpecFile('aSpec.js');
      await this.jasmineWorker.runSpecFile('bSpec.js');

      expect(this.env.parallelReset).toHaveBeenCalled();
    });

    it('proxies reporter events');

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

      resolveExecute();
      await Promise.resolve();
      await Promise.resolve();
      expect(this.clusterWorker.send).toHaveBeenCalledWith(
        {type: 'specFileDone'}
      );
    });
  });

  it('exits on disconnect');
  it('exits on parent death');

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
});
