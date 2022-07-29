#!/usr/bin/env node

const path = require('path');
const Command = require('../lib/command');
const Jasmine = require('../lib/jasmine');
const ParallelRunner = require("../lib/parallel_runner");

const examplesDir = path.join(path.dirname(require.resolve('jasmine-core')), 'jasmine-core', 'example', 'node_example');
const command = new Command(path.resolve(), examplesDir, {
  jasmine: new Jasmine({ projectBaseDir: path.resolve() }),
  parallelRunner: new ParallelRunner({ projectBaseDir: path.resolve() }),
  print: console.log
});

command.run(process.argv.slice(2));
