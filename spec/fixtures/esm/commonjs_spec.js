describe('A spec file ending in .js', function() {
  it('is required as a commonjs module', function() {
    require('./commonjs_sentinel');
  });
});
