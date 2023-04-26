const jasmineInterface = require('jasmine-core').noGlobals();
const {it, expect} = jasmineInterface;

it('can use equality testers defined in a different file', function() {
  expect(1).toEqual(2);
});

it('does not add any globals', function() {
  const jasmineGlobals = Object.keys(jasmineInterface)
    .filter(k => global[k] !== undefined);
  expect(jasmineGlobals).toEqual([]);
});
