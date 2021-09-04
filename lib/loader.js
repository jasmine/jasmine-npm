module.exports = Loader;

function Loader(options) {
  options = options || {};
  this.require_ = options.requireShim || requireShim;
  this.import_ = options.importShim || importShim;
}

Loader.prototype.load = function(path, alwaysImport) {
  if (alwaysImport || path.endsWith('.mjs')) {
    // The ES module spec requires import paths to be valid URLs. As of v14,
    // Node enforces this on Windows but not on other OSes.
    const url = `file://${path}`;
    return this.import_(url).catch(function(e) {
      return Promise.reject(fixupImportException(e, path));
    });
  } else {
    return new Promise(resolve => {
      this.require_(path);
      resolve();
    });
  }
};

function requireShim(path) {
  require(path);
}

function importShim(path) {
  return import(path);
}


function fixupImportException(e, importedPath) {
  // When an ES module has a syntax error, the resulting exception does not
  // include the filename, which the user will need to debug the problem. We
  // need to fix those up to include the filename. However, other kinds of load-
  // time errors *do* include the filename and usually the line number. We need
  // to leave those alone.
  //
  // Some examples of load-time errors that we need to deal with:
  // 1. Syntax error in an ESM spec:
  // SyntaxError: missing ) after argument list
  //     at Loader.moduleStrategy (node:internal/modules/esm/translators:147:18)
  //     at async link (node:internal/modules/esm/module_job:64:21)
  //
  // 2. Syntax error in an ES module imported from an ESM spec. This is exactly
  // the same as #1: there is no way to tell which file actually has the syntax
  // error.
  //
  // 3. Syntax error in a CommonJS module imported by an ES module:
  // /path/to/commonjs_with_syntax_error.js:2
  //
  //
  //
  // SyntaxError: Unexpected end of input
  //     at Object.compileFunction (node:vm:355:18)
  //     at wrapSafe (node:internal/modules/cjs/loader:1038:15)
  //     at Module._compile (node:internal/modules/cjs/loader:1072:27)
  //     at Object.Module._extensions..js (node:internal/modules/cjs/loader:1137:10)
  //     at Module.load (node:internal/modules/cjs/loader:988:32)
  //     at Function.Module._load (node:internal/modules/cjs/loader:828:14)
  //     at ModuleWrap.<anonymous> (node:internal/modules/esm/translators:201:29)
  //     at ModuleJob.run (node:internal/modules/esm/module_job:175:25)
  //     at async Loader.import (node:internal/modules/esm/loader:178:24)
  //     at async file:///path/to/esm_that_imported_cjs.mjs:2:11
  //
  // Note: For Jasmine's purposes, case 3 only occurs in  Node >= 14.8. Older
  // versions don't support top-level await, without which it's not possible to
  // load a CommonJS module from an ES module at load-time. The entire content
  // above, including the file path and the three blank lines, is part of the
  // error's `stack` property. There may or may not be any stack trace after the
  // SyntaxError line, and if there's a stack trace it may or may not contain
  // any useful information.
  //
  // 4. Any other kind of exception thrown at load time
  //
  //  Error: nope
  //     at Object.<anonymous> (/path/to/file_throwing_error.js:1:7)
  //     at Module._compile (node:internal/modules/cjs/loader:1108:14)
  //     at Object.Module._extensions..js (node:internal/modules/cjs/loader:1137:10)
  //     at Module.load (node:internal/modules/cjs/loader:988:32)
  //     at Function.Module._load (node:internal/modules/cjs/loader:828:14)
  //     at ModuleWrap.<anonymous> (node:internal/modules/esm/translators:201:29)
  //     at ModuleJob.run (node:internal/modules/esm/module_job:175:25)
  //     at async Loader.import (node:internal/modules/esm/loader:178:24)
  //     at async file:///path_to_file_importing_broken_file.mjs:1:1
  //
  // We need to replace the error with a useful one in cases 1 and 2, but not in
  // cases 3 and 4. Distinguishing among them can be tricky. Simple heuristics
  // like checking the stack trace for the name of the file we imported fail
  // because it often shows up even when the error was elsewhere, e.g. at the
  // bottom of the stack traces in the examples for cases 3 and 4 above. To add
  // to the fun, file paths in errors on Windows can be either Windows style
  // paths (c:\path\to\file.js) or URLs (file:///c:/path/to/file.js).
  
  if (!(e instanceof SyntaxError)) {
    return e;
  }

  const escapedWin = escapeStringForRegexp(importedPath.replace(/\//g, '\\'));
  const windowsPathRegex = new RegExp('[a-zA-z]:\\\\([^\\s]+\\\\|)' + escapedWin);
  const windowsUrlRegex = new RegExp('file:///[a-zA-z]:\\\\([^\\s]+\\\\|)' + escapedWin);
  const anyUnixPathFirstLineRegex = /^\/[^\s:]+:\d/;
  const anyWindowsPathFirstLineRegex = /^[a-zA-Z]:(\\[^\s\\:]+)+:/;

  if (e.message.indexOf(importedPath) !== -1
      || e.stack.indexOf(importedPath) !== -1
      || e.stack.match(windowsPathRegex) || e.stack.match(windowsUrlRegex)
      || e.stack.match(anyUnixPathFirstLineRegex)
      || e.stack.match(anyWindowsPathFirstLineRegex)) {
    return e;
  } else {
    return new Error(`While loading ${importedPath}: ${e.constructor.name}: ${e.message}`);
  }
}

// Adapted from Sindre Sorhus's escape-string-regexp (MIT license)
function escapeStringForRegexp(string) {
  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    .replace(/-/g, '\\x2d');
}
