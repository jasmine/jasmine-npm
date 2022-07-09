const path = require('path');
const util = require('util');
const glob = require('glob');
const Loader = require('./loader');
const ExitHandler = require('./exit_handler');
const ConsoleSpecFilter = require('./filters/console_spec_filter');

/**
 * Options for the {@link Jasmine} constructor
 * @name JasmineOptions
 * @interface
 */
/**
 * The path to the project's base directory. This can be absolute or relative
 * to the current working directory. If it isn't specified, the current working
 * directory will be used.
 * @name JasmineOptions#projectBaseDir
 * @type (string | undefined)
 */
/**
 * Whether to create the globals (describe, it, etc) that make up Jasmine's
 * spec-writing interface. If it is set to false, the spec-writing interface
 * can be accessed via jasmine-core's `noGlobals` method, e.g.:
 *
 * `const {describe, it, expect, jasmine} = require('jasmine-core').noGlobals();`
 *
 * @name JasmineOptions#globals
 * @type (boolean | undefined)
 * @default true
 */

/**
 * @classdesc Configures, builds, and executes a Jasmine test suite
 * @param {(JasmineOptions | undefined)} options
 * @constructor
 * @name Jasmine
 * @example
 * const Jasmine = require('jasmine');
 * const jasmine = new Jasmine();
 */
class Jasmine {
  constructor(options) {
    options = options || {};
    this.loader = options.loader || new Loader();
    const jasmineCore = options.jasmineCore || require('jasmine-core');

    if (options.globals === false) {
      this.jasmine = jasmineCore.noGlobals().jasmine;
    } else {
      this.jasmine = jasmineCore.boot(jasmineCore);
    }

    this.projectBaseDir = options.projectBaseDir || path.resolve();
    this.specDir = '';
    this.specFiles = [];
    this.helperFiles = [];
    this.requires = [];
    /**
     * The Jasmine environment.
     * @name Jasmine#env
     * @readonly
     * @see {@link https://jasmine.github.io/api/edge/Env.html|Env}
     * @type {Env}
     */
    this.env = this.jasmine.getEnv({suppressLoadErrors: true});
    this.reportersCount = 0;
    this.exit = process.exit;
    this.showingColors = true;
    this.alwaysListPendingSpecs_ = true;
    this.reporter = new module.exports.ConsoleReporter();
    this.addReporter(this.reporter);
    this.defaultReporterConfigured = false;

    /**
     * @function
     * @name Jasmine#coreVersion
     * @return {string} The version of jasmine-core in use
     */
    this.coreVersion = function() {
      return jasmineCore.version();
    };

    /**
     * Whether to cause the Node process to exit when the suite finishes executing.
     *
     * @name Jasmine#exitOnCompletion
     * @type {boolean}
     * @default true
     */
    this.exitOnCompletion = true;
  }

  /**
   * Sets whether to randomize the order of specs.
   * @function
   * @name Jasmine#randomizeTests
   * @param {boolean} value Whether to randomize
   */
  randomizeTests(value) {
    this.env.configure({random: value});
  }

  /**
   * Sets the random seed.
   * @function
   * @name Jasmine#seed
   * @param {number} seed The random seed
   */
  seed(value) {
    this.env.configure({seed: value});
  }

  /**
   * Sets whether to show colors in the console reporter.
   * @function
   * @name Jasmine#showColors
   * @param {boolean} value Whether to show colors
   */
  showColors(value) {
    this.showingColors = value;
  }

  /**
   * Sets whether the console reporter should list pending specs even when there
   * are failures.
   * @name Jasmine#alwaysListPendingSpecs
   * @param value {boolean}
   */
  alwaysListPendingSpecs(value) {
    this.alwaysListPendingSpecs_ = value;
  }

  /**
   * Adds a spec file to the list that will be loaded when the suite is executed.
   * @function
   * @name Jasmine#addSpecFile
   * @param {string} filePath The path to the file to be loaded.
   */
  addSpecFile(filePath) {
    this.specFiles.push(filePath);
  }

