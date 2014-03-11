var fs = require('fs'),
  path = require('path');

var Command = require('../src/command');

var projectBaseDir = "spec/fixtures/sample_empty_project/";

var src = projectBaseDir;
var spec = path.join(projectBaseDir, "spec/");

var support = path.join(spec, "support/");
var defaultConfigPath = path.join(support, "jasmine.json");

var spec_jasmine_examples = path.join(spec, "jasmine_examples/");
var src_jasmine_examples = path.join(src, "jasmine_examples/");

function emptyDirectory(dir) {
  if(fs.existsSync(dir)) {
    var dirFiles = fs.readdirSync(dir);
    dirFiles.forEach(function(file) {
      var fullPath = path.join(dir, file);
      if(fs.statSync(fullPath).isDirectory()) {
        emptyDirectory(fullPath);
        fs.rmdirSync(fullPath);
      }
      else if(fs.statSync(fullPath).isFile()){
        fs.unlinkSync(fullPath);
      }
    });
  }
}

describe("command", function() {
  var command;

  describe('passing in environment variables', function() {
    beforeEach(function () {
      command = new Command(projectBaseDir, ['TESTKEY=TESTVALUE']);
    });

    it('should run with those environment variables', function() {
      expect(process.env.TESTKEY).toBe('TESTVALUE');
    });
  });

  describe("init", function() {
    beforeEach(function() {
      command = new Command(projectBaseDir, ['init']);
    });

    it("should set execJasmine to false", function() {
      expect(command.execJasmine).toBe(false);
    });

    it("creates setup folders and files for specs", function() {
      expect(fs.existsSync(defaultConfigPath)).toBe(true);
    });

    it("writes default settings to jasmine.json", function() {
      var realJson = fs.readFileSync(defaultConfigPath, 'utf-8');
      var fixtureJson = fs.readFileSync(path.join(__dirname, "../", "lib/", "examples/", "jasmine.json"), 'utf-8');
      expect(realJson).toEqual(fixtureJson);
    });

    afterEach(function() {
      fs.unlinkSync(defaultConfigPath);
      fs.rmdirSync(support);
      fs.rmdirSync(spec);
    });
  });

  describe("examples", function() {
    beforeEach(function() {
      command = new Command(projectBaseDir, ['examples']);
    });

    it("should create init files if they don't exist", function() {
      expect(fs.existsSync(spec_jasmine_examples)).toBe(true);
      expect(fs.existsSync(src_jasmine_examples)).toBe(true);
      expect(fs.existsSync(path.join(spec, "helpers/"))).toBe(true);
      expect(fs.existsSync(path.join(spec, "helpers/jasmine_examples/"))).toBe(true);
    });

    it("should copy files into the appropriate folder", function() {
      expect(fs.existsSync(path.join(src_jasmine_examples, "Player.js"))).toBe(true);
      expect(fs.existsSync(path.join(src_jasmine_examples, "Song.js"))).toBe(true);
      expect(fs.existsSync(path.join(spec_jasmine_examples, "PlayerSpec.js"))).toBe(true);
      expect(fs.existsSync(path.join(spec, "helpers/", "jasmine_examples/", "SpecHelper.js"))).toBe(true);
    });

    afterEach(function () {
      emptyDirectory(projectBaseDir);
    });
  });
});
