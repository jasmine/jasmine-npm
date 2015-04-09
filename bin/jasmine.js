#!/usr/bin/env node

var path = require('path'),
    Command = require('../lib/command.js'),
    Jasmine = require('../lib/jasmine.js');

var exit = process.exit;
var code = 0;

Object.defineProperty(process, 'exitCode', {
  get: function() {
    console.log('get the code is', code);
    return code;
  },
  set: function(value) {
    console.log('set the code to', value, 'was', code);
    code = value;
  }
});

process.exit = function(code) {
  console.log('Someone said to exit with', code);
  // throw new Error('Who called exit with ' + code);
  exit(code);
};

var jasmine = new Jasmine({ projectBaseDir: path.resolve() });
var examplesDir = path.join(__dirname, '..', 'node_modules', 'jasmine-core', 'lib', 'jasmine-core', 'example', 'node_example');
var command = new Command(path.resolve(), examplesDir, console.log);

process.on('exit', function(code) {
  console.log('Exiting with code:', code);
});

process.on('beforeExit', function() {
  console.log('Will exit with code:', process.exitCode);
});

process.on('uncaughtException', function(err) {
  console.log('oopsie', err);
  process.exitCode = 1;
});

command.run(jasmine, process.argv.slice(2));
