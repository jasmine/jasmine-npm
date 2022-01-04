const child_process = require('child_process');

describe('Integration', function () {
  beforeEach(function() {
    jasmine.addMatchers({
      toBeSuccess: function(matchersUtil) {
        return {
          compare: function(actual, expected) {
            const result = { pass: actual.exitCode === 0 };

            if (result.pass) {
              result.message = 'Expected process not to succeed but it did.';
            } else {
              result.message = `Expected process to succeed but it exited ${actual.exitCode}.`;
            }

            result.message += '\n\nOutput:\n' + actual.output;
            return result;
          }
        };
      }
    });
  });

  it('supports ES modules', async function () {
    const {exitCode, output} = await runJasmine('spec/fixtures/esm', 'jasmine.mjs');
    expect(exitCode).toEqual(0);
    expect(stripExperimentalModulesWarning(output)).toContain(
      'name_reporter\n' +
      'commonjs_helper\n' +
      'esm_helper\n' +
      'Started\n' +
      'Spec: A spec file ending in .js is required as a commonjs module\n' +
      '.Spec: A spec file ending in .mjs is imported as an es module\n'
    );
  });

  it('supports ES module reporters that end in .mjs', async function() {
    let {output} = await runJasmine(
      'spec/fixtures/sample_project',
      'spec/support/jasmine.json',
      ['--reporter=../customReporter.mjs']
    );
    expect(output).toContain('customReporter.mjs jasmineDone');
  });

  it('supports ES module reporters that end in .js', async function() {
    let {output} = await runJasmine(
      'spec/fixtures/esm-reporter-packagejson',
      'jasmine.json',
      ['--reporter=./customReporter.js']
    );
    expect(output).toContain('customReporter.js jasmineDone');
  });

  it('loads .js files using import when jsLoader is "import"', async function() {
    expect(await runJasmine('spec/fixtures/js-loader-import')).toBeSuccess();
  });

  it('loads .js files using require when jsLoader is "require"', async function() {
    expect(await runJasmine('spec/fixtures/js-loader-require')).toBeSuccess();
  });

  it('loads .js files using import when jsLoader is undefined', async function() {
    expect(await runJasmine('spec/fixtures/js-loader-default')).toBeSuccess();
  });

  it('falls back to require when loading extensions that import does not support', async function() {
    expect(await runJasmine('spec/fixtures/import-jsx')).toBeSuccess();
  });


  it('handles load-time exceptions from CommonJS specs properly', async function () {
    const {exitCode, output} = await runJasmine('spec/fixtures/cjs-load-exception');
    expect(exitCode).toEqual(1);
    expect(output).toContain('Error: nope');
    expect(output).toMatch(/at .*throws_on_load.js/);
  });

  it('handles load-time exceptions from ESM specs properly', async function () {
    const {exitCode, output} = await runJasmine('spec/fixtures/esm-load-exception');
    expect(exitCode).toEqual(1);
    expect(output).toContain('Error: nope');
    expect(output).toMatch(/at .*throws_on_load.mjs/);
  });

  it('handles syntax errors in CommonJS specs properly', async function () {
    const {exitCode, output} = await runJasmine('spec/fixtures/cjs-syntax-error');
    expect(exitCode).toEqual(1);
    expect(output).toContain('SyntaxError');
    expect(output).toContain('syntax_error.js');
  });

  it('handles syntax errors in ESM specs properly', async function () {
    const {exitCode, output} = await runJasmine('spec/fixtures/esm-syntax-error');
    expect(exitCode).toEqual(1);
    expect(output).toContain('SyntaxError');
    expect(output).toContain('syntax_error.mjs');
  });

  it('handles syntax errors from a CommonJS module loaded from an ESM spec properly', async function() {
    try {
      await import('./fixtures/topLevelAwaitSentinel.mjs');
    } catch (e) {
      if (e instanceof SyntaxError && e.message === 'Unexpected reserved word') {
        pending('This Node version does not support top-level await');
      } else if (e.message === 'Not supported') {
        pending('This Node version does not support dynamic import');
      } else {
        throw e;
      }
    }

    const {exitCode, output} = await runJasmine('spec/fixtures/esm-importing-commonjs-syntax-error');
    expect(exitCode).toEqual(1);
    expect(output).toContain('SyntaxError');
    expect(output).toContain('syntax_error.js');
  });

  it('handles exceptions thrown from a module loaded from an ESM spec properly', async function() {
    const {exitCode, output} = await runJasmine('spec/fixtures/esm-indirect-error');
    expect(exitCode).toEqual(1);
    expect(output).toContain('nope');
    expect(output).toContain('throws.mjs');
  });

  it('can configure the env via the `env` config property', async function() {
    const {exitCode, output} = await runJasmine('spec/fixtures/env-config');
    expect(exitCode).toEqual(0);
    expect(stripExperimentalModulesWarning(output)).toContain(
      'in spec 1\n.in spec 2\n.in spec 3\n.in spec 4\n.in spec 5'
    );
  });

  describe('Programmatic usage', function() {
    it('exits on completion by default', async function() {
      const {exitCode, output} = await runCommand('node', ['spec/fixtures/defaultProgrammaticFail.js']);
      expect(exitCode).toEqual(3);
      expect(output).toContain('1 spec, 1 failure');
    });

    it('does not exit on completion when exitOnCompletion is set to false', async function() {
      const {exitCode, output} = await runCommand('node', ['spec/fixtures/dontExitOnCompletion.js']);
      expect(exitCode).toEqual(0);
      expect(output).toContain('in setTimeout cb');
    });

    it('resolves the returned promise when the suite passes', async function() {
      const {exitCode, output} = await runCommand('node', ['spec/fixtures/promiseSuccess.js']);
      expect(exitCode).toEqual(0);
      expect(output).toContain('Promise success!');
    });

    it('resolves the returned promise when the suite fails', async function() {
      const {exitCode, output} = await runCommand('node', ['spec/fixtures/promiseFailure.js']);
      expect(exitCode).toEqual(0);
      expect(output).toContain('Promise failure!');
    });

    it('resolves the returned promise when the suite is incomplete', async function() {
      const {exitCode, output} = await runCommand('node', ['spec/fixtures/promiseIncomplete.js']);
      expect(exitCode).toEqual(0);
      expect(output).toContain('Promise incomplete!');
    });
  });

  it('exits with status 4 when exit() is called before the suite finishes', async function() {
    const {exitCode} = await runCommand('node', ['spec/fixtures/prematureExit.js']);
    expect(exitCode).toEqual(4);
  });

  it('does not create globals when the globals option is false', async function() {
    const {exitCode, output} = await runCommand('node', ['runner.js'], 'spec/fixtures/no-globals');

    expect(exitCode).toEqual(0);
    expect(output).toContain('1 spec, 0 failures');
    expect(output).toContain('Globals OK');
  });
});

async function runJasmine(cwd, config="jasmine.json", extraArgs = []) {
  const args = ['../../../bin/jasmine.js', '--config=' + config].concat(extraArgs);
  return runCommand('node', args, cwd);
}

async function runCommand(cmd, args, cwd = '.') {
  return new Promise(function(resolve) {
    const child = child_process.spawn(
      cmd,
      args,
      {
        cwd,
        shell: false
      }
    );
    let output = '';
    child.stdout.on('data', function (data) {
      output += data;
    });
    child.stderr.on('data', function (data) {
      output += data;
    });
    child.on('close', function (exitCode) {
      resolve({exitCode, output});
    });
  });
}

function stripExperimentalModulesWarning(jasmineOutput) {
  // Node < 14 outputs a warning when ES modules are used, e.g.:
  // (node:5258) ExperimentalWarning: The ESM module loader is experimental.
  // The position of this warning in the output varies. Sometimes it
  // occurs before the lines we're interested in but sometimes it's in
  // the middle of them.
  return jasmineOutput.replace(/^.*ExperimentalWarning.*$\n/m, '');
}
