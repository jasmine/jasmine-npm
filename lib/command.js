var path = require('path'),
  fs = require('fs');

exports = module.exports = Command;

function Command(projectBaseDir, commands) {
  var execJasmine = true;

  var spec = path.join(projectBaseDir, 'spec/');
  var jasmine_core_examples = path.join(__dirname, '../', 'node_modules/', 'jasmine-core/', 'lib/',
    'jasmine-core/', 'example/', 'node_example/');

  setEnvironmentVariables(commands);

  if(commands.indexOf('init') !== -1) {
    execJasmine = false;
    makeDirStructure(path.join(spec, 'support/'));
    if(!fs.existsSync(path.join(projectBaseDir, 'spec/support/jasmine.json'))) {
      fs.writeFileSync(path.join(projectBaseDir, 'spec/support/jasmine.json'), fs.readFileSync(path.join(__dirname, '../lib/examples/jasmine.json'), 'utf-8'));
    }
    else {
      console.log('spec/support/jasmine.json already exists in your project.');
    }
  }

  else if(commands.indexOf('examples') !== -1) {
    execJasmine = false;
    makeDirStructure(path.join(spec, 'support/'));
    makeDirStructure(path.join(spec, 'jasmine_examples/'));
    makeDirStructure(path.join(projectBaseDir, 'jasmine_examples/'));
    makeDirStructure(path.join(spec, 'helpers/jasmine_examples/'));
    copyFiles(path.join(jasmine_core_examples, 'spec/'), path.join(spec, 'helpers/',
      'jasmine_examples/'), new RegExp(/[Hh]elper\.js/));
    copyFiles(path.join(jasmine_core_examples, 'src/'), path.join(projectBaseDir, 'jasmine_examples/'), new RegExp(/\.js/));
    copyFiles(path.join(jasmine_core_examples, 'spec/'), path.join(spec, 'jasmine_examples/'), new RegExp(/[Ss]pec.js/));
  }

  this.execJasmine = execJasmine;
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
  var splitPath = absolutePath.split('/');
  splitPath.forEach(function(dir, index) {
    if(index > 1) {
      var fullPath = path.join(splitPath.slice(0, index).join('/'), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath);
      }
    }
  });
}

function setEnvironmentVariables(commands) {
  var envRegExp = /(.*)=(.*)/;
  commands.forEach(function (command) {
    var regExpMatch = command.match(envRegExp);
    if(regExpMatch) {
      var key = regExpMatch[1];
      var value = regExpMatch[2];
      process.env[key] = value;
    }
  });
}
