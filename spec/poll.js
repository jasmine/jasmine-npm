// Make sure we can still work if the mock clock is installed
const realSetTimeout = setTimeout;

async function poll(predicate) {
  return new Promise(function(resolve, reject) {
    function check() {
      try {
        if (predicate()) {
          resolve();
        } else {
          realSetTimeout(check);
        }
      } catch (e) {
        reject(e);
      }
    }

    check();
  });
}

async function shortPoll(predicate, description) {
  const timedOut = {};
  const timeoutPromise = new Promise(function(resolve) {
    realSetTimeout(function() {
      resolve(timedOut);
    }, 250);
  });
  const result = await Promise.race([timeoutPromise, poll(predicate)]);

  if (result === timedOut) {
    throw new Error(`Timed out waiting for ${description}`);
  }
}

module.exports = {poll, shortPoll};
