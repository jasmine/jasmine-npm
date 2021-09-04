const path = require('path');
const temp = require('temp').track();
const fs = require('fs');

describe('npm package', function() {
  beforeAll(function() {
    const shell = require('shelljs'),
      pack = shell.exec('npm pack', { silent: true });

    this.tarball = pack.stdout.split('\n')[0];
    this.tmpDir = temp.mkdirSync(); // automatically deleted on exit

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
      'MIT.LICENSE',
      'README.md',
      'bin',
      'lib',
      'package.json',
    ]);
  });
});
