#!/usr/bin/env node

var fs = require('fs'),
  path = require('path'),
  util = require('util');

var Command = require('../lib/command.js');
var command = new Command(path.resolve(), process.argv);

if(!command.jasmineStop) {
  var jasmineRequire = require('jasmine-core');
  var jasmine = jasmineRequire.boot(jasmineRequire);

  var Config = require('../lib/config.js');
  var config = new Config(path.resolve());

  var done = function(passed) {
    if (passed) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  };

  var Runner = require('../lib/runner.js');
  var runner = new Runner(util.print, config, jasmine.getEnv(), done, process.argv);
}
