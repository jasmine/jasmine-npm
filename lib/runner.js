var program = require("commander");

module.exports = function(print, config, env, done, argv) {
  program
    .option('--no-color', 'turns off color in output')
    .parse(argv);

  config.userFiles().forEach(function(specFile) {
    require(specFile);
  });

  var consoleReporter = new jasmine.ConsoleReporter({
    print: print,
    onComplete: done,
    showColors: program.color,
    timer: new jasmine.Timer()
  });

  env.addReporter(consoleReporter);

  env.execute();
};
