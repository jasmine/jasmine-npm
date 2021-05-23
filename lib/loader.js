const path = require('path');
module.exports = Loader;

function Loader(options) {
  options = options || {};
  this.require_ = options.requireShim || requireShim;
  this.import_ = options.importShim || importShim;
  this.resolvePath_ = options.resolvePath || path.resolve.bind(path);
}

Loader.prototype.load = function(modulePath, alwaysImport) {
  if (alwaysImport || modulePath.endsWith('.mjs')) {
    // The ES module spec requires import paths to be valid URLs. As of v14,
    // Node enforces this on Windows but not on other OSes. On OS X, import
    // paths that are URLs must not contain parent directory references.
    const url = `file://${this.resolvePath_(modulePath)}`;
    return this.import_(url).catch(function(e) {
      if (e.message.indexOf(modulePath) !== -1 || e.stack.indexOf(modulePath) !== -1) {
        return Promise.reject(e);
      } else {
        // When an ES module has a syntax error, thde resulting exception does not
        // include the filename. Add it. We lose the stack trace in the process,
        // but the stack trace is usually not useful since it contains only frames
        // from the Node module loader.
        const updatedError = new Error(`While loading ${modulePath}: ${e.constructor.name}: ${e.message}`);
        return Promise.reject(updatedError);
      }
    });
  } else {
    return new Promise(resolve => {
      this.require_(modulePath);
      resolve();
    });
  }
};

function requireShim(modulePath) {
  require(modulePath);
}

function importShim(modulePath) {
  return import(modulePath);
}
