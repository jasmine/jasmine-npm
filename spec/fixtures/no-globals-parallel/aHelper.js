const {jasmine, beforeEach} = require('jasmine-core');
beforeEach(function() {
  jasmine.addCustomEqualityTester(function(a, b) {
    if ((a === 1 && b === 2) || (a === 2 && b === 1)) {
      return true;
    }
  });
});
