// URL helpers shared by the crawler and the checks.

const SKIPPED_SCHEMES = /^(?:mailto|tel|javascript|data|sms|file|blob|about|ftp):/i;

/** Resolve a href against a base; returns an absolute http(s) URL string without fragment, or null. */
export function resolveUrl(href, base) {
  if (typeof href !== 'string') return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#') || SKIPPED_SCHEMES.test(trimmed)) return null;
  try {
    const url = new URL(trimmed, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

export function isLoopbackHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h.endsWith('.localhost') || h === '::1' || /^127(?:\.\d{1,3}){3}$/.test(h);
}

/** Add a scheme when the user typed a bare host name. */
export function normalizeStartUrl(input) {
  const text = String(input ?? '').trim();
  if (!text) throw new Error('A URL is required.');
  // "host:8080" is a host and port; anything else with a colon after letters is a scheme.
  const hasScheme = /^[a-z][a-z0-9+.-]*:(?!\d+(?:[/?#]|$))/i.test(text);
  const withScheme = hasScheme ? text : `https://${text}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Only http and https URLs are supported: ${input}`);
  }
  url.hash = '';
  return url.href;
}

export function sameOrigin(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}
