module.exports = Loader;

function Loader(options) {
  options = options || {};
  this.require_ = options.requireShim || requireShim;
  this.import_ = options.importShim || importShim;
}

Loader.prototype.load = function(path) {
  if (path.endsWith('.mjs')) {
    return this.import_(path);
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
