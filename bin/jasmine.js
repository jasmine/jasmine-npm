#!/usr/bin/env node

var cluster = require('cluster'),
    path = require('path'),
    Jasmine = require("../lib/jasmine");

var jasmine = new Jasmine({ projectBaseDir: path.resolve() });

if (cluster.isMaster) {
  var Command = require('../lib/command.js');
  
  var examplesDir = path.join(path.dirname(require.resolve('jasmine-core')), 'jasmine-core', 'example', 'node_example');
  var command = new Command(path.resolve(), examplesDir, console.log);

  command.run(jasmine, process.argv.slice(2));
} else if (cluster.isWorker) {
  var loadConfig = require('../lib/loadConfig');
  var runWorkerJasmine = require('../lib/worker');
  runWorkerJasmine(jasmine, loadConfig);
}
