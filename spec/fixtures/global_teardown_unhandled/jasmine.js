module.exports = {
  spec_dir: '.',
  spec_files: ['spec.js'],
  globalTeardown() {
    setTimeout(function() {
      throw new Error('oops');
    });
    return new Promise(resolve => setTimeout(resolve));
  }
};
