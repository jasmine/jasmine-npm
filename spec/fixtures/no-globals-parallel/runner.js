const ParallelRunner = require('../../../lib/parallel_runner.js');
const runner = new ParallelRunner({
  globals: false,
  numWorkers: 2
});
runner.addHelperFile('./aHelper.js');
runner.addSpecFile('./aSpec.js');
runner.execute();
