import { resolveUrl } from '../url.js';

// Page-level SEO checks. Each check returns { id, evidence } results.

export function checkSeo(page) {
  const { doc, headers } = page;
  const out = [];
  if (/^(home|untitled)$/i.test(doc.title || '')) out.push({ id: 'seo-title-too-generic', evidence: `Generic title: "${doc.title}".` });
  if (doc.hreflangs?.length) {
    const languages = new Intl.DisplayNames(['en'], { type: 'language' });
    const validCode = (code) => {
      if (code === 'x-default') return true;
      if (!/^[a-z]{2,3}(?:-[a-z]{4})?(?:-(?:[a-z]{2}|[0-9]{3}))?$/i.test(code)) return false;
      const language = code.split('-')[0].toLowerCase();
      return languages.of(language) !== language;
    };
    const self = doc.hreflangs.some((link) => resolveUrl(link.href, page.url) === resolveUrl(page.url, page.url));
    if (!self || doc.hreflangs.some((link) => !validCode(link.code) || !resolveUrl(link.href, page.url))) {
      out.push({ id: 'seo-hreflang-invalid', evidence: 'Hreflang declarations lack a self reference or contain an invalid language code or URL.' });
    }
  }

  if (doc.title === null || doc.title === '') {
    out.push({ id: 'seo-title-missing', evidence: 'No <title> found.' });
  } else if (doc.title.length < 10 || doc.title.length > 60) {
    out.push({
      id: 'seo-title-length',
      evidence: `Title is ${doc.title.length} characters: "${truncate(doc.title, 80)}"`,
    });
  }

  if (doc.description === null || doc.description === '') {
    out.push({ id: 'seo-description-missing', evidence: 'No <meta name="description"> found.' });
  } else if (doc.description.length < 70 || doc.description.length > 160) {
    out.push({
      id: 'seo-description-length',
      evidence: `Description is ${doc.description.length} characters.`,
    });
  }

  if (doc.h1.length === 0) {
    out.push({ id: 'seo-h1-missing', evidence: 'No <h1> found.' });
  } else if (doc.h1.length > 1) {
    out.push({ id: 'seo-h1-multiple', evidence: `${doc.h1.length} <h1> elements found.` });
  }

  if (doc.canonical === null) {
    out.push({ id: 'seo-canonical-missing', evidence: 'No <link rel="canonical"> found.' });
  }

  if (doc.viewport === null) {
    out.push({ id: 'seo-viewport-missing', evidence: 'No <meta name="viewport"> found.' });
  }

  const xRobots = (headers['x-robots-tag'] || '').toLowerCase();
  const noindexSource = /\bnoindex\b/.test(doc.robotsMeta || '')
    ? 'meta robots'
    : /\bnoindex\b/.test(xRobots) ? 'X-Robots-Tag header' : null;
  if (noindexSource) {
    out.push({ id: 'seo-noindex', evidence: `"noindex" set by ${noindexSource}.` });
  }

  const og = doc.openGraph;
  const missingOg = ['title', 'description', 'image'].filter((k) => !og[k]);
  if (missingOg.length) {
    out.push({ id: 'seo-opengraph-missing', evidence: `Missing: ${missingOg.map((k) => `og:${k}`).join(', ')}.` });
  }

  if (!doc.hasStructuredData) {
    out.push({ id: 'seo-structured-data-missing', evidence: 'No application/ld+json block found.' });
  }

  return out;
}

export function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}
