// Functionally similar to wrapping a single fn in a QueueRunner
// (except for the lack of callback support), but considerably simpler
class GlobalSetupOrTeardownRunner {
  async run(name, fn, timeoutMs) {
    const maybePromise = fn();

    if (maybePromise && typeof maybePromise.then === 'function') {
      timeoutMs = timeoutMs || 5000;
      const timedOut = {};
      const timeoutPromise = new Promise(function(res) {
        setTimeout(function() {
          res(timedOut);
        }, timeoutMs);
      });

      const result = await Promise.race([maybePromise, timeoutPromise]);

      if (result === timedOut) {
        throw new Error(`${name} timed out after ${timeoutMs} milliseconds`);
      }
    }
  }
}

module.exports = GlobalSetupOrTeardownRunner;
