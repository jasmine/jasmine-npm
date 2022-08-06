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

    await this.createWorkers_();
    await this.runSpecFiles_();
    await this.shutDownWorkers_();
  }

  async createWorkers_() {
    const workerPath = path.join(__dirname, '../bin/worker.js');
    this.cluster_.setupPrimary({exec: workerPath});
    const configPromises = [];

    const workerConfig = {
      spec_dir: this.specDir,
      spec_files: [],
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
        if (this.nextSpecFileIx_ < this.specFiles.length) {
          const filePath = this.specFiles[this.nextSpecFileIx_++];
          console.log(`sending file ${filePath} to worker ${worker.id} (file ${this.nextSpecFileIx_} of ${this.specFiles.length})`);
          worker.send({type: 'runSpecFile', filePath});
        } else {
          resolve();
        }
      };

      worker.on('message', msg => {
        console.log('got message from worker', msg);
        switch (msg.type) {
          case 'specFileDone':
            runNextSpecFile();
            break;

          case 'reporterEvent':
            this.handleReporterEvent_(msg.eventName, msg.payload);
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
        // TODO
        break;

      default:
        this.reportDispatcher_[eventName](payload);
    }
  }
}

module.exports = ParallelRunner;


/*
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
 */
