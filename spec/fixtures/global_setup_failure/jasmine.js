module.exports = {
  spec_dir: '.',
  spec_files: ['spec.js'],
  globalSetup() {
    return Promise.reject(new Error('oops'));
  }
};
