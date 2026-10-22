// Breadth-first, same-origin crawler. Respects robots.txt, a page budget,
// a depth limit, a concurrency limit and a polite delay between requests.

import { request } from './http.js';
import { scan } from './html.js';
import { resolveUrl, sameOrigin } from './url.js';

/** Run `fn` over `items` with at most `limit` in flight. Preserves result order. */
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

function isHtml(result) {
  return /html/i.test(result.headers['content-type'] || '');
}

/**
 * @param first    already-fetched response for the start URL (with body)
 * @param ctx      { origin, robots, maxPages, maxDepth, concurrency, throttle, userAgent, timeoutMs, onPage }
 * @returns { pages, fetched }
 *   pages:   audited HTML pages ({ url, requestedUrl, depth, status, headers, bytes, timeMs, html, doc, redirects })
 *   fetched: Map requestedUrl -> probe result ({ status, finalUrl, redirects, bytes, error, skipped })
 */
export async function crawl(first, ctx) {
  const pages = [];
  const fetched = new Map();
  const seen = new Set();

  const record = (requested, result, depth) => {
    fetched.set(requested, probeOf(result));
    seen.add(requested);
    seen.add(result.finalUrl);
    if (result.status < 200 || result.status >= 300 || !isHtml(result) || result.body === null) return null;
    if (!sameOrigin(result.finalUrl, ctx.origin)) return null;
    const page = {
      url: result.finalUrl,
      requestedUrl: requested,
      depth,
      status: result.status,
      headers: result.headers,
      bytes: result.bytes,
      timeMs: result.timeMs,
      html: result.body,
      doc: scan(result.body),
      redirects: result.redirects,
    };
    pages.push(page);
    ctx.onPage?.(page, pages.length);
    return page;
  };

  const startRequested = first.url;
  let budget = ctx.maxPages - 1;
  const firstPage = record(startRequested, first, 0);
  let frontier = firstPage ? [firstPage] : [];

  for (let depth = 0; depth < ctx.maxDepth && frontier.length && budget > 0; depth++) {
    const batch = [];
    for (const page of frontier) {
      for (const href of page.doc.links) {
        const abs = resolveUrl(href, page.url);
        if (!abs || seen.has(abs) || !sameOrigin(abs, ctx.origin)) continue;
        seen.add(abs);
        const path = new URL(abs).pathname + new URL(abs).search;
        if (!ctx.robots.allows(path)) {
          fetched.set(abs, { status: 0, finalUrl: abs, redirects: [], bytes: null, error: null, skipped: 'robots' });
          continue;
        }
        if (batch.length >= budget) continue;
        batch.push(abs);
      }
    }
    budget -= batch.length;
    const results = await pool(batch, ctx.concurrency, (url) =>
      request(url, {
        readBody: true,
        userAgent: ctx.userAgent,
        timeoutMs: ctx.timeoutMs,
        throttle: ctx.throttle,
      }));
    const next = [];
    results.forEach((result, i) => {
      const page = record(batch[i], result, depth + 1);
      if (page) next.push(page);
    });
    frontier = next;
  }

  return { pages, fetched };
}

export function probeOf(result) {
  return {
    status: result.status,
    finalUrl: result.finalUrl,
    redirects: result.redirects,
    bytes: result.bytes,
    error: result.error,
    skipped: null,
  };
}
