const ParallelRunner = require('../../lib/parallel_runner');

beforeAll(function() {
  ParallelRunner.__in_own_specs__ = true;
});
