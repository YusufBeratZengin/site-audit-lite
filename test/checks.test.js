import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAccessibility } from '../src/checks/accessibility.js';
import { checkLinks } from '../src/checks/links.js';
import { checkPerformance } from '../src/checks/performance.js';
import { checkSecurity } from '../src/checks/security.js';
import { checkSeo } from '../src/checks/seo.js';
import { checkSite } from '../src/checks/site.js';
import { scan } from '../src/html.js';

const page = (html, extra = {}) => ({
  url: 'https://example.test/',
  headers: {},
  bytes: html.length,
  timeMs: 10,
  doc: scan(html),
  ...extra,
});
const ids = (results) => results.map((r) => r.id).sort();

test('seo: bare page reports the basics', () => {
  const found = ids(checkSeo(page('<html><body>hi</body></html>')));
  for (const id of [
    'seo-title-missing', 'seo-description-missing', 'seo-h1-missing', 'seo-canonical-missing',
    'seo-viewport-missing', 'seo-opengraph-missing', 'seo-structured-data-missing',
  ]) assert.ok(found.includes(id), id);
});

test('seo: title and description length, multiple h1, noindex', () => {
  const html = `<title>Hi</title><meta name="description" content="short"><h1>a</h1><h1>b</h1>
    <meta name="robots" content="noindex">`;
  const found = ids(checkSeo(page(html)));
  assert.ok(found.includes('seo-title-length'));
  assert.ok(found.includes('seo-description-length'));
  assert.ok(found.includes('seo-h1-multiple'));
  assert.ok(found.includes('seo-noindex'));
  const viaHeader = checkSeo(page('<title>A decent title</title>', { headers: { 'x-robots-tag': 'noindex' } }));
  assert.ok(ids(viaHeader).includes('seo-noindex'));
});

test('seo: a complete page passes', () => {
  const html = `<title>A decent page title</title>
    <meta name="description" content="${'d'.repeat(100)}">
    <meta name="viewport" content="width=device-width"><link rel="canonical" href="/">
    <meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:image" content="i">
    <script type="application/ld+json">{}</script><h1>Hi</h1>`;
  assert.deepEqual(checkSeo(page(html)), []);
});

test('accessibility: lang, alt, labels, link text, zoom', () => {
  const html = `<html><head><meta name="viewport" content="width=device-width, maximum-scale=1"></head>
    <body><img src="a.png"><img src="b.png" alt=""><input name="q"><a href="/x"></a></body></html>`;
  const found = checkAccessibility(page(html));
  assert.deepEqual(ids(found), [
    'a11y-form-label-missing', 'a11y-img-alt-missing', 'a11y-lang-missing',
    'a11y-link-text-empty', 'a11y-zoom-disabled',
  ]);
  assert.match(found.find((f) => f.id === 'a11y-img-alt-missing').evidence, /1 of 2/);
});

test('accessibility: clean page', () => {
  const html = '<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><img src="a.png" alt="A"></body></html>';
  assert.deepEqual(checkAccessibility(page(html)), []);
});

test('security: missing headers on an https page, and mixed content', () => {
  const html = '<script src="http://cdn.test/a.js"></script><img src="http://cdn.test/i.png"><link rel="stylesheet" href="https://ok.test/s.css">';
  const found = checkSecurity(page(html));
  assert.deepEqual(ids(found), [
    'sec-csp', 'sec-frame-protection', 'sec-hsts', 'sec-mixed-content',
    'sec-referrer-policy', 'sec-x-content-type-options',
  ]);
  assert.match(found.find((f) => f.id === 'sec-mixed-content').evidence, /2 insecure/);
});

test('security: all headers present passes; loopback skips HSTS; http pages skip mixed content', () => {
  const headers = {
    'strict-transport-security': 'max-age=1',
    'content-security-policy': "default-src 'self'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
  };
  assert.deepEqual(checkSecurity(page('<p>x</p>', { headers })), []);
  const { 'strict-transport-security': _hsts, ...noHsts } = headers;
  const local = checkSecurity(page('<script src="http://x.test/a.js"></script>', {
    url: 'http://127.0.0.1:8080/',
    headers: noHsts,
  }));
  assert.deepEqual(local, []);
});

test('security: frame-ancestors in CSP counts as clickjacking protection; wrong nosniff value is reported', () => {
  const found = checkSecurity(page('', {
    headers: { 'content-security-policy': "frame-ancestors 'none'", 'x-content-type-options': 'sniff' },
  }));
  assert.ok(!ids(found).includes('sec-frame-protection'));
  assert.match(found.find((f) => f.id === 'sec-x-content-type-options').evidence, /sniff/);
});

