const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('actual migration: prospective capture, immutability, tenant RLS and verified network access', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retention-pg-'));
  const pgdata = path.join(dir, 'data');
  const psql = execFileSync('which', ['psql'], { encoding: 'utf8' }).trim();
  const bin = path.dirname(psql);
  let started = false;
  const sql = input => execFileSync(psql, ['-h', dir, '-U', 'retention_test', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    execFileSync(path.join(bin, 'initdb'), ['-D', pgdata, '-U', 'retention_test', '-A', 'trust', '--no-locale'], { stdio: 'pipe' });
    execFileSync(path.join(bin, 'pg_ctl'), ['-D', pgdata, '-l', path.join(dir, 'postgres.log'), '-o', `-k ${dir} -c listen_addresses=''`, '-w', 'start'], { stdio: 'pipe' });
    started = true;
    sql(fs.readFileSync(path.join(__dirname, 'fixtures/retention-schema.sql'), 'utf8'));
    sql(fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261120160000_retention_evidence.sql'), 'utf8'));
    const result = sql(fs.readFileSync(path.join(__dirname, 'fixtures/retention-assertions.sql'), 'utf8'));
    assert.match(result, /retention SQL assertions passed/);
  } finally {
    if (started) execFileSync(path.join(bin, 'pg_ctl'), ['-D', pgdata, '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
