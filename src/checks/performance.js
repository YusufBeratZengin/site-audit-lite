// Page-level performance hints based on sizes and headers gathered while crawling.

export const LIMITS = {
  pageWeightWarn: 1.5 * 1024 * 1024,
  htmlWarn: 200 * 1024,
  imageWarn: 300 * 1024,
  slowMs: 1500,
  compressMinBytes: 2048,
};

export function formatBytes(n) {
  if (n === null || n === undefined) return 'unknown';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * @param page   crawled page ({ headers, doc, bytes, timeMs })
 * @param weight { total, images: [{ url, bytes }] } computed by the audit
 */
export function checkPerformance(page, weight) {
  const { doc, headers, bytes, timeMs } = page;
  const out = [];

  if (weight.total > LIMITS.pageWeightWarn) {
    out.push({
      id: 'perf-page-weight',
      evidence: `About ${formatBytes(weight.total)} including same-site images, scripts and styles (limit ${formatBytes(LIMITS.pageWeightWarn)}).`,
    });
  }

  if (bytes !== null && bytes > LIMITS.htmlWarn) {
    out.push({ id: 'perf-html-size', evidence: `HTML is ${formatBytes(bytes)}.` });
  }

  const large = weight.images.filter((i) => i.bytes !== null && i.bytes > LIMITS.imageWarn);
  if (large.length) {
    out.push({
      id: 'perf-large-image',
      evidence: large
        .slice(0, 5)
        .map((i) => `${i.url} (${formatBytes(i.bytes)})`)
        .join('; '),
    });
  }

  const encoding = (headers['content-encoding'] || '').toLowerCase();
  if (bytes !== null && bytes > LIMITS.compressMinBytes && (!encoding || encoding === 'identity')) {
    out.push({ id: 'perf-compression', evidence: `HTML (${formatBytes(bytes)}) has no Content-Encoding.` });
  }

  if (timeMs > LIMITS.slowMs) {
    out.push({ id: 'perf-slow-response', evidence: `Page took ${timeMs} ms to download.` });
  }

  const noDims = doc.images.filter((i) => i.src && (!i.width || !i.height));
  if (noDims.length) {
    out.push({
      id: 'perf-img-dimensions',
      evidence: `${noDims.length} of ${doc.images.length} images lack width or height.`,
    });
  }

  if (doc.renderBlockingScripts.length) {
    out.push({
      id: 'perf-render-blocking-script',
      evidence: doc.renderBlockingScripts.slice(0, 3).join(', '),
    });
  }

  return out;
}
