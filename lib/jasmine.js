const path = require('path');
const util = require('util');
const glob = require('glob');
const Loader = require('./loader');
const CompletionReporter = require('./reporters/completion_reporter');
const ConsoleSpecFilter = require('./filters/console_spec_filter');

module.exports = Jasmine;
module.exports.ConsoleReporter = require('./reporters/console_reporter');

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
 * @classdesc Configures, builds, and executes a Jasmine test suite
 * @param {(JasmineOptions | undefined)} options
 * @constructor
 * @name Jasmine
 * @example
 * const Jasmine = require('jasmine');
 * const jasmine = new Jasmine();
 */
function Jasmine(options) {
  options = options || {};
  this.loader = options.loader || new Loader();
  const jasmineCore = options.jasmineCore || require('jasmine-core');
  this.jasmineCorePath = path.join(jasmineCore.files.path, 'jasmine.js');
  this.jasmine = jasmineCore.boot(jasmineCore);
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
  this.completionReporter = new CompletionReporter();
  this.onCompleteCallbackAdded = false;
  this.exit = process.exit;
  this.showingColors = true;
  this.reporter = new module.exports.ConsoleReporter();
  this.addReporter(this.reporter);
  this.defaultReporterConfigured = false;

  const jasmineRunner = this;
  this.completionReporter.onComplete(function(passed) {
    jasmineRunner.exitCodeCompletion(passed);
  });
  this.checkExit = checkExit(this);

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
   * _Note_: If {@link Jasmine#onComplete|onComplete} is called, Jasmine will not
   * exit when the suite completes even if exitOnCompletion is set to true.
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
Jasmine.prototype.randomizeTests = function(value) {
  this.env.configure({random: value});
};

/**
 * Sets the random seed.
 * @function
 * @name Jasmine#seed
 * @param {number} seed The random seed
 */
Jasmine.prototype.seed = function(value) {
  this.env.configure({seed: value});
};

/**
 * Sets whether to show colors in the console reporter.
 * @function
 * @name Jasmine#showColors
 * @param {boolean} value Whether to show colors
 */
Jasmine.prototype.showColors = function(value) {
  this.showingColors = value;
};

/**
 * Adds a spec file to the list that will be loaded when the suite is executed.
 * @function
 * @name Jasmine#addSpecFile
 * @param {string} filePath The path to the file to be loaded.
 */
Jasmine.prototype.addSpecFile = function(filePath) {
  this.specFiles.push(filePath);
};

/**
 * Adds a helper file to the list that will be loaded when the suite is executed.
 * @function
 * @name Jasmine#addHelperFile
 * @param {string} filePath The path to the file to be loaded.
 */
Jasmine.prototype.addHelperFile = function(filePath) {
  this.helperFiles.push(filePath);
};

/**
 * Add a custom reporter to the Jasmine environment.
 * @function
 * @name Jasmine#addReporter
 * @param {Reporter} reporter The reporter to add
 * @see custom_reporter
 */
Jasmine.prototype.addReporter = function(reporter) {
  this.env.addReporter(reporter);
  this.reportersCount++;
};

/**
 * Clears all registered reporters.
 * @function
 * @name Jasmine#clearReporters
 */
Jasmine.prototype.clearReporters = function() {
  this.env.clearReporters();
  this.reportersCount = 0;
};

/**
 * Provide a fallback reporter if no other reporters have been specified.
 * @function
 * @name Jasmine#provideFallbackReporter
 * @param reporter The fallback reporter
 * @see custom_reporter
 */
Jasmine.prototype.provideFallbackReporter = function(reporter) {
  this.env.provideFallbackReporter(reporter);
};

/**
 * Configures the default reporter that is installed if no other reporter is
 * specified.
 * @param {ConsoleReporterOptions} options
 */
Jasmine.prototype.configureDefaultReporter = function(options) {
  options.print = options.print || function() {
    process.stdout.write(util.format.apply(this, arguments));
  };
  options.showColors = options.hasOwnProperty('showColors') ? options.showColors : true;
  options.jasmineCorePath = options.jasmineCorePath || this.jasmineCorePath;

  this.reporter.setOptions(options);
  this.defaultReporterConfigured = true;
};

/**
 * Add custom matchers for the current scope of specs.
 *
 * _Note:_ This is only callable from within a {@link beforeEach}, {@link it}, or {@link beforeAll}.
 * @function
 * @name Jasmine#addMatchers
 * @param {Object} matchers - Keys from this object will be the new matcher names.
 * @see custom_matcher
 */
Jasmine.prototype.addMatchers = function(matchers) {
  this.env.addMatchers(matchers);
};

Jasmine.prototype.loadSpecs = async function() {
  await this._loadFiles(this.specFiles);
};

Jasmine.prototype.loadHelpers = async function() {
  await this._loadFiles(this.helperFiles);
};

Jasmine.prototype._loadFiles = async function(files) {
  for (const file of files) {
    await this.loader.load(file, this._alwaysImport || false);
  }

};

Jasmine.prototype.loadRequires = function() {
  // TODO: In 4.0, switch to calling _loadFiles
  // (requires making this function async)
  this.requires.forEach(function(r) {
    require(r);
  });
};

/**
 * Loads configuration from the specified file. The file can be a JSON file or
 * any JS file that's loadable via require and provides a Jasmine config
 * as its default export.
 * @param {string} [configFilePath=spec/support/jasmine.json]
 */
Jasmine.prototype.loadConfigFile = function(configFilePath) {
  try {
    const absoluteConfigFilePath = path.resolve(this.projectBaseDir, configFilePath || 'spec/support/jasmine.json');
    const config = require(absoluteConfigFilePath);
    this.loadConfig(config);
  } catch (e) {
    if(configFilePath || e.code != 'MODULE_NOT_FOUND') { throw e; }
  }
};

/**
 * Loads configuration from the specified object.
 * @param {Configuration} config
 */
Jasmine.prototype.loadConfig = function(config) {
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
   * Whether to run specs in a random order.
   * @name Configuration#random
   * @type boolean | undefined
   * @default true
   */
  if (config.random !== undefined) {
    envConfig.random = config.random;
  }


  /**
   * Specifies how to load files with names ending in .js. Valid values are
   * "require" and "import". "import" should be safe in all cases, and is
   * required if your project contains ES modules with filenames ending in .js.
   * @name Configuration#jsLoader
   * @type string | undefined
   * @default "require"
   */
  if (config.jsLoader === 'import') {
    checkForJsFileImportSupport();
    this._alwaysImport = true;
  } else if (config.jsLoader === 'require' || config.jsLoader === undefined) {
    this._alwaysImport = false;
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
    this.addHelperFiles(config.helpers);
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
    this.addSpecFiles(config.spec_files);
  }
};

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


// Deprecated synonyms for the above. These are confusingly named (addSpecFiles
// doesn't just do N of what addSpecFile does) but they've been around a long
// time and there might be quite a bit of code that uses them.

/**
 * Synonym for {@link Jasmine#addMatchingSpecFiles}
 * @function
 * @name Jasmine#addSpecFiles
 * @deprecated Use {@link Jasmine#addMatchingSpecFiles|addMatchingSpecFiles},
 * {@link Jasmine#loadConfig|loadConfig}, or {@link Jasmine#loadConfigFile|loadConfigFile}
 * instead.
 */
Jasmine.prototype.addSpecFiles = Jasmine.prototype.addMatchingSpecFiles;
/**
 * Synonym for {@link Jasmine#addMatchingHelperFiles}
 * @name Jasmine#addHelperFiles
 * @function
 * @deprecated Use {@link Jasmine#addMatchingHelperFiles|addMatchingHelperFiles},
 * {@link Jasmine#loadConfig|loadConfig}, or {@link Jasmine#loadConfigFile|loadConfigFile}
 * instead.
 */
Jasmine.prototype.addHelperFiles = Jasmine.prototype.addMatchingHelperFiles;

Jasmine.prototype.addRequires = function(requires) {
  const jasmineRunner = this;
  requires.forEach(function(r) {
    jasmineRunner.requires.push(r);
  });
};

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

/**
 * Registers a callback that will be called when execution finishes.
 *
 * _Note_: Only one callback can be registered. The callback will be called
 * after the suite has completed and the results have been finalized, but not
 * necessarily before all of Jasmine's cleanup has finished. Calling this
 * function will also prevent Jasmine from exiting the Node process at the end
 * of suite execution.
 *
 * @deprecated Set {@link Jasmine#exitOnCompletion|exitOnCompletion} to false
 * and use the promise returned from {@link Jasmine#execute|execute} instead.
 * @param {function} onCompleteCallback
 */
Jasmine.prototype.onComplete = function(onCompleteCallback) {
  this.completionReporter.onComplete(onCompleteCallback);
};

/**
 * Sets whether to cause specs to only have one expectation failure.
 * @function
 * @name Jasmine#stopSpecOnExpectationFailure
 * @param {boolean} value Whether to cause specs to only have one expectation
 * failure
 */
Jasmine.prototype.stopSpecOnExpectationFailure = function(value) {
  this.env.configure({stopSpecOnExpectationFailure: value});
};

/**
 * Sets whether to stop execution of the suite after the first spec failure.
 * @function
 * @name Jasmine#stopOnSpecFailure
 * @param {boolean} value Whether to stop execution of the suite after the
 * first spec failure
 */
Jasmine.prototype.stopOnSpecFailure = function(value) {
  this.env.configure({stopOnSpecFailure: value});
};

Jasmine.prototype.exitCodeCompletion = function(passed) {
  // Ensure that all data has been written to stdout and stderr,
  // then exit with an appropriate status code. Otherwise, we
  // might exit before all previous writes have actually been
  // written when Jasmine is piped to another process that isn't
  // reading quickly enough.
  const jasmineRunner = this;
  const streams = [process.stdout, process.stderr];
  let writesToWait = streams.length;
  streams.forEach(function(stream) {
    stream.write('', null, exitIfAllStreamsCompleted);
  });
  function exitIfAllStreamsCompleted() {
    writesToWait--;
    if (writesToWait === 0 && jasmineRunner.exitOnCompletion) {
      if(passed) {
        jasmineRunner.exit(0);
      }
      else {
        jasmineRunner.exit(1);
      }
    }
  }
};

const checkExit = function(jasmineRunner) {
  return function() {
    if (!jasmineRunner.completionReporter.isComplete()) {
      process.exitCode = 4;
    }
  };
};

function checkForJsFileImportSupport() {
  const v = process.versions.node
    .split('.')
    .map(el => parseInt(el, 10));

  if (v[0] < 12 || (v[0] === 12 && v[1] < 17)) {
    console.warn('Warning: jsLoader: "import" may not work reliably on Node ' +
      'versions before 12.17.');
  }
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
Jasmine.prototype.execute = async function(files, filterString) {
  this.completionReporter.exitHandler = this.checkExit;

  this.loadRequires();
  await this.loadHelpers();
  if (!this.defaultReporterConfigured) {
    this.configureDefaultReporter({ showColors: this.showingColors });
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
    this.addSpecFiles(files);
  }

  await this.loadSpecs();

  if (!this.completionReporterInstalled_) {
    this.addReporter(this.completionReporter);
    this.completionReporterInstalled_ = true;
  }
  
  let overallResult;
  this.addReporter({
    jasmineDone: r => overallResult = r
  });
  await new Promise(resolve => {
    this.env.execute(null, resolve);
  });
  return overallResult;
};
