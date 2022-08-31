const path = require('path');
const cluster = require('node:cluster');
const RunnerBase = require('./runner_base');

// TODO: make this public?
class ParallelRunner extends RunnerBase {
  constructor(options) {
    super(options);
    this.cluster_ = options.cluster || cluster;
    this.numWorkers_ = options.numWorkers || 2;
    this.jasmineCorePath_ = options.jasmineCorePath;

    // TODO: default to loading jasmine-core like the serial runner does?
    // TODO: take just a core (which has a path on it) instad of core + path?
    const jasmineCore = options.jasmineCore || require('jasmine-core');
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
    this.reportDispatcher_.addReporter(this.reporter);
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
  }

  /**
   * Clears all registered reporters.
   * @function
   * @name ParallelRunner#clearReporters
   */
  clearReporters() {
    this.reportDispatcher_.clearReporters();
  }

  /**
   * Add a custom reporter to the Jasmine environment.
   * @function
   * @name ParallelRunner#addReporter
   * @param {Reporter} reporter The reporter to add
   * @see custom_reporter
   */
  addReporter(reporter) {
    this.reportDispatcher_.addReporter(reporter);
  }

    // TODO: filtering behavior

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
    const explicitFailPromise = new Promise((res, rej) => {
      this.failExecution_ = rej;
    });
    return Promise.race([
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
    this.timer_.start();
    await this.createWorkers_();
    await this.reportDispatcher_.jasmineStarted({
      // Omit totalSpecsDefined because we don't know how many there are.
      // Omit order because it's not currently something the user can control
      // in parallel mode.
    });
    await this.runSpecFiles_();
    await this.shutDownWorkers_();
    const overallStatus = await this.reportJasmineDone_();

    if (this.exitOnCompletion) {
      this.exit(RunnerBase.exitCodeForStatus(overallStatus));
    }
  }

  async createWorkers_() {
    const workerPath = path.join(__dirname, '../bin/worker.js');
    this.cluster_.setupPrimary({exec: workerPath});
    const configPromises = [];

    const workerConfig = {
      spec_dir: this.specDir,
      helpers: this.helperFiles,
      // TODO other properties as well
    };

    if (this.jasmineCorePath_) {
      workerConfig.jasmineCorePath = this.jasmineCorePath_;
    }

    for (let i = 0; i < this.numWorkers_; i++) {
      const worker = this.cluster_.fork();
      configPromises.push(new Promise(resolve => {
        const msg = {type: 'configure', configuration: workerConfig};
        worker.send(msg, resolve);
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

        if (this.nextSpecFileIx_ < this.specFiles.length) {
          const filePath = this.specFiles[this.nextSpecFileIx_++];
          worker.send({type: 'runSpecFile', filePath});
        } else {
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
            this.fatalError_(msg.error);
            break;

          default:
            console.error('Got unknown message from Jasmine worker:', msg);
        }
      });
      runNextSpecFile();
    });
  }

  configureEnv_(envConfig) {
    // TODO: implement this & backfill tests
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
    return event.overallStatus;
  }

  fatalError_(error) {
    // error isn't an Error instance (those don't survive IPC) so we have
    // to do some extra work to make it display nicely.
    console.error('Fatal error in worker:', error.message);
    this.exiting_ = true;
    const stack = error.stack.split('\n');
    let i = 0;

    if (stack[0].indexOf(error.message) !== 0) {
      i = 1;
    }

    for (; i < stack.length; i++) {
      console.error(stack[i]);
    }

    this.cluster_.disconnect(() => {
      // TODO only exit if configured to exit on completion
      this.exit(1);
      // Reject, currently for the benefit of our own tests that mock exit()
      // but later for cases where we're not configured to exit on completion.
      this.failExecution_(
        new Error('Fatal error in Jasmine worker process: ' + error.message)
      );
    });
  }
}

module.exports = ParallelRunner;
