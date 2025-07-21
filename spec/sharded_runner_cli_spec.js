const { spawn } = require('child_process');

describe('jasmine-sharded CLI', function() {
  function runShardedCli(args, cwd = '.') {
    return new Promise((resolve) => {
      const path = require('path');
      const cliPath = path.join(__dirname, '..', 'bin', 'jasmine-sharded.js');
      const cliArgs = [cliPath].concat(args);
      const child = spawn('node', cliArgs, {
        cwd,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          exitCode: code,
          output: stdout + stderr,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });
    });
  }

  describe('argument parsing', function() {
    it('shows help with --help', async function() {
      const result = await runShardedCli(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage: jasmine-sharded');
      expect(result.stdout).toContain('--shard=N/M');
    });

    it('shows help with -h', async function() {
      const result = await runShardedCli(['-h']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage: jasmine-sharded');
    });

    it('requires shard argument', async function() {
      const result = await runShardedCli([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--shard argument is required');
    });

    it('rejects invalid shard format', async function() {
      const result = await runShardedCli(['--shard=invalid']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid shard format');
    });

    it('rejects shard index of 0', async function() {
      const result = await runShardedCli(['--shard=0/4']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid shard index: 0');
    });

    it('rejects shard index greater than total', async function() {
      const result = await runShardedCli(['--shard=5/4']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid shard index: 5');
    });

    it('accepts valid shard format', async function() {
      const result = await runShardedCli(['--shard=1/4'], 'spec/fixtures/sample_project');

      // Should not fail on argument parsing (though may fail on missing specs)
      expect(result.stderr).not.toContain('Invalid shard format');
      expect(result.stderr).not.toContain('Invalid shard index');
    });
  });

  describe('config file handling', function() {
    it('uses default config path', async function() {
      const result = await runShardedCli(['--shard=1/4'], 'lib');

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('Config file not found');
      expect(result.output).toContain('spec/support/jasmine.json');
    });

    it('uses custom config path', async function() {
      const result = await runShardedCli(['--shard=1/4', '--config=nonexistent.json']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Config file not found');
      expect(result.stderr).toContain('nonexistent.json');
    });

    it('handles missing config file gracefully', async function() {
      const result = await runShardedCli(['--shard=1/4'], 'lib');

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('Config file not found');
      // Should not crash or show stack trace
      expect(result.output).not.toContain('at ');
    });
  });

  describe('1-based to 0-based conversion', function() {
    it('converts 1-based input to 0-based internally', async function() {
      const result = await runShardedCli(['--shard=1/2'], 'spec/fixtures/sample_project');

      // Should not fail on conversion
      expect(result.stdout).toContain('Running shard 1/2');
      expect(result.stdout).toContain('Loaded');
      expect(result.stdout).toContain('spec files for this shard');
    });

    it('handles edge case of last shard', async function() {
      const result = await runShardedCli(['--shard=2/2'], 'spec/fixtures/sample_project');

      expect(result.stdout).toContain('Running shard 2/2');
      expect(result.stdout).toContain('Loaded');
    });
  });

  describe('output formatting', function() {
    it('shows shard information', async function() {
      const result = await runShardedCli(['--shard=1/4'], 'spec/fixtures/sample_project');

      expect(result.stdout).toContain('Running shard 1/4');
      expect(result.stdout).toContain('Loaded');
      expect(result.stdout).toContain('spec files for this shard');
    });

    it('handles empty shard gracefully', async function() {
      // Use a high shard count to ensure some shards will be empty
      const result = await runShardedCli(['--shard=4/4'], 'spec/fixtures/sample_project');

      if (result.stdout.includes('No spec files to run')) {
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Running shard 4/4');
        expect(result.stdout).toContain('No spec files to run in this shard');
      } else {
        // If this shard isn't empty, that's also valid
        expect(result.stdout).toContain('Running shard 4/4');
        expect(result.stdout).toContain('Loaded');
      }
    });
  });
});
