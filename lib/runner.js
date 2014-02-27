module.exports = function(print, config, env, done) {
  config.userFiles().forEach(function(specFile) {
    require(specFile);
  });

  var consoleReporter = new jasmine.ConsoleReporter({
    print: print,
    onComplete: done,
    showColors: true,
    timer: new jasmine.Timer()
  });

  env.addReporter(consoleReporter);

  env.execute();
};
