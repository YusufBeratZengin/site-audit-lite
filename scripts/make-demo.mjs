// Run the actual CLI against a synthetic loopback site and capture its stdout.
// No report data is invented or rewritten. Port 8080 must be available.
import { mkdir, writeFile } from 'node:fs/promises';
import { main } from '../src/cli.js';
import { badSite } from '../test/support/fixtures.js';
import { startServer } from '../test/support/server.js';

const server = await startServer(badSite(), { port: 8080 });
if (process.argv.includes('--serve')) {
  console.log('Synthetic demo ready at http://127.0.0.1:8080 (Ctrl+C to stop).');
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      await server.close();
      process.exitCode = 0;
    });
  }
} else {
  try {
    let output = '';
    let errors = '';
    // bin/site-audit.js delegates to this same entry point.
    const code = await main([server.url, '--delay', '0', '--no-color'], {
      stdout: (text) => { output += text; },
      stderr: (text) => { errors += text; },
    });
    if (code !== 0) throw new Error(`Demo CLI exited ${code}: ${errors}`);
    process.stdout.write(output);

    const command = '$ node bin/site-audit.js http://127.0.0.1:8080 --delay 0 --no-color';
    const lines = [command, '', ...output.trimEnd().split('\n').slice(0, 22)];
    const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const width = Math.max(900, ...lines.map((line) => line.length * 8.5 + 48));
    const height = 78 + lines.length * 23;
    const text = lines.map((line, i) => {
      const fill = i === 0 ? '#a5f3c3' : /^ERROR/.test(line) ? '#fda4af' : /^WARNING/.test(line) ? '#fde68a' : '#dce4ee';
      return `    <text x="24" y="${79 + i * 23}" fill="${fill}" xml:space="preserve">${escape(line)}</text>`;
    }).join('\n');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">site-audit-lite terminal demo</title>
  <desc id="description">Actual CLI output from a synthetic local site. The first 22 output lines show category scores and actionable findings.</desc>
  <rect width="${width}" height="${height}" rx="14" fill="#101722"/>
  <path d="M14 0h${width - 28}a14 14 0 0 1 14 14v30H0V14A14 14 0 0 1 14 0" fill="#202b3b"/>
  <circle cx="24" cy="22" r="6" fill="#ff5f57"/>
  <circle cx="44" cy="22" r="6" fill="#febc2e"/>
  <circle cx="64" cy="22" r="6" fill="#28c840"/>
  <g font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="14">
${text}
  </g>
</svg>
`;
    await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
    await writeFile(new URL('../docs/demo.svg', import.meta.url), svg);
    console.log('\nSaved docs/demo.svg (first 22 output lines).');
  } finally {
    await server.close();
  }
}
