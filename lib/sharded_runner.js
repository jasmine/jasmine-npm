const fs = require('fs');
const path = require('path');
const glob = require('glob');

class ShardedRunner {
  constructor(options) {
    this.jasmineCore = options.jasmineCore;
    this.shardIndex = options.shardIndex;
    this.shardCount = options.shardCount;
    this.exitOnCompletion = true;

    this.specFiles = [];
    this.helperFiles = [];
    this.requireFiles = [];
    this.projectBaseDir = process.cwd();
    this.specDir = 'spec';
    this.jasmineConfig = {};
  }

  async loadConfigFile(configPath) {
    const fullPath = path.resolve(this.projectBaseDir, configPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Config file not found: ${fullPath}`);
    }

    let config;
    try {
      config = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (e) {
      throw new Error(`Failed to parse config file ${fullPath}: ${e.message}`);
    }

    this.specDir = config.spec_dir || this.specDir;

    // Load spec files using the same pattern as Jasmine's addMatchingSpecFiles
    if (config.spec_files) {
      const allSpecFiles = this.addMatchingFiles(config.spec_files);
      this.specFiles = this.filterFilesToShard(allSpecFiles);
    }

    // Load helper files
    if (config.helpers) {
      this.helperFiles = this.addMatchingFiles(config.helpers);
    }

    this.requireFiles = config.requires || [];

    this.jasmineConfig = {
      random: config.random,
      seed: config.seed,
      stopOnSpecFailure: config.stopOnSpecFailure,
      failSpecWithNoExpectations: config.failSpecWithNoExpectations,
      stopSpecOnExpectationFailure: config.stopSpecOnExpectationFailure
    };
  }

  addMatchingFiles(patterns) {
    const files = [];

    // Separate include and exclude patterns
    const {includeFiles, excludeFiles} = patterns.reduce((ongoing, file) => {
      const hasNegation = file.startsWith('!');

      if (hasNegation) {
        file = file.substring(1);
      }

      return {
        includeFiles: ongoing.includeFiles.concat(!hasNegation ? [file] : []),
        excludeFiles: ongoing.excludeFiles.concat(hasNegation ? [file] : [])
      };
    }, { includeFiles: [], excludeFiles: [] });

    const baseDir = path.resolve(this.projectBaseDir, this.specDir);

    includeFiles.forEach(file => {
      const filePaths = glob
        .sync(file, { cwd: baseDir, ignore: excludeFiles })
        .map(f => {
          if (path.isAbsolute(f)) {
            return f;
          } else {
            return path.resolve(baseDir, f);
          }
        })
        .filter(filePath => {
          return files.indexOf(filePath) === -1;
        })
        .sort();

      filePaths.forEach(filePath => {
        files.push(filePath);
      });
    });

    return files;
  }

  filterFilesToShard(files) {
    if (!files || files.length === 0) return [];

    const sortedFiles = files.slice().sort();
    return sortedFiles.filter((file, index) =>
      index % this.shardCount === this.shardIndex
    );
  }

  async execute() {
    const jasmineInterface = this.jasmineCore.noGlobals();
    const env = jasmineInterface.jasmine.getEnv();

    // Set up globals needed by specs and helpers
    for (const key in jasmineInterface) {
      globalThis[key] = jasmineInterface[key];
    }

    env.configure(this.jasmineConfig);

    for (const requireFile of this.requireFiles) {
      require(requireFile);
    }

    for (const helperFile of this.helperFiles) {
      require(path.resolve(helperFile));
    }

    for (const specFile of this.specFiles) {
      require(path.resolve(specFile));
    }

    return new Promise((resolve) => {
      env.execute().then(result => {
        if (this.exitOnCompletion) {
          process.exit(result.overallStatus === 'passed' ? 0 : 1);
        }
        resolve(result);
      });
    });
  }
}

module.exports = ShardedRunner;
