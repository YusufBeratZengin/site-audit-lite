// Plain-text terminal summary. Colors only when asked for.

const COLORS = { error: '31', warning: '33', info: '36', bold: '1', dim: '2' };

export function renderTerminal(result, { color = false, verbose = false } = {}) {
  const paint = (kind, text) => (color ? `\u001b[${COLORS[kind]}m${text}\u001b[0m` : text);
  const { scores, summary } = result;
  const lines = [];

  lines.push(paint('bold', `Site audit: ${result.origin}`));
  lines.push(`Score ${scores.overall}/100 (${scores.grade}) across ${summary.pages} pages`);
  lines.push('');
  for (const cat of Object.values(scores.categories)) {
    lines.push(`  ${cat.label.padEnd(14)} ${String(cat.score).padStart(3)}  ${cat.grade}`);
  }
  lines.push('');
  lines.push(`${summary.errors} errors, ${summary.warnings} warnings, ${summary.infos} notices`);

  const shown = verbose ? result.findings : result.findings.slice(0, 12);
  if (shown.length) lines.push('');
  for (const f of shown) {
    const tag = f.severity.toUpperCase().padEnd(7);
    lines.push(`${paint(f.severity, tag)} ${f.title} (${f.id}) - ${f.affected.length} affected`);
    if (verbose) {
      lines.push(paint('dim', `        Fix: ${f.fix}`));
      for (const a of f.affected.slice(0, 5)) lines.push(paint('dim', `        ${a.url}: ${a.evidence}`));
    }
  }
  if (!verbose && result.findings.length > shown.length) {
    lines.push(paint('dim', `... and ${result.findings.length - shown.length} more (use --out for the full report)`));
  }
  return lines.join('\n');
}
