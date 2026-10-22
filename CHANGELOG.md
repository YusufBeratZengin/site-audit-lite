# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
