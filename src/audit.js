// Orchestrates a whole audit: robots, crawl, link probing, checks, scoring.

import { CATALOG, CATEGORIES, SEVERITY_ORDER } from './catalog.js';
import { crawl, pool, probeOf } from './crawler.js';
import { checkAccessibility } from './checks/accessibility.js';
import { checkLinks, pageResources } from './checks/links.js';
import { checkPerformance } from './checks/performance.js';
import { checkSecurity } from './checks/security.js';
import { checkSeo } from './checks/seo.js';
import { checkSite } from './checks/site.js';
import { DEFAULT_USER_AGENT, Throttle, request } from './http.js';
import { allowAll, parseRobots } from './robots.js';
import { computeScores } from './score.js';
import { normalizeStartUrl, resolveUrl, sameOrigin } from './url.js';
import { VERSION } from './version.js';

export class AuditError extends Error {}

export const DEFAULTS = {
  maxPages: 20,
  maxDepth: 3,
  concurrency: 4,
  delayMs: 200,
  timeoutMs: 15000,
  userAgent: DEFAULT_USER_AGENT,
};

function toPositiveInt(value, name, min = 1) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) throw new AuditError(`${name} must be an integer >= ${min}.`);
  return n;
}

function robotsToken(userAgent) {
  const m = /^[A-Za-z0-9_.-]+/.exec(userAgent.trim());
  return m ? m[0] : 'site-audit-lite';
}

async function loadRobots(origin, http) {
  const result = await request(new URL('/robots.txt', origin).href, { ...http, readBody: true, anyType: true });
  const policy = result.status === 200 && result.body !== null
    ? parseRobots(result.body, robotsToken(http.userAgent))
    : allowAll();
  return { result, policy };
}

/**
 * Run an audit.
 * @param input   start URL (a bare host name is treated as https)
 * @param options see DEFAULTS; also `now` (Date, for deterministic output) and `onProgress(message)`
 */
