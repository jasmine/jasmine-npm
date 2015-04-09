// Ideally this file will just export a single function that exits correctly
module.exports = {
  useTheRealThing: function(code) {
    process.exit(code);
  },

  useNodeExit: function(code) {
    var exit = require('exit');

    exit(code);
  },

  justSetTheExitCode: function(code) {
    process.exitCode = code;
  },

  likeNodeExitButWritesFurtherOutput: function(code) {
    if (needToWaitForFlush()) {
      var streams = [process.stdout, process.stderr],
      drainCount = 0;

      function tryToExit() {
        if (drainCount === streams.length) {
          process.exit(code);
        }
      }

      streams.forEach(function(stream) {
        if (stream.bufferSize === 0) {
          drainCount++;
        } else {
          stream.write('', 'utf-8', function() {
            drainCount++;
            tryToExit();
          });
        }

        var write = stream.write;

        stream.write = function() {
          // node-exit makes stream.write be an empty function thus not allowing any writing by another exit handler
          // of course doing this would basically be the same as not clobbering stream.write
          write.call(stream, 'stream written with: ' + arguments[0]);
        };
      });

      tryToExit();

      process.on('exit', function() {
        process.exit(code);
      });
    } else {
      process.exit(code);
    }
  },

  // I'm leaning towards this as the solution since it should properly wait until
  whatGruntDoes: function(code) {
    if (needToWaitForFlush() && process.stdout._pendingWriteReqs || process.stderr._pendingWriteReqs) {
      process.nextTick(function() {
        process.exit(code);
      });
    } else {
      process.exit(code);
    }
  }
};

function olderThan12() {
  var version = process.version.split('.');

  return parseInt(version[0], 10) <= 0 && parseInt(version[1], 10) < 12;
}

function needToWaitForFlush() {
  var isWindows = /^win/;
  return isWindows.test(process.platform) && olderThan12();
}
