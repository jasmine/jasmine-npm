describe('helpers', function() {
  describe('helperFoo', function() {
    it('should be defiend as a function', function() {
      expect(typeof this.helperFoo).toBe('function');
    });

    it('should return "bar"', function() {
      expect(this.helperFoo()).toBe('bar');
    });
  });
});
