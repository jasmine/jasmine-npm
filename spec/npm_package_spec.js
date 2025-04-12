const path = require('path');
const fs = require('fs');
const os = require('os');
const shell = require('shelljs');
const {rimrafSync} = require('rimraf');

describe('npm package', function() {
  beforeAll(function() {
    const prefix = path.join(os.tmpdir(), 'jasmine-npm-package');
    this.tmpDir = fs.mkdtempSync(prefix);

    const pack = shell.exec('npm pack', { silent: true });
    this.tarball = pack.stdout.split('\n')[0];
    console.log(this.tmpDir);

    const untar = shell.exec('tar -xzf ' + this.tarball + ' -C ' + this.tmpDir, {
      silent: true
    });
    expect(untar.code).toBe(0);
  });

  beforeEach(function() {
    jasmine.addMatchers({
      toExistInPath: function() {
        return {
          compare: function(actual, expected) {
            const fullPath = path.resolve(expected, actual);
            return {
              pass: fs.existsSync(fullPath)
            };
          }
        };
      }
    });
  });

  afterAll(function() {
    fs.unlinkSync(this.tarball);
    rimrafSync(this.tmpDir);
  });

  it('has a jasmine script', function() {
    expect('package/bin/jasmine.js').toExistInPath(this.tmpDir);
  });

  it('has a jasmine module', function() {
    expect('package/lib/jasmine.js').toExistInPath(this.tmpDir);
  });

  it('contains only the expected root entries', function() {
    const files = fs.readdirSync(this.tmpDir);
    expect(files).toEqual(['package']);
  });

  it('contains only the expected entries in the package dir', function() {
    const files = fs.readdirSync(path.resolve(this.tmpDir, 'package'));
    files.sort();
    expect(files).toEqual([
      'LICENSE',
      'README.md',
      'bin',
      'lib',
      'package.json',
    ]);
  });
});
