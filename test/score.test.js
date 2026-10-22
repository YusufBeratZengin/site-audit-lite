import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOG, CATEGORIES } from '../src/catalog.js';
import { computeScores, gradeFor } from '../src/score.js';

const finding = (id, affected) => ({
  ...CATALOG[id],
  affected: Array.from({ length: affected }, (_, i) => ({ url: `/p${i}`, evidence: 'x' })),
});

test('no findings scores 100 / A', () => {
  const s = computeScores([], 3);
  assert.equal(s.overall, 100);
  assert.equal(s.grade, 'A');
  assert.equal(s.categories.seo.score, 100);
});

test('page-scope penalty scales with the share of affected pages', () => {
  const half = computeScores([finding('seo-title-missing', 1)], 2);
  assert.equal(half.categories.seo.score, 90);
  const all = computeScores([finding('seo-title-missing', 2)], 2);
  assert.equal(all.categories.seo.score, 80);
});

test('site-scope penalty is always full', () => {
  const s = computeScores([finding('seo-sitemap-missing', 1)], 10);
  assert.equal(s.categories.seo.score, 92);
});

test('category score clamps at 0 and weights combine', () => {
  const many = ['links-broken', 'links-broken-resource', 'links-redirected']
    .map((id) => finding(id, 1));
  const heavy = [...many, finding('links-broken', 1), finding('links-broken', 1), finding('links-broken', 1)];
  const s = computeScores(heavy, 1);
  assert.equal(s.categories.links.score, 0);
  const totalWeight = Object.values(CATEGORIES).reduce((a, c) => a + c.weight, 0);
  assert.equal(s.overall, Math.round((100 * (totalWeight - CATEGORIES.links.weight)) / totalWeight));
});

test('catalog is internally consistent', () => {
  for (const [id, c] of Object.entries(CATALOG)) {
    assert.equal(c.id, id);
    assert.ok(CATEGORIES[c.category], `${id} category`);
    assert.ok(['error', 'warning', 'info'].includes(c.severity), `${id} severity`);
    assert.ok(['page', 'site'].includes(c.scope), `${id} scope`);
    assert.ok(c.title && c.fix, `${id} text`);
  }
});

test('grade boundaries', () => {
  assert.deepEqual([100, 90, 89, 80, 79, 70, 69, 60, 59].map(gradeFor), ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'F']);
});
