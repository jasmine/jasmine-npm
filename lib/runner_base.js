const path = require('path');
const util = require('util');
const glob = require("glob");
const ConsoleReporter = require('./reporters/console_reporter');
const Loader = require("./loader");
const GlobalSetupOrTeardownRunner = require('./global_setup_or_teardown_runner');
const unWindows = require('./unWindows');

/**
 * @classdesc Defines common methods and properties of {@link Jasmine} and
 * {@link ParallelRunner}.<br>
 * Note: This should be considered an interface. It's only documented as a class
 * due to jsdoc limitations. You can safely assume that these members are
 * available on both runner classes, but the inheritance structure itself is an
 * implementation detail that may change at any time.
 * @constructor
 * @hideconstructor
 * @name Runner
 */
class RunnerBase {
  constructor(options) {
    this.loader = options.loader || new Loader();

    let baseDir;
    
    if (options.projectBaseDir) {
      baseDir = options.projectBaseDir;
    } else {
      baseDir = (options.getcwd || path.resolve)();
    }
    
    this.projectBaseDir = unWindows(baseDir);
 
    this.specFiles = [];
    this.helperFiles = [];
    this.requires = [];
    this.specDir = '';
    this.reporter_ = new (options.ConsoleReporter || ConsoleReporter)();
    this.defaultReporterConfigured = false;
    this.showingColors = true;
    this.alwaysListPendingSpecs_ = true;
    this.globalSetupOrTeardownRunner_ =
      options.globalSetupOrTeardownRunner || new GlobalSetupOrTeardownRunner();
    this.globals_ = options.globals;
  }

  /**
   * Sets whether to show colors in the console reporter.
   * @function
   * @name Runner#showColors
   * @param {boolean} value Whether to show colors
   */
  showColors(value) {
    this.showingColors = value;
  }

  /**
   * Sets whether to run in verbose mode, which prints information that may
   * be useful for debugging configuration problems.
   * @function
   * @name Runner#verbose
   * @param {boolean} value Whether to run in verbose mode
   */
  verbose(isVerbose) {
    this.isVerbose_ = isVerbose;
  }

  /**
   * Sets whether the console reporter should list pending specs even when there
   * are failures.
   * @name Runner#alwaysListPendingSpecs
   * @function
   * @param value {boolean}
   */
  alwaysListPendingSpecs(value) {
    this.alwaysListPendingSpecs_ = value;
  }

  /**
   * Loads configuration from the specified file. The file can be a JSON file or
   * any JS file that's loadable as a module and provides a Jasmine config
   * as its default export.
   *
   * The config file will be loaded via dynamic import() unless this Jasmine
   * instance has already been configured with {jsLoader: 'require'}. Dynamic
   * import() supports ES modules as well as nearly all CommonJS modules.
   * @name Runner#loadConfigFile
   * @function
   * @param {string} [configFilePath=spec/support/jasmine.json]
   * @return Promise
   */
  async loadConfigFile(configFilePath) {
    if (this.isVerbose_) {
      console.log(`Project base dir: ${this.projectBaseDir}`);
    }

    if (configFilePath) {
      if (this.isVerbose_) {
        console.log(`Loading config file ${configFilePath} because it was explicitly specified`);
      }
      await this.loadSpecificConfigFile_(configFilePath);
    } else {
      let numFound = 0;

      for (const ext of ['json', 'js']) {
        const candidate = `spec/support/jasmine.${ext}`;

        try {
          await this.loadSpecificConfigFile_(candidate);
          numFound++;
        } catch (e) {
          if (e.code !== 'MODULE_NOT_FOUND'       // CommonJS
            && e.code !== 'ERR_MODULE_NOT_FOUND'  // ESM
            && e.code !== 'ENOENT') {             // Testdouble.js, maybe other ESM loaders too
            throw e;
          }

          if (this.isVerbose_) {
            console.log(`Tried to load config file ${candidate} but it does not exist (${e.code})`);
          }
        }
      }

      if (numFound > 1) {
        console.warn(
          'Deprecation warning: Jasmine found and loaded both jasmine.js ' +
          'and jasmine.json\n' +
          'config files. In a future version, only the first file found ' +
          'will be loaded.'
        );
      } else if (numFound === 0 && this.isVerbose_) {
        console.log('Did not find any config files.');
      }
    }
  }

