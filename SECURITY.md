# Security Policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private vulnerability reporting for this repository: <https://github.com/YusufBeratZengin/site-audit-lite/security/advisories/new>.

Include the version, a description of the problem, and steps to reproduce. You can expect an initial response within a few days.

## Scope notes

- site-audit-lite sends HTTP GET and HEAD requests to the site you point it at, and to nothing else. It does not request external links.
- Report files contain content taken from the audited site. The HTML report escapes that content and contains no scripts; reports of an escaping bypass are in scope.
- Only audit sites you own or have permission to test. Keep the default delay and limits unless you control the target.
