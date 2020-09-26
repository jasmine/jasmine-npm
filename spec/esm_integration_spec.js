const child_process = require('child_process');


describe('ES module support', function() {
  it('supports ES modules', function(done) {
    const child = child_process.spawn(
      'node',
      ['--experimental-modules', '../../../bin/jasmine.js', '--config=jasmine.json'],
      {
        cwd: 'spec/fixtures/esm',
        shell: false
      }
    );
    let output = '';
    child.stdout.on('data', function(data) {
      output += data;
    });
    child.stderr.on('data', function(data) {
      output += data;
    });
    child.on('close', function(exitCode) {
      expect(exitCode).toEqual(0);
      // Node < 14 outputs a warning when ES modules are used, e.g.:
      // (node:5258) ExperimentalWarning: The ESM module loader is experimental.
      // The position of this warning in the output varies. Sometimes it
      // occurs before the lines we're interested in but sometimes it's in
      // the middle of them.
      output = output.replace(/^.*ExperimentalWarning.*$\n/m, '');
      expect(output).toContain(
        'name_reporter\n' +
        'commonjs_helper\n' +
        'esm_helper\n' +
        'Started\n' +
        'Spec: A spec file ending in .js is required as a commonjs module\n' +
        '.Spec: A spec file ending in .mjs is imported as an es module\n'
      );
      done();
    });
  });
});
