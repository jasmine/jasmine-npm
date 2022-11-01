const path = require('path');
const util = require('util');
const glob = require("glob");
const ConsoleReporter = require('./reporters/console_reporter');
const Loader = require("./loader");

/**
 * @interface Runner
 */
class RunnerBase {
  constructor(options) {
    this.loader = options.loader || new Loader();
    this.projectBaseDir = options.projectBaseDir || path.resolve();
    this.specFiles = [];
    this.helperFiles = [];
    this.requires = [];
    this.specDir = '';
    // TODO make obviously private
    this.reporter = new (options.ConsoleReporter || ConsoleReporter)();
    this.defaultReporterConfigured = false;
    this.showingColors = true;
    this.alwaysListPendingSpecs_ = true;
  }

  /**
   * Sets whether to show colors in the console reporter.
   * @function
   * @param {boolean} value Whether to show colors
   */
  showColors(value) {
    this.showingColors = value;
  }

  /**
   * Sets whether the console reporter should list pending specs even when there
   * are failures.
   * @param value {boolean}
   */
  alwaysListPendingSpecs(value) {
    this.alwaysListPendingSpecs_ = value;
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
      this.addRequires_(config.requires);
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
  }

  /**
   * Adds a spec file to the list that will be loaded when the suite is executed.
   * @function
   * @param {string} filePath The path to the file to be loaded.
   */
  addSpecFile(filePath) {
    this.specFiles.push(filePath);
  }

  /**
   * Adds a helper file to the list that will be loaded when the suite is executed.
   * @function
   * @param {string} filePath The path to the file to be loaded.
   */
  addHelperFile(filePath) {
    this.helperFiles.push(filePath);
  }

  addRequires_(requires) {
    const jasmineRunner = this;
    requires.forEach(function(r) {
      jasmineRunner.requires.push(r);
    });
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

function addFiles(kind) {
  return function (files) {
    const fileArr = this[kind];

    const {includeFiles, excludeFiles} = files.reduce((ongoing, file) => {
      const hasNegation = file.startsWith('!');

      if (hasNegation) {
        file = file.substring(1);
      }

      if (!path.isAbsolute(file)) {
        file = path.join(this.projectBaseDir, this.specDir, file);
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
