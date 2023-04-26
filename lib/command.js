const path = require('path');
const fs = require('fs');
const os = require('os');
const unWindows = require('./unWindows');

exports = module.exports = Command;

const subCommands = {
  init: {
    description: 'initialize jasmine',
    action: initJasmine
  },
  examples: {
    description: 'install examples',
    action: installExamples
  },
  help: {
    description: 'show help',
    action: help,
    alias: '-h'
  },
  version: {
    description: 'show jasmine and jasmine-core versions',
    action: version,
    alias: '-v'
  }
};

function Command(projectBaseDir, examplesDir, deps) {
  const {print, platform, Jasmine, ParallelRunner} = deps;
  const isWindows = platform() === 'win32';

  this.projectBaseDir = isWindows ? unWindows(projectBaseDir) : projectBaseDir;
  this.specDir = `${this.projectBaseDir}/spec`;

  const command = this;

  this.run = async function(args) {
    setEnvironmentVariables(args);

    let commandToRun;
    Object.keys(subCommands).forEach(function(cmd) {
      const commandObject = subCommands[cmd];
        if (args.indexOf(cmd) >= 0) {
        commandToRun = commandObject;
      } else if (commandObject.alias && args.indexOf(commandObject.alias) >= 0) {
        commandToRun = commandObject;
      }
    });

    if (commandToRun) {
      commandToRun.action({
        Jasmine,
        projectBaseDir,
        specDir: command.specDir,
        examplesDir: examplesDir,
        print
      });
    } else {
      const options = parseOptions(args, isWindows);
      if (options.usageErrors.length > 0) {
        process.exitCode = 1;

        for (const e of options.usageErrors) {
          print(e);
        }

        print('');
        help({print: print});
      } else {
        await runJasmine(Jasmine, ParallelRunner, projectBaseDir, options);
      }
    }
  };
}

function isFileArg(arg) {
  return arg.indexOf('--') !== 0 && !isEnvironmentVariable(arg);
}

function parseOptions(argv, isWindows) {
  let files = [],
      helpers = [],
      requires = [],
      unknownOptions = [],
      usageErrors = [],
      color = process.stdout.isTTY || false,
      reporter,
      configPath,
      filter,
      failFast,
      random,
      seed,
      numWorkers = 1;

  for (const arg of argv) {
    if (arg === '--no-color') {
      color = false;
    } else if (arg === '--color') {
      color = true;
    } else if (arg.match("^--filter=")) {
      filter = arg.match("^--filter=(.*)")[1];
    } else if (arg.match("^--helper=")) {
      helpers.push(arg.match("^--helper=(.*)")[1]);
    } else if (arg.match("^--require=")) {
      requires.push(arg.match("^--require=(.*)")[1]);
    } else if (arg === '--fail-fast') {
      failFast = true;
    } else if (arg.match("^--random=")) {
      random = arg.match("^--random=(.*)")[1] === 'true';
    } else if (arg.match("^--seed=")) {
      seed = arg.match("^--seed=(.*)")[1];
    } else if (arg.match("^--config=")) {
      configPath = arg.match("^--config=(.*)")[1];
    } else if (arg.match("^--reporter=")) {
      reporter = arg.match("^--reporter=(.*)")[1];
    } else if (arg.match("^--parallel=(.*)")) {
      const w = arg.match("^--parallel=(.*)")[1];
      if (w === 'auto') {
        // A reasonable default in most situations
        numWorkers = os.cpus().length -1;
      } else {
        numWorkers = parseFloat(w);
        if (isNaN(numWorkers) || numWorkers < 2 || numWorkers !== Math.floor(numWorkers)) {
          usageErrors.push('Argument to --parallel= must be an integer greater than 1');
        }
      }
    } else if (arg === '--') {
      break;
    } else if (isFileArg(arg)) {
      files.push(isWindows ? unWindows(arg) : arg);
    } else if (!isEnvironmentVariable(arg)) {
      unknownOptions.push(arg);
    }
  }

  if (unknownOptions.length > 0) {
    usageErrors.push('Unknown options: ' + unknownOptions.join(', '));
  }

  return {
    color,
    configPath,
    filter,
    failFast,
    helpers,
    requires,
    reporter,
    files,
    random,
    seed,
    numWorkers,
    usageErrors
  };
}

