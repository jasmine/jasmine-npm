const Loader = require('../lib/loader');

describe('loader', function() {
  afterEach(function() {
    delete global.require_tester_was_loaded;
  });

  describe('#load', function() {
    describe('When the path ends in .mjs', function () {
      it('loads the file as an es module', async function () {
        const requireShim = jasmine.createSpy('requireShim');
        let resolve;
        const importPromise = new Promise(function (res) {
          resolve = res;
        });
        const importShim = jasmine.createSpy('importShim')
          .and.returnValue(importPromise);
        const loader = new Loader({requireShim, importShim});

        const loaderPromise = loader.load('./foo/bar/baz.mjs');

        expect(requireShim).not.toHaveBeenCalled();
        expect(importShim).toHaveBeenCalledWith('./foo/bar/baz.mjs');
        await expectAsync(loaderPromise).toBePending();

        resolve();

        await expectAsync(loaderPromise).toBeResolved();
      });

      it("adds the filename to errors that don't include it", async function() {
        const underlyingError = new SyntaxError('some details but no filename, not even in the stack trace');
        const importShim = () => Promise.reject(underlyingError);
        const loader = new Loader({importShim});

        await expectAsync(loader.load('foo.mjs')).toBeRejectedWithError(
          "While loading foo.mjs: SyntaxError: some details but no filename, not even in the stack trace"
        );
      });

      it('propagates errors that already contain the filename without modifying them', async function () {
        const requireShim = jasmine.createSpy('requireShim');
        const underlyingError = new Error('nope');
        underlyingError.stack = underlyingError.stack.replace('loader_spec.js', 'foo.mjs');
        const importShim = jasmine.createSpy('importShim')
          .and.callFake(() => Promise.reject(underlyingError));
        const loader = new Loader({requireShim, importShim});

        await expectAsync(loader.load('foo.mjs')).toBeRejectedWith(underlyingError);
      });
    });

    describe('When the path does not end in .mjs', function () {
      it('loads the file as a commonjs module', async function () {
        const requireShim = jasmine.createSpy('requireShim')
          .and.returnValue(Promise.resolve());
        const importShim = jasmine.createSpy('importShim');
        const loader = new Loader({requireShim, importShim});

        await expectAsync(loader.load('./foo/bar/baz')).toBeResolved();

        expect(requireShim).toHaveBeenCalledWith('./foo/bar/baz');
        expect(importShim).not.toHaveBeenCalled();
      });

      it('propagates the error when import fails', async function () {
        const underlyingError = new Error('nope');
        const requireShim = jasmine.createSpy('requireShim')
          .and.throwError(underlyingError);
        const importShim = jasmine.createSpy('importShim');
        const loader = new Loader({requireShim, importShim});

        await expectAsync(loader.load('foo')).toBeRejectedWith(underlyingError);
      });
    });
  });
});
