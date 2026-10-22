// Fixture sites: one well-built, one full of problems.

export const SECURE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'strict-transport-security': 'max-age=31536000',
  'content-security-policy': "default-src 'self'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
};

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

function goodPage(name, extraBody = '') {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${name} - Riverside Bakery</title>
<meta name="description" content="Fresh bread and pastries baked every morning in the heart of the old town, with seating and coffee.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="/${name.toLowerCase()}">
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="/style.css">
<meta property="og:title" content="${name}"><meta property="og:description" content="Bakery"><meta property="og:image" content="/logo.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Bakery","name":"Riverside Bakery"}</script>
<script src="/app.js" defer></script>
</head>
<body>
<h1>${name}</h1>
<nav><a href="/">Home</a> <a href="/about">About</a> <a href="/contact">Contact</a></nav>
<img src="/logo.png" alt="Bakery logo" width="1" height="1">
${extraBody}
</body>
</html>`;
}

export function goodSite() {
  const html = (name, extra) => ({ headers: SECURE_HEADERS, body: goodPage(name, extra), gzip: true });
  return {
    '/': html('Home', '<a href="/private">Members area</a>'),
    '/about': html('About'),
    '/contact': html('Contact', `<form action="/contact" method="post">
<label for="email">Email</label><input id="email" name="email" type="email">
<label>Message <textarea name="message"></textarea></label>
<input type="hidden" name="token" value="x"><button type="submit">Send</button>
</form>`),
    '/robots.txt': (req) => ({
      headers: { 'content-type': 'text/plain' },
      body: `User-agent: *\nDisallow: /private\nSitemap: http://${req.headers.host}/sitemap.xml\n`,
    }),
    '/sitemap.xml': { headers: { 'content-type': 'application/xml' }, body: '<urlset></urlset>' },
    '/favicon.ico': { headers: { 'content-type': 'image/x-icon' }, body: 'icon' },
    '/style.css': { headers: { 'content-type': 'text/css', 'cache-control': 'public, max-age=3600' }, body: 'body{margin:0}' },
    '/app.js': { headers: { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=3600' }, body: 'void 0;' },
    '/logo.png': { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' }, body: PNG },
    '/private': { headers: SECURE_HEADERS, body: goodPage('Private') },
  };
}

export const BAD_HOME = `<html>
<head>
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, user-scalable=no">
<script src="/head.js"></script>
</head>
<body>
<h1>One</h1><h1>Two</h1>
<a href="/missing">Gone</a>
<a href="/moved">Moved</a>
<a href="/dup1">Dup 1</a>
<a href="/dup2">Dup 2</a>
<a href="/x"></a>
<img src="/big.jpg">
<img src="/nowhere.png" alt="">
<form><input name="q"><select name="s"></select></form>
<link rel="stylesheet" href="/missing.css">
</body>
</html>`;

export function badSite() {
  return {
    '/': { headers: { 'content-type': 'text/html' }, body: BAD_HOME },
    '/dup1': { headers: { 'content-type': 'text/html' }, body: '<html lang="en"><head><title>Same title here</title></head><body><h1>A</h1></body></html>' },
    '/dup2': { headers: { 'content-type': 'text/html' }, body: '<html lang="en"><head><title>Same title here</title></head><body><h1>B</h1></body></html>' },
    '/moved': { status: 301, headers: { location: '/dup1' } },
    '/x': { headers: { 'content-type': 'text/html' }, body: '<html lang="en"><title>X page title</title><h1>X</h1>' },
    '/head.js': { headers: { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=3600' }, body: 'void 0;' },
    '/big.jpg': { headers: { 'content-type': 'image/jpeg' }, body: Buffer.alloc(400 * 1024, 1) },
  };
}
