import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { CATALOG } from '../src/catalog.js';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('both READMEs document every check id', async () => {
  for (const file of ['README.md', 'README.tr.md']) {
    const text = await read(file);
    for (const id of Object.keys(CATALOG)) {
      assert.ok(text.includes(`\`${id}\``), `${file} is missing ${id}`);
    }
  }
});

test('changelog states the real number of checks', async () => {
  const text = await read('CHANGELOG.md');
  assert.match(text, new RegExp(`${Object.keys(CATALOG).length} checks`));
});

test('package metadata points at the right GitHub owner', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.match(pkg.repository.url, /github\.com\/YusufBeratZengin\/site-audit-lite/);
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.engines.node, '>=20');
});
