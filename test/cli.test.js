import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

for (const args of [[], ['--unknown'], ['--max-pages', '0'], ['--max-pages', '-1'], ['--max-pages', 'abc']]) {
  test(`CLI usage validation ${JSON.stringify(args)}`, async () => {
    const c = capture();
    const full = args.length && args[0] !== '--unknown' ? [good.url, ...args] : args;
    assert.equal(await main(full, c.io), 2);
    const error = c.err.join('');
    assert.match(error, /Usage:/);
    assert.equal((error.match(/Error:/g) || []).length, 1);
    if (args[0] === '--max-pages') assert.match(error, /--max-pages must be an integer >= 1/);
  });
}

test('--baseline integrates diff reports and --fail-on-new', async () => {
  const baseline = join(dir, 'baseline.json');
  assert.equal((await cli([good.url, '--delay', '0', '--quiet', '--out', baseline])).code, 0);
  const md = join(dir, 'diff', 'report.md');
  const first = await cli([bad.url, '--delay', '0', '--baseline', baseline, '--fail-on-new', 'error', '--out', md, '--quiet']);
  assert.equal(first.code, 1, first.stderr);
  assert.match(await readFile(md, 'utf8'), /Baseline status: new/);
  const own = join(dir, 'bad-baseline.json');
  await cli([bad.url, '--delay', '0', '--quiet', '--out', own]);
  assert.equal((await cli([bad.url, '--delay', '0', '--baseline', own, '--fail-on-new', 'error', '--quiet'])).code, 0);
  assert.equal((await cli([good.url, '--fail-on-new', 'error'])).code, 2);
});

test('unreadable or malformed baselines fail before any audit requests', async () => {
  const baseline = join(dir, 'invalid-baseline.json');
  const requestsBefore = good.requests.length;
  const missing = capture();
  assert.equal(await main([good.url, '--baseline', join(dir, 'missing-baseline.json')], missing.io), 2);
  assert.match(missing.err.join(''), /Cannot read baseline/);

  for (const contents of ['not JSON', '{}', '{"findings":[{"id":"seo-title-missing","affected":null}]}']) {
    await writeFile(baseline, contents);
    const c = capture();
    assert.equal(await main([good.url, '--baseline', baseline], c.io), 2);
    assert.match(c.err.join(''), /Cannot read baseline: expected a JSON report/);
    assert.equal(c.out.join(''), '');
  }
  assert.equal(good.requests.length, requestsBefore, 'invalid baselines must not trigger a crawl');
});

test('invalid score and severity gates are rejected before fetching', async () => {
  const requestsBefore = good.requests.length;
  for (const threshold of ['-1', '101', 'NaN']) {
    const c = capture();
    assert.equal(await main([good.url, '--fail-under', threshold], c.io), 2);
    assert.match(c.err.join(''), /--fail-under must be a number between 0 and 100/);
  }
  const c = capture();
  assert.equal(await main([good.url, '--baseline', 'unused.json', '--fail-on-new', 'critical'], c.io), 2);
  assert.match(c.err.join(''), /severity error, warning or info/);
  assert.equal(good.requests.length, requestsBefore);
});

test('an output directory blocked by a file exits 2 without overwriting it', async () => {
  const blocker = join(dir, 'output-blocker');
  await writeFile(blocker, 'keep this file');
  const c = capture();
  assert.equal(await main([good.url, '--delay', '0', '--out', join(blocker, 'report.json')], c.io), 2);
  assert.match(c.err.join(''), /Unexpected error:.*(?:EEXIST|ENOTDIR)/s);
  assert.equal(c.out.join(''), '');
  assert.equal(await readFile(blocker, 'utf8'), 'keep this file');
});
