module.exports = function(grunt) {
  var pkg = require("./package.json");
  global.jasmineVersion = pkg.version;
  var versionString = 'v' + pkg.version;

  grunt.initConfig({
    pkg: pkg
  });

  var shell = require('shelljs');
  function runCommands(commands, done) {
    var command = commands.shift();

    if (command) {
      shell.exec(command, function(exitCode) {
        if (exitCode !== 0) {
          grunt.fail.fatal("Command `" + command + "` failed", exitCode);
          done();
        } else {
          runCommands(commands, done);
        }
      });
    } else {
      done();
    }
  }

  grunt.registerTask('release',
                     'Create tag ' + versionString + ' and push jasmine-' + pkg.version + ' to NPM',
                     function() {
    var done = this.async(),
        commands = ['git tag ' + versionString, 'git push origin main --tags', 'npm publish'];

    runCommands(commands, done);
  });

  grunt.loadTasks('tasks');
};
