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
  return out;
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
    bytes += value.length;
    chunks.push(value);
    if (bytes > maxBytes) {
      truncated = true;
      await reader.cancel();
      break;
    }
  }
  const text = new TextDecoder('utf-8').decode(Buffer.concat(chunks));
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
  } = options;

  const started = Date.now();
  const redirects = [];
  let current = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (throttle) await throttle.wait();
      const response = await fetch(current, {
        method,
        redirect: 'manual',
        headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const headers = headersToObject(response.headers);
      const location = headers.location;
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel();
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
