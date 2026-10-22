// Standalone HTML report: inline CSS, no scripts, light and dark themes.

import { formatBytes } from '../checks/performance.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1b1f24;--muted:#5b6571;--card:#f6f8fa;--line:#d8dee4;--error:#b42318;--warning:#8a5a00;--info:#175cd3;--good:#067647}
@media (prefers-color-scheme:dark){:root{--bg:#0f141a;--fg:#e6eaef;--muted:#9aa5b1;--card:#171e26;--line:#2a3441;--error:#ff8a80;--warning:#f5c36b;--info:#7ab0ff;--good:#6fd9a0}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:960px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.6rem;margin:0 0 4px}h2{margin:32px 0 12px;font-size:1.25rem}
.muted{color:var(--muted);font-size:.9rem}
.overall{display:flex;align-items:center;gap:16px;margin:20px 0}
.big{font-size:3rem;font-weight:700;line-height:1}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px}
.bar{height:6px;background:var(--line);border-radius:3px;margin-top:8px;overflow:hidden}
.bar>span{display:block;height:100%;background:var(--good)}
.finding{border:1px solid var(--line);border-left-width:4px;border-radius:6px;padding:10px 14px;margin:12px 0;background:var(--card)}
.finding.error{border-left-color:var(--error)}.finding.warning{border-left-color:var(--warning)}.finding.info{border-left-color:var(--info)}
.sev{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.sev.error{color:var(--error)}.sev.warning{color:var(--warning)}.sev.info{color:var(--info)}
.finding h3{margin:2px 0 6px;font-size:1.05rem}
.fix{margin:6px 0}
details{margin-top:6px}summary{cursor:pointer;color:var(--muted)}
ul{padding-left:20px;margin:6px 0}li{margin:4px 0;word-break:break-word}
code{font:.85em ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);word-break:break-word}
td.num,th.num{text-align:right;white-space:nowrap}
`;

export function renderHtml(result) {
  const { scores, summary } = result;
  const out = [];
  out.push('<!doctype html>');
  out.push('<html lang="en"><head><meta charset="utf-8">');
  out.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  out.push(`<title>Site audit: ${escapeHtml(result.origin)}</title>`);
  out.push(`<style>${CSS}</style></head><body><main>`);
  out.push(`<h1>Site audit: ${escapeHtml(result.origin)}</h1>`);
  out.push(
    `<p class="muted">Generated ${escapeHtml(result.generatedAt)} by site-audit-lite ${escapeHtml(result.version)}. Start URL: ${escapeHtml(result.startUrl)}</p>`,
  );

  out.push('<div class="overall">');
  out.push(`<div class="big">${scores.overall}<span class="muted">/100</span></div>`);
  out.push(
    `<div><strong>Grade ${escapeHtml(scores.grade)}</strong><br><span class="muted">${summary.pages} pages audited. ${summary.errors} errors, ${summary.warnings} warnings, ${summary.infos} notices.</span></div>`,
  );
  out.push('</div>');

  out.push('<div class="grid">');
  for (const cat of Object.values(scores.categories)) {
    out.push(
      `<div class="card"><div class="muted">${escapeHtml(cat.label)} (${cat.weight}%)</div><div><strong>${cat.score}</strong> ${escapeHtml(cat.grade)}</div><div class="bar"><span style="width:${cat.score}%"></span></div></div>`,
    );
  }
  out.push('</div>');

  out.push('<h2>Findings</h2>');
  if (result.findings.length === 0) out.push('<p>No issues found.</p>');
  for (const f of result.findings) {
    out.push(`<section class="finding ${escapeHtml(f.severity)}">`);
    out.push(
      `<div class="sev ${escapeHtml(f.severity)}">${escapeHtml(f.severity)} &middot; ${escapeHtml(scores.categories[f.category].label)} &middot; <code>${escapeHtml(f.id)}</code></div>`,
    );
    out.push(`<h3>${escapeHtml(f.title)}</h3>`);
    out.push(`<p class="fix"><strong>How to fix:</strong> ${escapeHtml(f.fix)}</p>`);
    out.push(`<details><summary>${f.affected.length} affected</summary><ul>`);
    for (const a of f.affected) {
      out.push(`<li><code>${escapeHtml(a.url)}</code><br>${escapeHtml(a.evidence)}</li>`);
    }
    out.push('</ul></details></section>');
  }

  out.push('<h2>Pages</h2><table><thead><tr><th>URL</th><th class="num">Status</th><th class="num">Size</th><th class="num">Time</th><th>Title</th></tr></thead><tbody>');
  for (const p of result.pages) {
    out.push(
      `<tr><td>${escapeHtml(p.url)}</td><td class="num">${p.status}</td><td class="num">${escapeHtml(formatBytes(p.bytes))}</td><td class="num">${p.timeMs} ms</td><td>${escapeHtml(p.title)}</td></tr>`,
    );
  }
  out.push('</tbody></table></main></body></html>');
  return out.join('\n');
}