  async loadSpecificConfigFile_(relativePath) {
    const absolutePath = path.resolve(this.projectBaseDir, relativePath);
    const config = await this.loader.load(absolutePath);
    if (this.isVerbose_) {
      console.log(`Loaded config file ${absolutePath}`);
    }
    this.loadConfig(config);
  }

  /**
   * Loads configuration from the specified object.
   * @name Runner#loadConfig
   * @function
   * @param {Configuration} config
   */
  loadConfig(config) {
    /**
     * @interface Configuration
     */
    const envConfig = {...config.env};

    /**
     * The directory that spec files are contained in, relative to the project
     * base directory.
     * @name Configuration#spec_dir
     * @type string | undefined
     */
    this.specDir = config.spec_dir || this.specDir;

    /**
     * Whether to fail specs that contain no expectations.
     * @name Configuration#failSpecWithNoExpectations
     * @type boolean | undefined
     * @default false
     */
    if (config.failSpecWithNoExpectations !== undefined) {
      envConfig.failSpecWithNoExpectations = config.failSpecWithNoExpectations;
    }

    /**
     * Whether to stop each spec on the first expectation failure.
     * @name Configuration#stopSpecOnExpectationFailure
     * @type boolean | undefined
     * @default false
     */
    if (config.stopSpecOnExpectationFailure !== undefined) {
      envConfig.stopSpecOnExpectationFailure = config.stopSpecOnExpectationFailure;
    }

    /**
     * Whether to stop suite execution on the first spec failure.
     * @name Configuration#stopOnSpecFailure
     * @type boolean | undefined
     * @default false
     */
    if (config.stopOnSpecFailure !== undefined) {
      envConfig.stopOnSpecFailure = config.stopOnSpecFailure;
    }

    /**
     * Whether the default reporter should list pending specs even if there are
     * failures.
     * @name Configuration#alwaysListPendingSpecs
     * @type boolean | undefined
     * @default true
     */
    if (config.alwaysListPendingSpecs !== undefined) {
      this.alwaysListPendingSpecs(config.alwaysListPendingSpecs);
    }

    /**
     * Whether to run specs in a random order.
     * @name Configuration#random
     * @type boolean | undefined
     * @default true
     */
    if (config.random !== undefined) {
      envConfig.random = config.random;
    }

    if (config.verboseDeprecations !== undefined) {
      envConfig.verboseDeprecations = config.verboseDeprecations;
    }


    /**
     * Specifies how to load files with names ending in .js. Valid values are
     * "require" and "import". "import" should be safe in all cases, and is
     * required if your project contains ES modules with filenames ending in .js.
     * @name Configuration#jsLoader
     * @type string | undefined
     * @default "require"
     */
    if (config.jsLoader === 'import' || config.jsLoader === undefined) {
      this.loader.alwaysImport = true;
    } else if (config.jsLoader === 'require') {
      this.loader.alwaysImport = false;
    } else {
      throw new Error(`"${config.jsLoader}" is not a valid value for the ` +
        'jsLoader configuration property. Valid values are "import", ' +
        '"require", and undefined.');
    }

    if (Object.keys(envConfig).length > 0) {
      this.configureEnv(envConfig);
    }

    /**
     * An array of helper file paths or {@link https://github.com/isaacs/node-glob#glob-primer|globs}
     * that match helper files. Each path or glob will be evaluated relative to
     * the spec directory. Helpers are loaded before specs.
     * @name Configuration#helpers
     * @type string[] | undefined
     */
    if(config.helpers) {
      this.addMatchingHelperFiles(config.helpers);
    }

    /**
     * An array of module names to load via require() at the start of execution.
     * @name Configuration#requires
     * @type string[] | undefined
     */
    if(config.requires) {
      this.addRequires(config.requires);
    }

    /**
     * An array of spec file paths or {@link https://github.com/isaacs/node-glob#glob-primer|globs}
     * that match helper files. Each path or glob will be evaluated relative to
     * the spec directory.
     * @name Configuration#spec_files
     * @type string[] | undefined
     */
    if(config.spec_files) {
      this.addMatchingSpecFiles(config.spec_files);
    }

    /**
     * An array of reporters. Each object in the array will be passed to
     * {@link Jasmine#addReporter} or {@link ParallelRunner#addReporter}.
     *
     * This provides a middle ground between the --reporter= CLI option and full
     * programmatic usage. Note that because reporters are objects with methods,
     * this option can only be used in JavaScript config files
     * (e.g `spec/support/jasmine.js`), not JSON.
     * @name Configuration#reporters
     * @type Reporter[] | undefined
     * @see custom_reporter
     */
    if (config.reporters) {
      for (let i = 0; i < config.reporters.length; i++) {
        this.addReporter(
          config.reporters[i],
          `the reporter in position ${i} of the configuration's reporters array`
        );
      }
    }

    /**
     * A function that will be called exactly once, even in parallel mode,
     * before the test suite runs. This is intended to be used to initialize
     * out-of-process state such as starting up an external service.
     *
     * If the globalSetup function is async or otherwise returns a promise,
     * Jasmine will wait up to {@link Configuration#globalSetupTimeout}
     * milliseconds for it to finish before running specs. Callbacks are not
     * supported.
     *
     * globalSetup may be run in a different process from the specs. In-process
     * side effects that it causes, including changes to the Jasmine
     * environment, are not guaranteed to affect any or all specs. Use either
     * beforeEach or beforeAll for in-process setup.
     *
     * @name Configuration#globalSetup
     * @type Function | undefined
     */
    if (config.globalSetup) {
      this.globalSetup_ = config.globalSetup;
    }

    /**
     * The number of milliseconds to wait for an asynchronous
     * {@link Configuration#globalSetup} to complete.
     *
     * @name Configuration#globalSetupTimeout
     * @type Number | undefined
     * @default 5000
     */
    if (config.globalSetupTimeout) {
      this.globalSetupTimeout_ = config.globalSetupTimeout;
    }

    /**
     * A function that will be called exactly once, even in parallel mode,
     * after the test suite runs. This is intended to be used to clean up
     * out-of-process state such as shutting down an external service.
     *
     * If the globalTeardown function is async or otherwise returns a promise,
     * Jasmine will wait up to {@link Configuration#globalTeardownTimeout}
     * milliseconds for it to finish. Callbacks are not supported.
     *
     * globalTeardown may be run in a different process from the specs.
     * In-process side effects caused by specs, including changes to the Jasmine
     * environment, are not guaranteed to be visible to globalTeardown. Use
     * either afterEach or afterAll for in-process cleanup.
     *
     * @name Configuration#globalTeardown
     * @type Function | undefined
     */
    if (config.globalTeardown) {
      this.globalTeardown_ = config.globalTeardown;
    }

    /**
     * The number of milliseconds to wait for an asynchronous
     * {@link Configuration#globalTeardown} to complete.
     *
     * @name Configuration#globalTeardownTimeout
     * @type Number | undefined
     * @default 5000
     */
    if (config.globalTeardownTimeout) {
      this.globalTeardownTimeout_ = config.globalTeardownTimeout;
    }
  }

