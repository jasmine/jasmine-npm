var ConsoleSpecFilter = require('../../lib/filters/console_spec_filter');

describe("ConsoleSpecFilter", function() {

  it("should match when no string is provided", function() {
    var specFilter = new ConsoleSpecFilter();

    expect(specFilter.matches("foo")).toBe(true);
    expect(specFilter.matches("*bar")).toBe(true);
  });

  it("should match the provided string", function() {
    var specFilter = new ConsoleSpecFilter({
      filterString: "foo"
    });

    expect(specFilter.matches("foo")).toBe(true);
    expect(specFilter.matches("bar")).toBe(false);
  });

  it("should match by part of spec name", function() {
    var specFilter = new ConsoleSpecFilter({
      filterString: "ba"
    });

    expect(specFilter.matches("foo")).toBe(false);
    expect(specFilter.matches("bar")).toBe(true);
    expect(specFilter.matches("baz")).toBe(true);
  });
});