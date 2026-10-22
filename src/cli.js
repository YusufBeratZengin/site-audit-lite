// Command line interface.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { AuditError, DEFAULTS, runAudit } from './audit.js';
import { renderHtml } from './report/html.js';
import { renderMarkdown } from './report/markdown.js';
import { renderTerminal } from './report/terminal.js';
import { VERSION } from './version.js';

export const HELP = `site-audit ${VERSION}
Fast website health check: SEO, accessibility, security headers, performance hints and broken links.

Usage:
  site-audit <url> [options]

Options:
  --max-pages <n>      Maximum pages to fetch (default ${DEFAULTS.maxPages})
  --max-depth <n>      Maximum link depth from the start page (default ${DEFAULTS.maxDepth})
  --concurrency <n>    Parallel requests (default ${DEFAULTS.concurrency})
  --delay <ms>         Minimum delay between requests (default ${DEFAULTS.delayMs})
  --timeout <ms>       Per-request timeout (default ${DEFAULTS.timeoutMs})
  --user-agent <text>  User-Agent header (also used to match robots.txt rules)
  --out <file>         Write a report; format from extension (.html, .md, .json). Repeatable.
  --format <fmt>       Override the format of the --out files: html, md or json
  --fail-under <n>     Exit with code 1 when the overall score is below n
  --verbose            Show fixes and evidence in the terminal summary
  --quiet              Print nothing except errors
  --no-color           Disable colors
  -h, --help           Show this help
  -v, --version        Show the version

Exit codes: 0 success, 1 score below --fail-under, 2 usage or fetch error.
`;

const VALUE_OPTIONS = {
  '--max-pages': 'maxPages',
  '--max-depth': 'maxDepth',
  '--concurrency': 'concurrency',
  '--delay': 'delayMs',
  '--timeout': 'timeoutMs',
  '--user-agent': 'userAgent',
  '--format': 'format',
  '--fail-under': 'failUnder',
};

export class UsageError extends Error {}

export function parseArgs(argv) {
  const args = { out: [], url: null, help: false, version: false, quiet: false, verbose: false, color: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    const value = () => {
      if (inline !== undefined) return inline;
      if (i + 1 >= argv.length) throw new UsageError(`Option ${flag} needs a value.`);
      return argv[++i];
    };

    if (flag === '-h' || flag === '--help') args.help = true;
    else if (flag === '-v' || flag === '--version') args.version = true;
    else if (flag === '--quiet') args.quiet = true;
    else if (flag === '--verbose') args.verbose = true;
    else if (flag === '--no-color') args.color = false;
    else if (flag === '--out') args.out.push(value());
    else if (flag in VALUE_OPTIONS) args[VALUE_OPTIONS[flag]] = value();
    else if (arg.startsWith('-') && arg !== '-') throw new UsageError(`Unknown option: ${arg}`);
    else if (args.url === null) args.url = arg;
    else throw new UsageError(`Unexpected argument: ${arg}`);
  }
  return args;
}

const FORMATS = { html: renderHtml, md: renderMarkdown, markdown: renderMarkdown };

export function formatFor(file, override) {
  const ext = (override || extname(file).slice(1)).toLowerCase();
  if (ext === 'json') return 'json';
  if (ext === 'htm') return 'html';
  if (ext in FORMATS) return ext === 'markdown' ? 'md' : ext;
  throw new UsageError(`Cannot tell the report format of "${file}". Use .html, .md or .json, or pass --format.`);
}

export function render(result, format) {
  if (format === 'json') return `${JSON.stringify(result, null, 2)}\n`;
  return FORMATS[format](result);
}

/**
 * Run the CLI. `io` supplies stdout/stderr writers so tests can capture output.
 * Returns the process exit code.
 */
export async function main(argv, io = {}) {
  const stdout = io.stdout ?? ((text) => process.stdout.write(text));
  const stderr = io.stderr ?? ((text) => process.stderr.write(text));
  try {
    const args = parseArgs(argv);
    if (args.help) {
      stdout(HELP);
      return 0;
    }
    if (args.version) {
      stdout(`${VERSION}\n`);
      return 0;
    }
    if (!args.url) throw new UsageError('A URL is required. Try: site-audit https://example.com');

    const numeric = (name, flagName, min) => {
      if (args[name] === undefined) return undefined;
      const n = Number(args[name]);
      if (!Number.isInteger(n) || n < min) throw new UsageError(`--${flagName} must be an integer >= ${min}.`);
      return n;
    };
    const failUnder = args.failUnder === undefined ? null : Number(args.failUnder);
    if (failUnder !== null && !(failUnder >= 0 && failUnder <= 100)) {
      throw new UsageError('--fail-under must be a number between 0 and 100.');
    }
    const targets = args.out.map((file) => ({ file, format: formatFor(file, args.format) }));

    const options = {
      maxPages: numeric('maxPages', 'max-pages', 1),
      maxDepth: numeric('maxDepth', 'max-depth', 0),
      concurrency: numeric('concurrency', 'concurrency', 1),
      delayMs: numeric('delayMs', 'delay', 0),
      timeoutMs: numeric('timeoutMs', 'timeout', 1),
      userAgent: args.userAgent,
      onProgress: args.quiet || !args.verbose ? undefined : (message) => stderr(`${message}\n`),
    };

    const result = await runAudit(args.url, options);

    for (const { file, format } of targets) {
      const path = resolve(file);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, render(result, format), 'utf8');
      if (!args.quiet) stdout(`Wrote ${file}\n`);
    }
    if (!args.quiet) {
      const color = args.color ?? (Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);
      stdout(`${renderTerminal(result, { color, verbose: args.verbose })}\n`);
    }
    return failUnder !== null && result.scores.overall < failUnder ? 1 : 0;
  } catch (err) {
    if (err instanceof UsageError) {
      stderr(`Error: ${err.message}\nRun "site-audit --help" for usage.\n`);
    } else if (err instanceof AuditError) {
      stderr(`Error: ${err.message}\n`);
    } else {
      stderr(`Unexpected error: ${err?.stack || err}\n`);
    }
    return 2;
  }
}
