var path = require('path'),
  fs = require('fs');

module.exports = function(projectBaseDir, commands) {
  var jasmineStop = false;

  var defaultConfigPath = path.join(projectBaseDir, "spec/support/jasmine.json");
  var spec = path.join(projectBaseDir, "spec/");
  var src = path.join(projectBaseDir);
  var support = path.join(spec, "support/");
  var spec_jasmine_examples = path.join(spec, "jasmine_examples/");
  var src_jasmine_examples = path.join(src, "jasmine_examples/");

  var root = path.resolve();
  var jasmine_core = path.join(root, "node_modules/", "jasmine-core/");

  var jasmine_core_examples = path.join(jasmine_core, "lib/",
    "jasmine-core/", "example/");


  var jasmine_core_example_specs = path.join(jasmine_core_examples, "spec/");
  var jasmine_core_example_src = path.join(jasmine_core_examples, "src/");

  var jasmineJSON = JSON.stringify({
      "spec_dir": "spec",
      "spec_files": [
        "**/*[sS]pec.js"
      ],
      "helpers": [
        "helpers/**/*.js"
      ]
    }, null, '  ');

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

  if(commands.indexOf('init') !== -1) {
    jasmineStop = true;
    makeDirStructure(support);
    if(!fs.existsSync(defaultConfigPath)) {
      fs.writeFileSync(defaultConfigPath, jasmineJSON);
    }
    else {
      console.log("spec/support/jasmine.json already exists in your project.");
    }
  }

  else if(commands.indexOf('examples') !== -1) {
    jasmineStop = true;
    makeDirStructure(support);
    makeDirStructure(spec_jasmine_examples);
    makeDirStructure(src_jasmine_examples);
    makeDirStructure(path.join(spec, "helpers/jasmine_examples/"));

    if(!fs.existsSync(defaultConfigPath)) {
      copyFiles(jasmine_core_example_specs, path.join(spec, "helpers/",
        "jasmine_examples/"), new RegExp(/[Hh]elper\.js/));
      copyFiles(jasmine_core_example_src, src_jasmine_examples, new RegExp(/\.js/));
      copyFiles(jasmine_core_example_specs, spec_jasmine_examples, new RegExp(/[Ss]pec.js/));
    }
  }

  this.jasmineStop = jasmineStop;
};
