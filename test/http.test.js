import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Throttle, request } from '../src/http.js';
import { resolveUrl, normalizeStartUrl, isLoopbackHost, sameOrigin } from '../src/url.js';
import { startServer } from './support/server.js';

const servers = [];
after(async () => {
  await Promise.all(servers.map((s) => s.close()));
});

test('request follows redirects and records them', async () => {
  const s = await startServer({
    '/a': { status: 301, headers: { location: '/b' } },
    '/b': { status: 302, headers: { location: '/c' } },
    '/c': { headers: { 'content-type': 'text/html' }, body: '<p>hi</p>' },
  });
  servers.push(s);
  const r = await request(`${s.url}/a`, { readBody: true });
  assert.equal(r.status, 200);
  assert.equal(new URL(r.finalUrl).pathname, '/c');
  assert.equal(r.redirects.length, 2);
  assert.equal(r.body, '<p>hi</p>');
  assert.equal(r.bytes, 9);
});

test('request gives up on redirect loops', async () => {
  const s = await startServer({ '/loop': { status: 302, headers: { location: '/loop' } } });
  servers.push(s);
  const r = await request(`${s.url}/loop`);
  assert.equal(r.status, 0);
  assert.match(r.error, /Too many redirects/);
});

test('request does not read the body unless asked, and HEAD uses content-length', async () => {
  const s = await startServer({
    '/img': { headers: { 'content-type': 'image/png' }, body: Buffer.alloc(1234) },
  });
  servers.push(s);
  const get = await request(`${s.url}/img`);
  assert.equal(get.body, null);
  assert.equal(get.bytes, 1234);
  const head = await request(`${s.url}/img`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.bytes, 1234);
});

test('request caps body size', async () => {
  const s = await startServer({ '/big': { headers: { 'content-type': 'text/html' }, body: 'x'.repeat(100000) } });
  servers.push(s);
  const r = await request(`${s.url}/big`, { readBody: true, maxBytes: 1000 });
  assert.equal(r.truncated, true);
});

test('request reports timeouts and connection errors without throwing', async () => {
  const s = await startServer({ '/slow': { delay: 500, body: 'late' } });
  servers.push(s);
  const slow = await request(`${s.url}/slow`, { timeoutMs: 50 });
  assert.equal(slow.status, 0);
  assert.equal(slow.error, 'Timed out');
  const dead = await startServer({});
  const url = dead.url;
  await dead.close();
  const refused = await request(url);
  assert.equal(refused.status, 0);
  assert.ok(refused.error);
});

test('throttle spaces requests', async () => {
  const t = new Throttle(30);
  const started = Date.now();
  await Promise.all([t.wait(), t.wait(), t.wait()]);
  assert.ok(Date.now() - started >= 55);
  const none = new Throttle(0);
  const s2 = Date.now();
  await none.wait();
  assert.ok(Date.now() - s2 < 25);
});

test('url helpers', () => {
  assert.equal(resolveUrl('/a#frag', 'https://e.test/x/'), 'https://e.test/a');
  assert.equal(resolveUrl('../b', 'https://e.test/x/y'), 'https://e.test/b');
  for (const bad of ['mailto:a@b.c', 'tel:1', 'javascript:void(0)', '#top', '', 'data:text/plain,x']) {
    assert.equal(resolveUrl(bad, 'https://e.test/'), null, bad);
  }
  assert.equal(normalizeStartUrl('example.com'), 'https://example.com/');
  assert.equal(normalizeStartUrl('http://example.com/a#b'), 'http://example.com/a');
  assert.throws(() => normalizeStartUrl('mailto:a@b.c'));
  assert.equal(isLoopbackHost('127.0.0.1'), true);
  assert.equal(isLoopbackHost('localhost'), true);
  assert.equal(isLoopbackHost('example.com'), false);
  assert.equal(sameOrigin('https://a.test/x', 'https://a.test/y'), true);
  assert.equal(sameOrigin('https://a.test', 'http://a.test'), false);
});
