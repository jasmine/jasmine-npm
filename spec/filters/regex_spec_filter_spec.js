const regexSpecFilter = require('../../lib/filters/regex_spec_filter');

describe("regexSpecFilter", function() {
  it("should match when no string is provided", function() {
    const specFilter = regexSpecFilter();

    expect(specFilter({ getFullName: () => "foo" })).toBe(true);
    expect(specFilter({ getFullName: () => "*bar" })).toBe(true);
  });

  it("should match the provided string", function() {
    const specFilter = regexSpecFilter("foo?");

    expect(specFilter({ getFullName: () => "foo"})).toBe(true);
    expect(specFilter({ getFullName: () => "fo"})).toBe(true);
    expect(specFilter({ getFullName: () => "bar"})).toBe(false);
  });

  it("should match the provided regex", function() {
    const specFilter = regexSpecFilter(/foo?/);

    expect(specFilter({ getFullName: () => "foo"})).toBe(true);
    expect(specFilter({ getFullName: () => "fo"})).toBe(true);
    expect(specFilter({ getFullName: () => "bar"})).toBe(false);
  });

  it("should match by part of spec name", function() {
    const specFilter = regexSpecFilter("ba");

    expect(specFilter({ getFullName: () => "foo"})).toBe(false);
    expect(specFilter({ getFullName: () => "bar"})).toBe(true);
    expect(specFilter({ getFullName: () => "baz"})).toBe(true);
  });
});
