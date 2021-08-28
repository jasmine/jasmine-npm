const Jasmine = require('../..');
const jasmine = new Jasmine();

it('a spec', function() {});

jasmine.exitOnCompletion = false;
jasmine.execute().then(function(result) {
  if (result.overallStatus === 'passed') {
    console.log("Promise success!");
  }
});
