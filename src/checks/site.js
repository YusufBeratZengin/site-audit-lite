// Site-level checks: HTTPS, robots.txt, sitemap, favicon and duplicate titles.

import { isLoopbackHost } from '../url.js';

/**
 * @param facts {
 *   finalUrl, httpRedirect, robots: {status}, sitemap: {url,status}|null,
 *   favicon: {url,status}|null, pages: [{url, doc}]
 * }
 * Returns results shaped { id, evidence, url? } where url overrides the affected URL.
 */
export function checkSite(facts) {
  const out = [];
  const parsed = new URL(facts.finalUrl);
  const loopback = isLoopbackHost(parsed.hostname);

  if (parsed.protocol !== 'https:' && !loopback) {
    out.push({ id: 'sec-https', evidence: `The site was reached at ${facts.finalUrl}` });
  }

  if (parsed.protocol === 'https:' && !loopback && facts.httpRedirect) {
    const r = facts.httpRedirect;
    if (r.error) {
      out.push({ id: 'sec-https-redirect', evidence: `http:// request failed (${r.error}).` });
    } else if (!r.finalUrl.startsWith('https://')) {
      out.push({ id: 'sec-https-redirect', evidence: `http:// stays on ${r.finalUrl}` });
    }
  }

  if (facts.robots.status !== 200) {
    out.push({
      id: 'seo-robots-txt-missing',
      evidence: facts.robots.error
        ? `/robots.txt request failed (${facts.robots.error}).`
        : `/robots.txt returned ${facts.robots.status}.`,
    });
  }

  if (!facts.sitemap || facts.sitemap.status !== 200) {
    out.push({
      id: 'seo-sitemap-missing',
      evidence: facts.sitemap
        ? `${facts.sitemap.url} returned ${facts.sitemap.status || 'an error'}.`
        : 'No sitemap candidate found.',
    });
  }

  if (!facts.favicon || facts.favicon.status !== 200) {
    out.push({
      id: 'seo-favicon-missing',
      evidence: facts.favicon
        ? `${facts.favicon.url} returned ${facts.favicon.status || 'an error'}.`
        : 'No favicon declared and /favicon.ico was not found.',
    });
  }

  const byTitle = new Map();
  for (const page of facts.pages) {
    const title = page.doc.title;
    if (!title) continue;
    const key = title.toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(page.url);
  }
  for (const [, urls] of byTitle) {
    if (urls.length < 2) continue;
    for (const url of urls) {
      out.push({
        id: 'seo-title-duplicate',
        url,
        evidence: `Title is shared by ${urls.length} pages.`,
      });
    }
  }

  return out;
}
