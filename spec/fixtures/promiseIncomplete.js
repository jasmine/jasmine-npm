const Jasmine = require('../..');
const jasmine = new Jasmine();

it('a spec', function() {});

fit('another spec', function() {});

jasmine.exitOnCompletion = false;
jasmine.execute().then(function(result) {
  if (result.overallStatus === 'incomplete') {
    console.log("Promise incomplete!");
  }
});
