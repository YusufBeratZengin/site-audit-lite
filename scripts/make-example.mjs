// Synthetic local fixture only. Stabilise ephemeral ports and measured timings in saved reports.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runAudit, renderHtml, renderMarkdown, renderTerminal } from '../src/index.js';
import { badSite } from '../test/support/fixtures.js';
import { startServer } from '../test/support/server.js';

const server = await startServer(badSite());
try {
  const result = await runAudit(server.url, { delayMs: 0, now: new Date(process.env.SITE_AUDIT_NOW || '2026-10-22T00:00:00Z') });
  result.durationMs = 0;
  for (const page of result.pages) page.timeMs = 0;
  // No timing measurements or random listen(0) port enter the committed example.
  const stable = JSON.parse(JSON.stringify(result).replaceAll(server.url, 'http://127.0.0.1:8080'));
  const directory = new URL('../examples/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('report.html', directory), renderHtml(stable));
  await writeFile(new URL('report.md', directory), renderMarkdown(stable));
  console.log(renderTerminal(stable, { color: false }));
  console.log(`Reports: ${fileURLToPath(new URL('report.html', directory)).split(/[\\/]/).slice(-2).join('/')} and examples/report.md`);
} finally {
  await server.close();
}
