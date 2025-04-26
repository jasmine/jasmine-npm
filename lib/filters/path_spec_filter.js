module.exports = exports = pathSpecFilter;

function pathSpecFilter(filterPath) {
  return function(spec) {
    const specPath = spec.getPath();

    if (filterPath.length > specPath.length) {
      return false;
    }

    for (let i = 0; i < filterPath.length; i++) {
      if (specPath[i] !== filterPath[i]) {
        return false;
      }
    }

    return true;
  };
}
