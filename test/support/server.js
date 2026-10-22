// A tiny in-test HTTP server that serves fixture sites on 127.0.0.1.

import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';

/**
 * routes: { '/path': { status?, headers?, body?, gzip? } | (req) => same }
 * Returns { url, requests, close }.
 */
export async function startServer(routes) {
  const requests = [];
  const server = createServer((req, res) => {
    const path = req.url.split('#')[0];
    requests.push({ method: req.method, path, userAgent: req.headers['user-agent'] });
    const key = path in routes ? path : path.split('?')[0];
    let route = routes[key];
    if (typeof route === 'function') route = route(req);
    if (!route) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    const headers = { ...(route.headers || {}) };
    let body = route.body ?? '';
    if (route.gzip) {
      body = gzipSync(Buffer.from(body));
      headers['content-encoding'] = 'gzip';
    }
    if (!('content-length' in headers)) headers['content-length'] = Buffer.byteLength(body);
    if (route.delay) {
      setTimeout(() => finish(), route.delay);
    } else {
      finish();
    }
    function finish() {
      res.writeHead(route.status ?? 200, headers);
      res.end(req.method === 'HEAD' ? undefined : body);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
