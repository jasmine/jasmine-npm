#!/usr/bin/env node

var cluster = require('cluster');

if (cluster.isMaster) {
  var path = require('path'),
      Command = require('../lib/command.js'),
      newJasmine = require('../lib/new.js');

  var jasmine = newJasmine();
  var examplesDir = path.join(path.dirname(require.resolve('jasmine-core')), 'jasmine-core', 'example', 'node_example');
  var command = new Command(path.resolve(), examplesDir, console.log);

  command.run(jasmine, process.argv.slice(2));
} else if (cluster.isWorker) {
  var runWorkerJasmine = require('../lib/worker.js');
  runWorkerJasmine();
}
