var Config = require('../src/config.js');

var path = require("path");

describe("config", function() {
  var config;

  beforeEach(function() {
    config = new Config("spec/fixtures/sample_project/")
  });

  describe("#userFiles", function() {
    it("returns the helper files first", function() {
      expect(config.userFiles()[0]).toEqual(path.resolve("spec/fixtures/sample_project/spec/helper.js"));
    });

    it("handles normal files", function() {
      expect(config.userFiles()).toContain(path.resolve("spec/fixtures/sample_project/spec/fixture_spec.js"));
    });

    it("handles pattern/glob matching", function() {
      expect(config.userFiles()).toContain(path.resolve("spec/fixtures/sample_project/spec/other_fixture_spec.js"));
    });
  });
});
