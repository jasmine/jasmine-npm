const Jasmine = require('../..');
const jasmine = new Jasmine();

it('a spec', function() {
  process.exit(0);
});

jasmine.execute();
