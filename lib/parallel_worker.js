class ParallelWorker {
  constructor(options) {
    this.loader_= options.loader;
    this.clusterWorker_ = options.clusterWorker;

    this.clusterWorker_.on('message', msg => {
      switch (msg.type) {
        case 'configure':
          this.configure(msg.configuration);
          break;

        case 'runSpecFile':
          this.runSpecFile(msg.filePath);
          break;

        default:
          console.error('Jasmine worker got an unrecognized message:', msg);
      }
    });
  }

  configure(options) {
    this.envPromise_ = this.loader_.load(options.jasmineCorePath || 'jasmine-core')
      .then(core => {
        // TODO also support globals: false
        const bootedCore = core.boot(core);
        const env = bootedCore.getEnv();
        env.addReporter(new TemporaryConsoleReporter(this.clusterWorker_.id));
        return env;
      });
  }

  runSpecFile(specFilePath) {
    (async () => {
      let env = await this.envPromise_;
      env.parallelReset();
      await this.loader_.load(specFilePath);
      await env.execute();
      this.clusterWorker_.send({type: 'specFileDone'});
    })();
  }
}

class TemporaryConsoleReporter {
  constructor(workerId) {
    const events = [
      'jasmineStarted',
      'jasmineDone',
      'suiteStarted',
      'suiteDone',
      'specStarted',
      'specDone'
    ];

    for (const eventName of events) {
      this[eventName] = function(event) {
        console.log(`Worker ${workerId} event:`, eventName, event);
      };
    }
  }
}

module.exports = ParallelWorker;
