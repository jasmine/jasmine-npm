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
    let {exitCode, output} = await runJasmine('spec/fixtures/esm', true);
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
  });

  it('loads .js files using import when jsLoader is "import"', async function() {
    await requireFunctioningJsImport();
    expect(await runJasmine('spec/fixtures/js-loader-import', false)).toBeSuccess();
  });

  it('warns that jsLoader: "import" is not supported', async function() {
    await requireBrokenJsImport();
    const {output} = await runJasmine('spec/fixtures/js-loader-import', false);
    expect(output).toContain('Warning: jsLoader: "import" may not work ' +
      'reliably on Node versions before 12.17.');
  });

  it('loads .js files using require when jsLoader is "require"', async function() {
    expect(await runJasmine('spec/fixtures/js-loader-require', false)).toBeSuccess();
  });

  it('loads .js files using require when jsLoader is undefined', async function() {
    expect(await runJasmine('spec/fixtures/js-loader-default', false)).toBeSuccess();
  });

  it('handles load-time exceptions from CommonJS specs properly', async function () {
    const {exitCode, output} = await runJasmine('spec/fixtures/cjs-load-exception', false);
    expect(exitCode).toEqual(1);
    expect(output).toContain('Error: nope');
    expect(output).toMatch(/at .*throws_on_load.js/);
  });

  it('handles load-time exceptions from ESM specs properly', async function () {
    const {exitCode, output} = await runJasmine('spec/fixtures/esm-load-exception', true);
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
    const {exitCode, output} = await runJasmine('spec/fixtures/esm-syntax-error', true);
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

    const {exitCode, output} = await runJasmine('spec/fixtures/esm-importing-commonjs-syntax-error', true);
    expect(exitCode).toEqual(1);
    expect(output).toContain('SyntaxError');
    expect(output).toContain('syntax_error.js');
  });

  it('handles exceptions thrown from a module loaded from an ESM spec properly', async function() {
    const {exitCode, output} = await runJasmine('spec/fixtures/esm-indirect-error', true);
    expect(exitCode).toEqual(1);
    expect(output).toContain('nope');
    expect(output).toContain('throws.mjs');
  });

  it('can configure the env via the `env` config property', async function() {
    const {exitCode, output} = await runJasmine('spec/fixtures/env-config');
    expect(exitCode).toEqual(0);
    expect(output).toContain('in spec 1\n.in spec 2\n.in spec 3\n.in spec 4\n.in spec 5');
  });

  describe('Programmatic usage', function() {
    it('exits on completion by default', async function() {
      const {exitCode, output} = await runCommand('node', ['spec/fixtures/defaultProgrammaticFail.js']);
      expect(exitCode).toEqual(1);
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
});

async function runJasmine(cwd, useExperimentalModulesFlag) {
  const args = ['../../../bin/jasmine.js', '--config=jasmine.json'];

  if (useExperimentalModulesFlag) {
    args.unshift('--experimental-modules');
  }

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

async function requireFunctioningJsImport() {
  if (!(await hasFunctioningJsImport())) {
    pending("This Node version can't import .js files");
  }
}

async function requireBrokenJsImport() {
  if (await hasFunctioningJsImport()) {
    pending("This Node version can import .js files");
  }
}

async function hasFunctioningJsImport() {
  try {
    await import('./fixtures/js-loader-import/anEsModule.js');
    return true;
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') {
      throw e;
    }

    return false;
  }
}
