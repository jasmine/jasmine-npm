var fs = require('fs'),
  path = require('path');

var Command = require('../src/command');

describe("command", function() {
  var command;

  describe("init", function() {
    beforeEach(function() {
      command = new Command("spec/fixtures/sample_empty_project/", ['init']);
    });

    it("should set jasmineStop to true", function() {
      expect(command.jasmineStop).toBe(true);
    });

    it("creates setup folders and files for specs", function() {
      var configFilePath = 'spec/fixtures/sample_empty_project/spec/support/jasmine.json';
      expect(fs.existsSync(configFilePath)).toBe(true);
    });

    it("writes default settings to jasmine.json", function() {
      var realJson = fs.readFileSync("spec/fixtures/sample_empty_project/spec/support/jasmine.json", 'utf-8');
      var fixtureJson = JSON.stringify({
        "spec_dir": "spec",
        "spec_files": [
          "**/*.js"
        ]
      }, null, '  ');
      expect(realJson).toEqual(fixtureJson);
    });

    afterEach(function() {
      fs.unlinkSync("spec/fixtures/sample_empty_project/spec/support/jasmine.json");
      fs.rmdirSync("spec/fixtures/sample_empty_project/spec/support/");
      fs.rmdirSync("spec/fixtures/sample_empty_project/spec/");
    });
  });
});
