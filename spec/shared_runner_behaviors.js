const path = require('path');
const Loader = require("../lib/loader");

/*
  Preconditions that a beforeEach in the containing suite should provide:
  - this.testJasmine is the subject
  - this.testJasmine.exit is a spy
  - this.execute is a function that executes the env and returns a promise
    that resolves when it's done

    Not all shared behaviors are tested here. Many are separately tested in
    jasmine_spec.js and parallel_runner_spec.js because the code resulting
    from de-duplication would be excessively complex.
 */
function sharedRunnerBehaviors(makeRunner) {
  describe('Shared runner behaviors', function () {
    it('sets projectBaseDir to the cwd by default', function () {
      expect(this.testJasmine.projectBaseDir).toEqual(
        path.resolve().replace(/\\/g, '/')
      );
    });

    describe('#addSpecFile', function () {
      it('adds the provided path to the list of spec files', function () {
        expect(this.testJasmine.specFiles).toEqual([]);
        this.testJasmine.addSpecFile('some/file/path.js');
        expect(this.testJasmine.specFiles).toEqual(['some/file/path.js']);
      });
    });

    describe('#addHelperFile', function () {
      it('adds the provided path to the list of helper files', function () {
        expect(this.testJasmine.helperFiles).toEqual([]);
        this.testJasmine.addHelperFile('some/file/path.js');
        expect(this.testJasmine.helperFiles).toEqual(['some/file/path.js']);
      });
    });

    describe('Methods that specify files via globs', function () {
      describe('#addMatchingSpecFiles', function () {
        hasCommonFileGlobBehavior('addMatchingSpecFiles', 'specFiles');
      });

      describe('#addMatchingHelperFiles', function () {
        hasCommonFileGlobBehavior('addMatchingHelperFiles', 'helperFiles');
      });

      function hasCommonFileGlobBehavior(method, destProp) {
        it('adds a file with an absolute path', function () {
          const aFile = path.join(this.testJasmine.projectBaseDir, this.testJasmine.specDir, 'spec/command_spec.js')
            .replace(/\\/g, '/');
          expect(this.testJasmine[destProp]).toEqual([]);
          this.testJasmine[method]([aFile]);
          const expectedPath = aFile.replace(/\\/g, '/');
          expect(this.testJasmine[destProp]).toEqual([
            pathEndingWith(expectedPath)
          ]);
        });

        it('adds files that match a glob pattern', function () {
          expect(this.testJasmine[destProp]).toEqual([]);
          this.testJasmine[method](['spec/fixtures/jasmine_spec/*.js']);
          expect(this.testJasmine[destProp].map(basename)).toEqual([
            'c.js',
            'd.js',
            'e.js',
            'f.js',
          ]);
        });

        it('can exclude files that match another glob', function () {
          expect(this.testJasmine[destProp]).toEqual([]);
          this.testJasmine[method]([
            'spec/fixtures/jasmine_spec/*.js',
            '!spec/fixtures/jasmine_spec/c*'
          ]);
          expect(this.testJasmine[destProp].map(basename)).toEqual([
            'd.js',
            'e.js',
            'f.js',
          ]);
        });

        it('adds new files to existing files', function () {
          // Don't use path.join because glob needs forward slashes
          // even on Windows
          const aFile = [
            this.testJasmine.projectBaseDir,
            this.testJasmine.specDir,
            'spec/command_spec.js',
          ].join('/');
          this.testJasmine[destProp] = [aFile, 'b'];
          this.testJasmine[method](['spec/fixtures/jasmine_spec/*.js']);
          expect(this.testJasmine[destProp].map(basename)).toEqual([
            'command_spec.js',
            'b',
            'c.js',
            'd.js',
            'e.js',
            'f.js',
          ]);
        });
      }

      function basename(name) {
        return path.basename(name);
      }
    });

    describe('#configureDefaultReporter', function () {
      beforeEach(function () {
        if (!jasmine.isSpy(this.testJasmine.reporter_.configure)) {
          spyOn(this.testJasmine.reporter_, 'configure');
        }
      });

      it('sets the options on the console reporter', function () {
        const reporterOptions = {color: true};

        this.testJasmine.configureDefaultReporter(reporterOptions);

        expect(this.testJasmine.reporter_.configure).toHaveBeenCalledWith({
          ...reporterOptions,
          randomSeedReproductionCmd: jasmine.any(Function)
        });
      });

      it('creates a reporter with a default option if an option is not specified', function () {
        this.testJasmine.configureDefaultReporter({});
        
        expect(this.testJasmine.reporter_.configure).toHaveBeenCalledWith({
          randomSeedReproductionCmd: jasmine.any(Function)
        });
      });
    });

    describe('loading configurations', function () {
      beforeEach(function() {
        this.fixtureJasmine = makeRunner.call(this, {
          projectBaseDir: 'spec/fixtures/sample_project'
        });
      });

      describe('from an object', function () {
        beforeEach(function() {
          this.loader = this.fixtureJasmine.loader = jasmine.createSpyObj('loader', ['load']);
        });

        it('adds unique spec and helper files', function() {
          this.fixtureJasmine.loadConfig({
            spec_dir: 'spec',
            spec_files: [
              'fixture_spec.js',
              '**/*spec.js'
            ],
            helpers: ["helper.js"]
          });
          expect(this.fixtureJasmine.specFiles).toEqual([
            pathEndingWith('spec/fixtures/sample_project/spec/fixture_spec.js'),
            pathEndingWith('spec/fixtures/sample_project/spec/other_fixture_spec.js')
          ]);
          expect(this.fixtureJasmine.helperFiles).toEqual([
            pathEndingWith('spec/fixtures/sample_project/spec/helper.js'
          )]);
        });

        it('sets the spec dir to the provided value', function() {
          this.fixtureJasmine.loadConfig({spec_dir: 'spec'});
          expect(this.fixtureJasmine.specDir).toEqual('spec');
        });

        it('sets the spec dir to the empty string when unspecified', function() {
          this.fixtureJasmine.loadConfig({});
          expect(this.fixtureJasmine.specDir).toEqual('');
        });

        describe('with jsLoader: "require"', function () {
          it('tells the loader not to always import', async function() {
            this.fixtureJasmine.loadConfig({jsLoader: 'require'});
            expect(this.loader.alwaysImport).toBeFalse();
          });
        });

        describe('with jsLoader: "import"', function () {
          it('tells the loader to always import', async function() {
            this.fixtureJasmine.loadConfig({jsLoader: 'import'});
            expect(this.loader.alwaysImport).toBeTrue();
          });
        });

        describe('with jsLoader set to an invalid value', function () {
          it('throws an error', function() {
            expect(() => {
              this.fixtureJasmine.loadConfig({jsLoader: 'bogus'});
            }).toThrowError(/"bogus" is not a valid value/);
          });
        });

        describe('with jsLoader undefined', function () {
          it('tells the loader to always import', async function() {
            this.fixtureJasmine.loadConfig({});
            expect(this.loader.alwaysImport).toBeTrue();
          });
        });

        it('adds requires', function() {
          this.fixtureJasmine.loadConfig({
            spec_dir: 'spec',
            requires: ['ts-node/register']
          });
          expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
        });
      });

      describe('from a file', function () {
        it('adds unique spec files', async function() {
          await this.fixtureJasmine.loadConfigFile('spec/support/jasmine_alternate.json');
          expect(this.fixtureJasmine.helperFiles).toEqual([
            pathEndingWith('spec/fixtures/sample_project/spec/helper.js')
          ]);
          expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
          expect(this.fixtureJasmine.specFiles).toEqual([
            pathEndingWith('spec/fixtures/sample_project/spec/fixture_spec.js'),
            pathEndingWith('spec/fixtures/sample_project/spec/other_fixture_spec.js')
          ]);
        });

        it('can use an ES module', async function() {
          await this.fixtureJasmine.loadConfigFile('spec/support/jasmine_alternate.mjs');
          expect(this.fixtureJasmine.helperFiles).toEqual([
            pathEndingWith('spec/fixtures/sample_project/spec/helper.js')
          ]);
          expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
          expect(this.fixtureJasmine.specFiles).toEqual([
            pathEndingWith('spec/fixtures/sample_project/spec/fixture_spec.js'),
            pathEndingWith('spec/fixtures/sample_project/spec/other_fixture_spec.js')
          ]);
        });

        it('can use a CommonJS module', async function() {
          await this.fixtureJasmine.loadConfigFile('spec/support/jasmine_alternate.cjs');
          expect(this.fixtureJasmine.helperFiles).toEqual([
            pathEndingWith('spec/fixtures/sample_project/spec/helper.js')
          ]);
          expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
          expect(this.fixtureJasmine.specFiles).toEqual([
            pathEndingWith('spec/fixtures/sample_project/spec/fixture_spec.js'),
            pathEndingWith('spec/fixtures/sample_project/spec/other_fixture_spec.js')
          ]);
        });

        it('loads the specified configuration file from an absolute path', async function() {
          const absoluteConfigPath = path.join(__dirname, 'fixtures/sample_project/spec/support/jasmine_alternate.json');
          await this.fixtureJasmine.loadConfigFile(absoluteConfigPath);
          expect(this.fixtureJasmine.helperFiles).toEqual([
            pathEndingWith('spec/fixtures/sample_project/spec/helper.js')
          ]);
          expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
          expect(this.fixtureJasmine.specFiles).toEqual([
            pathEndingWith('spec/fixtures/sample_project/spec/fixture_spec.js'),
            pathEndingWith('spec/fixtures/sample_project/spec/other_fixture_spec.js')
          ]);
        });

        it("throws an error if the specified configuration file doesn't exist", async function() {
          await expectAsync(this.fixtureJasmine.loadConfigFile('missing.json')).toBeRejected();
        });

        it("does not throw if the default configuration files don't exist", async function() {
          this.fixtureJasmine.projectBaseDir += '/missing';
          await expectAsync(this.fixtureJasmine.loadConfigFile()).toBeResolved();
        });

        describe('When the default .mjs configuration file exists', function() {
          it('loads the default .mjs configuration file', async function() {
            const config = require('./fixtures/sample_project/spec/support/jasmine.json');
            spyOn(Loader.prototype, 'load')
              .withArgs(jasmine.stringMatching(/jasmine\.mjs$/))
              .and.returnValue(Promise.resolve(config));

            await this.fixtureJasmine.loadConfigFile();

            expect(Loader.prototype.load).toHaveBeenCalledWith(jasmine.stringMatching(
              'jasmine\.mjs$'
            ));
            expect(this.fixtureJasmine.specFiles).toEqual([
              pathEndingWith('spec/fixtures/sample_project/spec/fixture_spec.js')
            ]);
          });

          it('does not also load the default .js or .json configuration files', async function() {
            spyOn(Loader.prototype, 'load')
              .withArgs(jasmine.stringMatching(/jasmine\.mjs$/))
              .and.returnValue(Promise.resolve({}));

            await this.fixtureJasmine.loadConfigFile();

            expect(Loader.prototype.load).not.toHaveBeenCalledWith(jasmine.stringMatching(
              'jasmine\.js$'
            ));
            expect(Loader.prototype.load).not.toHaveBeenCalledWith(jasmine.stringMatching(
              'jasmine\.json$'
            ));
          });
        });

        describe('When the default .mjs configuration file does not exist', function() {
          it('loads the default .json configuration file', async function () {
            await this.fixtureJasmine.loadConfigFile();
            expect(this.fixtureJasmine.specFiles).toEqual([
              pathEndingWith('spec/fixtures/sample_project/spec/fixture_spec.js')
            ]);
          });

          it('loads the default .js configuration file', async function () {
            const config = require('./fixtures/sample_project/spec/support/jasmine.json');
            spyOn(Loader.prototype, 'load').and.callFake(function (path) {
              if (path.endsWith('jasmine.js')) {
                return Promise.resolve(config);
              } else {
                const e = new Error(`Module not found: ${path}`);
                e.code = 'MODULE_NOT_FOUND';
                return Promise.reject(e);
              }
            });

            await this.fixtureJasmine.loadConfigFile();
            expect(Loader.prototype.load).toHaveBeenCalledWith(jasmine.stringMatching(
              'jasmine\.js$'
            ));
            expect(this.fixtureJasmine.specFiles).toEqual([
              pathEndingWith('spec/fixtures/sample_project/spec/fixture_spec.js')
            ]);
          });

          it('does not load jasmine.js config if jasmine.json config file is found', async function () {
            spyOn(Loader.prototype, 'load').and.callFake(function (path) {
              if (path.endsWith('jasmine.json')) {
                return Promise.resolve({});
              } else {
                const e = new Error(`Module not found: ${path}`);
                e.code = 'MODULE_NOT_FOUND';
                return Promise.reject(e);
              }
            });

            await this.fixtureJasmine.loadConfigFile();

            expect(Loader.prototype.load)
              .toHaveBeenCalledWith(jasmine.stringMatching(/jasmine\.json$/));
            expect(Loader.prototype.load)
              .not.toHaveBeenCalledWith(jasmine.stringMatching(/jasmine\.js$/));
          });
        });
      });
    });

    describe('#execute', function() {
      it('uses the default console reporter if no reporters were added', async function () {
        spyOn(this.testJasmine, 'configureDefaultReporter');

        await this.execute();

        expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalledWith({
          color: undefined,
          alwaysListPendingSpecs: true
        });
      });

      it('configures the default console reporter with the right color settings', async function() {
        spyOn(this.testJasmine, 'configureDefaultReporter');
        this.testJasmine.showColors(false);
        this.testJasmine.alwaysListPendingSpecs(false);

        await this.execute();

        expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalledWith({
          color: false,
          alwaysListPendingSpecs: false
        });
      });

      it('does not configure the default reporter if this was already done', async function() {
        this.testJasmine.configureDefaultReporter({color: false});

        spyOn(this.testJasmine, 'configureDefaultReporter');

        await this.execute();

        expect(this.testJasmine.configureDefaultReporter).not.toHaveBeenCalled();
      });

      describe('completion behavior', function() {
        beforeEach(function() {
          spyOn(this.testJasmine, 'exit');
        });

        describe('default', function() {
          it('exits successfully when the whole suite is green', async function () {
            await this.execute({overallStatus: 'passed'});
            expect(this.testJasmine.exit).toHaveBeenCalledWith(0);
          });

          it('exits with a distinct status code when anything in the suite is not green', async function () {
            await this.execute({overallStatus: 'failed'});
            expect(this.testJasmine.exit).toHaveBeenCalledWith(3);
          });

          it('exits with a distinct status code when anything in the suite is focused', async function() {
            await this.execute({overallStatus: 'incomplete'});
            expect(this.testJasmine.exit).toHaveBeenCalledWith(2);
          });
        });

        describe('When exitOnCompletion is set to false', function() {
          it('does not exit', async function() {
            this.testJasmine.exitOnCompletion = false;
            await this.execute();
            expect(this.testJasmine.exit).not.toHaveBeenCalled();
          });
        });
      });
    });
  });
}

function pathEndingWith(suffix) {
  // Match glob output from either Windows or other OSes.
  const pattern = '(^|[\\/\\\\])' + suffix.replace(/\//g, '[\\/\\\\]') + '$';
  return jasmine.stringMatching(new RegExp(pattern));
}

module.exports = {sharedRunnerBehaviors, pathEndingWith};
