module.exports = exports = regexSpecFilter;

function regexSpecFilter(filterString) {
  const filterPattern = new RegExp(filterString);

  return function(spec) {
    return filterPattern.test(spec.getFullName());
  };
}