  /**
   * Adds a helper file to the list that will be loaded when the suite is executed.
   * @function
   * @name Jasmine#addHelperFile
   * @param {string} filePath The path to the file to be loaded.
   */
  addHelperFile(filePath) {
    this.helperFiles.push(filePath);
  }

  /**
   * Add a custom reporter to the Jasmine environment.
   * @function
   * @name Jasmine#addReporter
   * @param {Reporter} reporter The reporter to add
   * @see custom_reporter
   */
  addReporter(reporter) {
    this.env.addReporter(reporter);
    this.reportersCount++;
  }

  /**
   * Clears all registered reporters.
   * @function
   * @name Jasmine#clearReporters
   */
  clearReporters() {
    this.env.clearReporters();
    this.reportersCount = 0;
  }

  /**
   * Provide a fallback reporter if no other reporters have been specified.
   * @function
   * @name Jasmine#provideFallbackReporter
   * @param reporter The fallback reporter
   * @see custom_reporter
   */
  provideFallbackReporter(reporter) {
    this.env.provideFallbackReporter(reporter);
  }

  /**
   * Configures the default reporter that is installed if no other reporter is
   * specified.
   * @param {ConsoleReporterOptions} options
   */
  configureDefaultReporter(options) {
    options.print = options.print || function() {
      process.stdout.write(util.format.apply(this, arguments));
    };
    options.showColors = options.hasOwnProperty('showColors') ? options.showColors : true;

    this.reporter.setOptions(options);
    this.defaultReporterConfigured = true;
  }

  /**
   * Add custom matchers for the current scope of specs.
   *
   * _Note:_ This is only callable from within a {@link beforeEach}, {@link it}, or {@link beforeAll}.
   * @function
   * @name Jasmine#addMatchers
   * @param {Object} matchers - Keys from this object will be the new matcher names.
   * @see custom_matcher
   */
  addMatchers(matchers) {
    this.env.addMatchers(matchers);
  }

  async loadSpecs() {
    await this._loadFiles(this.specFiles);
  }

  async loadHelpers() {
    await this._loadFiles(this.helperFiles);
  }

  async _loadFiles(files) {
    for (const file of files) {
      await this.loader.load(file);
    }
  }

  async loadRequires() {
    await this._loadFiles(this.requires);
  }

  /**
   * Loads configuration from the specified file. The file can be a JSON file or
   * any JS file that's loadable via require and provides a Jasmine config
   * as its default export.
   * @param {string} [configFilePath=spec/support/jasmine.json]
   * @return Promise
   */
  async loadConfigFile(configFilePath) {
    if (configFilePath) {
      await this.loadSpecificConfigFile_(configFilePath);
    } else {
      for (const ext of ['json', 'js']) {
        try {
          await this.loadSpecificConfigFile_(`spec/support/jasmine.${ext}`);
        } catch (e) {
          if (e.code !== 'MODULE_NOT_FOUND' && e.code !== 'ERR_MODULE_NOT_FOUND') {
            throw e;
          }
        }
      }
    }
  }

  async loadSpecificConfigFile_(relativePath) {
    const absolutePath = path.resolve(this.projectBaseDir, relativePath);
    const config = await this.loader.load(absolutePath);
    this.loadConfig(config);
  }

  /**
   * Loads configuration from the specified object.
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
     * @default false
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
      this.env.configure(envConfig);
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
  }

  addRequires(requires) {
    const jasmineRunner = this;
    requires.forEach(function(r) {
      jasmineRunner.requires.push(r);
    });
  }

  /**
   * Sets whether to cause specs to only have one expectation failure.
   * @function
   * @name Jasmine#stopSpecOnExpectationFailure
   * @param {boolean} value Whether to cause specs to only have one expectation
   * failure
   */
  stopSpecOnExpectationFailure(value) {
    this.env.configure({stopSpecOnExpectationFailure: value});
  }

