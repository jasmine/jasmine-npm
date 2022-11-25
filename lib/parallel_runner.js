const path = require('path');
const cluster = require('node:cluster');
const RunnerBase = require('./runner_base');
const randomize = require('./randomize');

// TODO: jsdocs for this
class ParallelRunner extends RunnerBase {
  constructor(options) {
    super(options);
    this.cluster_ = options.cluster || cluster;
    this.workerDone_ = {};
    this.numWorkers_ = options.numWorkers || 2;

    let jasmineCore;

    if (options.jasmineCore) {
      // Use the provided core in all processes. This is mainly for use by
      // jasmine-core's own test suite.
      jasmineCore = options.jasmineCore;
      this.jasmineCorePath_ = jasmineCore.files.self;
    } else {
      jasmineCore = require('jasmine-core');
    }

    const bootedCore = jasmineCore.boot();
    const reporterEventNames = [
      'jasmineStarted',
      'jasmineDone',
      'suiteStarted',
      'suiteDone',
      'specStarted',
      'specDone'
    ];
    this.reportDispatcher_ = new bootedCore.ReportDispatcher(
      reporterEventNames,
      function(options) {
        options = {
          ...options,
          timeout: {setTimeout, clearTimeout},
          fail: function() {
            // TODO
          },
          onException: function() {
            // TODO
          },
          deprecated: function() {
            // TODO
          }
        };
        new bootedCore.QueueRunner(options).execute();
      },
      function() {
        // TODO recordLateError
      }
    );
    this.reportDispatcher_.addReporter(this.reporter_);
    this.timer_ = new bootedCore.Timer();

    /**
     * Whether to cause the Node process to exit when the suite finishes executing.
     *
     * @name Jasmine#exitOnCompletion
     * @type {boolean}
     * @default true
     */
    this.exitOnCompletion = true;
    this.exit = process.exit;
    this.reportedFatalErrors_ = [];
  }

  /**
   * Clears all registered reporters.
   * @function
   * @name ParallelRunner#clearReporters
   */
  clearReporters() {
    this.reportDispatcher_.clearReporters();
  }

  randomizeTests(value) {
    if (!value) {
      throw new Error('Randomization cannot be disabled in parallel mode');
    }
  }

  seed(value) {
    throw new Error('Random seed cannot be set in parallel mode');
  }

  /**
   * Add a custom reporter to the Jasmine environment.
   * @function
   * @name ParallelRunner#addReporter
   * @param {Reporter} reporter The reporter to add
   * @see custom_reporter
   */
  addReporter(reporter, errorContext) {
    if (!reporter.reporterCapabilities?.parallel) {
      if (!errorContext) {
        errorContext = 'this reporter';
      }
      throw new Error(
        `Can't use ${errorContext} because it doesn't support parallel mode. ` +
        '(Add reporterCapabilities: {parallel: true} if the reporter meets ' +
        'the requirements for parallel mode.)'
      );
    }
    this.reportDispatcher_.addReporter(reporter);
  }

  /**
   * Runs the test suite.
   *
   * _Note_: Set {@link Runner#exitOnCompletion|exitOnCompletion} to false if you
   * intend to use the returned promise. Otherwise, the Node process will
   * ordinarily exit before the promise is settled.
   * @param {Array.<string>} [files] Spec files to run instead of the previously
   * configured set
   * @param {string} [filterString] Regex used to filter specs. If specified, only
   * specs with matching full names will be run.
   * @return {Promise<JasmineDoneInfo>} Promise that is resolved when the suite completes.
   */
  async execute(files, filterString) {
    if (this.startedExecuting_) {
      throw new Error('Parallel runner instance can only be executed once');
    }

    this.startedExecuting_ = true;
    const explicitFailPromise = new Promise((res, rej) => {
      this.failExecution_ = rej;
    });
    return await Promise.race([
      explicitFailPromise,
      this.execute2_(files, filterString)
    ]);
  }

