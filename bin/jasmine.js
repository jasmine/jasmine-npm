#!/usr/bin/env node

var path = require('path'),
    program = require('commander');

var Command = require('../lib/command.js');
var command = new Command(path.resolve(), process.argv);

if(command.execJasmine) {
  program
    .option('--no-color', 'turns off color in output')
    .parse(process.argv);

  var Jasmine = require('../lib/jasmine.js');
  var jasmine = new Jasmine();

  jasmine.loadConfigFile(process.env.JASMINE_CONFIG_PATH);

  jasmine.configureDefaultReporter({
    showColors: program.color
  });
  jasmine.execute();
}
