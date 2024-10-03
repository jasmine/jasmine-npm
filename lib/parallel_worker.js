const ConsoleSpecFilter = require("./filters/console_spec_filter");

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

    // Install global error handlers now, before jasmine-core is booted.
    // That allows jasmine-core to override them with its own more specific
    // handling. These handlers will take care of errors that occur in between
    // spec files.
    for (const errorType of ['uncaughtException', 'unhandledRejection']) {
      options.process.on(errorType, error => {
        const sent = sendIfConnected(this.clusterWorker_, {
          type: errorType,
          error: serializeError(error)
        });

        if (!sent) {
          console.error(`${errorType} in Jasmine worker process after disconnect:`,
            error);
          console.error('This error cannot be reported properly because it ' +
            'happened after the worker process was disconnected.'
          );
        }
      });
    }
  }

  configure(options) {
    this.loader_.alwaysImport = options.jsLoader !== 'require';
    this.envPromise_ = this.loader_.load(options.jasmineCorePath || 'jasmine-core')
      .then(core => {
        let env;

        if (options.globals === false) {
          env = core.noGlobals().jasmine.getEnv();
        } else {
          const bootedCore = core.boot(core);
          env = bootedCore.getEnv();
        }

        env.addReporter(forwardingReporter(this.clusterWorker_));
        env.addReporter({
          jasmineDone: event => this.jasmineDoneEvent_ = event
        });

        if (options.env) {
          env.configure(options.env);
        }

        if (options.filter) {
          const specFilter = new ConsoleSpecFilter({
            filterString: options.filter
          });
          env.configure({
            specFilter: function (spec) {
              return specFilter.matches(spec.getFullName());
            }
          });
        }

        return this.loadFiles_(options.requires || [])
          .then(() => {
            env.setParallelLoadingState('helpers');
            return this.loadFiles_(options.helpers);
          })
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
          type: 'specFileLoadError',
          filePath: specFilePath,
          error: serializeError(error)
        });
        return;
      }

      await env.execute();

      if (!this.clusterWorker_.isConnected()) {
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
      const msg = {
        type: 'reporterEvent',
        eventName,
        payload: {
          ...payload,
          // IDs we get from -core are only unique within this process.
          // Make them globally unique by prepending the worker ID.
          id: `${clusterWorker.id}-${payload.id}`
        }
      };

      try {
        sendIfConnected(clusterWorker, msg);
      } catch (e) {
        if (e instanceof TypeError) {
          msg.payload = fixNonSerializableReporterEvent(payload);
          sendIfConnected(clusterWorker, msg);
        } else {
          throw e;
        }
      }
    };
  }

  return reporter;
}

function sendIfConnected(clusterWorker, msg) {
  if (clusterWorker.isConnected()) {
    try {
      clusterWorker.send(msg);
      return true;
    } catch (e) {
      // EPIPE may be thrown if the worker receives a disconnect between
      // the calls to isConnected() and send() above.
      if (e.code !== 'EPIPE') {
        throw e;
      }
    }
  }

  return false;
}

function fixNonSerializableReporterEvent(payload) {
  payload = {...payload};

  for (const ak of ['passedExpectations', 'failedExpectations']) {
    if (payload[ak]) {
      payload[ak] = payload[ak].map(function(expectation) {
        expectation = {...expectation};

        for (const vk of ['expected', 'actual']) {
          try {
            JSON.stringify(expectation[vk]);
          } catch (ex) {
            expectation[vk] = '<not serializable>';
          }
        }

        return expectation;
      });
    }
  }

  return payload;
}


module.exports = ParallelWorker;