  /**
   * Adds a spec file to the list that will be loaded when the suite is executed.
   * @function
   * @name Runner#addSpecFile
   * @param {string} filePath The path to the file to be loaded.
   */
  addSpecFile(filePath) {
    this.specFiles.push(filePath);
  }

  /**
   * Adds a helper file to the list that will be loaded when the suite is executed.
   * @function
   * @name Runner#addHelperFile
   * @param {string} filePath The path to the file to be loaded.
   */
  addHelperFile(filePath) {
    this.helperFiles.push(filePath);
  }

  addRequires(requires) {
    const jasmineRunner = this;
    requires.forEach(function(r) {
      jasmineRunner.requires.push(r);
    });
  }

  /**
   * Configures the default reporter that is installed if no other reporter is
   * specified.
   * @name Runner#configureDefaultReporter
   * @function
   * @param {ConsoleReporterOptions} options
   */
  configureDefaultReporter(options) {
    options.print = options.print || function() {
      process.stdout.write(util.format.apply(this, arguments));
    };
    options.showColors = options.hasOwnProperty('showColors') ? options.showColors : true;

    this.reporter_.setOptions(options);
    this.defaultReporterConfigured = true;
  }

  async withinGlobalSetup_(fn) {
    let ok = false;

    await this.runGlobalSetup_();

    try {
      await fn();
      ok = true;
    } finally {
      if (ok) {
        await this.runGlobalTeardown_();
      } else {
        // Allow the error from fn (which executes the suite) to propagate.
        // It's probably more important than any error from global teardown.
        try {
          await this.runGlobalTeardown_();
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  async runGlobalSetup_() {
    if (this.globalSetup_) {
      await this.globalSetupOrTeardownRunner_.run(
        'globalSetup', this.globalSetup_, this.globalSetupTimeout_
      );
    }
  }

  async runGlobalTeardown_() {
    if (this.globalTeardown_) {
      await this.globalSetupOrTeardownRunner_.run(
        'globalTeardown', this.globalTeardown_, this.globalTeardownTimeout_
      );
    }
  }

  async flushOutput() {
    // Ensure that all data has been written to stdout and stderr,
    // then exit with an appropriate status code. Otherwise, we
    // might exit before all previous writes have actually been
    // written when Jasmine is piped to another process that isn't
    // reading quickly enough.
    var streams = [process.stdout, process.stderr];
    var promises = streams.map(stream => {
      return new Promise(resolve => stream.write('', null, resolve));
    });
    return Promise.all(promises);
  }
}

/**
 * Adds files that match the specified patterns to the list of spec files.
 * @function
 * @name Runner#addMatchingSpecFiles
 * @param {Array<string>} patterns An array of spec file paths
 * or {@link https://github.com/isaacs/node-glob#glob-primer|globs} that match
 * spec files. Each path or glob will be evaluated relative to the spec directory.
 */
RunnerBase.prototype.addMatchingSpecFiles = addFiles('specFiles');
/**
 * Adds files that match the specified patterns to the list of helper files.
 * @function
 * @name Runner#addMatchingHelperFiles
 * @param {Array<string>} patterns An array of helper file paths
 * or {@link https://github.com/isaacs/node-glob#glob-primer|globs} that match
 * helper files. Each path or glob will be evaluated relative to the spec directory.
 */
RunnerBase.prototype.addMatchingHelperFiles = addFiles('helperFiles');


/**
 * Whether to cause the Node process to exit when the suite finishes executing.
 *
 * @name Runner#exitOnCompletion
 * @type {boolean}
 * @default true
 */
/**
 * Add a custom reporter to the Jasmine environment.
 * @function
 * @name Runner#addReporter
 * @param {Reporter} reporter The reporter to add
 * @see custom_reporter
 */
/**
 * Clears all registered reporters.
 * @function
 * @name Runner#clearReporters
 */


function addFiles(kind) {
  return function (files) {
    const fileArr = this[kind];

    const {includeFiles, excludeFiles} = files.reduce((ongoing, file) => {
      const hasNegation = file.startsWith('!');

      if (hasNegation) {
        file = file.substring(1);
      }

      return {
        includeFiles: ongoing.includeFiles.concat(!hasNegation ? [file] : []),
        excludeFiles: ongoing.excludeFiles.concat(hasNegation ? [file] : [])
      };
    }, { includeFiles: [], excludeFiles: [] });

    const baseDir = `${this.projectBaseDir}/${this.specDir}`;

    includeFiles.forEach(function(file) {
      const filePaths = glob
        .sync(file, { cwd: baseDir, ignore: excludeFiles })
        .map(function(f) {
          if (path.isAbsolute(f)) {
            return f;
          } else {
            return unWindows(path.join(baseDir, f));
          }
        })
        .filter(function(filePath) {
          return fileArr.indexOf(filePath) === -1;
        })
        // Sort file paths consistently. Glob <9 did this but Glob >= 9 doesn't.
        // Jasmine doesn't care about the order, but users might.
        .sort();

      filePaths.forEach(function(filePath) {
        fileArr.push(filePath);
      });
    });

    if (this.isVerbose_) {
      console.log(`File glob for ${kind}: ${files}`);
      console.log(`Resulting ${kind}: [${fileArr}]`);
    }
  };
}

RunnerBase.exitCodeForStatus = function(status) {
  switch (status) {
    case 'passed':
      return 0;
    case 'incomplete':
      return 2;
    case 'failed':
      return 3;
    default:
      console.error(`Unrecognized overall status: ${status}`);
      return 1;
  }
};

module.exports = RunnerBase;
