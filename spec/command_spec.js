var fs = require('fs'),
  path = require('path');

var Command = require('../lib/command');

var projectBaseDir = 'spec/fixtures/sample_empty_project/';
var spec = path.join(projectBaseDir, 'spec/');

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
  var fakeJasmine, command;

  beforeEach(function() {
    fs.mkdirSync(projectBaseDir);
    command = new Command(projectBaseDir);

    fakeJasmine = jasmine.createSpyObj('jasmine', ['loadConfigFile', 'configureDefaultReporter', 'execute']);
  });

  afterEach(function() {
    deleteDirectory(projectBaseDir);
  });

  describe('passing in environment variables', function() {
    beforeEach(function () {
      command.run(fakeJasmine, ['node', 'jasmine.js', 'TESTKEY=TESTVALUE']);
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
      command.run(fakeJasmine, ['node', 'jasmine.js', 'init']);
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
      command.run(fakeJasmine, ['node', 'jasmine.js', 'examples']);
    });

    it('should create init files if they don\'t exist', function() {
      expect(fs.existsSync(path.join(spec, 'jasmine_examples/'))).toBe(true);
      expect(fs.existsSync(path.join(projectBaseDir, 'jasmine_examples/'))).toBe(true);
      expect(fs.existsSync(path.join(spec, 'helpers/'))).toBe(true);
      expect(fs.existsSync(path.join(spec, 'helpers/jasmine_examples/'))).toBe(true);
    });

    it('should copy files into the appropriate folder', function() {
      expect(fs.existsSync(path.join(projectBaseDir, 'jasmine_examples/', 'Player.js'))).toBe(true);
      expect(fs.existsSync(path.join(projectBaseDir, 'jasmine_examples/', 'Song.js'))).toBe(true);
      expect(fs.existsSync(path.join(spec, 'jasmine_examples/', 'PlayerSpec.js'))).toBe(true);
      expect(fs.existsSync(path.join(spec, 'helpers/', 'jasmine_examples/', 'SpecHelper.js'))).toBe(true);
    });
  });

  describe('running specs', function() {
    var originalConfigPath;
    beforeEach(function() {
      originalConfigPath = process.env.JASMINE_CONFIG_PATH;
    });

    afterEach(function() {
      process.env.JASMINE_CONFIG_PATH = originalConfigPath;
    });

    it('should load the default config file', function() {
      command.run(fakeJasmine, ['node', 'jasmine.js']);
      expect(fakeJasmine.loadConfigFile).toHaveBeenCalledWith(undefined);
    });

    it('should load a custom config file', function() {
      command.run(fakeJasmine, ['node', 'jasmine.js', 'JASMINE_CONFIG_PATH=somewhere.json']);
      expect(fakeJasmine.loadConfigFile).toHaveBeenCalledWith('somewhere.json');
    });

    it('should show colors by default', function() {
      command.run(fakeJasmine, ['node', 'jasmine.js']);
      expect(fakeJasmine.configureDefaultReporter).toHaveBeenCalledWith({ showColors: true });
    });

    it('should allow colors to be turned off', function() {
      command.run(fakeJasmine, ['node', 'jasmine.js', '--no-color']);
      expect(fakeJasmine.configureDefaultReporter).toHaveBeenCalledWith({ showColors: false });
    });

    it('should execute the jasmine suite', function() {
      command.run(fakeJasmine, ['node', 'jasmine.js']);
      expect(fakeJasmine.execute).toHaveBeenCalled();
    });
  });
});
