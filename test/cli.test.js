import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { after, before, test } from 'node:test';
import { formatFor, main, parseArgs } from '../src/cli.js';
import { badSite, goodSite } from './support/fixtures.js';
import { startServer } from './support/server.js';

const run = promisify(execFile);
const BIN = fileURLToPath(new URL('../bin/site-audit.js', import.meta.url));
let good;
let bad;
let dir;

before(async () => {
  good = await startServer(goodSite());
  bad = await startServer(badSite());
  dir = await mkdtemp(join(tmpdir(), 'site-audit-'));
});
after(async () => {
  await good.close();
  await bad.close();
  await rm(dir, { recursive: true, force: true });
});

function capture() {
  const out = [];
  const err = [];
  return { io: { stdout: (t) => out.push(t), stderr: (t) => err.push(t) }, out, err };
}

async function cli(args) {
  try {
    const { stdout, stderr } = await run(process.execPath, [BIN, ...args]);
    return { code: 0, stdout, stderr };
  } catch (e) {
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

test('parseArgs handles flags, inline values and repeats', () => {
  const a = parseArgs(['https://e.test', '--max-pages', '5', '--out=a.html', '--out', 'b.json', '--quiet']);
  assert.equal(a.url, 'https://e.test');
  assert.equal(a.maxPages, '5');
  assert.deepEqual(a.out, ['a.html', 'b.json']);
  assert.equal(a.quiet, true);
  assert.throws(() => parseArgs(['--nope']), /Unknown option/);
  assert.throws(() => parseArgs(['a', 'b']), /Unexpected argument/);
  assert.throws(() => parseArgs(['--out']), /needs a value/);
});

test('formatFor infers from extension', () => {
  assert.equal(formatFor('r.html'), 'html');
  assert.equal(formatFor('r.MD'), 'md');
  assert.equal(formatFor('r.json'), 'json');
  assert.equal(formatFor('r.txt', 'html'), 'html');
  assert.throws(() => formatFor('r.txt'), /report format/);
});

test('--help and --version exit 0', async () => {
  const help = await cli(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /Usage:/);
  const version = await cli(['--version']);
  assert.equal(version.code, 0);
  assert.match(version.stdout, /^\d+\.\d+\.\d+/);
});

test('missing URL and bad options exit 2 with a message', async () => {
  const none = capture();
  assert.equal(await main([], none.io), 2);
  assert.match(none.err.join(''), /URL is required/);
  const bad1 = capture();
  assert.equal(await main(['http://127.0.0.1:1', '--max-pages', 'abc'], bad1.io), 2);
  assert.match(bad1.err.join(''), /--max-pages/);
  const bad2 = capture();
  assert.equal(await main(['http://127.0.0.1:1', '--out', 'x.unknown'], bad2.io), 2);
});

test('end to end: writes html, markdown and json reports', async () => {
  const html = join(dir, 'nested', 'report.html');
  const md = join(dir, 'report.md');
  const json = join(dir, 'report.json');
  const r = await cli([bad.url, '--delay', '0', '--out', html, '--out', md, '--out', json, '--no-color']);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /Score \d+\/100/);
  assert.match(await readFile(html, 'utf8'), /<!doctype html>/);
  assert.match(await readFile(md, 'utf8'), /^# Site audit/);
  const parsed = JSON.parse(await readFile(json, 'utf8'));
  assert.equal(parsed.tool, 'site-audit-lite');
  assert.ok(parsed.findings.length > 5);
});

test('--fail-under sets the exit code', async () => {
  const fail = await cli([bad.url, '--delay', '0', '--quiet', '--fail-under', '95']);
  assert.equal(fail.code, 1);
  assert.equal(fail.stdout, '');
  const pass = await cli([good.url, '--delay', '0', '--quiet', '--fail-under', '95']);
  assert.equal(pass.code, 0, pass.stderr);
});

test('unreachable site exits 2', async () => {
  const dead = await startServer({});
  const url = dead.url;
  await dead.close();
  const r = await cli([url, '--delay', '0']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /Could not fetch/);
});
