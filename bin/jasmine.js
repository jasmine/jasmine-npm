#!/usr/bin/env node

const path = require('path');
const os = require('os');
const Command = require('../lib/command');
const Jasmine = require('../lib/jasmine');

let projectBaseDir = path.resolve();

if (os.platform() === 'win32') {
  // Future versions of glob will interpret backslashes as escape sequences on
  // all platforms, and Jasmine warns about them. Convert to slashes to avoid
  // the warning and future behavior change.
  projectBaseDir = projectBaseDir.replace(/\\/g, '/');
}

const jasmine = new Jasmine({ projectBaseDir });
const examplesDir = path.join(path.dirname(require.resolve('jasmine-core')), 'jasmine-core', 'example', 'node_example');
const command = new Command(path.resolve(), examplesDir, {
  print: console.log,
  platform: os.platform,
});

command.run(jasmine, process.argv.slice(2));
