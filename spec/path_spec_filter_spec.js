const pathSpecFilter = require('../lib/filters/path_spec_filter');

describe("pathSpecFilter", function() {
  it("matches a spec with the exact same path", function() {
    const specFilter = pathSpecFilter(["a", "b", "c"]);
    expect(specFilter(stubSpec(['a', 'b', 'c']))).toBeTrue();
  });

  it('matches a spec whose path has the filter path as a prefix', function() {
    const specFilter = pathSpecFilter(["a", "b"]);
    expect(specFilter(stubSpec(['a', 'b', 'c']))).toBeTrue();
  });

  it('does not match a spec with a different path', function() {
    const specFilter = pathSpecFilter(["a", "b", "c"]);
    expect(specFilter(stubSpec(['a', 'd', 'c']))).toBeFalse();
  });

  function stubSpec(path) {
    return {
      getPath() { return path; },
      // getFullName is required, but plays no role in filtering
      getFullName() { return ""; }
    };
  }
});
