module.exports = {
  spec_dir: '.',
  spec_files: ['spec.js'],
  globalTeardown() {
    console.log('in globalTeardown');
  }
};
