var newJasmine = require("./new"),
    runJasmine = require('./run'),
    noop = require("./noop");

module.exports = exports = function() {
  process.on('message', function(env) {
    var jasmine = newJasmine();
    jasmine.onComplete(noop);
    runJasmine(jasmine, env, console.log);
  });
};