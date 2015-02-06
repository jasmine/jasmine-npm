var fs = require('fs'),
  path = require('path');

var Command = require('../lib/command');

var projectBaseDir = 'spec/fixtures/sample_empty_project/';
var spec = path.join(projectBaseDir, 'spec');

function deleteDirectory(dir) {
  if(fs.existsSync(dir)) {
    var dirFiles = fs.readdirSync(dir);
    dirFiles.forEach(function(file) {
      var fullPath = path.join(dir, file);
      if(fs.statSync(fullPath).isDirectory()) {
        deleteDirectory(fullPath);
      }
      else if(fs.statSync(fullPath).isFile()){
        fs.unlinkSync(fullPath);
      }
    });
    fs.rmdirSync(dir);
  }
}

describe('command', function() {
  beforeEach(function() {
    var examplesDir = path.resolve(path.join(__dirname, 'fixtures', 'example'));

    fs.mkdirSync(projectBaseDir);
    this.command = new Command(projectBaseDir, examplesDir);

    this.fakeJasmine = jasmine.createSpyObj('jasmine', ['loadConfigFile', 'configureDefaultReporter', 'execute']);
  });

  afterEach(function() {
    deleteDirectory(projectBaseDir);
  });

  describe('passing in environment variables', function() {
    beforeEach(function () {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'TESTKEY=TESTVALUE']);
    });

    afterEach(function() {
      delete process.env.TESTKEY;
    });

    it('should run with those environment variables', function() {
      expect(process.env.TESTKEY).toBe('TESTVALUE');
    });
  });

  describe('init', function() {
    beforeEach(function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'init']);
    });

    it('creates setup folders and files for specs', function() {
      expect(fs.existsSync(path.join(spec, 'support/', 'jasmine.json'))).toBe(true);
    });

    it('writes default settings to jasmine.json', function() {
      var realJson = fs.readFileSync(path.join(spec, 'support/', 'jasmine.json'), 'utf-8');
      var fixtureJson = fs.readFileSync(path.join(__dirname, '../', 'lib/', 'examples/', 'jasmine.json'), 'utf-8');
      expect(realJson).toEqual(fixtureJson);
    });
  });

  describe('examples', function() {
    beforeEach(function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'examples']);
    });

    it('should create init files if they do not exist', function() {
      expect(fs.existsSync(path.join(spec, 'jasmine_examples'))).toBe(true);
      expect(fs.existsSync(path.join(projectBaseDir, 'lib', 'jasmine_examples'))).toBe(true);
      expect(fs.existsSync(path.join(spec, 'helpers', 'jasmine_examples'))).toBe(true);
    });

    it('should copy files into the appropriate folder', function() {
      expect(fs.existsSync(path.join(projectBaseDir, 'lib', 'jasmine_examples', 'Foo.js'))).toBe(true);
      expect(fs.existsSync(path.join(projectBaseDir, 'lib', 'jasmine_examples', 'Bar.js'))).toBe(true);
      expect(fs.existsSync(path.join(spec, 'jasmine_examples', 'FooSpec.js'))).toBe(true);
      expect(fs.existsSync(path.join(spec, 'helpers', 'jasmine_examples', 'SpecHelper.js'))).toBe(true);
    });
  });

  describe('running specs', function() {
    beforeEach(function() {
      this.originalConfigPath = process.env.JASMINE_CONFIG_PATH;
    });

    afterEach(function() {
      process.env.JASMINE_CONFIG_PATH = this.originalConfigPath;
    });

    it('should load the default config file', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
      expect(this.fakeJasmine.loadConfigFile).toHaveBeenCalledWith(undefined);
    });

    it('should load a custom config file', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', 'JASMINE_CONFIG_PATH=somewhere.json']);
      expect(this.fakeJasmine.loadConfigFile).toHaveBeenCalledWith('somewhere.json');
    });

    it('should show colors by default', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
      expect(this.fakeJasmine.configureDefaultReporter).toHaveBeenCalledWith({ showColors: true });
    });

    it('should allow colors to be turned off', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js', '--no-color']);
      expect(this.fakeJasmine.configureDefaultReporter).toHaveBeenCalledWith({ showColors: false });
    });

    it('should execute the jasmine suite', function() {
      this.command.run(this.fakeJasmine, ['node', 'bin/jasmine.js']);
      expect(this.fakeJasmine.execute).toHaveBeenCalled();
    });

    it('should be able to run only specified specs', function() {
      this.command.run(this.fakeJasmine, ['spec/some/fileSpec.js', 'SOME_ENV=SOME_VALUE', '--some-option']);
      expect(this.fakeJasmine.execute).toHaveBeenCalledWith(['spec/some/fileSpec.js']);
    });
  });
});
