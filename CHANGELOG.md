# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Re-runnable terminal SVG demo captured from the CLI against synthetic local fixtures, with matching English and Turkish quick starts.
- Runtime and npm version badges, built-in test coverage reporting and an 85% source line coverage gate on Node 24.
- Weekly CodeQL analysis and a Node 24 macOS CI job alongside the Ubuntu/Windows matrix.
- CLI regression cases for invalid baselines, score/severity gate validation and report-write failures.

### Changed

- Dependabot checks npm development dependencies and GitHub Actions weekly.
- README navigation, FAQ and Turkish translations now explain local setup and audit limits consistently.

## [0.1.0] - 2026-10-23

### Added

- Same-origin crawler with robots.txt support, bounded pages/depth/concurrency and polite request delays; no runtime dependencies.
- Weighted category scores with a terminal summary, JSON, Markdown and standalone light/dark HTML reports, plus a programmatic API.
- Public npm metadata, prepublish lint/test gate and a tag-triggered OIDC release workflow with version equality checks; least-privilege CI on Node 20, 22 and 24.
- CI/license badges, real terminal output and reproducible local-only HTML/Markdown examples with `SITE_AUDIT_NOW` support.
- Six new heuristics, bringing the catalog to 44 checks: hreflang, generic titles, heading order, button names, cookie flags and static-asset cache headers.
- Baseline JSON comparison, new/fixed/unchanged report markers and `--fail-on-new` severity thresholds.
- Community issue/PR forms, Contributor Covenant 2.1 and automated dependency updates.
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

[Unreleased]: https://github.com/YusufBeratZengin/site-audit-lite/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/YusufBeratZengin/site-audit-lite/releases/tag/v0.1.0
