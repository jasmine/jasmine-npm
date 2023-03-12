// Functionally similar to wrapping a single fn in a QueueRunner
// (except for the lack of callback support), but considerably simpler
class GlobalSetupOrTeardownRunner {
  async run(name, fn, timeoutMs) {
    await withTimeout(name, timeoutMs, async function() {
      await withGlobalErrorHandling(name, fn);
    });
  }
}

async function withGlobalErrorHandling(name, fn) {
  process.on('uncaughtException', onUncaughtException);
  process.on('unhandledRejection', onUnhandledRejection);
  let globalError = null;

  try {
    await fn();
  } finally {
    process.off('uncaughtException', onUncaughtException);
    process.off('unhandledRejection', onUnhandledRejection);
  }

  if (globalError) {
    throw globalError;
  }

  function onUncaughtException(e) {
    globalError = new Error(`Unhandled exception during ${name}`, {
      cause: e
    });
  }

  function onUnhandledRejection(e) {
    globalError = new Error(`Unhandled promise rejection during ${name}`, {
      cause: e
    });
  }
}

async function withTimeout(name, timeoutMs, fn) {
  timeoutMs = timeoutMs || 5000;
  const maybePromise = fn();
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

module.exports = GlobalSetupOrTeardownRunner;
