var Promise = require('es6-promise').Promise;

var filesToLoad = [];

module.exports = function(file) {
	filesToLoad.push(file);

	return Promise.resolve();
};

module.exports.filesToLoad = filesToLoad;
