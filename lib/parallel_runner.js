const path = require('path');
const cluster = require('node:cluster');
const RunnerBase = require('./runner_base');

// TODO: make this public
class ParallelRunner extends RunnerBase {
  constructor(options) {
    super(options);
    this.cluster_ = options.cluster || cluster;
    this.reporters_ = [this.reporter];
    /**
     * The number of worker processes to create
     * @type {number}
     */
    this.numWorkers = 2;
    this.jasmineCorePath_ = options.jasmineCorePath;
  }

  /**
   * Clears all registered reporters.
   * @function
   * @name ParallelRunner#clearReporters
   */
  clearReporters() {
    this.reporters_ = [];
  }

  /**
   * Add a custom reporter to the Jasmine environment.
   * @function
   * @name ParallelRunner#addReporter
   * @param {Reporter} reporter The reporter to add
   * @see custom_reporter
   */
  addReporter(reporter) {
    this.reporters_.push(reporter);
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
    console.log('created workers');
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

    for (let i = 0; i < this.numWorkers; i++) {
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
          default:
            console.log('Got unknown message from worker:', msg);
        }
      });
      runNextSpecFile();
    });
  }

  configureEnv_(envConfig) {
    // TODO: implement this & backfill tests
  }
}

module.exports = ParallelRunner;
