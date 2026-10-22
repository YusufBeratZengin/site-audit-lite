// Markdown report renderer.

import { formatBytes } from '../checks/performance.js';

const MAX_AFFECTED = 10;

function cell(text) {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

export function renderMarkdown(result) {
  const lines = [];
  const { scores, summary } = result;

  lines.push(`# Site audit: ${result.origin}`, '');
  lines.push(`Generated ${result.generatedAt} by site-audit-lite ${result.version}.`);
  lines.push(`Start URL: ${result.startUrl}`, '');
  lines.push(`## Score: ${scores.overall}/100 (${scores.grade})`, '');
  lines.push('| Category | Score | Weight |', '| --- | ---: | ---: |');
  for (const cat of Object.values(scores.categories)) {
    lines.push(`| ${cat.label} | ${cat.score} (${cat.grade}) | ${cat.weight}% |`);
  }
  lines.push('');
  lines.push(
    `${summary.pages} pages audited. ${summary.errors} errors, ${summary.warnings} warnings, ${summary.infos} notices.`,
    '',
  );

  if (result.baseline) lines.push(`Baseline: ${result.baseline.new} new, ${result.baseline.unchanged} unchanged, ${result.baseline.fixed.length} fixed checks.`, '');
  lines.push('## Findings', '');
  if (result.findings.length === 0) {
    lines.push('No issues found.', '');
  }
  for (const f of [...result.findings, ...(result.baseline?.fixed || [])]) {
    lines.push(`### [${f.severity.toUpperCase()}] ${f.title} (${f.id})`, '');
    if (f.status) lines.push(`Baseline status: ${f.status}.`, '');
    lines.push(`Category: ${scores.categories[f.category].label}. Affected: ${f.affected.length}.`, '');
    lines.push(`How to fix: ${f.fix}`, '');
    for (const a of f.affected.slice(0, MAX_AFFECTED)) {
      lines.push(`- ${a.status ? `[${a.status}] ` : ''}${a.url}: ${a.evidence}`);
    }
    if (f.affected.length > MAX_AFFECTED) {
      lines.push(`- and ${f.affected.length - MAX_AFFECTED} more`);
    }
    lines.push('');
  }

  lines.push('## Pages', '');
  lines.push('| URL | Status | Size | Time | Title |', '| --- | ---: | ---: | ---: | --- |');
  for (const p of result.pages) {
    lines.push(`| ${cell(p.url)} | ${p.status} | ${formatBytes(p.bytes)} | ${p.timeMs} ms | ${cell(p.title)}${p.truncated ? ' (body truncated)' : ''} |`);
  }
  lines.push('');
  return lines.join('\n');
}
