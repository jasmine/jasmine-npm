module.exports = exports = ConsoleSpecFilter;

function ConsoleSpecFilter(options) {
  const filterString = options && options.filterString;
  const filterPattern = new RegExp(filterString);

  this.matches = function(specName) {
    return filterPattern.test(specName);
  };
}
