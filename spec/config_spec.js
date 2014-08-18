var Config = require('../lib/config.js');

var path = require("path");

describe("config", function() {
  var config;

  beforeEach(function() {
    config = new Config("spec/fixtures/sample_project/");
  });

  describe("#userFiles", function() {
    it("returns the helper files first", function() {
      expect(config.specFiles()[0]).toEqual(path.resolve("spec/fixtures/sample_project/spec/helper.js"));
    });

    it("does not duplicate files", function() {
      expect(config.specFiles().length).toEqual(3);
    });

    it("handles normal files", function() {
      expect(config.specFiles()).toContain(path.resolve("spec/fixtures/sample_project/spec/fixture_spec.js"));
    });

    it("handles pattern/glob matching", function() {
      expect(config.specFiles()).toContain(path.resolve("spec/fixtures/sample_project/spec/other_fixture_spec.js"));
    });

    describe("when an environment variable for where to find the config file is set", function() {
      beforeEach(function() {
        process.env.JASMINE_CONFIG_PATH="spec/support/jasmine_alternate.json";
      });

      afterEach(function() {
        delete process.env.JASMINE_CONFIG_PATH;
      });

      it("defers to that", function() {
        config = new Config("spec/fixtures/sample_project/");
        expect(config.specFiles().length).toEqual(1);
      });
    });

    describe("when an environment variable for where to find the config file is a fully qualified path", function() {
      beforeEach(function() {
        process.env.JASMINE_CONFIG_PATH=__dirname + "/fixtures/sample_project/spec/support/jasmine_alternate.json";
      });

      afterEach(function() {
        delete process.env.JASMINE_CONFIG_PATH;
      });

      it("defers to that", function() {
        config = new Config("spec/fixtures/sample_project/");
        expect(config.specFiles().length).toEqual(1);
      });
    });
  });
});