export async function runAudit(input, options = {}) {
  const startUrl = normalizeStartUrl(input);
  const opts = {
    maxPages: toPositiveInt(options.maxPages ?? DEFAULTS.maxPages, 'maxPages'),
    maxDepth: toPositiveInt(options.maxDepth ?? DEFAULTS.maxDepth, 'maxDepth', 0),
    concurrency: toPositiveInt(options.concurrency ?? DEFAULTS.concurrency, 'concurrency'),
    delayMs: toPositiveInt(options.delayMs ?? DEFAULTS.delayMs, 'delayMs', 0),
    timeoutMs: toPositiveInt(options.timeoutMs ?? DEFAULTS.timeoutMs, 'timeoutMs'),
    userAgent: options.userAgent || DEFAULTS.userAgent,
    allowPrivate: options.allowPrivate ?? false,
  };
  const progress = options.onProgress ?? (() => {});
  const startedAt = Date.now();
  const throttle = new Throttle(opts.delayMs);
  const http = { userAgent: opts.userAgent, timeoutMs: opts.timeoutMs, throttle, startUrl, allowPrivate: opts.allowPrivate };

  // 1. robots.txt of the origin we were asked to visit.
  let origin = new URL(startUrl).origin;
  let { result: robotsResult, policy: robots } = await loadRobots(origin, http);
  const startPath = (u) => new URL(u).pathname + new URL(u).search;
  if (!robots.allows(startPath(startUrl))) {
    throw new AuditError(`robots.txt disallows crawling ${startUrl} for this user agent.`);
  }

  // 2. The start page.
  progress(`Fetching ${startUrl}`);
  const first = await request(startUrl, { ...http, readBody: true });
  if (first.error) throw new AuditError(`Could not fetch ${startUrl}: ${first.error}`);
  if (first.status < 200 || first.status >= 300) {
    throw new AuditError(`${startUrl} returned HTTP ${first.status}.`);
  }
  if (!/html/i.test(first.headers['content-type'] || '') || first.body === null) {
    throw new AuditError(`${startUrl} did not return an HTML page.`);
  }
  const finalOrigin = new URL(first.finalUrl).origin;
  if (finalOrigin !== origin) {
    origin = finalOrigin;
    ({ result: robotsResult, policy: robots } = await loadRobots(origin, http));
    if (!robots.allows(startPath(first.finalUrl))) {
      throw new AuditError(`robots.txt disallows crawling ${first.finalUrl} for this user agent.`);
    }
  }
  if (robots.crawlDelay) throttle.setDelay(Math.round(robots.crawlDelay * 1000));

  // 3. Crawl.
  const { pages, fetched } = await crawl(first, {
    origin,
    startUrl,
    allowPrivate: opts.allowPrivate,
    robots,
    maxPages: opts.maxPages,
    maxDepth: opts.maxDepth,
    concurrency: opts.concurrency,
    throttle,
    userAgent: opts.userAgent,
    timeoutMs: opts.timeoutMs,
    onPage: (page, n) => progress(`Crawled ${n}: ${page.url}`),
  });

  // 4. Probe every same-site link and resource that the crawl did not fetch itself.
  const toProbe = new Set();
  for (const page of pages) {
    for (const href of page.doc.links) {
      const abs = resolveUrl(href, page.url);
      if (!abs || !sameOrigin(abs, origin) || fetched.has(abs)) continue;
      if (robots.allows(startPath(abs))) toProbe.add(abs);
      else fetched.set(abs, { status: 0, finalUrl: abs, redirects: [], bytes: null, error: null, skipped: 'robots' });
    }
    for (const abs of pageResources(page, origin)) {
      if (!fetched.has(abs)) toProbe.add(abs);
    }
  }
  const probeList = [...toProbe];
  progress(`Checking ${probeList.length} additional URLs`);
  await pool(probeList, opts.concurrency, async (url) => {
    let result = await request(url, { ...http, method: 'HEAD' });
    if (result.status === 405 || result.status === 501) {
      result = await request(url, { ...http, method: 'GET' });
    }
    fetched.set(url, probeOf(result));
  });
  const lookup = (url) => fetched.get(url);

  // 5. Site-level probes.
  const sitemapCandidates = robots.sitemaps
    .map((s) => resolveUrl(s, origin))
    .filter((u) => u && sameOrigin(u, origin));
  if (!sitemapCandidates.length) sitemapCandidates.push(new URL('/sitemap.xml', origin).href);
  let sitemap = null;
  for (const url of sitemapCandidates) {
    const r = await request(url, { ...http, readBody: true, anyType: true });
    sitemap = { url, status: r.status };
    if (r.status === 200 && /<sitemapindex\b/i.test(r.body || '')) {
      const children = [...(r.body || '').matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)]
        .map((m) => resolveUrl(m[1].trim().replace(/&amp;/g, '&'), url))
        .filter((u) => u && sameOrigin(u, origin));
      sitemap.children = [];
      // One index level and a bounded child budget; never crawl URLs from a urlset.
      for (const child of [...new Set(children)].slice(0, opts.maxPages)) {
        const response = await request(child, { ...http, readBody: true, anyType: true });
        sitemap.children.push({ url: child, status: response.status });
      }
      if (!sitemap.children.some((child) => child.status === 200)) sitemap.status = 0;
    }
    if (r.status === 200) break;
  }

  const iconCandidates = pages[0].doc.icons
    .map((h) => resolveUrl(h, pages[0].url))
    .filter((u) => u && sameOrigin(u, origin));
  iconCandidates.push(new URL('/favicon.ico', origin).href);
  let favicon = null;
  for (const url of iconCandidates) {
    const known = fetched.get(url);
    const status = known ? known.status : (await request(url, { ...http, method: 'GET' })).status;
    favicon = { url, status };
    if (status === 200) break;
  }

  let httpRedirect = null;
  const finalParsed = new URL(first.finalUrl);
  if (finalParsed.protocol === 'https:') {
    const httpUrl = new URL(first.finalUrl);
    httpUrl.protocol = 'http:';
    httpUrl.port = '';
    httpUrl.pathname = '/';
    httpUrl.search = '';
    httpRedirect = await request(httpUrl.href, { ...http, method: 'HEAD', timeoutMs: Math.min(opts.timeoutMs, 8000) });
  }

  // 6. Run every check and group by check id.
  const grouped = new Map();
  const add = (url, results) => {
    for (const r of results) {
      if (!grouped.has(r.id)) grouped.set(r.id, []);
      grouped.get(r.id).push({ url: r.url ?? url, evidence: r.evidence });
    }
  };

  for (const page of pages) {
    const resources = pageResources(page, origin).map((u) => ({ url: u, probe: lookup(u) }));
    const known = (r) => r.probe && !r.probe.skipped && r.probe.bytes !== null && r.probe.status < 400;
    const total = (page.bytes ?? 0) + resources.filter(known).reduce((sum, r) => sum + r.probe.bytes, 0);
    const imageUrls = new Set(
      page.doc.images.map((i) => resolveUrl(i.src, page.url)).filter(Boolean),
    );
    const images = resources
      .filter((r) => imageUrls.has(r.url))
      .map((r) => ({ url: r.url, bytes: known(r) ? r.probe.bytes : null }));

    add(page.url, checkSeo(page));
    add(page.url, checkAccessibility(page));
    add(page.url, checkSecurity(page));
    add(page.url, checkPerformance(page, { total, images, resources }));
    add(page.url, checkLinks(page, origin, lookup));
  }
  add(origin, checkSite({
    finalUrl: first.finalUrl,
    httpRedirect,
    robots: robotsResult,
    sitemap,
    favicon,
    pages,
  }));

  const findings = [...grouped.entries()]
    .map(([id, affected]) => ({ ...CATALOG[id], affected }))
    .sort((a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      || a.category.localeCompare(b.category)
      || a.id.localeCompare(b.id));

  const scores = computeScores(findings, pages.length);
  const count = (sev) => findings.filter((f) => f.severity === sev).length;

  return {
    tool: 'site-audit-lite',
    version: VERSION,
    generatedAt: (options.now ?? new Date(process.env.SITE_AUDIT_NOW || Date.now())).toISOString(),
    startUrl,
    finalUrl: first.finalUrl,
    origin,
    options: opts,
    durationMs: Date.now() - startedAt,
    pages: pages.map((p) => ({
      url: p.url,
      depth: p.depth,
      status: p.status,
      bytes: p.bytes,
      timeMs: p.timeMs,
      title: p.doc.title,
      truncated: p.truncated,
    })),
    categories: Object.fromEntries(
      Object.entries(CATEGORIES).map(([key, meta]) => [key, { label: meta.label, weight: meta.weight }]),
    ),
    scores,
    summary: {
      pages: pages.length,
      errors: count('error'),
      warnings: count('warning'),
      infos: count('info'),
    },
    findings,
  };
}
