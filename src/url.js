import { isIP } from 'node:net';

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

/** Private, loopback, link-local and common metadata targets (including mapped IPv6). */
export function isPrivateHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (isLoopbackHost(h) || h === 'metadata.google.internal' || h === 'metadata' || h === 'instance-data') return true;
  if (isIP(h) === 4) {
    const [a, b] = h.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a === 169 && b === 254
      || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168
      || a === 100 && b >= 64 && b <= 127 || a >= 224;
  }
  if (isIP(h) === 6) {
    if (h.startsWith('::ffff:')) {
      const tail = h.slice(7);
      if (isIP(tail) === 4) return isPrivateHost(tail);
      const parts = tail.split(':');
      if (parts.length === 2) {
        const n = parseInt(parts[0], 16) * 65536 + parseInt(parts[1], 16);
        return isPrivateHost([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'));
      }
    }
    return h === '::' || h === '::1' || /^(?:f[cd]|fe[89ab])/.test(h);
  }
  return false;
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
