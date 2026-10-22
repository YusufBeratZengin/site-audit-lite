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
- Run `npm test` and `npm run lint` before opening a pull request. CI runs both on Ubuntu and Windows with Node 20 and 22.
- Add an entry under "Unreleased" in `CHANGELOG.md` for user-visible changes.

## Reporting bugs

Open an issue with the command you ran, the version (`site-audit --version`), and, if possible, a minimal HTML snippet that is mis-reported. Do not include private site data. For security problems, see [SECURITY.md](SECURITY.md).
