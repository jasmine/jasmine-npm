var path = require('path'),
    fs = require('fs');

exports = module.exports = Command;

var subCommands = {
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
    action: help
  }
};

function Command(projectBaseDir, examplesDir) {
  this.projectBaseDir = projectBaseDir;
  this.specDir = path.join(projectBaseDir, 'spec');

  var command = this;

  this.run = function(jasmine, commands) {
    setEnvironmentVariables(commands);

    var commandToRun;
    Object.keys(subCommands).forEach(function(cmd) {
      if (commands.indexOf(cmd) >= 0) {
        commandToRun = subCommands[cmd];
      }
    });

    if (commandToRun) {
      commandToRun.action({projectBaseDir: command.projectBaseDir, specDir: command.specDir, examplesDir: examplesDir});
    } else {
      runJasmine(jasmine, parseOptions(commands));
    }
  };
}

function isFileArg(arg) {
  return arg.indexOf('--') !== 0 && !isEnvironmentVariable(arg);
}

function parseOptions(argv) {
  var files = [],
      color = true,
      useDefaultReporter = true;
  argv.forEach(function(arg) {
    if (arg === '--no-color') {
      color = false;
    } else if (arg === '--no-default-reporter') {
      useDefaultReporter = false;
    } else if (isFileArg(arg)) {
      files.push(arg);
    }
  });
  return {
    color: color,
    useDefaultReporter: useDefaultReporter,
    files: files
  };
}

function runJasmine(jasmine, env) {
  jasmine.loadConfigFile(process.env.JASMINE_CONFIG_PATH);

  if (env.useDefaultReporter) {
    jasmine.configureDefaultReporter({
      showColors: env.color
    });
  }
  jasmine.execute(env.files);
}

function initJasmine(options) {
  var specDir = options.specDir;
  makeDirStructure(path.join(specDir, 'support/'));
  if(!fs.existsSync(path.join(specDir, 'support/jasmine.json'))) {
    fs.writeFileSync(path.join(specDir, 'support/jasmine.json'), fs.readFileSync(path.join(__dirname, '../lib/examples/jasmine.json'), 'utf-8'));
  }
  else {
    console.log('spec/support/jasmine.json already exists in your project.');
  }
}

function installExamples(options) {
  var specDir = options.specDir;
  var projectBaseDir = options.projectBaseDir;
  var examplesDir = options.examplesDir;

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

function help() {
  console.log('Usage: jasmine [command] [options] [files]');
  console.log('');
  console.log('Commands:');
  Object.keys(subCommands).forEach(function(cmd) {
    console.log('%s\t%s', lPad(cmd, 10), subCommands[cmd].description);
  });
  console.log('');

  console.log('Options:');
  console.log('%s\t\tturn off color in spec output', lPad('--no-color', 15));
  console.log('');
  console.log('if no command is given, jasmine specs will be run');
}

function lPad(str, length) {
  if (str.length === length) {
    return str;
  } else {
    return lPad(' ' + str, length);
  }
}

function copyFiles(srcDir, destDir, pattern) {
  var srcDirFiles = fs.readdirSync(srcDir);
  srcDirFiles.forEach(function(file) {
    if (file.search(pattern) !== -1) {
      fs.writeFileSync(path.join(destDir, file), fs.readFileSync(path.join(srcDir, file)));
    }
  });
}

function makeDirStructure(absolutePath) {
  var splitPath = absolutePath.split(path.sep);
  splitPath.forEach(function(dir, index) {
    if(index > 1) {
      var fullPath = path.join(splitPath.slice(0, index).join('/'), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath);
      }
    }
  });
}

function isEnvironmentVariable(command) {
  var envRegExp = /(.*)=(.*)/;
  return command.match(envRegExp);
}

function setEnvironmentVariables(commands) {
  commands.forEach(function (command) {
    var regExpMatch = isEnvironmentVariable(command);
    if(regExpMatch) {
      var key = regExpMatch[1];
      var value = regExpMatch[2];
      process.env[key] = value;
    }
  });
}
