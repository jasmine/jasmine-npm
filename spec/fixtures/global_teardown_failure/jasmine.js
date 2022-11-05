module.exports = {
  spec_dir: '.',
  spec_files: ['spec.js'],
  globalTeardown() {
    return Promise.reject(new Error('oops'));
  }
};
