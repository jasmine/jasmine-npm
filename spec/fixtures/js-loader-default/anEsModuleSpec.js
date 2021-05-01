import {foo} from './anEsModule.js';

describe('foo', function() {
  it('returns 42', function() {
    expect(foo()).toEqual(42);
  });
});
