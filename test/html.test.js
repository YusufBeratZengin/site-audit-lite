import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeEntities, scan, tokenize } from '../src/html.js';

test('extracts head facts', () => {
  const doc = scan(`<!DOCTYPE html><html lang="en"><head>
    <title>  Hello &amp;   World </title>
    <meta name="Description" content="A &quot;test&quot; page">
    <meta name="viewport" content="width=device-width">
    <meta name="robots" content="NOINDEX, follow">
    <meta property="og:title" content="OG">
    <link rel="Canonical" href="/c">
    <link rel="shortcut icon" href="/f.ico">
    <script type="application/ld+json">{"a":1}</script>
  </head><body></body></html>`);
  assert.equal(doc.title, 'Hello & World');
  assert.equal(doc.lang, 'en');
  assert.equal(doc.description, 'A "test" page');
  assert.equal(doc.viewport, 'width=device-width');
  assert.equal(doc.robotsMeta, 'noindex, follow');
  assert.equal(doc.openGraph.title, 'OG');
  assert.equal(doc.canonical, '/c');
  assert.deepEqual(doc.icons, ['/f.ico']);
  assert.equal(doc.hasStructuredData, true);
});

test('is tolerant: unquoted attributes, uppercase tags, unclosed elements', () => {
  const doc = scan('<HTML LANG=fr><BODY><H1>Titre<IMG SRC=a.png><a href=/x>Lien<p>texte');
  assert.equal(doc.lang, 'fr');
  assert.equal(doc.images.length, 1);
  assert.equal(doc.images[0].src, 'a.png');
  assert.deepEqual(doc.links, ['/x']);
});

test('ignores tags inside comments, scripts and styles', () => {
  const doc = scan(`<!-- <img src="no.png"> -->
    <script>var s = '<img src="no2.png"><a href="/no">';</script>
    <style>a::after{content:"<h1>"}</style>
    <h1>Real</h1>`);
  assert.equal(doc.images.length, 0);
  assert.equal(doc.links.length, 0);
  assert.deepEqual(doc.h1, ['Real']);
});

test('does not crash on garbage input', () => {
  for (const input of ['', '<', '<<<>>>', '<a href="', '<div class="x', '<!--', '<script>', 'plain text only']) {
    assert.doesNotThrow(() => scan(input), JSON.stringify(input));
  }
});

test('handles ">" inside quoted attribute values', () => {
  const tokens = tokenize('<a title="a > b" href="/ok">x</a>');
  assert.equal(tokens[0].attrs.href, '/ok');
  assert.equal(tokens[0].attrs.title, 'a > b');
});

test('images: alt missing vs empty', () => {
  const doc = scan('<img src="a.png"><img src="b.png" alt=""><img src="c.png" alt="C" width=10 height=10>');
  assert.equal(doc.images[0].alt, undefined);
  assert.equal(doc.images[1].alt, '');
  assert.equal(doc.images[2].width, '10');
});

test('form label heuristic', () => {
  const doc = scan(`<form>
    <label for="a">A</label><input id="a">
    <label>B <input name="b"></label>
    <input name="c" aria-label="C">
    <input name="d">
    <input type="hidden" name="h"><input type="submit">
    <select name="e"></select>
    <textarea name="f" id="f"></textarea><label for="f">F</label>
  </form>`);
  assert.deepEqual(doc.unlabelledControls.map((c) => c.name), ['d', 'e']);
  assert.equal(doc.formControls.length, 6);
});

test('empty links: text, aria-label and image alt count as names', () => {
  const doc = scan(`<a href="/1"></a><a href="/2">Text</a><a href="/3" aria-label="X"></a>
    <a href="/4"><img src="i.png" alt="Logo"></a><a href="/5"><img src="i.png"></a>`);
  assert.deepEqual(doc.emptyLinks, ['/1', '/5']);
});

test('render-blocking scripts only in head without async/defer/module', () => {
  const doc = scan(`<head><script src="/a.js"></script><script src="/b.js" defer></script>
    <script src="/c.js" async></script><script type="module" src="/d.js"></script></head>
    <body><script src="/e.js"></script></body>`);
  assert.deepEqual(doc.renderBlockingScripts, ['/a.js']);
  assert.equal(doc.scripts.length, 5);
});

test('h1 count and text', () => {
  const doc = scan('<h1>One <em>big</em></h1><h2>Sub</h2><h1>Two</h1>');
  assert.deepEqual(doc.h1, ['One big', 'Two']);
  assert.equal(doc.headingCount, 3);
});

test('decodeEntities', () => {
  assert.equal(decodeEntities('a &lt; b &#65; &#x42; &unknown; &#0;'), 'a < b A B &unknown; &#0;');
});