async function runJasmine(Jasmine, ParallelRunner, projectBaseDir, options) {
  let runner;

  if (options.numWorkers > 1) {
    runner = new ParallelRunner({
      projectBaseDir,
      numWorkers: options.numWorkers
    });
  } else {
    runner = new Jasmine({
      projectBaseDir
    });
  }

  await runner.loadConfigFile(options.configPath || process.env.JASMINE_CONFIG_PATH);

  if (options.failFast !== undefined) {
    runner.configureEnv({
      stopSpecOnExpectationFailure: options.failFast,
      stopOnSpecFailure: options.failFast
    });
  }

  if (options.seed !== undefined) {
    runner.seed(options.seed);
  }

  if (options.random !== undefined) {
    runner.randomizeTests(options.random);
  }

  if (options.helpers !== undefined && options.helpers.length) {
    runner.addMatchingHelperFiles(options.helpers);
  }

  if (options.requires !== undefined && options.requires.length) {
    runner.addRequires(options.requires);
  }

  if (options.reporter !== undefined) {
    await registerReporter(options.reporter, runner);
  }

  runner.showColors(options.color);

  try {
    await runner.execute(options.files, options.filter);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

async function registerReporter(reporterModuleName, runner) {
  let Reporter;

  try {
    Reporter = await runner.loader.load(resolveReporter(reporterModuleName));
  } catch (e) {
    throw new Error('Failed to load reporter module '+ reporterModuleName +
      '\nUnderlying error: ' + e.stack + '\n(end underlying error)');
  }

  let reporter;

  try {
    reporter = new Reporter();
  } catch (e) {
    throw new Error('Failed to instantiate reporter from '+ reporterModuleName +
      '\nUnderlying error: ' + e.stack + '\n(end underlying error)');

  }
  runner.clearReporters();
  runner.addReporter(reporter);
}

function resolveReporter(nameOrPath) {
  if (nameOrPath.startsWith('./') || nameOrPath.startsWith('../')) {
    return path.resolve(nameOrPath);
  } else {
    return nameOrPath;
  }
}

function initJasmine(options) {
  const print = options.print;
  const specDir = options.specDir;
  makeDirStructure(path.join(specDir, 'support/'));
  if(!fs.existsSync(path.join(specDir, 'support/jasmine.json'))) {
    fs.writeFileSync(path.join(specDir, 'support/jasmine.json'), fs.readFileSync(path.join(__dirname, '../lib/examples/jasmine.json'), 'utf-8'));
  }
  else {
    print('spec/support/jasmine.json already exists in your project.');
  }
}

function installExamples(options) {
  const specDir = options.specDir;
  const projectBaseDir = options.projectBaseDir;
  const examplesDir = options.examplesDir;

  makeDirStructure(path.join(specDir, 'support'));
  makeDirStructure(path.join(specDir, 'jasmine_examples'));
  makeDirStructure(path.join(specDir, 'helpers', 'jasmine_examples'));
  makeDirStructure(path.join(projectBaseDir, 'lib', 'jasmine_examples'));

  copyFiles(
    path.join(examplesDir, 'spec', 'helpers', 'jasmine_examples'),
    path.join(specDir, 'helpers', 'jasmine_examples'),
    new RegExp(/[Hh]elper\.js/)
  );

  copyFiles(
    path.join(examplesDir, 'lib', 'jasmine_examples'),
    path.join(projectBaseDir, 'lib', 'jasmine_examples'),
    new RegExp(/\.js/)
  );

  copyFiles(
    path.join(examplesDir, 'spec', 'jasmine_examples'),
    path.join(specDir, 'jasmine_examples'),
    new RegExp(/[Ss]pec.js/)
  );
}

function help(options) {
  const print = options.print;
  print('Usage: jasmine [command] [options] [files] [--]');
  print('');
  print('Commands:');
  Object.keys(subCommands).forEach(function(cmd) {
    let commandNameText = cmd;
    if(subCommands[cmd].alias) {
      commandNameText = commandNameText + ',' + subCommands[cmd].alias;
    }
    print('%s\t%s', lPad(commandNameText, 10), subCommands[cmd].description);
  });
  print('');
  print('If no command is given, jasmine specs will be run');
  print('');
  print('');

  print('Options:');
  print('%s\tRun in parallel with N workers', lPad('--parallel=N', 18));
  print('%s\tRun in parallel with an automatically chosen number of workers', lPad('--parallel=auto', 18));
  print('%s\tturn off color in spec output', lPad('--no-color', 18));
  print('%s\tforce turn on color in spec output', lPad('--color', 18));
  print('%s\tfilter specs to run only those that match the given string', lPad('--filter=', 18));
  print('%s\tload helper files that match the given string', lPad('--helper=', 18));
  print('%s\tload module that match the given string', lPad('--require=', 18));
  print('%s\tstop Jasmine execution on spec failure', lPad('--fail-fast', 18));
  print('%s\tpath to your optional jasmine.json', lPad('--config=', 18));
  print('%s\tpath to reporter to use instead of the default Jasmine reporter', lPad('--reporter=', 18));
  print('%s\tmarker to signal the end of options meant for Jasmine', lPad('--', 18));
  print('');
  print('The given arguments take precedence over options in your jasmine.json');
  print('The path to your optional jasmine.json can also be configured by setting the JASMINE_CONFIG_PATH environment variable');
}

function version(options) {
  const print = options.print;
  print('jasmine v' + require('../package.json').version);
  const jasmine = new options.Jasmine();
  print('jasmine-core v' + jasmine.coreVersion());
}

function lPad(str, length) {
  if (str.length >= length) {
    return str;
  } else {
    return lPad(' ' + str, length);
  }
}

function copyFiles(srcDir, destDir, pattern) {
  const srcDirFiles = fs.readdirSync(srcDir);
  srcDirFiles.forEach(function(file) {
    if (file.search(pattern) !== -1) {
      fs.writeFileSync(path.join(destDir, file), fs.readFileSync(path.join(srcDir, file)));
    }
  });
}

function makeDirStructure(absolutePath) {
  const splitPath = absolutePath.split(path.sep);
  splitPath.forEach(function(dir, index) {
    if(index > 1) {
      const fullPath = path.join(splitPath.slice(0, index).join('/'), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath);
      }
    }
  });
}

function isEnvironmentVariable(arg) {
  if (arg.match(/^--/)) {
    return false;
  }

  return arg.match(/(.*)=(.*)/);
}

function setEnvironmentVariables(args) {
  args.forEach(function (arg) {
    const regExpMatch = isEnvironmentVariable(arg);
    if(regExpMatch) {
      const key = regExpMatch[1];
      const value = regExpMatch[2];
      process.env[key] = value;
    }
  });
}
