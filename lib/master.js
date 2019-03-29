var cluster = require('cluster'),
    noop = require("./noop");

module.exports = exports = function(jasmine, env, print) {
  var runJasmine = require('./run');  // for spy purpose
  jasmine.execute = noop;
  runJasmine(jasmine, env, print);

  if (env.files && env.files.length > 0) {
    jasmine.specDir = '';
    jasmine.specFiles = [];
    jasmine.addSpecFiles(env.files);
  }

  env.seed = env.seed || String(Math.random()).slice(-5);

  var files = jasmine.specFiles.slice(0).reverse();
  jasmine.configureDefaultReporter({ showColors: env.color });
  clusterReporter(jasmine.reporter);

  cluster.on('message', function(worker, message) {
    if (message.kind === 'jasmineDone') {
      if (files.length) {
        worker.send(clusterEnv(env, files.pop()));
      } else {
        worker.kill();
      }
    }
  });

  for (var i = 0; i < env.workerCount; i++) {
    cluster.fork().send(clusterEnv(env, files.pop()));
  }
};

function clusterEnv(env, file) {
  var clusterEnv = Object.assign({}, env);
  clusterEnv.reporter = './reporters/worker_reporter.js';
  clusterEnv.files = [file];
  return clusterEnv;
}

function clusterReporter(reporter) {
  var results = [];

  cluster.on('message', function(worker, message) {
    if (message.kind === 'jasmineDone') {
      results.push(message.result);
    } else if (reporter[message.kind]) {
      reporter[message.kind](message.result);
      if (message.kind === 'jasmineStarted') {
        delete reporter[message.kind];
      }
    }
  });

  cluster.on('exit', function() {
    if (!Object.keys(cluster.workers).length) {
      reporter.jasmineDone(results);
    }
  });
}