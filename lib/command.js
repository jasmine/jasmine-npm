const path = require('path');
const fs = require('fs');

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

function Command(projectBaseDir, examplesDir, print) {
  this.projectBaseDir = projectBaseDir;
  this.specDir = path.join(projectBaseDir, 'spec');

  const command = this;

  this.run = async function(jasmine, commands) {
    setEnvironmentVariables(commands);

    let commandToRun;
    Object.keys(subCommands).forEach(function(cmd) {
      const commandObject = subCommands[cmd];
        if (commands.indexOf(cmd) >= 0) {
        commandToRun = commandObject;
      } else if(commandObject.alias && commands.indexOf(commandObject.alias) >= 0) {
        commandToRun = commandObject;
      }
    });

    if (commandToRun) {
      commandToRun.action({jasmine: jasmine, projectBaseDir: command.projectBaseDir, specDir: command.specDir, examplesDir: examplesDir, print: print});
    } else {
      const env = parseOptions(commands);
      if (env.unknownOptions.length > 0) {
        process.exitCode = 1;
        print('Unknown options: ' + env.unknownOptions.join(', '));
        print('');
        help({print: print});
      } else {
        await runJasmine(jasmine, env, print);
      }
    }
  };
}

function isFileArg(arg) {
  return arg.indexOf('--') !== 0 && !isEnvironmentVariable(arg);
}

function parseOptions(argv) {
  let files = [],
      helpers = [],
      requires = [],
      unknownOptions = [],
      color = process.stdout.isTTY || false,
      reporter,
      configPath,
      filter,
      failFast,
      random,
      seed;

  for (let i in argv) {
    const arg = argv[i];
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
    } else if (arg === '--') {
      break;
    } else if (isFileArg(arg)) {
      files.push(arg);
    } else if (!isEnvironmentVariable(arg)) {
      unknownOptions.push(arg);
    }
  }
  return {
    color: color,
    configPath: configPath,
    filter: filter,
    failFast: failFast,
    helpers: helpers,
    requires: requires,
    reporter: reporter,
    files: files,
    random: random,
    seed: seed,
    unknownOptions: unknownOptions
  };
}

async function runJasmine(jasmine, env, print) {
  await jasmine.loadConfigFile(env.configPath || process.env.JASMINE_CONFIG_PATH);

  if (env.failFast !== undefined) {
    jasmine.env.configure({
      stopSpecOnExpectationFailure: env.failFast,
      stopOnSpecFailure: env.failFast
    });
  }

  if (env.seed !== undefined) {
    jasmine.seed(env.seed);
  }

  if (env.random !== undefined) {
    jasmine.randomizeTests(env.random);
  }

  if (env.helpers !== undefined && env.helpers.length) {
    jasmine.addMatchingHelperFiles(env.helpers);
  }

  if (env.requires !== undefined && env.requires.length) {
    jasmine.addRequires(env.requires);
  }

  if (env.reporter !== undefined) {
    await registerReporter(env.reporter, jasmine);
  }

  jasmine.showColors(env.color);

  try {
    await jasmine.execute(env.files, env.filter);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

async function registerReporter(reporterModuleName, jasmine) {
  let Reporter;

  try {
    Reporter = await jasmine.loader.load(resolveReporter(reporterModuleName));
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
  jasmine.clearReporters();
  jasmine.addReporter(reporter);
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
  print('jasmine-core v' + options.jasmine.coreVersion());
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

function isEnvironmentVariable(command) {
  const envRegExp = /(.*)=(.*)/;
  return command.match(envRegExp);
}

function setEnvironmentVariables(commands) {
  commands.forEach(function (command) {
    const regExpMatch = isEnvironmentVariable(command);
    if(regExpMatch) {
      const key = regExpMatch[1];
      const value = regExpMatch[2];
      process.env[key] = value;
    }
  });
}
