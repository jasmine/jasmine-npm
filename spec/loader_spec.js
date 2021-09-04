const Loader = require('../lib/loader');

describe('loader', function() {
  afterEach(function() {
    delete global.require_tester_was_loaded;
  });

  describe('#load', function() {
    describe('With alwaysImport: true', function() {
      describe('When the path ends in .mjs', function () {
        esModuleSharedExamples('mjs', true);
      });

      describe('When the path does not end in .mjs', function () {
        esModuleSharedExamples('js', true);
      });
    });

    describe('With alwaysImport: false', function() {
      describe('When the path ends in .mjs', function () {
        esModuleSharedExamples('mjs', false);
      });

      describe('When the path does not end in .mjs', function () {
        it('loads the file as a commonjs module', async function () {
          const requireShim = jasmine.createSpy('requireShim')
            .and.returnValue(Promise.resolve());
          const importShim = jasmine.createSpy('importShim');
          const loader = new Loader({requireShim, importShim});

          await expectAsync(loader.load('./foo/bar/baz', false)).toBeResolved();

          expect(requireShim).toHaveBeenCalledWith('./foo/bar/baz');
          expect(importShim).not.toHaveBeenCalled();
        });

        it('propagates the error when import fails', async function () {
          const underlyingError = new Error('nope');
          const requireShim = jasmine.createSpy('requireShim')
            .and.throwError(underlyingError);
          const importShim = jasmine.createSpy('importShim');
          const loader = new Loader({requireShim, importShim}, false);

          await expectAsync(loader.load('foo')).toBeRejectedWith(underlyingError);
        });
      });
    });
  });
});

function esModuleSharedExamples(extension, alwaysImport) {
  it('loads the file as an es module', async function () {
    const requireShim = jasmine.createSpy('requireShim');
    let resolve;
    const importPromise = new Promise(function (res) {
      resolve = res;
    });
    const importShim = jasmine.createSpy('importShim')
      .and.returnValue(importPromise);
    const resolvePath = jasmine.createSpy('resolvePath')
      .and.returnValue('/the/path/to/the/module');
    const loader = new Loader({requireShim, importShim, resolvePath});

    const loaderPromise = loader.load(`./foo/bar/baz.${extension}`, alwaysImport);

    expect(requireShim).not.toHaveBeenCalled();
    expect(resolvePath).toHaveBeenCalledWith(`./foo/bar/baz.${extension}`);
    expect(importShim).toHaveBeenCalledWith('file:///the/path/to/the/module');
    await expectAsync(loaderPromise).toBePending();

    resolve();

    await expectAsync(loaderPromise).toBeResolved();
  });

  it("adds the filename to ES module syntax errors", async function() {
    const underlyingError = new SyntaxError('some details but no filename, not even in the stack trace');
    const loader = new Loader({importShim: () => Promise.reject(underlyingError)});

    await expectAsync(loader.load(`foo.${extension}`, alwaysImport)).toBeRejectedWithError(
      `While loading foo.${extension}: SyntaxError: some details but no filename, not even in the stack trace`
    );
  });

  it('does not modify errors that are not SyntaxError instances', async function() {
    const underlyingError = new Error('nope');
    const loader = new Loader({importShim: () => Promise.reject(underlyingError)});

    await expectAsync(loader.load(`foo.${extension}`, alwaysImport)).toBeRejectedWith(underlyingError);
  });

  it('does not modify SyntaxErrors that mention the imported filename as a Unix-style path', async function() {
    const underlyingError = new SyntaxError('nope');
    underlyingError.stack = `/the/absolute/path/to/foo.${extension}:1\n` +
      '\n' +
      '\n' +
      '\n' +
      'maybe some more stack\n';
    const loader = new Loader({importShim: () => Promise.reject(underlyingError)});

    await expectAsync(loader.load(`path/to/foo.${extension}`, alwaysImport))
      .toBeRejectedWith(underlyingError);
  });

  it('does not modify SyntaxErrors that mention the imported filename as a Unix-style file URL', async function() {
    const underlyingError = new SyntaxError('nope');
    underlyingError.stack += `\n     at async file:///the/absolute/path/to/foo.${extension}:1:1`;
    const loader = new Loader({importShim: () => Promise.reject(underlyingError)});

    await expectAsync(loader.load(`path/to/foo.${extension}`, alwaysImport))
      .toBeRejectedWith(underlyingError);
  });

  it('does not modify SyntaxErrors that mention the imported filename as a Windows-style path', async function() {
    const underlyingError = new SyntaxError('nope');
    underlyingError.stack = `c:\\the\\absolute\\path\\to\\foo.${extension}:1\n` +
      '\n' +
      '\n' +
      '\n' +
      'maybe some more stack\n';
    const loader = new Loader({importShim: () => Promise.reject(underlyingError)});

    await expectAsync(loader.load(`path/to/foo.${extension}`, alwaysImport))
      .toBeRejectedWith(underlyingError);
  });

  it('does not modify SyntaxErrors that mention the imported filename as a Windows-style file URL', async function() {
    const underlyingError = new SyntaxError('nope');
    underlyingError.stack += `\n     at async file:///c:/the/absolute/path/to/foo.${extension}:1:1`;
    const loader = new Loader({importShim: () => Promise.reject(underlyingError)});

    await expectAsync(loader.load(`path/to/foo.${extension}`, alwaysImport))
      .toBeRejectedWith(underlyingError);
  });

  it('does not modify SyntaxErrors when the stack trace starts with any Unix-style path', async function() {
    const underlyingError = new SyntaxError('nope');
    underlyingError.stack = '/some/path/to/a/file.js:1\n\n\n\n' + underlyingError.stack;
    const loader = new Loader({importShim: () => Promise.reject(underlyingError)});

    await expectAsync(loader.load(`path/to/some/other/file.${extension}`, alwaysImport))
      .toBeRejectedWith(underlyingError);
  });

  it('does not modify SyntaxErrors when the stack trace starts with any Windows-style path', async function() {
    const underlyingError = new SyntaxError('nope');
    underlyingError.stack = 'c:\\some\\path\\to\\a\\file.js:1\n\n\n\n' + underlyingError.stack;
    const loader = new Loader({importShim: () => Promise.reject(underlyingError)});

    await expectAsync(loader.load(`path/to/some/other/file.${extension}`, alwaysImport))
      .toBeRejectedWith(underlyingError);
  });
}
