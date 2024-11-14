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
  const {print, platform, terminalColumns, Jasmine, ParallelRunner} = deps;
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
        print,
        terminalColumns
      });
    } else {
      const options = parseOptions(args, isWindows);
      if (options.usageErrors.length > 0) {
        process.exitCode = 1;

        for (const e of options.usageErrors) {
          print(e);
        }

        print('');
        help({print, terminalColumns});
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
  let files = [];
  let helpers = [];
  let requires = [];
  let unknownOptions = [];
  let usageErrors = [];
  let color = process.stdout.isTTY || false;
  let reporter;
  let configPath;
  let filter;
  let failFast;
  let random;
  let seed;
  let numWorkers = 1;
  let verbose = false;

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
    } else if (arg === '--verbose') {
      verbose = true;
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
    verbose,
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

  runner.verbose(options.verbose);
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
  const destDir = path.join(options.specDir, 'support/');
  makeDirStructure(destDir);
  const destPath = path.join(destDir, 'jasmine.mjs');

  if (fs.existsSync(destPath)) {
    print('spec/support/jasmine.mjs already exists in your project.');
  } else {
    const contents = fs.readFileSync(
      path.join(__dirname, '../lib/examples/jasmine.mjs'), 'utf-8');
    fs.writeFileSync(destPath, contents);
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

function help(deps) {
  const print = deps.print;
  let terminalColumns = deps.terminalColumns || 80;

  print(wrap(terminalColumns, 'Usage: jasmine [command] [options] [files] [--]'));
  print('');
  print('Commands:');
  Object.keys(subCommands).forEach(function(cmd) {
    let commandNameText = cmd;
    if(subCommands[cmd].alias) {
      commandNameText = commandNameText + ',' + subCommands[cmd].alias;
    }
    print(wrapWithIndent(terminalColumns, lPad(commandNameText, 10) + '    ', subCommands[cmd].description));
  });
  print('');
  print(wrap(terminalColumns, 'If no command is given, Jasmine specs will be run.'));
  print('');
  print('');

  print('Options:');

  const options = [
    { syntax: '--parallel=N', help: 'Run in parallel with N workers' },
    { syntax: '--parallel=auto', help: 'Run in parallel with an automatically chosen number of workers' },
    { syntax: '--no-color', help: 'turn off color in spec output' },
    { syntax: '--color', help: 'force turn on color in spec output' },
    { syntax: '--filter=', help: 'filter specs to run only those that match the given string' },
    { syntax: '--helper=', help: 'load helper files that match the given string' },
    { syntax: '--require=', help: 'load module that matches the given string' },
    { syntax: '--fail-fast', help: 'stop Jasmine execution on spec failure' },
    { syntax: '--config=', help: 'path to the Jasmine configuration file' },
    { syntax: '--reporter=', help: 'path to reporter to use instead of the default Jasmine reporter' },
    { syntax: '--verbose', help: 'print information that may be useful for debugging configuration' },
    { syntax: '--', help: 'marker to signal the end of options meant for Jasmine' },
  ];

  for (const o of options) {
    print(wrapWithIndent(terminalColumns, lPad(o.syntax, 18) + '    ', o.help));
  }

  print('');
  print(wrap(terminalColumns,
    'The given arguments take precedence over options in your jasmine.json.'));
  print(wrap(terminalColumns,
    'The path to your optional jasmine.json can also be configured by setting the JASMINE_CONFIG_PATH environment variable.'));
}

function wrapWithIndent(cols, prefix, suffix) {
  const lines = wrap2(cols - prefix.length, suffix);
  const indent = lPad('', prefix.length);
  return prefix + lines.join('\n' + indent);
}

function wrap(cols, input) {
  return wrap2(cols, input).join('\n');
}

function wrap2(cols, input) {
  let lines = [];
  let start = 0;

  while (start < input.length) {
    const splitAt = indexOfLastSpaceInRange(start, start + cols, input);

    if (splitAt === -1 || input.length - start <= cols) {
      lines.push(input.substring(start));
      break;
    } else {
      lines.push(input.substring(start, splitAt));
      start = splitAt + 1;
    }
  }

  return lines;
}

function indexOfLastSpaceInRange(start, end, s) {
  for (let i = end; i >= start; i--) {
    if (s[i] === ' ') {
      return i;
    }
  }

  return -1;
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
