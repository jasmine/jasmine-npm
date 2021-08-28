const Jasmine = require('../..');
const jasmine = new Jasmine();

it('a spec', function() {});

jasmine.exitOnCompletion = false;
jasmine.execute().finally(function() {
  setTimeout(function() {
    console.log("in setTimeout cb");
  });
});
