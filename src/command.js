var path = require('path'),
  fs = require('fs');

module.exports = function(projectBaseDir, commands) {
  var execJasmine = true;

  var defaultConfigPath = path.join(projectBaseDir, "spec/support/jasmine.json");
  var spec = path.join(projectBaseDir, "spec/");
  var src = path.join(projectBaseDir);
  var support = path.join(spec, "support/");
  var spec_jasmine_examples = path.join(spec, "jasmine_examples/");
  var src_jasmine_examples = path.join(src, "jasmine_examples/");

  var jasmine_core = path.join(__dirname,   "../", "node_modules/", "jasmine-core/");
  var jasmine_core_examples = path.join(jasmine_core, "lib/",
    "jasmine-core/", "example/", "node_example/");


  var jasmine_core_example_specs = path.join(jasmine_core_examples, "spec/");
  var jasmine_core_example_src = path.join(jasmine_core_examples, "src/");

  setEnvironmentVariables(commands);

  if(commands.indexOf('init') !== -1) {
    execJasmine = false;
    makeDirStructure(support);
    if(!fs.existsSync(defaultConfigPath)) {
      fs.writeFileSync(defaultConfigPath, fs.readFileSync(path.join(__dirname, "../lib/examples/jasmine.json"), 'utf-8'));
    }
    else {
      console.log("spec/support/jasmine.json already exists in your project.");
    }
  }

  else if(commands.indexOf('examples') !== -1) {
    execJasmine = false;
    makeDirStructure(support);
    makeDirStructure(spec_jasmine_examples);
    makeDirStructure(src_jasmine_examples);
    makeDirStructure(path.join(spec, "helpers/jasmine_examples/"));
    copyFiles(jasmine_core_example_specs, path.join(spec, "helpers/",
      "jasmine_examples/"), new RegExp(/[Hh]elper\.js/));
    copyFiles(jasmine_core_example_src, src_jasmine_examples, new RegExp(/\.js/));
    copyFiles(jasmine_core_example_specs, spec_jasmine_examples, new RegExp(/[Ss]pec.js/));
  }

  this.execJasmine = execJasmine;
};

function copyFiles(srcDir, destDir, pattern) {
  var srcDirFiles = fs.readdirSync(srcDir);
  srcDirFiles.forEach(function(file) {
    if (file.search(pattern) !== -1) {
      fs.writeFileSync(path.join(destDir, file), fs.readFileSync(path.join(srcDir, file)));
    }
  });
}

function makeDirStructure(absolutePath) {
  var splitPath = absolutePath.split("/");
  splitPath.forEach(function(dir, index) {
    if(index > 1) {
      var fullPath = path.join(splitPath.slice(0, index).join("/"), dir);
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