  async execute2_(files, filterString) {
    if (!this.defaultReporterConfigured) {
      this.configureDefaultReporter({
        showColors: this.showingColors,
        alwaysListPendingSpecs: this.alwaysListPendingSpecs_
      });
    }

    if (files && files.length > 0) {
      this.specDir = '';
      this.specFiles = [];
      this.addMatchingSpecFiles(files);
    }

    this.executionState_ = {
      hasFailures: false,
      hasSpecs: false,
      failedExpectations: [],
      deprecationWarnings: []
    };
    let jasmineDoneInfo;
    // TODO: needs the same premature exit handling and output flushing. as `Jasmine`
    await this.withinGlobalSetup_(async () => {
      this.timer_.start();

      // Prevent Node from exiting if all workers shut down unexpectedly, such as
      // if a helper fails to load. The time interval is arbitrary.
      const keepalive = setInterval(function () {
      }, 100000);
      try {
        await this.createWorkers_(filterString);
        await this.reportDispatcher_.jasmineStarted({
          // Omit totalSpecsDefined because we don't know how many there are.
          // Omit order because it's not currently something the user can control
          // in parallel mode.
        });
        await this.runSpecFiles_();
        await this.shutDownWorkers_();
        jasmineDoneInfo = await this.reportJasmineDone_();
      } finally {
        clearInterval(keepalive);
      }
    });
    
    if (this.exitOnCompletion) {
      this.exit(RunnerBase.exitCodeForStatus(jasmineDoneInfo.overallStatus));
    }

    return jasmineDoneInfo;
  }

  async createWorkers_(filterString) {
    const workerPath = path.join(__dirname, '../bin/worker.js');
    this.cluster_.setupPrimary({exec: workerPath});
    const configPromises = [];

    const workerConfig = {
      spec_dir: this.specDir,
      helpers: this.helperFiles,
      requires: this.requires,
      filter: filterString,
      env: this.envConfig_,
    };

    if (!this.loader.alwaysImport) {
      workerConfig.jsLoader = 'require';
    }

    if (this.jasmineCorePath_) {
      workerConfig.jasmineCorePath = this.jasmineCorePath_;
    }

    for (let i = 0; i < this.numWorkers_; i++) {
      const worker = this.cluster_.fork();

      worker.on('exit', () => {
        if (!this.workerDone_[worker.id]) {
          this.fatalError_('Jasmine worker process unexpectedly exited');
        }
      });

      configPromises.push(new Promise(resolve => {
        // Wait for the worker to acknowledge that it's booted so that we don't
        // tell it to run specs while it's booting.
        let booted = false;
        worker.on('message', msg => {
          switch (msg.type) {
            case 'booted':
              booted = true;
              resolve();
              break;

            case 'fatalError':
              this.fatalError_(formatErrorFromWorker(msg.error, msg.error.message));
              break;

            default:
              if (!booted) {
                console.error('Got unexpected message from Jasmine worker during boot:', msg);
              }
              break;
          }
        });

        const msg = {type: 'configure', configuration: workerConfig};
        worker.send(msg);
      }));
    }

    await Promise.all(configPromises);
  }

  shutDownWorkers_() {
    return new Promise(resolve => {
      this.cluster_.disconnect(resolve);
    });
  }

  async runSpecFiles_() {
    this.specFiles = randomize(this.specFiles);
    this.nextSpecFileIx_ = 0;
    const workerPromises = Object.values(this.cluster_.workers)
      .map(worker => this.runWorker_(worker));
    await Promise.all(workerPromises);
    await new Promise(resolve => this.cluster_.disconnect(resolve));
  }

