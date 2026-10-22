import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import { AuditError, runAudit } from '../src/audit.js';
import { badSite, goodSite } from './support/fixtures.js';
import { startServer } from './support/server.js';

const FAST = { delayMs: 0, timeoutMs: 5000, now: new Date('2026-01-01T00:00:00Z') };
const servers = [];
async function serve(routes) {
  const s = await startServer(routes);
  servers.push(s);
  return s;
}
after(async () => {
  await Promise.all(servers.map((s) => s.close()));
});

const idsOf = (result) => result.findings.map((f) => f.id);

describe('good site', () => {
  test('has no findings and scores 100', async () => {
    const site = await serve(goodSite());
    const result = await runAudit(site.url, FAST);
    assert.deepEqual(idsOf(result), []);
    assert.equal(result.scores.overall, 100);
    assert.equal(result.scores.grade, 'A');
    assert.deepEqual(result.pages.map((p) => new URL(p.url).pathname).sort(), ['/', '/about', '/contact']);
    assert.equal(result.generatedAt, '2026-01-01T00:00:00.000Z');
  });

  test('respects robots.txt: disallowed page is never requested', async () => {
    const site = await serve(goodSite());
    await runAudit(site.url, FAST);
    assert.ok(!site.requests.some((r) => r.path === '/private'), 'GET or HEAD /private happened');
  });

  test('sends the configured user agent', async () => {
    const site = await serve(goodSite());
    await runAudit(site.url, { ...FAST, userAgent: 'my-audit-bot/9.9' });
    assert.ok(site.requests.length > 0);
    assert.ok(site.requests.every((r) => r.userAgent === 'my-audit-bot/9.9'));
  });
});

describe('bad site', () => {
  test('reports the expected problems', async () => {
    const site = await serve(badSite());
    const result = await runAudit(site.url, FAST);
    const ids = idsOf(result);
    for (const id of [
      'seo-title-missing', 'seo-description-missing', 'seo-h1-multiple', 'seo-noindex',
      'seo-title-duplicate', 'seo-robots-txt-missing', 'seo-sitemap-missing', 'seo-favicon-missing',
      'a11y-lang-missing', 'a11y-img-alt-missing', 'a11y-form-label-missing', 'a11y-link-text-empty',
      'a11y-zoom-disabled', 'sec-csp', 'sec-x-content-type-options', 'sec-referrer-policy',
      'perf-large-image', 'perf-img-dimensions', 'perf-render-blocking-script',
      'links-broken', 'links-broken-resource', 'links-redirected',
    ]) assert.ok(ids.includes(id), `missing ${id} in ${ids.join(', ')}`);
    assert.ok(result.scores.overall < 80, `score ${result.scores.overall}`);
    assert.ok(result.summary.errors > 0);
  });

  test('broken link evidence names the link and the status', async () => {
    const site = await serve(badSite());
    const result = await runAudit(site.url, FAST);
    const broken = result.findings.find((f) => f.id === 'links-broken');
    assert.match(broken.affected[0].evidence, /\/missing returned 404/);
  });

  test('every finding carries severity, evidence and a fix', async () => {
    const site = await serve(badSite());
    const result = await runAudit(site.url, FAST);
    for (const f of result.findings) {
      assert.ok(['error', 'warning', 'info'].includes(f.severity));
      assert.ok(f.fix.length > 10);
      assert.ok(f.affected.length > 0);
      for (const a of f.affected) assert.ok(a.evidence && a.url);
    }
  });
});

