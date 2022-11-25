const path = require('path');
const slash = require("slash");
const Loader = require("../lib/loader");

/*
  Preconditions that a beforeEach in the containing suite should provide:
  - this.testJasmine is the subject
  - this.testJasmine.exit is a spy
  - this.execute is a function that executes the env and returns a promise
    that resolves when it's done
  - probably more
 */
function sharedRunnerBehaviors(makeRunner) {
  describe('Shared runner behaviors', function () {
    it('sets projectBaseDir to the cwd by default', function () {
      expect(this.testJasmine.projectBaseDir).toEqual(path.resolve());
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
          const aFile = path.join(this.testJasmine.projectBaseDir, this.testJasmine.specDir, 'spec/command_spec.js');
          expect(this.testJasmine[destProp]).toEqual([]);
          this.testJasmine[method]([aFile]);
          expect(this.testJasmine[destProp]).toEqual([slash(aFile)]);
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
          const aFile = path.join(this.testJasmine.projectBaseDir, this.testJasmine.specDir, 'spec/command_spec.js');
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
        if (!jasmine.isSpy(this.testJasmine.reporter_.setOptions)) {
          spyOn(this.testJasmine.reporter_, 'setOptions');
        }
      });

      it('sets the options on the console reporter', function () {
        const reporterOptions = {
          print: 'printer',
          showColors: true,
        };

        const expectedReporterOptions = Object.keys(reporterOptions).reduce(function (options, key) {
          options[key] = reporterOptions[key];
          return options;
        }, {});

        this.testJasmine.configureDefaultReporter(reporterOptions);

        expect(this.testJasmine.reporter_.setOptions).toHaveBeenCalledWith(expectedReporterOptions);
      });

      it('creates a reporter with a default option if an option is not specified', function () {
        const reporterOptions = {};

        this.testJasmine.configureDefaultReporter(reporterOptions);

        const expectedReporterOptions = {
          print: jasmine.any(Function),
          showColors: true,
        };

        expect(this.testJasmine.reporter_.setOptions).toHaveBeenCalledWith(expectedReporterOptions);
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
            'spec/fixtures/sample_project/spec/fixture_spec.js',
            'spec/fixtures/sample_project/spec/other_fixture_spec.js'
          ]);
          expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
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
          expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
          expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
          expect(this.fixtureJasmine.specFiles).toEqual([
            'spec/fixtures/sample_project/spec/fixture_spec.js',
            'spec/fixtures/sample_project/spec/other_fixture_spec.js'
          ]);
        });

        it('can use an ES module', async function() {
          await this.fixtureJasmine.loadConfigFile('spec/support/jasmine_alternate.mjs');
          expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
          expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
          expect(this.fixtureJasmine.specFiles).toEqual([
            'spec/fixtures/sample_project/spec/fixture_spec.js',
            'spec/fixtures/sample_project/spec/other_fixture_spec.js'
          ]);
        });

        it('can use a CommonJS module', async function() {
          await this.fixtureJasmine.loadConfigFile('spec/support/jasmine_alternate.cjs');
          expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
          expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
          expect(this.fixtureJasmine.specFiles).toEqual([
            'spec/fixtures/sample_project/spec/fixture_spec.js',
            'spec/fixtures/sample_project/spec/other_fixture_spec.js'
          ]);
        });

        it('loads the specified configuration file from an absolute path', async function() {
          const absoluteConfigPath = path.join(__dirname, 'fixtures/sample_project/spec/support/jasmine_alternate.json');
          await this.fixtureJasmine.loadConfigFile(absoluteConfigPath);
          expect(this.fixtureJasmine.helperFiles).toEqual(['spec/fixtures/sample_project/spec/helper.js']);
          expect(this.fixtureJasmine.requires).toEqual(['ts-node/register']);
          expect(this.fixtureJasmine.specFiles).toEqual([
            'spec/fixtures/sample_project/spec/fixture_spec.js',
            'spec/fixtures/sample_project/spec/other_fixture_spec.js'
          ]);
        });

        it("throws an error if the specified configuration file doesn't exist", async function() {
          await expectAsync(this.fixtureJasmine.loadConfigFile('missing.json')).toBeRejected();
        });

        it("does not throw if the default configuration files don't exist", async function() {
          this.fixtureJasmine.projectBaseDir += '/missing';
          await expectAsync(this.fixtureJasmine.loadConfigFile()).toBeResolved();
        });

        it('loads the default .json configuration file', async function() {
          await this.fixtureJasmine.loadConfigFile();
          expect(this.fixtureJasmine.specFiles).toEqual([
            jasmine.stringMatching('^spec[\\/]fixtures[\\/]sample_project[\\/]spec[\\/]fixture_spec.js$')
          ]);
        });

        it('loads the default .js configuration file', async function() {
          const config = require('./fixtures/sample_project/spec/support/jasmine.json');
          spyOn(Loader.prototype, 'load').and.callFake(function(path) {
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
            'spec/fixtures/sample_project/spec/fixture_spec.js'
          ]);
        });
      });
    });

    // describe('#execute', function() {
    //   it('uses the default console reporter if no reporters were added', async function () {
    //     spyOn(this.testJasmine, 'configureDefaultReporter');
    //
    //     await this.execute();
    //
    //     expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalledWith({
    //       showColors: true,
    //       alwaysListPendingSpecs: true
    //     });
    //   });
    //
    //   it('configures the default console reporter with the right color settings', async function() {
    //     spyOn(this.testJasmine, 'configureDefaultReporter');
    //     this.testJasmine.showColors(false);
    //     this.testJasmine.alwaysListPendingSpecs(false);
    //
    //     await this.execute();
    //
    //     expect(this.testJasmine.configureDefaultReporter).toHaveBeenCalledWith({
    //       showColors: false,
    //       alwaysListPendingSpecs: false
    //     });
    //   });
    //
    //   it('does not configure the default reporter if this was already done', async function() {
    //     this.testJasmine.configureDefaultReporter({showColors: false});
    //
    //     spyOn(this.testJasmine, 'configureDefaultReporter');
    //
    //     await this.execute();
    //
    //     expect(this.testJasmine.configureDefaultReporter).not.toHaveBeenCalled();
    //   });
    //
    //   it('can run only specified files', async function() {
    //     await this.execute({
    //       executeArgs: [['spec/fixtures/sample_project/**/*spec.js']]
    //     });
    //
    //     const relativePaths = this.testJasmine.specFiles.map(function(filePath) {
    //       return slash(path.relative(__dirname, filePath));
    //     });
    //
    //     expect(relativePaths).toEqual(['fixtures/sample_project/spec/fixture_spec.js', 'fixtures/sample_project/spec/other_fixture_spec.js']);
    //   });
    //
    //   describe('completion behavior', function() {
    //     beforeEach(function() {
    //       spyOn(this.testJasmine, 'exit');
    //     });
    //
    //     describe('default', function() {
    //       it('exits successfully when the whole suite is green', async function () {
    //         await this.execute({overallStatus: 'passed'});
    //         expect(this.testJasmine.exit).toHaveBeenCalledWith(0);
    //       });
    //
    //       it('exits with a distinct status code when anything in the suite is not green', async function () {
    //         await this.execute({overallStatus: 'failed'});
    //         expect(this.testJasmine.exit).toHaveBeenCalledWith(3);
    //       });
    //
    //       it('exits with a distinct status code when anything in the suite is focused', async function() {
    //         await this.execute({overallStatus: 'incomplete'});
    //         expect(this.testJasmine.exit).toHaveBeenCalledWith(2);
    //       });
    //     });
    //
    //     describe('When exitOnCompletion is set to false', function() {
    //       it('does not exit', async function() {
    //         this.testJasmine.exitOnCompletion = false;
    //         await this.execute();
    //         expect(this.testJasmine.exit).not.toHaveBeenCalled();
    //       });
    //     });
    //   });
    // });
  });
}

module.exports = sharedRunnerBehaviors;
