import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareBaseline, hasNewFindings } from '../src/baseline.js';
import { CATALOG } from '../src/catalog.js';
import { renderHtml, escapeHtml } from '../src/report/html.js';
import { renderMarkdown } from '../src/report/markdown.js';
import { renderTerminal } from '../src/report/terminal.js';
import { computeScores } from '../src/score.js';

function sample() {
  const findings = [
    {
      ...CATALOG['seo-title-missing'],
      affected: [{ url: 'https://e.test/<script>alert(1)</script>', evidence: 'No <title> & "quotes"' }],
    },
    { ...CATALOG['sec-csp'], affected: Array.from({ length: 12 }, (_, i) => ({ url: `https://e.test/${i}`, evidence: 'none' })) },
  ];
  return {
    tool: 'site-audit-lite',
    version: '0.1.0',
    generatedAt: '2026-01-01T00:00:00.000Z',
    startUrl: 'https://e.test/',
    finalUrl: 'https://e.test/',
    origin: 'https://e.test',
    pages: [{ url: 'https://e.test/', depth: 0, status: 200, bytes: 2048, timeMs: 12, title: 'A | B <i>' }],
    scores: computeScores(findings, 12),
    summary: { pages: 1, errors: 1, warnings: 1, infos: 0 },
    findings,
  };
}

test('html report is standalone, themed and escapes untrusted text', () => {
  const html = renderHtml(sample());
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /prefers-color-scheme:dark/);
  assert.match(html, /<meta name="viewport"/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /https?:\/\/[^"'\s<]*\.(css|js)\b/);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('No &lt;title&gt; &amp; &quot;quotes&quot;'));
  assert.ok(html.includes('A | B &lt;i&gt;'));
});

test('markdown report lists score, findings and pages', () => {
  const md = renderMarkdown(sample());
  assert.match(md, /^# Site audit: https:\/\/e\.test/);
  assert.match(md, /\| SEO \| \d+ \(\w\) \| 30% \|/);
  assert.match(md, /### \[ERROR\] Page has no title \(seo-title-missing\)/);
  assert.match(md, /How to fix:/);
  assert.match(md, /and 2 more/);
  assert.match(md, /\| A \\\| B <i> \|/);
});

test('terminal summary shows scores and truncates without verbose', () => {
  const text = renderTerminal(sample());
  assert.match(text, /Score \d+\/100/);
  assert.match(text, /ERROR\s+Page has no title/);
  assert.ok(!text.includes('\u001b['));
  const verbose = renderTerminal(sample(), { verbose: true, color: true });
  assert.match(verbose, /Fix:/);
  assert.ok(verbose.includes('\u001b[31m'));
});

test('empty findings render a clean report', () => {
  const r = { ...sample(), findings: [], scores: computeScores([], 1), summary: { pages: 1, errors: 0, warnings: 0, infos: 0 } };
  assert.match(renderHtml(r), /No issues found/);
  assert.match(renderMarkdown(r), /No issues found/);
});

test('escapeHtml handles non-strings', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(5), '5');
});

test('baseline diff tracks added, removed and unchanged affected URLs without changing inputs', () => {
  const previous = sample();
  const next = sample();
  next.findings = [
    { ...CATALOG['seo-title-missing'], affected: [{ url: previous.findings[0].affected[0].url, evidence: 'updated evidence' }, { url: 'https://e.test/new', evidence: 'missing' }] },
    { ...CATALOG['a11y-lang-missing'], affected: [{ url: 'https://e.test/', evidence: 'missing' }] },
  ];
  const diff = compareBaseline(next, previous);
  assert.deepEqual(diff.findings[0].affected.map((a) => a.status), ['unchanged', 'new']);
  assert.equal(diff.baseline.fixed[0].id, 'sec-csp');
  assert.equal(diff.baseline.fixed[0].affected.length, 12);
  assert.ok(hasNewFindings(diff, 'error'));
  assert.equal(previous.findings[0].status, undefined);
  assert.equal(next.findings[0].status, undefined);
  for (const render of [renderHtml, renderMarkdown]) {
    const report = render(diff);
    for (const status of ['new', 'fixed', 'unchanged']) assert.ok(report.includes(status));
  }
  assert.equal(hasNewFindings(compareBaseline(previous, previous)), false);
  const warningOnly = compareBaseline({ ...next, findings: [previous.findings[1]] }, { findings: [] });
  assert.equal(hasNewFindings(warningOnly, 'error'), false);
  assert.equal(hasNewFindings(warningOnly, 'warning'), true);
});

test('HTML has no active or remote resources and supports focus and print', () => {
  const html = renderHtml(sample());
  assert.doesNotMatch(html, /<script|src=["']http|(?:src|href)=["'](?:https?:)?\/\//i);
  assert.match(html, /:focus-visible/);
  assert.match(html, /prefers-color-scheme/);
  assert.match(html, /@media print/);
});
