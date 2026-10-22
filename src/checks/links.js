// Link and resource checks. They read from a lookup of probe results built by the audit.

import { resolveUrl, sameOrigin } from '../url.js';

function isBroken(result) {
  return result.status === 0 || result.status >= 400;
}

function describe(result) {
  return result.error ? `failed (${result.error})` : `returned ${result.status}`;
}

/**
 * @param page    crawled page
 * @param origin  the allowed (site) origin URL
 * @param lookup  (absoluteUrl) => probe result or undefined
 */
export function checkLinks(page, origin, lookup) {
  const out = [];
  const broken = [];
  const redirected = [];
  const seen = new Set();

  for (const href of page.doc.links) {
    const abs = resolveUrl(href, page.url);
    if (!abs || seen.has(abs) || !sameOrigin(abs, origin)) continue;
    seen.add(abs);
    const result = lookup(abs);
    if (!result || result.skipped) continue;
    if (isBroken(result)) broken.push(`${href} ${describe(result)}`);
    else if (result.redirects.length > 0) redirected.push(`${href} -> ${result.finalUrl}`);
  }
  if (broken.length) {
    out.push({ id: 'links-broken', evidence: summarize(broken) });
  }
  if (redirected.length) {
    out.push({ id: 'links-redirected', evidence: summarize(redirected) });
  }

  const brokenResources = [];
  for (const abs of pageResources(page, origin)) {
    const result = lookup(abs);
    if (result && !result.skipped && isBroken(result)) {
      brokenResources.push(`${abs} ${describe(result)}`);
    }
  }
  if (brokenResources.length) {
    out.push({ id: 'links-broken-resource', evidence: summarize(brokenResources) });
  }
  return out;
}

/** Same-origin images, scripts and stylesheets used by a page (absolute URLs, unique). */
export function pageResources(page, origin) {
  const hrefs = [
    ...page.doc.images.map((i) => i.src),
    ...page.doc.scripts,
    ...page.doc.stylesheets,
  ];
  const urls = new Set();
  for (const href of hrefs) {
    const abs = resolveUrl(href, page.url);
    if (abs && sameOrigin(abs, origin)) urls.add(abs);
  }
  return [...urls];
}

function summarize(items) {
  const shown = items.slice(0, 5).join('; ');
  return items.length > 5 ? `${shown}; and ${items.length - 5} more` : shown;
}
