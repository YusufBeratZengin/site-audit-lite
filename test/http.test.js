import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Throttle, request } from '../src/http.js';
import { isPrivateHost, resolveUrl, normalizeStartUrl, isLoopbackHost, sameOrigin } from '../src/url.js';
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
  assert.equal(r.redirects.length, 5);
  assert.equal(s.requests.length, 6);
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

for (const encoding of ['gzip', 'br']) {
  test(`decoded ${encoding} bodies are capped and flagged`, async () => {
    const s = await startServer({ '/': { headers: { 'content-type': 'text/html' }, body: 'x'.repeat(100000), [encoding]: true } });
    servers.push(s);
    const r = await request(s.url, { readBody: true, maxBytes: 1024 });
    assert.equal(r.truncated, true);
    assert.equal(Buffer.byteLength(r.body), 1024);
    assert.equal(r.bytes, 1024);
  });
}

test('missing content-type never becomes HTML', async () => {
  const s = await startServer({ '/': { body: '<title>Not typed</title>' } });
  servers.push(s);
  assert.equal((await request(s.url, { readBody: true })).body, null);
});

for (const status of [429, 503]) {
  for (const [header, expectedWait, attempts] of [['1', 1000, 2], ['30', 30000, 2], ['31', null, 1], ['invalid', null, 1], ['Thu, 01 Jan 2026 00:00:02 GMT', 2000, 2]]) {
    test(`Retry-After ${status} ${header}`, async () => {
      const s = await startServer({ '/': { status, headers: { 'retry-after': header } } });
      servers.push(s);
      const delays = [];
      const r = await request(s.url, { wait: async (ms) => delays.push(ms), now: () => Date.parse('2026-01-01T00:00:00Z') });
      assert.equal(r.status, status);
      assert.equal(s.requests.length, attempts);
      assert.deepEqual(delays, expectedWait === null ? [] : [expectedWait]);
    });
  }
}

test('Retry-After can recover on the single retry', async () => {
  let hits = 0;
  const s = await startServer({ '/': () => ++hits === 1 ? { status: 503, headers: { 'retry-after': '0' } } : { body: 'ok' } });
  servers.push(s);
  assert.equal((await request(s.url)).status, 200);
  assert.equal(hits, 2);
});

for (const target of ['http://169.254.169.254/', 'http://10.0.0.1/', 'http://localhost/', 'http://[::ffff:a00:1]/', 'http://metadata.google.internal/']) {
  test(`public redirect refuses ${target} before fetch`, async () => {
    const s = await startServer({ '/': { status: 302, headers: { location: target } } });
    servers.push(s);
    const calls = [];
    const r = await request('http://93.184.216.34/', {
      fetchImpl: async (url, options) => {
        calls.push(url);
        assert.equal(url, 'http://93.184.216.34/');
        return fetch(s.url, options);
      },
    });
    assert.match(r.error, /Refusing private/);
    assert.equal(calls.length, 1);
  });
}

test('redirect hostname resolving privately is refused before fetch', async () => {
  const calls = [];
  const r = await request('http://public.test/', {
    fetchImpl: async (url) => { calls.push(url); return { status: 302, headers: new Headers({ location: 'http://internal.test/' }), body: null }; },
    lookupHost: async (host) => [{ address: host === 'public.test' ? '93.184.216.34' : '192.168.1.2' }],
  });
  assert.match(r.error, /resolving to a private/);
  assert.equal(calls.length, 1);
});

test('private start or explicit opt-in allows private requests', async () => {
  const s = await startServer({ '/': { body: 'ok' } });
  servers.push(s);
  assert.equal((await request(s.url)).status, 200);
  assert.equal((await request(s.url, { startUrl: 'https://public.test/', allowPrivate: true })).status, 200);
  for (const host of ['10.0.0.1', '192.168.0.1', '172.16.0.1', '169.254.1.1', '::1', 'fc00::1', 'fe80::1', '::ffff:192.168.1.1']) assert.ok(isPrivateHost(host), host);
  assert.equal(isPrivateHost('93.184.216.34'), false);
});

test('request decodes legacy Turkish charsets from header and meta tag', async () => {
  const encode = (text) => Buffer.from(text.replace(/ş/g, '\xfe').replace(/ğ/g, '\xf0').replace(/İ/g, '\xdd'), 'latin1');
  const s = await startServer({
    '/hdr': { headers: { 'content-type': 'text/html; charset=windows-1254' }, body: encode('<title>İş yeri ğ</title>') },
    '/meta': { headers: { 'content-type': 'text/html' }, body: encode('<meta charset="iso-8859-9"><title>İş yeri ğ</title>') },
    '/utf': { headers: { 'content-type': 'text/html' }, body: '<title>İş yeri ğ</title>' },
  });
  servers.push(s);
  assert.equal((await request(`${s.url}/hdr`, { readBody: true })).body, '<title>İş yeri ğ</title>');
  assert.match((await request(`${s.url}/meta`, { readBody: true })).body, /<title>İş yeri ğ<\/title>/);
  assert.equal((await request(`${s.url}/utf`, { readBody: true })).body, '<title>İş yeri ğ</title>');
});
