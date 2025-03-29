module.exports = exports = RegexSpecFilter;

function RegexSpecFilter(options) {
  const filterString = options && options.filterString;
  const filterPattern = new RegExp(filterString);

  this.matches = function(specName) {
    return filterPattern.test(specName);
  };
}
