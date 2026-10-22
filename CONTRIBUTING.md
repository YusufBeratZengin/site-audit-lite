# Contributing

Thanks for helping improve site-audit-lite. The project aims to stay small, dependency-free at runtime, and easy to explain.

## Setup

```sh
git clone https://github.com/YusufBeratZengin/site-audit-lite.git
cd site-audit-lite
npm install
npm test
npm run lint
```

Node.js 20 or newer is required.

## Ground rules

- No runtime dependencies without a strong reason. Prefer the Node standard library and global `fetch`.
- Tests must not touch the real network. Use the in-test HTTP server in `test/support/server.js` and the fixture sites in `test/support/fixtures.js`.
- Every check lives in `src/catalog.js` (id, category, severity, scope, title, fix) and is implemented in `src/checks/`. Findings need evidence and a plain-language fix.
- When you add or change a check, update the tables in `README.md` and `README.tr.md` and add a test in `test/checks.test.js`.
- Scoring weights are documented in `src/score.js` and the READMEs. Changing them is a user-visible change and belongs in the changelog.
- Keep the crawler polite: robots.txt, delay and limits must keep working.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) in English: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.
- Keep commits small and focused. Explain why, not only what.
- Run `npm test` and `npm run lint` before opening a pull request. CI runs both on Ubuntu and Windows with Node 20, 22 and 24.
- Add an entry under "Unreleased" in `CHANGELOG.md` for user-visible changes.

## Reporting bugs

Open an issue with the command you ran, the version (`site-audit --version`), and, if possible, a minimal HTML snippet that is mis-reported. Do not include private site data. For security problems, see [SECURITY.md](SECURITY.md).

## Releasing

Publishing runs only for tags matching `v*.*.*` in `.github/workflows/release.yml`.
The maintainer configures the npm package's trusted publisher for owner
`YusufBeratZengin`, repository `site-audit-lite`, workflow filename `release.yml`,
and GitHub environment `npm`. Enable direct `npm publish` in that publisher's
allowed actions. Use a GitHub-hosted runner with Node 24 (npm >=11.5.1).
See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
The workflow uses OIDC; no npm token or token fallback is configured.
Initial package creation and npm account configuration are maintainer tasks;
verify package ownership and trusted publishing before creating a release tag.

1. Review Unreleased entries and update `CHANGELOG.md` for the release.
2. Update `package.json`, `package-lock.json` and the constant in `src/version.js` together.
3. Run `npm run lint`, `npm test`, and `npm pack --dry-run`; inspect the package contents.
4. Regenerate examples with `node scripts/make-example.mjs`. Set `SITE_AUDIT_NOW` to an ISO date to override the fixed example timestamp.
5. Commit with `chore(release): vX.Y.Z`, replacing X.Y.Z with the actual version, then create the matching `vX.Y.Z` tag. Only the maintainer pushes the reviewed commit and tag.

The release workflow checks the tag against both versions, runs lint and tests,
and publishes with public access and provenance. Do not run the workflow just
to test it; use the local pack dry run. Never put credentials in files or logs.

## Manual report review

Open `examples/report.html` locally. Tab to each disclosure summary and confirm
that keyboard focus is visible, Enter/Space toggles evidence, light and dark
system themes remain readable, and print preview shows the evidence without
clipping tables. The report intentionally has no scripts or external resources;
URL strings are escaped text. Automated tests scan for scripts and remote
src/href attributes. A browser and print-preview review is still required before a release.
