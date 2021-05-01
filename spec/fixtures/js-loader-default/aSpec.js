describe('a file with js extension', function() {
  it('was loaded as a CommonJS module', function() {
    expect(module.parent).toBeTruthy();
  });
});
