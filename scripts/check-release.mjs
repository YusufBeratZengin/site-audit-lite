import { readFile } from 'node:fs/promises';
import { VERSION } from '../src/version.js';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (VERSION !== pkg.version || process.env.GITHUB_REF_NAME !== `v${pkg.version}`) {
  console.error('Release tag, package.json and src/version.js must have the same version.');
  process.exitCode = 1;
}
