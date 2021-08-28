const Jasmine = require('../..');
const jasmine = new Jasmine();

it('fails', function() {
  expect(1).toBe(2);
});

jasmine.execute();