  /**
   * Sets whether to stop execution of the suite after the first spec failure.
   * @function
   * @name Jasmine#stopOnSpecFailure
   * @param {boolean} value Whether to stop execution of the suite after the
   * first spec failure
   */
  stopOnSpecFailure(value) {
    this.env.configure({stopOnSpecFailure: value});
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

  /**
   * Runs the test suite.
   *
   * _Note_: Set {@link Jasmine#exitOnCompletion|exitOnCompletion} to false if you
   * intend to use the returned promise. Otherwise, the Node process will
   * ordinarily exit before the promise is settled.
   * @param {Array.<string>} [files] Spec files to run instead of the previously
   * configured set
   * @param {string} [filterString] Regex used to filter specs. If specified, only
   * specs with matching full names will be run.
   * @return {Promise<JasmineDoneInfo>} Promise that is resolved when the suite completes.
   */
  async execute(files, filterString) {
    await this.loadRequires();
    await this.loadHelpers();
    if (!this.defaultReporterConfigured) {
      this.configureDefaultReporter({
        showColors: this.showingColors,
        alwaysListPendingSpecs: this.alwaysListPendingSpecs_
      });
    }

    if (filterString) {
      const specFilter = new ConsoleSpecFilter({
        filterString: filterString
      });
      this.env.configure({specFilter: function(spec) {
          return specFilter.matches(spec.getFullName());
        }});
    }

    if (files && files.length > 0) {
      this.specDir = '';
      this.specFiles = [];
      this.addMatchingSpecFiles(files);
    }

    await this.loadSpecs();

    const prematureExitHandler = new ExitHandler(() => this.exit(4));
    prematureExitHandler.install();
    const overallResult = await this.env.execute();
    await this.flushOutput();
    prematureExitHandler.uninstall();

    if (this.exitOnCompletion) {
      this.exit(exitCodeForStatus(overallResult.overallStatus));
    }

    return overallResult;
  }
}

/**
 * Adds files that match the specified patterns to the list of spec files.
 * @function
 * @name Jasmine#addMatchingSpecFiles
 * @param {Array<string>} patterns An array of spec file paths
 * or {@link https://github.com/isaacs/node-glob#glob-primer|globs} that match
 * spec files. Each path or glob will be evaluated relative to the spec directory.
 */
Jasmine.prototype.addMatchingSpecFiles = addFiles('specFiles');
/**
 * Adds files that match the specified patterns to the list of helper files.
 * @function
 * @name Jasmine#addMatchingHelperFiles
 * @param {Array<string>} patterns An array of helper file paths
 * or {@link https://github.com/isaacs/node-glob#glob-primer|globs} that match
 * helper files. Each path or glob will be evaluated relative to the spec directory.
 */
Jasmine.prototype.addMatchingHelperFiles = addFiles('helperFiles');

function addFiles(kind) {
  return function (files) {
    const jasmineRunner = this;
    const fileArr = this[kind];

    const {includeFiles, excludeFiles} = files.reduce(function(ongoing, file) {
      const hasNegation = file.startsWith('!');

      if (hasNegation) {
        file = file.substring(1);
      }

      if (!path.isAbsolute(file)) {
        file = path.join(jasmineRunner.projectBaseDir, jasmineRunner.specDir, file);
      }

      return {
        includeFiles: ongoing.includeFiles.concat(!hasNegation ? [file] : []),
        excludeFiles: ongoing.excludeFiles.concat(hasNegation ? [file] : [])
      };
    }, { includeFiles: [], excludeFiles: [] });

    includeFiles.forEach(function(file) {
      const filePaths = glob
        .sync(file, { ignore: excludeFiles })
        .filter(function(filePath) {
          // glob will always output '/' as a segment separator but the fileArr may use \ on windows
          // fileArr needs to be checked for both versions
          return fileArr.indexOf(filePath) === -1 && fileArr.indexOf(path.normalize(filePath)) === -1;
        });

      filePaths.forEach(function(filePath) {
        fileArr.push(filePath);
      });
    });
  };
}

function exitCodeForStatus(status) {
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
}

module.exports = Jasmine;
module.exports.ConsoleReporter = require('./reporters/console_reporter');
