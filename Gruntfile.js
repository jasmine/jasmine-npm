module.exports = function(grunt) {
  var pkg = require("./package.json");
  global.jasmineVersion = pkg.version;

  grunt.initConfig({
    pkg: pkg,
    jshint: {all: ['lib/**/*.js', 'spec/**/*.js']}
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');

  grunt.registerTask('specs', function() {
    var Jasmine = require('./lib/jasmine.js');
    var jasmine = new Jasmine();

    jasmine.loadConfigFile('./spec/support/jasmine.json');
    jasmine.addReporter({});
    jasmine.execute();
  });

  grunt.registerTask('default', ['jshint:all', 'specs']);
};
