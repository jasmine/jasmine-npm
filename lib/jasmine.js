const ExitHandler = require('./exit_handler');
const regexSpecFilter = require('./filters/regex_spec_filter');
const pathSpecFilter = require('./filters/path_spec_filter');
const RunnerBase = require('./runner_base');

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
 * @classdesc Configures, builds, and executes a Jasmine test suite.<br>See also {@link ParallelRunner} which provides equivalent functionality for parallel execution.
 * @param {(JasmineOptions | undefined)} options
 * @constructor
 * @name Jasmine
 * @extends Runner
 * @example
 * const Jasmine = require('jasmine');
 * const runner = new Jasmine();
 */
class Jasmine extends RunnerBase {
  constructor(options) {
    options = options || {};
    super(options);
    const jasmineCore = options.jasmineCore || require('jasmine-core');

    if (options.globals === false) {
      this.jasmine = jasmineCore.noGlobals().jasmine;
    } else {
      this.jasmine = jasmineCore.boot(true);
    }

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
    this.addReporter(this.reporter_);

    /**
     * @function
     * @name Jasmine#coreVersion
     * @return {string} The version of jasmine-core in use
     */
    this.coreVersion = function() {
      return jasmineCore.version();
    };

    // Public. See RunnerBase.
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

  // Public. See RunnerBase jsdocs.
  addReporter(reporter) {
    this.env.addReporter(reporter);
    this.reportersCount++;
  }

  // Public. See RunnerBase jsdocs.
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

  configureEnv(envConfig) {
    this.env.configure(envConfig);
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

  /**
   * Runs the test suite.
   *
   * _Note_: Set {@link Jasmine#exitOnCompletion|exitOnCompletion} to false if you
   * intend to use the returned promise. Otherwise, the Node process will
   * ordinarily exit before the promise is settled.
   * @param {Array.<string>} [files] Spec files to run instead of the previously
   * configured set
   * @param {string|RegExp|object} [filter] Optional specification of what specs to run.
   * Can be a RegExp, a string, or an object. If it's a RegExp, it will be matched
   * against the full names of specs. If it's a string, it will be converted to
   * a RegExp and then handled in the same way. If it's
   * an object, it should have a path property whose value is an array of spec
   * or suite descriptions.
   * Regex used to filter specs. If specified, only
   * specs with matching full names will be run.
   * @return {Promise<JasmineDoneInfo>} Promise that is resolved when the suite completes.
   * @example
   * // Run all specs
   * await jasmine.execute();
   *
   * // Run just spec/someSpec.js
   * await jasmine.execute(['spec/someSpec.js']);
   *
   * // Run all specs with full paths starting with "a suite a child suite"
   * await jasmine.execute(null, '^a suite a child suite');
   *
   * // Run all specs that are inside a suite named "a child suite" that is
   * // a child of a top-level suite named "a suite"
   * await jasmine.execute(null, {path: ['a suite', 'a child suite']});
   */
  async execute(files, filter) {
    await this.loadRequires();
    await this.loadHelpers();
    if (!this.defaultReporterConfigured) {
      this.configureDefaultReporter({
        showColors: this.showingColors,
        alwaysListPendingSpecs: this.alwaysListPendingSpecs_
      });
    }

    if (filter) {
      if (typeof filter === 'string' || filter instanceof RegExp) {
        this.env.configure({
          specFilter: regexSpecFilter(filter)
        });
      } else if (filter.path) {
        this.env.configure({
          specFilter: pathSpecFilter(filter.path)
        });
      } else {
        throw new Error('Unrecognized filter type');
      }
    }

    if (files && files.length > 0) {
      if (this.isVerbose_) {
        console.log('Overriding previous specDir and specFiles because a list of spec files was provided on the command line or as an argument to Jasmine#execute');
      }

      this.specDir = '';
      this.specFiles = [];
      this.addMatchingSpecFiles(files);
    }

    const prematureExitHandler = new ExitHandler(() => this.exit(4));
    prematureExitHandler.install();
    let overallResult;

    try {
      await this.withinGlobalSetup_(async () => {
        await this.loadSpecs();
        overallResult = await this.env.execute();
      });
    } finally {
      await this.flushOutput();
      prematureExitHandler.uninstall();
    }

    if (this.exitOnCompletion) {
      this.exit(RunnerBase.exitCodeForStatus(overallResult.overallStatus));
    }

    return overallResult;
  }

  /**
   * Returns a tree of suites and specs without actually running the specs.
   * @return {Promise<EnumeratedSuiteOrSpec[]>}
   */
  async enumerate() {
    await this.loadRequires();
    await this.loadHelpers();
    await this.loadSpecs();

    return this.env.topSuite().children.map(toEnumerateResult);
  }
}

function toEnumerateResult(suiteOrSpecMeta) {
  // Omit parent links to avoid JSON serialization failure due to circular
  // references. Omit IDs since they aren't stable across executions. Add
  // type information to make interpreting the output easier.

  /**
   * @interface EnumeratedSuiteOrSpec
   * @property {string} type - 'suite' or 'spec'
   * @property {EnumeratedSuiteOrSpec[]} [children] - Only defined for suites
   */
  const result = {
    description: suiteOrSpecMeta.description
  };

  if (suiteOrSpecMeta.children === undefined) {
    result.type = 'spec';
  } else {
    result.type = 'suite';
    result.children = suiteOrSpecMeta.children.map(toEnumerateResult);
  }

  return result;
}

module.exports = Jasmine;
module.exports.ConsoleReporter = require('./reporters/console_reporter');
