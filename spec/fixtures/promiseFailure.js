const Jasmine = require('../..');
const jasmine = new Jasmine();

it('a spec', function() {
  expect(1).toBe(2);
});

jasmine.exitOnCompletion = false;
jasmine.execute().then(function(result) {
  if (result.overallStatus === 'failed') {
    console.log("Promise failure!");
  }
});
