# site-audit-lite

[English](README.md) | [Türkçe](README.tr.md)

A fast, dependency-light website health checker for small business sites. It crawls a site, checks SEO basics, accessibility basics, security headers, performance hints and broken links, and writes a readable report as HTML, Markdown or JSON.

It is meant for freelancers and site owners who want a quick, explainable audit without running a full Lighthouse setup or paying for a SaaS tool. Every finding has an id, a severity, the evidence that triggered it, and a plain-language fix.

- Node.js 20 or newer, ESM, built on the global `fetch`.
- Zero runtime dependencies.
- Respects `robots.txt`, limits pages, depth and concurrency, and waits politely between requests.
- Standalone HTML report with inline CSS and light/dark themes.

## Install

```sh
git clone https://github.com/YusufBeratZengin/site-audit-lite.git
cd site-audit-lite
npm install        # only needed for development (tests and lint)
npm link           # optional: makes the `site-audit` command available globally
```

You can also run it without linking: `node bin/site-audit.js https://example.com`.

## Usage

```sh
site-audit https://example.com
site-audit https://example.com --max-pages 20 --out report.html
site-audit https://example.com --out report.md --out report.json
site-audit https://example.com --fail-under 80 --quiet
```

A bare host name such as `example.com` is treated as `https://example.com`.

| Option | Default | Meaning |
| --- | --- | --- |
| `--max-pages <n>` | 20 | Maximum number of pages to fetch |
| `--max-depth <n>` | 3 | Maximum link depth from the start page |
| `--concurrency <n>` | 4 | Parallel requests |
| `--delay <ms>` | 200 | Minimum delay between requests (a larger `Crawl-delay` in robots.txt wins, capped at 10 s) |
| `--timeout <ms>` | 15000 | Per-request timeout |
| `--user-agent <text>` | `site-audit-lite/0.1 (+repo URL)` | User-Agent header; its first token is also used to match robots.txt groups |
| `--out <file>` | none | Write a report. Format comes from the extension (`.html`, `.md`, `.json`). Repeatable |
| `--format <fmt>` | by extension | Force `html`, `md` or `json` for all `--out` files |
| `--fail-under <n>` | none | Exit with code 1 if the overall score is below `n` |
| `--verbose` | off | Print fixes and evidence in the terminal and progress messages |
| `--quiet` | off | Print nothing except errors |
| `--no-color` | auto | Disable ANSI colors |

Exit codes: `0` success, `1` score below `--fail-under`, `2` usage error or the site could not be audited.

### Use as a library

```js
import { runAudit, renderHtml } from 'site-audit-lite';

const result = await runAudit('https://example.com', { maxPages: 10 });
console.log(result.scores.overall, result.findings.length);
const html = renderHtml(result);
```

## What it checks

Severity is `error`, `warning` or `info`. Scope `page` means the check runs on every audited page; `site` means it runs once.

### SEO

| Id | Severity | Scope | What |
| --- | --- | --- | --- |
| `seo-title-missing` | error | page | Page has no title |
| `seo-title-length` | warning | page | Title shorter than 10 or longer than 60 characters |
| `seo-title-duplicate` | warning | site | Several pages share the same title |
| `seo-description-missing` | warning | page | No meta description |
| `seo-description-length` | info | page | Description shorter than 70 or longer than 160 characters |
| `seo-h1-missing` | warning | page | No h1 heading |
| `seo-h1-multiple` | info | page | More than one h1 |
| `seo-canonical-missing` | info | page | No canonical link |
| `seo-viewport-missing` | error | page | No viewport meta tag |
| `seo-noindex` | warning | page | `noindex` in robots meta or X-Robots-Tag |
| `seo-opengraph-missing` | info | page | Missing og:title, og:description or og:image |
| `seo-structured-data-missing` | info | page | No JSON-LD block |
| `seo-robots-txt-missing` | info | site | `/robots.txt` not found |
| `seo-sitemap-missing` | warning | site | Sitemap not found (robots.txt `Sitemap:` line, else `/sitemap.xml`) |
| `seo-favicon-missing` | info | site | No favicon (declared icon, else `/favicon.ico`) |

### Accessibility

These are basic, heuristic checks. They do not replace a manual review or a full tool such as axe.

