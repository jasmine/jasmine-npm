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
        env.addReporter(forwardingReporter(this.clusterWorker_));
        env.addReporter({
          jasmineDone: event => this.jasmineDoneEvent_ = event
        });

        if (options.env) {
          env.configure(options.env);
        }

        env.setParallelLoadingState('helpers');
        return this.loadFiles_(options.helpers)
          .then(() => {
            env.setParallelLoadingState('specs');
            this.clusterWorker_.send({type: 'booted'});
            return env;
          });
      })
      .catch(error => {
        this.clusterWorker_.send({
          type: 'fatalError',
          error: serializeError(error)
        });
      });
  }

  async loadFiles_(files) {
    for (const file of files) {
      await this.loader_.load(file);
    }
  }

  runSpecFile(specFilePath) {
    (async () => {
      this.jasmineDoneEvent_ = null;
      let env = await this.envPromise_;
      env.parallelReset();

      try {
        await this.loader_.load(specFilePath);
      } catch (error) {
        this.clusterWorker_.send({
          type: 'fatalError',
          error: serializeError(error)
        });
        return;
      }

      await env.execute();

      if (!this.clusterWorker_.isConnected()) {
        console.error(
          'Jasmine worker not sending specFileDone message after disconnect'
        );
        return;
      }

      this.clusterWorker_.send({
        type: 'specFileDone',
        overallStatus: this.jasmineDoneEvent_.overallStatus,
        incompleteCode: this.jasmineDoneEvent_.incompleteCode,
        incompleteReason: this.jasmineDoneEvent_.incompleteReason,
        failedExpectations: this.jasmineDoneEvent_.failedExpectations,
        deprecationWarnings: this.jasmineDoneEvent_.deprecationWarnings,
      });
    })();
  }
}

function serializeError(error) {
  return {
    message: error.message,
    stack: error.stack
  };
}

function forwardingReporter(clusterWorker) {
  const reporter = {};
  const eventNames = ['suiteStarted', 'suiteDone', 'specStarted', 'specDone'];

  for (const eventName of eventNames) {
    reporter[eventName] = function (payload) {
      if (!clusterWorker.isConnected()) {
        console.error(
          `Jasmine worker not sending ${eventName} reporter event ` +
          'after disconnect'
        );
        return;
      }

      clusterWorker.send({
        type: 'reporterEvent',
        eventName,
        payload
      });
    };
  }

  return reporter;
}

module.exports = ParallelWorker;
