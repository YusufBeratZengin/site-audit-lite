// Page-level accessibility basics. These are heuristics, not a full audit.

export function checkAccessibility(page) {
  const { doc } = page;
  const out = [];
  if (doc.headings?.some((level, i, levels) => level > (i ? levels[i - 1] : 0) + 1)) {
    out.push({ id: 'a11y-heading-order', evidence: `Heading levels skip a level: ${doc.headings.join(', ')}.` });
  }
  if (doc.unnamedButtons?.length) out.push({ id: 'a11y-button-name-missing', evidence: `${doc.unnamedButtons.length} buttons have no accessible name (heuristic).` });

  if (!doc.lang) {
    out.push({ id: 'a11y-lang-missing', evidence: 'The <html> element has no lang attribute.' });
  }

  const missingAlt = doc.images.filter(
    (img) => img.alt === undefined && img.role !== 'presentation' && img.ariaHidden !== 'true',
  );
  if (missingAlt.length) {
    const sample = missingAlt.slice(0, 3).map((i) => i.src || '(no src)').join(', ');
    out.push({
      id: 'a11y-img-alt-missing',
      evidence: `${missingAlt.length} of ${doc.images.length} images have no alt attribute (e.g. ${sample}).`,
    });
  }

  if (doc.unlabelledControls.length) {
    const sample = doc.unlabelledControls
      .slice(0, 3)
      .map((c) => `${c.tag}${c.name ? `[name=${c.name}]` : ''}`)
      .join(', ');
    out.push({
      id: 'a11y-form-label-missing',
      evidence: `${doc.unlabelledControls.length} of ${doc.formControls.length} form fields have no label (e.g. ${sample}).`,
    });
  }

  if (doc.emptyLinks.length) {
    out.push({
      id: 'a11y-link-text-empty',
      evidence: `${doc.emptyLinks.length} links have no text (e.g. ${doc.emptyLinks.slice(0, 3).join(', ')}).`,
    });
  }

  if (doc.viewport) {
    const v = doc.viewport.toLowerCase().replace(/\s+/g, '');
    const max = /maximum-scale=([\d.]+)/.exec(v);
    if (/user-scalable=(no|0)/.test(v) || (max && Number.parseFloat(max[1]) < 2)) {
      out.push({ id: 'a11y-zoom-disabled', evidence: `Viewport is "${doc.viewport}".` });
    }
  }

  return out;
}
