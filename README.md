# site-audit-lite

[![CI](https://github.com/YusufBeratZengin/site-audit-lite/actions/workflows/ci.yml/badge.svg)](https://github.com/YusufBeratZengin/site-audit-lite/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) | [Türkçe](README.tr.md)

A fast, zero-dependency website health checker for small business sites. It crawls a site, checks SEO basics, accessibility basics, security headers, performance hints and broken links, and writes a readable report as HTML, Markdown or JSON.

Install from source: `npm ci`. Local-only demo: `node scripts/make-example.mjs`.

It is meant for freelancers and site owners who want a quick, explainable audit without running a full Lighthouse setup or paying for a SaaS tool. Every finding has an id, a severity, the evidence that triggered it, and a plain-language fix.

- Node.js 20 or newer, ESM, built on the global `fetch`.
- Zero runtime dependencies.
- Respects `robots.txt`, limits pages, depth and concurrency, and waits politely between requests.
- Standalone HTML report with inline CSS and light/dark themes.

## Demo

Run `node scripts/make-example.mjs` for a synthetic site served on an ephemeral loopback port. The saved report uses port 8080 and zero timings for reproducibility. Real output (first lines):

```text
Site audit: http://127.0.0.1:8080
Score 74/100 (C) across 5 pages

  SEO             44  F
  Accessibility   87  B
  Security        80  B
  Performance     97  A
  Links           92  A

6 errors, 10 warnings, 12 notices
```

View the [HTML example](examples/report.html) or [Markdown example](examples/report.md).

## Install

```sh
git clone https://github.com/YusufBeratZengin/site-audit-lite.git
cd site-audit-lite
npm install        # only needed for development (tests and lint)
npm link           # optional: makes the `site-audit` command available globally
```

You can also run it without linking: `node bin/site-audit.js http://127.0.0.1:8080`.

## Usage

These commands require your own local site running on port 8080. You can use `node bin/site-audit.js` in place of the linked `site-audit` command.

```sh
site-audit http://127.0.0.1:8080
site-audit http://127.0.0.1:8080 --max-pages 20 --out report.html
site-audit http://127.0.0.1:8080 --out report.md --out report.json
site-audit http://127.0.0.1:8080 --fail-under 80 --quiet
```

A bare host name is treated as HTTPS; include `http://` explicitly for local HTTP servers.

## Configuration and options

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
| `--baseline <file>` | none | Compare against a previous JSON report by check id and affected URL |
| `--fail-on-new <severity>` | none | Exit 1 for new findings at this severity or higher; requires `--baseline` (`error`, `warning`, `info`) |
| `--allow-private` | off | Permit private targets for trusted audits; origin restrictions still apply |
| `--verbose` | off | Print fixes and evidence in the terminal and progress messages |
| `--quiet` | off | Print nothing except errors |
| `--no-color` | auto | Disable ANSI colors |

Exit codes: `0` success, `1` score below `--fail-under` or new findings meet `--fail-on-new`, `2` usage error or the site could not be audited.

### Use as a library

```js
import { runAudit, renderHtml } from 'site-audit-lite';

const result = await runAudit('http://127.0.0.1:8080', { maxPages: 10 });
console.log(result.scores.overall, result.findings.length);
const html = renderHtml(result);
```

## What it checks

Severity is `error`, `warning` or `info`. Scope `page` means the check runs on every audited page; `site` means it runs once.

### SEO

| Id | Severity | Scope | What |
| --- | --- | --- | --- |
| `seo-hreflang-invalid` | warning | page | Invalid language tags or no self reference in hreflang declarations |
| `seo-title-too-generic` | warning | page | Generic title: Home or Untitled |
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
| `a11y-heading-order` | warning | page | Heading levels skip a level, including starting below h1 |
| `a11y-button-name-missing` | error | page | Button has no accessible name (heuristic) |
| `a11y-lang-missing` | error | page | `<html>` has no `lang` |
| `a11y-img-alt-missing` | error | page | Images without an `alt` attribute (empty `alt=""` is accepted) |
| `a11y-form-label-missing` | warning | page | Form fields with no `<label>`, `aria-label`, `aria-labelledby` or `title` (heuristic) |
| `a11y-link-text-empty` | warning | page | Links with no text, aria-label or image alt |
| `a11y-zoom-disabled` | warning | page | Viewport blocks zoom (`user-scalable=no`, `maximum-scale` below 2) |

### Security

| Id | Severity | Scope | What |
| --- | --- | --- | --- |
| `sec-cookie-flags` | warning | page | Set-Cookie lacks Secure, HttpOnly or valid SameSite |
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
| `perf-no-cache-headers` | info | page | Same-site static asset has neither Cache-Control nor Expires |
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

## Examples

`node scripts/make-example.mjs` uses only synthetic data from `test/support/fixtures.js`; it never audits a real site. It regenerates the [HTML](examples/report.html) and [Markdown](examples/report.md) reports. Set `SITE_AUDIT_NOW` to an ISO date to inject a timestamp; the example defaults to `2026-10-22T00:00:00Z`.

## How it works

Read robots.txt, crawl pages breadth first, probe same-origin links and resources, then run the catalog checks to produce evidence and fixes. The page budget does not cap all link probes: discovered same-origin links may also receive HEAD requests.

## Scoring

Each category starts at 100 points. Every failed check deducts points by severity: error 20, warning 8, info 2. A page-scope check is scaled by the share of audited pages it affects (3 of 6 pages affected means half the deduction); a site-scope check always deducts in full. Category scores are clamped to 0..100.

All 44 catalog checks use this rule, including the new checks with the severity and page scope shown in the tables.

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

`--baseline previous.json` marks findings and affected URLs as `new`, `fixed` or `unchanged` in HTML and Markdown. Matching uses check id plus URL; changed evidence alone is unchanged. A check can contain both new and unchanged URLs, each marked individually. Fixed findings do not affect current scores. `--fail-on-new error` exits 1 only for new errors. JSON keeps existing fields and adds `status` and `baseline` data when comparing.

## Limits and honesty

- Unless the START URL is private/local, redirects to private, loopback, link-local, localhost and known metadata targets are refused before fetch. Redirect hostname DNS addresses are checked too. Use `--allow-private` only for trusted targets; an already private/local start permits private targets. Other origins are refused except a same-host HTTP ? HTTPS upgrade.
- This is not network isolation: DNS checks do not prevent a DNS rebinding race between lookup and connection. Audit untrusted sites in a network-restricted environment. Reports contain audited URLs and evidence; review them before sharing. No telemetry or report upload is performed.
- On 429/503, a valid `Retry-After` up to 30 seconds is honoured once, then the URL is abandoned if still failing. Longer or invalid delays are not retried. HEAD falls back to GET only on 405/501.
- At most five redirects are followed. Missing Content-Type is never parsed as HTML. Decoded bodies are capped at 2 MiB, including gzip/Brotli; truncated pages have `pages[].truncated` and a report label, and findings may be incomplete.
- Sitemap indexes follow same-origin children one level deep, bounded by `maxPages`. Sitemap page URLs are not added to the crawl queue.
- Hreflang language tags/self references, button names and heading order are heuristic; region registries, ARIA reference targets and visibility are not fully validated. Cookie flags may flag intentional script-readable cookies. Cache checks detect header presence, not policy correctness.

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, contribution rules and releasing, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

## License

MIT, see [LICENSE](LICENSE).