describe('crawl limits', () => {
  function chain(n) {
    const routes = {};
    for (let i = 0; i < n; i++) {
      routes[i === 0 ? '/' : `/p${i}`] = {
        headers: { 'content-type': 'text/html' },
        body: `<html lang="en"><title>Page number ${i}</title><h1>${i}</h1><a href="/p${i + 1}">next</a>`,
      };
    }
    return routes;
  }

  test('max-pages caps the number of audited pages', async () => {
    const site = await serve(chain(10));
    const result = await runAudit(site.url, { ...FAST, maxPages: 3 });
    assert.equal(result.pages.length, 3);
    assert.ok(!site.requests.some((r) => r.path === '/p5'));
  });

  test('max-depth limits link depth', async () => {
    const site = await serve(chain(10));
    const result = await runAudit(site.url, { ...FAST, maxDepth: 2 });
    assert.equal(result.pages.length, 3);
    assert.deepEqual(result.pages.map((p) => p.depth), [0, 1, 2]);
  });

  test('stays on the same origin', async () => {
    const other = await serve({ '/': { headers: { 'content-type': 'text/html' }, body: '<title>Other</title>' } });
    const site = await serve({
      '/': { headers: { 'content-type': 'text/html' }, body: `<html lang="en"><title>Home page here</title><a href="${other.url}/">out</a>` },
    });
    const result = await runAudit(site.url, FAST);
    assert.equal(result.pages.length, 1);
    assert.equal(other.requests.length, 0);
  });

  test('concurrency option is accepted and all pages are still fetched', async () => {
    const routes = chain(1);
    routes['/'].body = '<html lang="en"><title>Hub page title</title>' +
      Array.from({ length: 8 }, (_, i) => `<a href="/leaf${i}">l</a>`).join('');
    for (let i = 0; i < 8; i++) {
      routes[`/leaf${i}`] = { headers: { 'content-type': 'text/html' }, body: `<title>Leaf ${i} title</title>` };
    }
    const site = await serve(routes);
    const result = await runAudit(site.url, { ...FAST, concurrency: 2 });
    assert.equal(result.pages.length, 9);
  });

  test('polite delay spaces out requests', async () => {
    const site = await serve(chain(3));
    const started = Date.now();
    await runAudit(site.url, { ...FAST, delayMs: 40, maxPages: 3 });
    assert.ok(Date.now() - started >= 40 * 4, 'expected at least four throttled gaps');
  });
});

describe('errors and edge cases', () => {
  test('robots.txt that disallows the start page aborts the audit', async () => {
    const site = await serve({
      '/robots.txt': { body: 'User-agent: *\nDisallow: /\n' },
      '/': { headers: { 'content-type': 'text/html' }, body: '<title>x</title>' },
    });
    await assert.rejects(runAudit(site.url, FAST), AuditError);
    assert.ok(!site.requests.some((r) => r.path === '/'));
  });

  test('crawl-delay in robots.txt slows the crawl', async () => {
    const site = await serve({
      '/robots.txt': { body: 'User-agent: *\nCrawl-delay: 0.05\n' },
      '/': { headers: { 'content-type': 'text/html' }, body: '<html lang="en"><title>Only page here</title>' },
    });
    const started = Date.now();
    await runAudit(site.url, FAST);
    assert.ok(Date.now() - started >= 45);
  });

  test('start page errors are reported as AuditError', async () => {
    const site = await serve({});
    await assert.rejects(runAudit(site.url, FAST), /returned HTTP 404/);
  });

  test('non-HTML start page is rejected', async () => {
    const site = await serve({ '/': { headers: { 'content-type': 'application/json' }, body: '{}' } });
    await assert.rejects(runAudit(site.url, FAST), /did not return an HTML page/);
  });

  test('connection failures are reported, not thrown raw', async () => {
    const site = await startServer({});
    const url = site.url;
    await site.close();
    await assert.rejects(runAudit(url, FAST), AuditError);
  });

  test('start redirect to another path is followed', async () => {
    const site = await serve({
      '/': { status: 302, headers: { location: '/home' } },
      '/home': { headers: { 'content-type': 'text/html' }, body: '<html lang="en"><title>Redirect target</title>' },
    });
    const result = await runAudit(site.url, FAST);
    assert.equal(new URL(result.finalUrl).pathname, '/home');
  });

  test('invalid options are rejected', async () => {
    await assert.rejects(runAudit('http://127.0.0.1:1/', { maxPages: 0 }), /maxPages/);
    await assert.rejects(runAudit('', {}), /URL is required/);
    await assert.rejects(runAudit('ftp://example.test', {}), /http and https/);
  });

  test('slow server response is flagged', async () => {
    const site = await serve({
      '/': { delay: 1700, headers: { 'content-type': 'text/html' }, body: '<html lang="en"><title>Slow page here</title>' },
    });
    const result = await runAudit(site.url, FAST);
    assert.ok(idsOf(result).includes('perf-slow-response'));
  });
});
