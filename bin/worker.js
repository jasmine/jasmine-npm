const cluster = require('node:cluster');
const ParallelWorker = require('../lib/parallel_worker');
const Loader = require('../lib/loader');

new ParallelWorker({
  loader: new Loader(),
  process,
  clusterWorker: cluster.worker
});
