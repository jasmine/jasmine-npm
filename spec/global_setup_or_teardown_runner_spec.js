const GlobalSetupOrTeardownRunner = require('../lib/global_setup_or_teardown_runner');

describe('GlobalSetupOrTeardownRunner', function() {
  describe('#run', function() {
    it('waits for a promise-returning fn to complete', async function () {
      const subject = new GlobalSetupOrTeardownRunner();
      let resolve;

      const runPromise = subject.run('', function() {
        return new Promise(res => resolve = res);
      });
      await expectAsync(runPromise).toBePending();

      resolve();
      await runPromise;
    });
  });

  it('supports synchronous fns', async function() {
    const subject = new GlobalSetupOrTeardownRunner();
    await subject.run('', function() {});
  });

  it('fails if the fn throws synchronously', async function() {
    const subject = new GlobalSetupOrTeardownRunner();
    const error = new Error('nope');
    const runPromise = subject.run('', function() {
      throw error;
    });
    await expectAsync(runPromise).toBeRejectedWith(jasmine.is(error));
  });

  it('fails if the promise returned by the fn is rejected', async function () {
    const subject = new GlobalSetupOrTeardownRunner();
    const error = new Error('nope');
    const runPromise = subject.run('', function() {
      return Promise.reject(error);
    });
    await expectAsync(runPromise).toBeRejectedWith(jasmine.is(error));
  });

  describe('Timeout handling', function() {
    const realSetTimeout = setTimeout;

    beforeEach(function() {
      jasmine.clock().install();
    });

    afterEach(function() {
      jasmine.clock().uninstall();
    });

    it('fails if the promise returned by the fn is not resolved within 5 seconds', async function () {
      const subject = new GlobalSetupOrTeardownRunner();
      const runPromise = subject.run('foo', function() {
        return new Promise(() => {});
      });

      jasmine.clock().tick(4999);
      await new Promise(res => realSetTimeout.call(null, res));
      await expectAsync(runPromise).toBePending();

      jasmine.clock().tick(1);
      await expectAsync(runPromise).toBeRejectedWithError(
        'foo timed out after 5000 milliseconds'
      );
    });

    it('can use a custom timeout', async function() {
      const subject = new GlobalSetupOrTeardownRunner();
      const runPromise = subject.run('bar', function() {
        return new Promise(() => {});
      }, 10);

      jasmine.clock().tick(9);
      await new Promise(res => realSetTimeout.call(null, res));
      await expectAsync(runPromise).toBePending();

      jasmine.clock().tick(1);
      await expectAsync(runPromise).toBeRejectedWithError(
        'bar timed out after 10 milliseconds'
      );
    });
  });
});
