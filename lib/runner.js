var program = require("commander");

exports = module.exports = Runner;

function Runner(print, config, env, done, argv) {
  program
    .option('--no-color', 'turns off color in output')
    .parse(argv);

  config.specFiles().forEach(function(file) {
    require(file);
  });

  var consoleReporter = new jasmine.ConsoleReporter({
    print: print,
    onComplete: done,
    showColors: program.color,
    timer: new jasmine.Timer()
  });

  env.addReporter(consoleReporter);

  env.execute();
}
