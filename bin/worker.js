const cluster = require('node:cluster');
const ParallelWorker = require('../lib/parallel_worker');
const Loader = require('../lib/loader');

const loader = new Loader();
new ParallelWorker({loader, clusterWorker: cluster.worker});
