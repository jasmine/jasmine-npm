module.exports = exports = function(jasmine, loadConfig) {
  process.on('message', function(env) {
    jasmine.onComplete(function(){});
    loadConfig(jasmine, env, console.log);
    jasmine.execute(env.files, env.filter);
  });
};