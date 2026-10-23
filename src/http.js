import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPrivateHost, sameOrigin } from './url.js';

// Thin wrapper around global fetch: manual redirects, timeouts, size caps,
// and a throttle so the crawler stays polite.

export const DEFAULT_USER_AGENT = 'site-audit-lite/0.1 (+https://github.com/YusufBeratZengin/site-audit-lite)';

const MAX_REDIRECTS = 5;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Makes sure consecutive requests start at least `delayMs` apart. */
export class Throttle {
  constructor(delayMs = 0) {
    this.delayMs = delayMs;
    this.nextSlot = 0;
  }

  setDelay(delayMs) {
    this.delayMs = Math.max(this.delayMs, delayMs);
  }

  async wait() {
    if (this.delayMs <= 0) return;
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.delayMs;
    if (slot > now) await sleep(slot - now);
  }
}

function headersToObject(headers) {
  const out = {};
  for (const [key, value] of headers.entries()) out[key.toLowerCase()] = value;
  if (headers.getSetCookie) out['set-cookie'] = headers.getSetCookie();
  return out;
}

/** Decode with the charset from Content-Type, a BOM or an early <meta>; default UTF-8. */
function decodeBody(buffer, contentType) {
  let label = /charset\s*=\s*["']?([\w.:-]+)/i.exec(contentType ?? '')?.[1];
  if (!label && !(buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf)) {
    const head = buffer.subarray(0, 2048).toString('latin1');
    label = /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(head)?.[1];
  }
  try {
    return new TextDecoder(label || 'utf-8').decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

async function readLimited(response, maxBytes) {
  if (!response.body) return { text: '', bytes: 0, truncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maxBytes - bytes;
    chunks.push(value.subarray(0, remaining));
    bytes += Math.min(value.length, remaining);
    if (value.length > remaining) {
      truncated = true;
      await reader.cancel();
      break;
    }
  }
  const text = decodeBody(Buffer.concat(chunks), response.headers.get('content-type'));
  return { text, bytes, truncated };
}

/**
 * Perform an HTTP request, following up to five redirects manually.
 *
 * Resolves (never rejects) to:
 *   { url, finalUrl, status, headers, redirects, bytes, body, truncated, timeMs, error }
 * `bytes` is the decoded body size when the body was read, otherwise the
 * Content-Length header if present, otherwise null.
 */
export async function request(url, options = {}) {
  const {
    method = 'GET',
    userAgent = DEFAULT_USER_AGENT,
    timeoutMs = 15000,
    readBody = false,
    anyType = false,
    maxBytes = 2 * 1024 * 1024,
    throttle = null,
    startUrl = url,
    allowPrivate = false,
    fetchImpl = fetch,
    lookupHost = lookup,
    wait = sleep,
    now = Date.now,
  } = options;

  const started = Date.now();
  const redirects = [];
  let current = url;
  let retried = false;
  try {
    const startHost = new URL(startUrl).hostname;
    let privateAllowed = allowPrivate || isPrivateHost(startHost);
    if (!privateAllowed && !isIP(startHost)) {
      const addresses = await lookupHost(startHost, { all: true });
      privateAllowed = addresses.some(({ address }) => isPrivateHost(address));
    }
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const target = new URL(current);
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only HTTP(S) redirects are allowed');
      if (!privateAllowed) {
        if (isPrivateHost(target.hostname)) throw new Error('Refusing private address; use --allow-private for a trusted target');
        if (!isIP(target.hostname) && (hop > 0 || target.hostname !== startHost)) {
          const addresses = await lookupHost(target.hostname, { all: true });
          if (addresses.some(({ address }) => isPrivateHost(address))) throw new Error('Refusing hostname resolving to a private address');
        }
      }
      // Redirects may upgrade HTTP to HTTPS on the same host; other origins are never fetched.
      if (!sameOrigin(current, url) && !(new URL(url).protocol === 'http:' && target.protocol === 'https:' && target.hostname === new URL(url).hostname && !target.port)) {
        throw new Error('Refusing cross-origin redirect');
      }
      if (throttle) await throttle.wait();
      const response = await fetchImpl(current, {
        method,
        redirect: 'manual',
        headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const headers = headersToObject(response.headers);
      if ([429, 503].includes(response.status) && headers['retry-after'] && !retried) {
        const raw = headers['retry-after'].trim();
        const delay = /^\d+$/.test(raw) ? Number(raw) * 1000 : Date.parse(raw) - now();
        if (Number.isFinite(delay) && delay >= 0 && delay <= 30000) {
          await response.body?.cancel();
          await wait(delay);
          retried = true;
          hop--;
          continue;
        }
      }
      const location = headers.location;
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel();
        if (hop === MAX_REDIRECTS) return failure(url, current, redirects, started, 'Too many redirects');
        const next = new URL(location, current).href;
        redirects.push({ from: current, to: next, status: response.status });
        current = next;
        continue;
      }
      let body = null;
      let bytes = null;
      let truncated = false;
      const type = headers['content-type'] || '';
      if (method !== 'HEAD' && readBody && (anyType || /html|xml|text|json/i.test(type))) {
        const read = await readLimited(response, maxBytes);
        body = read.text;
        bytes = read.bytes;
        truncated = read.truncated;
      } else {
        await response.body?.cancel();
        const length = Number.parseInt(headers['content-length'] ?? '', 10);
        bytes = Number.isFinite(length) ? length : null;
      }
      return {
        url,
        finalUrl: current,
        status: response.status,
        headers,
        redirects,
        bytes,
        body,
        truncated,
        timeMs: Date.now() - started,
        error: null,
      };
    }
    return failure(url, current, redirects, started, 'Too many redirects');
  } catch (err) {
    const reason = err?.name === 'TimeoutError' ? 'Timed out' : (err?.cause?.code || err?.message || String(err));
    return failure(url, current, redirects, started, reason);
  }
}

function failure(url, finalUrl, redirects, started, error) {
  return {
    url,
    finalUrl,
    status: 0,
    headers: {},
    redirects,
    bytes: null,
    body: null,
    truncated: false,
    timeMs: Date.now() - started,
    error,
  };
}
