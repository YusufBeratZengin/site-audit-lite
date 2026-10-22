// Page-level security checks: response headers and mixed content.

import { isLoopbackHost } from '../url.js';

export function checkSecurity(page) {
  const { headers, doc, url } = page;
  const out = [];
  const rawCookies = headers['set-cookie'] || [];
  const cookies = Array.isArray(rawCookies) ? rawCookies : rawCookies.split(/,(?=\s*[^;,=\s]+=)/);
  const unsafe = cookies.filter((cookie) => !/;\s*Secure\s*(?:;|$)/i.test(cookie)
    || !/;\s*HttpOnly\s*(?:;|$)/i.test(cookie) || !/;\s*SameSite=(?:Strict|Lax|None)\s*(?:;|$)/i.test(cookie));
  // Never include cookie names or values in findings.
  if (unsafe.length) out.push({ id: 'sec-cookie-flags', evidence: `${unsafe.length} Set-Cookie headers lack Secure, HttpOnly or a valid SameSite attribute.` });
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const loopback = isLoopbackHost(parsed.hostname);

  // HSTS only means something over HTTPS; local development servers are exempt.
  if (!loopback && !headers['strict-transport-security']) {
    out.push({ id: 'sec-hsts', evidence: 'Response has no Strict-Transport-Security header.' });
  }

  const csp = headers['content-security-policy'];
  if (!csp) {
    out.push({ id: 'sec-csp', evidence: 'Response has no Content-Security-Policy header.' });
  }

  if ((headers['x-content-type-options'] || '').toLowerCase() !== 'nosniff') {
    out.push({
      id: 'sec-x-content-type-options',
      evidence: headers['x-content-type-options']
        ? `Header value is "${headers['x-content-type-options']}", expected "nosniff".`
        : 'Response has no X-Content-Type-Options header.',
    });
  }

  if (!headers['referrer-policy']) {
    out.push({ id: 'sec-referrer-policy', evidence: 'Response has no Referrer-Policy header.' });
  }

  const framed = headers['x-frame-options'] || /frame-ancestors/i.test(csp || '');
  if (!framed) {
    out.push({
      id: 'sec-frame-protection',
      evidence: 'Neither X-Frame-Options nor CSP frame-ancestors is set.',
    });
  }

  if (isHttps) {
    const insecure = [
      ...doc.scripts,
      ...doc.stylesheets,
      ...doc.iframes,
      ...doc.images.map((i) => i.src),
    ].filter((u) => /^http:\/\//i.test(u));
    if (insecure.length) {
      out.push({
        id: 'sec-mixed-content',
        evidence: `${insecure.length} insecure resources, e.g. ${insecure.slice(0, 3).join(', ')}`,
      });
    }
  }

  return out;
}
