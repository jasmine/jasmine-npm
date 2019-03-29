var path = require('path'),
    Jasmine = require('./jasmine');

module.exports = exports = function() {
  return new Jasmine({ projectBaseDir: path.resolve() });
};