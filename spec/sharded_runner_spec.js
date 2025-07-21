const path = require('path');
const ShardedRunner = require('../lib/sharded_runner');

describe('ShardedRunner', function() {
  beforeEach(function() {
    this.mockEnv = {
      configure: function() {},
      addReporter: function() {},
      execute: function() {
        return Promise.resolve({ overallStatus: 'passed' });
      }
    };

    this.mockJasmineInterface = {
      jasmine: { 
        getEnv: function() {
          return this.mockEnv;
        }.bind(this)
      },
      describe: function() {},
      it: function() {},
      beforeEach: function() {},
      afterEach: function() {}
    };

    this.mockJasmineCore = {
      noGlobals: function() {
        return this.mockJasmineInterface;
      }.bind(this)
    };

    this.runner = new ShardedRunner({
      jasmineCore: this.mockJasmineCore,
      shardIndex: 0,
      shardCount: 4
    });

    this.originalExistsSync = require('fs').existsSync;
    this.originalReadFileSync = require('fs').readFileSync;
    this.originalGlobSync = require('glob').sync;
    
    require('fs').existsSync = function() { return true; };
    require('fs').readFileSync = function() { return '{}'; };
    require('glob').sync = function() { return []; };
  });

  afterEach(function() {
    require('fs').existsSync = this.originalExistsSync;
    require('fs').readFileSync = this.originalReadFileSync;
    require('glob').sync = this.originalGlobSync;
  });

  describe('constructor', function() {
    it('initializes with provided options', function() {
      const runner = new ShardedRunner({
        jasmineCore: this.mockJasmineCore,
        shardIndex: 2,
        shardCount: 8
      });

      expect(runner.jasmineCore).toBe(this.mockJasmineCore);
      expect(runner.shardIndex).toBe(2);
      expect(runner.shardCount).toBe(8);
      expect(runner.exitOnCompletion).toBe(true);
    });

    it('sets default values', function() {
      expect(this.runner.specFiles).toEqual([]);
      expect(this.runner.helperFiles).toEqual([]);
      expect(this.runner.requireFiles).toEqual([]);
      expect(this.runner.specDir).toBe('spec');
    });
  });

  describe('filterFilesToShard', function() {
    it('returns empty array for empty input', function() {
      expect(this.runner.filterFilesToShard([])).toEqual([]);
      expect(this.runner.filterFilesToShard(null)).toEqual([]);
    });

    it('distributes files using round-robin algorithm', function() {
      const files = [
        'spec1.js', 'spec2.js', 'spec3.js', 'spec4.js',
        'spec5.js', 'spec6.js', 'spec7.js', 'spec8.js'
      ];

      this.runner.shardIndex = 0;
      this.runner.shardCount = 4;
      const shard0Files = this.runner.filterFilesToShard(files);
      expect(shard0Files).toEqual(['spec1.js', 'spec5.js']);

      this.runner.shardIndex = 1;
      const shard1Files = this.runner.filterFilesToShard(files);
      expect(shard1Files).toEqual(['spec2.js', 'spec6.js']);

      this.runner.shardIndex = 2;
      const shard2Files = this.runner.filterFilesToShard(files);
      expect(shard2Files).toEqual(['spec3.js', 'spec7.js']);

      this.runner.shardIndex = 3;
      const shard3Files = this.runner.filterFilesToShard(files);
      expect(shard3Files).toEqual(['spec4.js', 'spec8.js']);
    });

    it('handles uneven distribution correctly', function() {
      const files = ['spec1.js', 'spec2.js', 'spec3.js', 'spec4.js', 'spec5.js'];

      this.runner.shardCount = 3;

      this.runner.shardIndex = 0;
      expect(this.runner.filterFilesToShard(files)).toEqual(['spec1.js', 'spec4.js']);

      this.runner.shardIndex = 1;
      expect(this.runner.filterFilesToShard(files)).toEqual(['spec2.js', 'spec5.js']);

      this.runner.shardIndex = 2;
      expect(this.runner.filterFilesToShard(files)).toEqual(['spec3.js']);
    });

    it('sorts files deterministically before distribution', function() {
      const unsortedFiles = ['zebra.js', 'apple.js', 'banana.js', 'cherry.js'];
      const expectedSortedOrder = ['apple.js', 'cherry.js', , 'banana.js', 'zebra.js'];

      this.runner.shardIndex = 0;
      this.runner.shardCount = 2;

      const result = this.runner.filterFilesToShard(unsortedFiles);
      expect(result).toEqual(expectedSortedOrder.slice(0,2));
    });

    it('handles more shards than files', function() {
      const files = ['spec1.js', 'spec2.js'];
      this.runner.shardCount = 4;

      this.runner.shardIndex = 0;
      expect(this.runner.filterFilesToShard(files)).toEqual(['spec1.js']);

      this.runner.shardIndex = 1;
      expect(this.runner.filterFilesToShard(files)).toEqual(['spec2.js']);

      this.runner.shardIndex = 2;
      expect(this.runner.filterFilesToShard(files)).toEqual([]);

      this.runner.shardIndex = 3;
      expect(this.runner.filterFilesToShard(files)).toEqual([]);
    });
  });

  describe('loadConfigFile', function() {
    it('loads valid configuration file', async function() {
      const config = {
        spec_dir: 'spec',
        spec_files: ['*_spec.js'],
        helpers: ['helper.js'],
        requires: ['some-module'],
        random: true,
        seed: 12345
      };

      require('fs').readFileSync = function() { return JSON.stringify(config); };
      require('glob').sync = function() { 
        return ['/abs/path/test1_spec.js', '/abs/path/test2_spec.js', '/abs/path/helper.js'];
      };

      await this.runner.loadConfigFile('jasmine.json');

      expect(this.runner.specDir).toBe('spec');
      expect(this.runner.requireFiles).toEqual(['some-module']);
      expect(this.runner.jasmineConfig.random).toBe(true);
      expect(this.runner.jasmineConfig.seed).toBe(12345);
    });

    it('throws error for non-existent config file', async function() {
      require('fs').existsSync = function() { return false; };

      await expectAsync(this.runner.loadConfigFile('nonexistent.json'))
        .toBeRejectedWithError(/Config file not found/);
    });

    it('throws error for invalid JSON', async function() {
      require('fs').readFileSync = function() { return '{ invalid json }'; };

      await expectAsync(this.runner.loadConfigFile('invalid.json'))
        .toBeRejectedWithError(/Failed to parse config file/);
    });

    it('applies shard filtering only to spec files', async function() {
      const config = {
        spec_dir: 'spec',
        spec_files: ['*_spec.js'],
        helpers: ['helper.js']
      };

      require('fs').readFileSync = function() { return JSON.stringify(config); };
      
      require('glob').sync = function(pattern) {
        if (pattern === '*_spec.js') {
          return ['/abs/path/test1_spec.js', '/abs/path/test2_spec.js'];
        } else if (pattern === 'helper.js') {
          return ['/abs/path/helper.js'];
        }
        return [];
      };

      this.runner.shardIndex = 0;
      this.runner.shardCount = 2;

      await this.runner.loadConfigFile('jasmine.json');

      expect(this.runner.specFiles.length).toBe(1);
      expect(this.runner.helperFiles.length).toBe(1);
      expect(this.runner.helperFiles[0]).toMatch(/helper\.js$/);
    });
  });

  describe('addMatchingFiles', function() {
    it('finds files matching include patterns', function() {
      this.runner.specDir = 'spec';
      require('glob').sync = function() { return ['/abs/path/test1.js', '/abs/path/test2.js']; };
      
      const files = this.runner.addMatchingFiles(['test*.js']);

      expect(files.length).toBe(2);
      expect(files.some(f => f.includes('test1.js'))).toBe(true);
      expect(files.some(f => f.includes('test2.js'))).toBe(true);
    });

    it('excludes files matching exclude patterns', function() {
      this.runner.specDir = 'spec';
      require('glob').sync = function() { return ['/abs/path/test1.js', '/abs/path/test2.js']; };
      
      const files = this.runner.addMatchingFiles(['*.js', '!ignore_*.js']);

      expect(files.length).toBe(2);
      expect(files.some(f => f.includes('ignore_me.js'))).toBe(false);
    });

    it('returns absolute paths', function() {
      this.runner.specDir = 'spec';
      require('glob').sync = function() { return ['/abs/path/test1.js']; };
      
      const files = this.runner.addMatchingFiles(['test1.js']);

      expect(files.length).toBe(1);
      expect(path.isAbsolute(files[0])).toBe(true);
    });

    it('removes duplicates', function() {
      this.runner.specDir = 'spec';
      require('glob').sync = function() { return ['/abs/path/test1.js', '/abs/path/test2.js']; };
      
      const files = this.runner.addMatchingFiles(['test1.js', 'test*.js']);

      const test1Files = files.filter(f => f.includes('test1.js'));
      expect(test1Files.length).toBe(1);
    });
  });

  describe('execute', function() {
    it('sets up jasmine environment correctly', async function() {
      this.runner.exitOnCompletion = false;

      const result = await this.runner.execute();

      expect(result).toBeDefined();
      expect(result.overallStatus).toBe('passed');
    });

    it('sets up global functions', async function() {
      this.runner.exitOnCompletion = false;

      await this.runner.execute();

      expect(typeof globalThis.describe).toBe('function');
      expect(typeof globalThis.it).toBe('function');
      expect(typeof globalThis.beforeEach).toBe('function');
      expect(typeof globalThis.afterEach).toBe('function');
    });

    it('handles execution without errors', async function() {
      this.runner.exitOnCompletion = false;

      await expectAsync(this.runner.execute()).toBeResolved();
    });

    it('handles require files without errors', async function() {
      this.runner.requireFiles = [];
      this.runner.exitOnCompletion = false;

      await expectAsync(this.runner.execute()).toBeResolved();
    });
  });

  describe('mathematical distribution correctness', function() {
    it('distributes 108 files across 4 shards correctly', function() {
      const files = Array.from({length: 108}, (_, i) => `spec${i + 1}.js`);

      const results = [];
      for (let shard = 0; shard < 4; shard++) {
        this.runner.shardIndex = shard;
        this.runner.shardCount = 4;
        const shardFiles = this.runner.filterFilesToShard(files);
        results.push(shardFiles.length);
      }

      expect(results).toEqual([27, 27, 27, 27]);
    });

    it('distributes 108 files across 8 shards correctly', function() {
      const files = Array.from({length: 108}, (_, i) => `spec${i + 1}.js`);

      const results = [];
      for (let shard = 0; shard < 8; shard++) {
        this.runner.shardIndex = shard;
        this.runner.shardCount = 8;
        const shardFiles = this.runner.filterFilesToShard(files);
        results.push(shardFiles.length);
      }

      const expected = [14, 14, 14, 14, 13, 13, 13, 13];
      expect(results).toEqual(expected);
    });

    it('ensures all files are distributed exactly once', function() {
      const files = Array.from({length: 25}, (_, i) => `spec${i + 1}.js`);
      const shardCount = 4;

      const allShardFiles = [];
      for (let shard = 0; shard < shardCount; shard++) {
        this.runner.shardIndex = shard;
        this.runner.shardCount = shardCount;
        const shardFiles = this.runner.filterFilesToShard(files);
        allShardFiles.push(...shardFiles);
      }

      expect(allShardFiles.sort()).toEqual(files.sort());
    });

    it('maintains deterministic ordering across multiple runs', function() {
      const files = ['zebra.js', 'apple.js', 'banana.js', 'cherry.js'];
      this.runner.shardIndex = 0;
      this.runner.shardCount = 2;

      const result1 = this.runner.filterFilesToShard(files);
      const result2 = this.runner.filterFilesToShard(files);

      expect(result1).toEqual(result2);
    });
  });
});
