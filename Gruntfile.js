module.exports = function(grunt) {
  var pkg = require("./package.json");
  global.jasmineVersion = pkg.version;

  grunt.initConfig({
    pkg: pkg,
    jshint: {all: ['src/**/*.js']},
    copy: {
      lib: {
        files: [
          {expand: true, cwd: 'src', src: ['**/*.js'], dest: 'lib/'}
        ]
      }
    }
  });

  require('load-grunt-tasks')(grunt);

  grunt.registerTask('specs', function() {
    var execFile = require("child_process").execFile;
    var done = this.async();

    var child = execFile('./bin/jasmine', done);

    child.stdout.on('data', function(data) {
      process.stdout.write(data);
    });
  });

  grunt.registerTask('default', ['jshint:all', 'specs']);

  grunt.registerTask('buildDistribution',
    'Builds and lints the files needed for jasmine-node',
    ['jshint:all', 'copy:lib']
  );

};