test('performance: heavy page, large images, no compression, slow, no dimensions, blocking script', () => {
  const html = `<head><script src="/a.js"></script></head><img src="/big.jpg" alt="">${'x'.repeat(5000)}`;
  const p = page(html, { timeMs: 3000 });
  const found = checkPerformance(p, {
    total: 2 * 1024 * 1024,
    images: [{ url: 'https://example.test/big.jpg', bytes: 500 * 1024 }, { url: 'https://example.test/s.png', bytes: 1000 }],
  });
  assert.deepEqual(ids(found), [
    'perf-compression', 'perf-img-dimensions', 'perf-large-image', 'perf-page-weight',
    'perf-render-blocking-script', 'perf-slow-response',
  ]);
  assert.match(found.find((f) => f.id === 'perf-large-image').evidence, /big\.jpg/);
});

test('performance: compressed small page passes; large html is flagged', () => {
  const ok = page('<img src="/a.png" width="1" height="1">', { headers: { 'content-encoding': 'gzip' } });
  assert.deepEqual(checkPerformance(ok, { total: 1000, images: [] }), []);
  const big = page('x', { bytes: 300 * 1024, headers: { 'content-encoding': 'br' } });
  assert.deepEqual(ids(checkPerformance(big, { total: 300 * 1024, images: [] })), ['perf-html-size']);
});

test('links: broken, redirected, and broken resources; external and skipped are ignored', () => {
  const html = `<a href="/ok">ok</a><a href="/gone">gone</a><a href="/old">old</a><a href="https://other.test/x">ext</a>
    <a href="/robot">robot</a><img src="/missing.png" alt=""><link rel="stylesheet" href="/s.css">`;
  const p = page(html);
  const probes = {
    'https://example.test/ok': { status: 200, redirects: [] },
    'https://example.test/gone': { status: 404, redirects: [] },
    'https://example.test/old': { status: 200, redirects: [{}], finalUrl: 'https://example.test/new' },
    'https://example.test/robot': { status: 0, redirects: [], skipped: 'robots' },
    'https://example.test/missing.png': { status: 0, redirects: [], error: 'ECONNRESET' },
    'https://example.test/s.css': { status: 200, redirects: [] },
  };
  const found = checkLinks(p, 'https://example.test', (u) => probes[u]);
  assert.deepEqual(ids(found), ['links-broken', 'links-broken-resource', 'links-redirected']);
  assert.match(found.find((f) => f.id === 'links-broken').evidence, /\/gone returned 404/);
  assert.doesNotMatch(found.find((f) => f.id === 'links-broken').evidence, /robot|other\.test/);
  assert.match(found.find((f) => f.id === 'links-broken-resource').evidence, /ECONNRESET/);
});

test('site: https, redirect, robots, sitemap, favicon, duplicate titles', () => {
  const pages = [
    { url: 'http://a.test/', doc: scan('<title>Same</title>') },
    { url: 'http://a.test/b', doc: scan('<title>same</title>') },
    { url: 'http://a.test/c', doc: scan('<title>Different</title>') },
  ];
  const found = checkSite({
    finalUrl: 'http://a.test/',
    robots: { status: 404 },
    sitemap: { url: 'http://a.test/sitemap.xml', status: 404 },
    favicon: null,
    pages,
  });
  assert.deepEqual(ids(found), [
    'sec-https', 'seo-favicon-missing', 'seo-robots-txt-missing', 'seo-sitemap-missing',
    'seo-title-duplicate', 'seo-title-duplicate',
  ]);

  const httpsStays = checkSite({
    finalUrl: 'https://a.test/',
    httpRedirect: { finalUrl: 'http://a.test/', error: null },
    robots: { status: 200 },
    sitemap: { url: 'x', status: 200 },
    favicon: { url: 'y', status: 200 },
    pages: [],
  });
  assert.deepEqual(ids(httpsStays), ['sec-https-redirect']);

  const redirected = checkSite({
    finalUrl: 'https://a.test/',
    httpRedirect: { finalUrl: 'https://a.test/', error: null },
    robots: { status: 200 },
    sitemap: { url: 'x', status: 200 },
    favicon: { url: 'y', status: 200 },
    pages: [],
  });
  assert.deepEqual(redirected, []);
});
