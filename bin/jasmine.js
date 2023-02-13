#!/usr/bin/env node

const path = require('path');
const os = require('os');
const Command = require('../lib/command');
const Jasmine = require('../lib/jasmine');

let projectBaseDir = path.resolve();

if (os.platform() === 'win32') {
  // glob interprets backslashes as escape sequences, not directory separators.
  projectBaseDir = projectBaseDir.replace(/\\/g, '/');
}

const jasmine = new Jasmine({ projectBaseDir });
const examplesDir = path.join(path.dirname(require.resolve('jasmine-core')), 'jasmine-core', 'example', 'node_example');
const command = new Command(path.resolve(), examplesDir, {
  print: console.log,
  platform: os.platform,
});

command.run(jasmine, process.argv.slice(2));
