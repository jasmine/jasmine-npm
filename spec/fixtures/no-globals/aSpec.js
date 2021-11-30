const {it, expect} = require('jasmine-core').noGlobals();

it('can use equality testers defined in a different file', function() {
  expect(1).toEqual(2);
});