  async runWorker_(worker) {
    return new Promise(resolve => {
      const runNextSpecFile = () => {
        if (this.exiting_) {
          return;
        }

        const moreFiles = this.nextSpecFileIx_ < this.specFiles.length;
        const stopOnSpecFailure = this.envConfig_ ? this.envConfig_.stopOnSpecFailure : false;

        if (moreFiles && !(this.executionState_.hasFailures && stopOnSpecFailure)) {
          const filePath = this.specFiles[this.nextSpecFileIx_++];
          worker.send({type: 'runSpecFile', filePath});
        } else {
          this.workerDone_[worker.id] = true;
          resolve();
        }
      };

      worker.on('message', msg => {
        switch (msg.type) {
          case 'specFileDone':
            if (msg.incompleteCode !== 'noSpecsFound') {
              this.executionState_.hasSpecs = true;
            }

            if (msg.incompleteCode && msg.incompleteCode !== 'noSpecsFound') {
              this.executionState_.incompleteCode = msg.incompleteCode;
              this.executionState_.incompleteReason = msg.incompleteReason;
            }

            this.executionState_.failedExpectations = [
              ...this.executionState_.failedExpectations,
              ...msg.failedExpectations
            ];
            this.executionState_.deprecationWarnings = [
              ...this.executionState_.deprecationWarnings,
              ...msg.deprecationWarnings
            ];
            runNextSpecFile();
            break;

          case 'reporterEvent':
            this.handleReporterEvent_(msg.eventName, msg.payload);
            break;

          case 'fatalError':
            // Handled elsewhere
            break;

          default:
            console.error('Got unknown message from Jasmine worker:', msg);
        }
      });
      runNextSpecFile();
    });
  }

  configureEnv(envConfig) {
    if (envConfig.specFilter) {
      // specFilter is a function and we can't serialize those
      throw new Error('The specFilter config property is not supported in ' +
        'parallel mode');
    }

    if (this.startedExecuting_) {
      throw new Error("Can't call configureEnv() after execute()");
    }

    this.envConfig_ = envConfig;
  }

  handleReporterEvent_(eventName, payload) {
    switch (eventName) {
      case 'jasmineStarted':
      case 'jasmineDone':
        break;

      case 'specDone':
      case 'suiteDone':
        if (payload.status === 'failed') {
          this.executionState_.hasFailures = true;
        }
        this.reportDispatcher_[eventName](payload);
        break;

      default:
        this.reportDispatcher_[eventName](payload);
    }
  }

  async reportJasmineDone_() {
    const event = {
      totalTime: this.timer_.elapsed(),
      numWorkers: this.numWorkers_,
      failedExpectations: this.executionState_.failedExpectations,
      deprecationWarnings: this.executionState_.deprecationWarnings,
    };

    if (this.executionState_.hasFailures
      || this.executionState_.failedExpectations.length > 0) {
      event.overallStatus = 'failed';
    } else if (this.executionState_.incompleteCode) {
      event.overallStatus = 'incomplete';
      event.incompleteCode = this.executionState_.incompleteCode;
      event.incompleteReason = this.executionState_.incompleteReason;
    } else if (!this.executionState_.hasSpecs) {
      event.overallStatus = 'incomplete';
      event.incompleteCode = 'noSpecsFound';
      event.incompleteReason = 'No specs found';
    } else {
      event.overallStatus = 'passed';
    }

    await this.reportDispatcher_.jasmineDone(event);
    return event;
  }

  fatalError_(msg, msgWithoutStack) {
    if (!msgWithoutStack) {
      msgWithoutStack = msg;
    }

    this.exiting_ = true;

    // Some errors may be reported by each worker. Print them only once.
    if (!this.reportedFatalErrors_.includes(msg)) {
      console.error(msg);
      this.reportedFatalErrors_.push(msg);
    }

    this.cluster_.disconnect(() => {
      // TODO only exit if configured to exit on completion
      this.exit(1);
      // Reject, currently for the benefit of our own tests that mock exit()
      // but later for cases where we're not configured to exit on completion.
      this.failExecution_(
        new Error('Fatal error in Jasmine worker process: ' + msgWithoutStack)
      );
    });
  }
}

function formatErrorFromWorker(error) {
  // error isn't an Error instance (those don't survive IPC) so we have
  // to do some extra work to make it display nicely.
  const lines = ['Fatal error in worker: '+ error.message];
  const stack = error.stack.split('\n');
  let i = 0;

  if (stack[0].indexOf(error.message) !== 0) {
    i = 1;
  }

  for (; i < stack.length; i++) {
    lines.push(stack[i]);
  }

  return lines.join('\n');
}

module.exports = ParallelRunner;
