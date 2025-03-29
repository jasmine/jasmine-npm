const RegexSpecFilter = require('../../lib/filters/regex_spec_filter');

describe("RegexSpecFilter", function() {

  it("should match when no string is provided", function() {
    const specFilter = new RegexSpecFilter();

    expect(specFilter.matches("foo")).toBe(true);
    expect(specFilter.matches("*bar")).toBe(true);
  });

  it("should match the provided string", function() {
    const specFilter = new RegexSpecFilter({
      filterString: "foo"
    });

    expect(specFilter.matches("foo")).toBe(true);
    expect(specFilter.matches("bar")).toBe(false);
  });

  it("should match by part of spec name", function() {
    const specFilter = new RegexSpecFilter({
      filterString: "ba"
    });

    expect(specFilter.matches("foo")).toBe(false);
    expect(specFilter.matches("bar")).toBe(true);
    expect(specFilter.matches("baz")).toBe(true);
  });
});
