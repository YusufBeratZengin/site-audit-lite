# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Public npm metadata, prepublish lint/test gate and a tag-triggered OIDC release workflow with version equality checks; least-privilege CI on Node 20, 22 and 24.
- CI/license badges, real terminal output and reproducible local-only HTML/Markdown examples with `SITE_AUDIT_NOW` support.
- Six new heuristics, bringing the catalog to 44 checks: hreflang, generic titles, heading order, button names, cookie flags and static-asset cache headers.
- Baseline JSON comparison, new/fixed/unchanged report markers and `--fail-on-new` severity thresholds.
- Community issue/PR forms, Contributor Covenant 2.1 and monthly npm-dev/GitHub Actions updates.
- Runtime/package version equality test and release tag validation without a version bump.

### Changed

- English and Turkish READMEs now share section structure, options, checks, scoring and documented limits.
- HTML reports include keyboard focus and print styles, with script/external-resource regression checks.

### Fixed

- Public-to-private redirect protection (including IP literals, localhost and metadata hosts), explicit `--allow-private`, and refusal of cross-origin redirects other than same-host HTTPS upgrades.
- Retry-After handling for 429/503 (one retry up to 30 seconds); no redundant GET fallback for failed probes except unsupported HEAD.
- Decoded gzip/Brotli body caps now truncate stored content and expose truncation on audited pages; missing content types remain unparsed; redirect chains stop at five hops.
- Same-origin sitemap index children are requested one level deep within a bounded budget.
- CLI usage output for missing URLs/unknown flags, clear numeric validation and regression coverage for automatic output-directory creation.

## [0.1.0] - 2026-10-22

### Added

- Same-origin crawler with page and depth limits, concurrency limit, polite delay, configurable user agent and robots.txt support (including `Crawl-delay`).
- Tolerant HTML scanner for title, meta description, canonical, lang, viewport, h1, image alt, link rel, Open Graph, structured data and form labels.
- 38 checks across SEO, accessibility, security headers, performance and links, each with severity, evidence and a plain-language fix.
- Category scoring with documented weights and an overall grade.
- Terminal summary, JSON, Markdown and standalone HTML (inline CSS, light and dark) reports.
- `site-audit` command with `--max-pages`, `--max-depth`, `--concurrency`, `--delay`, `--timeout`, `--user-agent`, `--out`, `--format`, `--fail-under`, `--verbose`, `--quiet` and `--no-color`.
- Programmatic API (`runAudit`, `renderHtml`, `renderMarkdown`, `renderTerminal`).

[Unreleased]: https://github.com/YusufBeratZengin/site-audit-lite/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/YusufBeratZengin/site-audit-lite/releases/tag/v0.1.0