| Id | Severity | Scope | What |
| --- | --- | --- | --- |
| `a11y-lang-missing` | error | page | `<html>` has no `lang` |
| `a11y-img-alt-missing` | error | page | Images without an `alt` attribute (empty `alt=""` is accepted) |
| `a11y-form-label-missing` | warning | page | Form fields with no `<label>`, `aria-label`, `aria-labelledby` or `title` (heuristic) |
| `a11y-link-text-empty` | warning | page | Links with no text, aria-label or image alt |
| `a11y-zoom-disabled` | warning | page | Viewport blocks zoom (`user-scalable=no`, `maximum-scale` below 2) |

### Security

| Id | Severity | Scope | What |
| --- | --- | --- | --- |
| `sec-https` | error | site | Site is served over plain HTTP |
| `sec-https-redirect` | warning | site | `http://` does not redirect to `https://` |
| `sec-hsts` | warning | page | No `Strict-Transport-Security` |
| `sec-csp` | warning | page | No `Content-Security-Policy` |
| `sec-x-content-type-options` | warning | page | Missing or wrong `X-Content-Type-Options` |
| `sec-referrer-policy` | info | page | No `Referrer-Policy` |
| `sec-frame-protection` | info | page | Neither `X-Frame-Options` nor CSP `frame-ancestors` |
| `sec-mixed-content` | error | page | HTTPS page references `http://` scripts, styles, frames or images |

Loopback hosts (`localhost`, `127.0.0.0/8`, `::1`) are exempt from the HTTPS, HTTP-redirect and HSTS checks so you can audit a local development server.

### Performance

| Id | Severity | Scope | What |
| --- | --- | --- | --- |
| `perf-page-weight` | warning | page | HTML plus same-site images, scripts and styles above 1.5 MB |
| `perf-html-size` | info | page | HTML alone above 200 KB |
| `perf-large-image` | warning | page | Same-site image above 300 KB |
| `perf-compression` | warning | page | HTML above 2 KB without `Content-Encoding` |
| `perf-slow-response` | warning | page | Page took more than 1.5 s to download |
| `perf-img-dimensions` | info | page | Images without `width` and `height` |
| `perf-render-blocking-script` | info | page | External script in `<head>` without `async`, `defer` or `type="module"` |

Sizes come from the decoded HTML body and from `Content-Length` headers of same-site resources. Resources without a `Content-Length` are not counted, so page weight is a lower bound.

### Links

| Id | Severity | Scope | What |
| --- | --- | --- | --- |
| `links-broken` | error | page | Internal link returns 4xx/5xx or fails |
| `links-broken-resource` | error | page | Same-site image, script or stylesheet returns 4xx/5xx or fails |
| `links-redirected` | info | page | Internal link redirects elsewhere |

Only same-origin links are checked. External links are never requested.

## Scoring

Each category starts at 100 points. Every failed check deducts points by severity: error 20, warning 8, info 2. A page-scope check is scaled by the share of audited pages it affects (3 of 6 pages affected means half the deduction); a site-scope check always deducts in full. Category scores are clamped to 0..100.

The overall score is the weighted average of the category scores:

| Category | Weight |
| --- | ---: |
| SEO | 30 |
| Security | 25 |
| Accessibility | 20 |
| Performance | 15 |
| Links | 10 |

Grades: A is 90 or more, B 80, C 70, D 60, F below 60. The scores are a rough guide for prioritising fixes, not a ranking signal used by any search engine.

## Reports

- Terminal: scores, counts and the most severe findings.
- HTML: one self-contained file with inline CSS, no scripts, light and dark themes; all page content is escaped.
- Markdown: same content, easy to paste into an issue or an email.
- JSON: the full result object (`scores`, `summary`, `pages`, `findings` with `affected[].evidence`).

## Limits and honesty

- Pages are parsed with a small tolerant scanner, not a browser. Content added by JavaScript is not seen.
- Checks are heuristics for small sites. Passing them does not prove a site is secure, accessible or fast.
- `--max-pages` counts every page fetch during the crawl, including 404s.

## Development

```sh
npm install
npm test       # node --test, uses a local HTTP server; no real network
npm run lint
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).

## License

MIT, see [LICENSE](LICENSE).
