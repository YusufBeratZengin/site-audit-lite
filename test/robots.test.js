import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRobots } from '../src/robots.js';

test('empty robots allows everything', () => {
  assert.equal(parseRobots('').allows('/anything'), true);
});

test('disallow and allow use the longest match', () => {
  const r = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/open\n');
  assert.equal(r.allows('/private/secret'), false);
  assert.equal(r.allows('/private/open/page'), true);
  assert.equal(r.allows('/public'), true);
});

test('wildcards and end anchors', () => {
  const r = parseRobots('User-agent: *\nDisallow: /*.pdf$\nDisallow: /tmp*/cache\n');
  assert.equal(r.allows('/a/b.pdf'), false);
  assert.equal(r.allows('/a/b.pdf?x=1'), true);
  assert.equal(r.allows('/tmp1/cache'), false);
});

test('specific user agent group beats the wildcard group', () => {
  const text = 'User-agent: *\nDisallow: /\n\nUser-agent: site-audit-lite\nDisallow: /nope\n';
  const r = parseRobots(text, 'site-audit-lite');
  assert.equal(r.allows('/'), true);
  assert.equal(r.allows('/nope'), false);
  assert.equal(parseRobots(text, 'other-bot').allows('/'), false);
});

test('empty Disallow allows all; comments and sitemaps are parsed', () => {
  const r = parseRobots('# hi\nUser-agent: *\nDisallow: # nothing\nCrawl-delay: 2\nSitemap: https://e.com/s.xml\n');
  assert.equal(r.allows('/x'), true);
  assert.equal(r.crawlDelay, 2);
  assert.deepEqual(r.sitemaps, ['https://e.com/s.xml']);
});

test('crawl delay is capped', () => {
  assert.equal(parseRobots('User-agent: *\nCrawl-delay: 9999\n').crawlDelay, 10);
});

test('consecutive user-agent lines share one group', () => {
  const r = parseRobots('User-agent: a\nUser-agent: site-audit-lite\nDisallow: /x\n', 'site-audit-lite');
  assert.equal(r.allows('/x'), false);
});
