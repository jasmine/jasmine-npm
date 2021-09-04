#!/usr/bin/env node

const path = require('path');
const Command = require('../lib/command');
const Jasmine = require('../lib/jasmine');

const jasmine = new Jasmine({ projectBaseDir: path.resolve() });
const examplesDir = path.join(path.dirname(require.resolve('jasmine-core')), 'jasmine-core', 'example', 'node_example');
const command = new Command(path.resolve(), examplesDir, console.log);

command.run(jasmine, process.argv.slice(2));
