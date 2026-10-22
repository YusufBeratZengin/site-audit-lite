// Every check the tool knows about: id, category, severity, scope, a short
// title and a plain-language fix. Scoring and reports read from here.

export const CATEGORIES = {
  seo: { label: 'SEO', weight: 30 },
  accessibility: { label: 'Accessibility', weight: 20 },
  security: { label: 'Security', weight: 25 },
  performance: { label: 'Performance', weight: 15 },
  links: { label: 'Links', weight: 10 },
};

// Penalty points deducted from a category's 100 points when a check fails on
// every audited page (site-scope checks always deduct the full amount).
export const SEVERITY_PENALTY = { error: 20, warning: 8, info: 2 };

export const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

function check(id, category, severity, scope, title, fix) {
  return [id, { id, category, severity, scope, title, fix }];
}

export const CATALOG = Object.fromEntries([
  check('seo-hreflang-invalid', 'seo', 'warning', 'page',
    'Invalid hreflang declarations', 'Use valid language tags (or x-default) and include an alternate link to the current page.'),
  check('seo-title-too-generic', 'seo', 'warning', 'page',
    'Title is too generic', 'Replace Home or Untitled with a descriptive title unique to this page.'),
  check('a11y-heading-order', 'accessibility', 'warning', 'page',
    'Heading levels are skipped', 'Start with h1 and increase heading levels one step at a time.'),
  check('a11y-button-name-missing', 'accessibility', 'error', 'page',
    'Buttons without an accessible name', 'Add visible button text, an image alt, aria-label or aria-labelledby.'),
  check('sec-cookie-flags', 'security', 'warning', 'page',
    'Cookies lack security flags', 'Set Secure, HttpOnly and SameSite on cookies; review intentional script-readable cookies manually.'),
  check('perf-no-cache-headers', 'performance', 'info', 'page',
    'Static assets have no cache headers', 'Send Cache-Control or Expires for same-site images, scripts and stylesheets.'),
  // SEO
  check('seo-title-missing', 'seo', 'error', 'page',
    'Page has no title',
    'Add a unique <title> element inside <head> that describes the page in 10 to 60 characters.'),
  check('seo-title-length', 'seo', 'warning', 'page',
    'Title is too short or too long',
    'Keep the title between 10 and 60 characters so search engines show it without cutting it off.'),
  check('seo-title-duplicate', 'seo', 'warning', 'site',
    'Several pages share the same title',
    'Give every page its own title so visitors and search engines can tell the pages apart.'),
  check('seo-description-missing', 'seo', 'warning', 'page',
    'Page has no meta description',
    'Add <meta name="description" content="..."> with a one or two sentence summary of the page.'),
  check('seo-description-length', 'seo', 'info', 'page',
    'Meta description is too short or too long',
    'Aim for a description between 70 and 160 characters.'),
  check('seo-h1-missing', 'seo', 'warning', 'page',
    'Page has no h1 heading',
    'Add one <h1> that states what the page is about.'),
  check('seo-h1-multiple', 'seo', 'info', 'page',
    'Page has more than one h1 heading',
    'Use a single <h1> per page and <h2> to <h6> for sub-sections.'),
  check('seo-canonical-missing', 'seo', 'info', 'page',
    'Page has no canonical link',
    'Add <link rel="canonical" href="..."> pointing at the preferred URL of the page.'),
  check('seo-viewport-missing', 'seo', 'error', 'page',
    'Page has no viewport meta tag',
    'Add <meta name="viewport" content="width=device-width, initial-scale=1"> so the page works on phones.'),
  check('seo-noindex', 'seo', 'warning', 'page',
    'Page asks search engines not to index it',
    'Remove "noindex" from the robots meta tag or the X-Robots-Tag header if the page should appear in search results.'),
  check('seo-opengraph-missing', 'seo', 'info', 'page',
    'Page has no Open Graph tags',
    'Add og:title, og:description and og:image so links look good when shared on social networks.'),
  check('seo-structured-data-missing', 'seo', 'info', 'page',
    'Page has no structured data',
    'Add JSON-LD (for example LocalBusiness or Organization) so search engines understand the business.'),
  check('seo-robots-txt-missing', 'seo', 'info', 'site',
    'robots.txt not found',
    'Publish /robots.txt, even a minimal one, so crawlers know what they may visit.'),
  check('seo-sitemap-missing', 'seo', 'warning', 'site',
    'sitemap.xml not found',
    'Publish /sitemap.xml and reference it from robots.txt with a Sitemap: line.'),
  check('seo-favicon-missing', 'seo', 'info', 'site',
    'Favicon not found',
    'Add a favicon (link rel="icon" or /favicon.ico) so the site is recognisable in tabs and bookmarks.'),

  // Accessibility
  check('a11y-lang-missing', 'accessibility', 'error', 'page',
    'Page language is not declared',
    'Add a lang attribute to the <html> element, for example <html lang="en">.'),
  check('a11y-img-alt-missing', 'accessibility', 'error', 'page',
    'Images without alt text',
    'Give every informative image an alt attribute; use alt="" for purely decorative images.'),
  check('a11y-form-label-missing', 'accessibility', 'warning', 'page',
    'Form fields without a visible label (heuristic)',
    'Connect each field to a <label for="..."> or wrap it in a <label>; use aria-label only when no visible label fits.'),
  check('a11y-link-text-empty', 'accessibility', 'warning', 'page',
    'Links without readable text',
    'Give each link text, an aria-label, or an image with alt text so screen readers can announce it.'),
  check('a11y-zoom-disabled', 'accessibility', 'warning', 'page',
    'Pinch zoom is disabled',
    'Remove user-scalable=no and maximum-scale below 2 from the viewport meta tag.'),

  // Security
  check('sec-https', 'security', 'error', 'site',
    'Site is not served over HTTPS',
    'Install a TLS certificate and serve the whole site over https://.'),
  check('sec-https-redirect', 'security', 'warning', 'site',
    'HTTP does not redirect to HTTPS',
    'Configure the server to redirect every http:// request to the https:// version with a 301.'),
  check('sec-hsts', 'security', 'warning', 'page',
    'Strict-Transport-Security header missing',
    'Send Strict-Transport-Security: max-age=31536000; includeSubDomains once HTTPS works everywhere.'),
  check('sec-csp', 'security', 'warning', 'page',
    'Content-Security-Policy header missing',
    'Send a Content-Security-Policy header that limits where scripts, styles and frames may load from.'),
  check('sec-x-content-type-options', 'security', 'warning', 'page',
    'X-Content-Type-Options header missing',
    'Send X-Content-Type-Options: nosniff so browsers do not guess file types.'),
  check('sec-referrer-policy', 'security', 'info', 'page',
    'Referrer-Policy header missing',
    'Send Referrer-Policy: strict-origin-when-cross-origin (or stricter) to limit what is leaked to other sites.'),
  check('sec-frame-protection', 'security', 'info', 'page',
    'No clickjacking protection',
    'Send X-Frame-Options: SAMEORIGIN or a Content-Security-Policy with frame-ancestors.'),
  check('sec-mixed-content', 'security', 'error', 'page',
    'HTTPS page loads insecure http:// resources',
    'Change http:// resource URLs to https:// (or protocol-relative paths) so browsers do not block them.'),

  // Performance
  check('perf-page-weight', 'performance', 'warning', 'page',
    'Page is heavy',
    'Reduce the combined size of the HTML, images, scripts and styles; compress images and remove unused files.'),
  check('perf-html-size', 'performance', 'info', 'page',
    'HTML document is large',
    'Trim inline scripts, inline styles and repeated markup; the HTML alone should stay under 200 KB.'),
  check('perf-large-image', 'performance', 'warning', 'page',
    'Large images',
    'Resize images to the size they are shown at and use compressed formats such as WebP or AVIF.'),
  check('perf-compression', 'performance', 'warning', 'page',
    'HTML is served without compression',
    'Enable gzip or Brotli compression on the web server for HTML, CSS and JavaScript.'),
  check('perf-slow-response', 'performance', 'warning', 'page',
    'Slow server response',
    'Look at hosting, caching and slow database queries; the page should respond in under 1.5 seconds.'),
  check('perf-img-dimensions', 'performance', 'info', 'page',
    'Images without width and height',
    'Add width and height attributes so the browser reserves space and the layout does not jump while loading.'),
  check('perf-render-blocking-script', 'performance', 'info', 'page',
    'Scripts in <head> block rendering',
    'Add defer (or async) to external scripts in <head>, or move them to the end of <body>.'),

  // Links
  check('links-broken', 'links', 'error', 'page',
    'Broken internal links',
    'Fix or remove the links that return an error, or add redirects from the old addresses.'),
  check('links-broken-resource', 'links', 'error', 'page',
    'Broken images, scripts or stylesheets',
    'Fix the file paths or upload the missing files so the page renders completely.'),
  check('links-redirected', 'links', 'info', 'page',
    'Internal links that redirect',
    'Update links to point at the final address so visitors skip the extra redirect.'),
]);

export function getCheck(id) {
  const entry = CATALOG[id];
  if (!entry) throw new Error(`Unknown check id: ${id}`);
  return entry;
}
