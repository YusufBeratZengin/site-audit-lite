// Page-level SEO checks. Each check returns { id, evidence } results.

export function checkSeo(page) {
  const { doc, headers } = page;
  const out = [];

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
