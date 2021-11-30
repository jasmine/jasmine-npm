const initialGlobals = Object.keys(global);
const Jasmine = require('../../../lib/jasmine.js');
const {jasmine, beforeEach} = require('jasmine-core').noGlobals();
beforeEach(function() {
  jasmine.addCustomEqualityTester(function(a, b) {
    if ((a === 1 && b === 2) || (a === 2 && b === 1)) {
      return true;
    }
  });
});

const runner = new Jasmine({globals: false});
runner.addSpecFile('./aSpec.js');
runner.exitOnCompletion = false;
runner.execute().then(function() {
  const extraGlobals = Object.keys(global).filter(k => !initialGlobals.includes(k));

  if (extraGlobals.length === 0) {
    console.log('Globals OK');
  } else {
    console.log('Extra globals:', extraGlobals);
  }
});
