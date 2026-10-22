// A small, tolerant HTML scanner. It does not build a DOM; it produces a flat
// list of tokens and a summary of the facts the audit checks need.

const RAW_TEXT = new Set(['script', 'style']);
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });
}

function parseAttributes(source) {
  const attrs = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1].toLowerCase();
    if (name in attrs) continue;
    const raw = m[2] ?? m[3] ?? m[4];
    attrs[name] = raw === undefined ? '' : decodeEntities(raw);
  }
  return attrs;
}

/**
 * Tokenize HTML into { type: 'open'|'close'|'text', ... } tokens.
 * Never throws; malformed input yields best-effort tokens.
 */
export function tokenize(html) {
  const tokens = [];
  const len = html.length;
  let i = 0;
  while (i < len) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      tokens.push({ type: 'text', text: html.slice(i) });
      break;
    }
    if (lt > i) tokens.push({ type: 'text', text: html.slice(i, lt) });

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = html.indexOf('>', lt);
      i = end === -1 ? len : end + 1;
      continue;
    }
    const closing = html[lt + 1] === '/';
    const nameStart = lt + (closing ? 2 : 1);
    const nameMatch = /^[a-zA-Z][^\s/>]*/.exec(html.slice(nameStart, nameStart + 60));
    if (!nameMatch) {
      tokens.push({ type: 'text', text: '<' });
      i = lt + 1;
      continue;
    }
    const name = nameMatch[0].toLowerCase();
    // Find the end of the tag, honouring quoted attribute values.
    const attrStart = nameStart + nameMatch[0].length;
    let j = attrStart;
    let quote = null;
    for (; j < len; j++) {
      const c = html[j];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '>') {
        break;
      }
    }
    const attrSource = html.slice(attrStart, j);
    i = j < len ? j + 1 : len;

    if (closing) {
      tokens.push({ type: 'close', name });
      continue;
    }
    const selfClosing = /\/\s*$/.test(attrSource) || VOID.has(name);
    tokens.push({ type: 'open', name, attrs: parseAttributes(attrSource), selfClosing });

    if (RAW_TEXT.has(name) && !selfClosing) {
      const re = new RegExp(`</${name}[\\s>/]`, 'ig');
      re.lastIndex = i;
      const m = re.exec(html);
      const endAt = m ? m.index : len;
      const text = html.slice(i, endAt);
      if (text) tokens.push({ type: 'text', text, raw: true });
      i = endAt;
    }
  }
  return tokens;
}

function collapse(text) {
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

const NON_LABELLED_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'image', 'reset']);

/**
 * Scan an HTML document and return the facts used by the checks.
 */
export function scan(html) {
  const tokens = tokenize(html);
  const doc = {
    title: null,
    lang: null,
    metas: [],
    description: null,
    robotsMeta: null,
    viewport: null,
    canonical: null,
    openGraph: {},
    hasStructuredData: false,
    h1: [],
    headingCount: 0,
    images: [],
    links: [],
    emptyLinks: [],
    stylesheets: [],
    scripts: [],
    iframes: [],
    icons: [],
    formControls: [],
    unlabelledControls: [],
    renderBlockingScripts: [],
  };

  let inHead = false;
  let inTitle = false;
  let titleBuf = '';
  let h1Buf = null;
  let anchor = null;
  let labelDepth = 0;
  const labelFor = new Set();
  const controls = [];

  for (const t of tokens) {
    if (t.type === 'text') {
      if (inTitle) titleBuf += t.text;
      if (h1Buf !== null && !t.raw) h1Buf += t.text;
      if (anchor && !t.raw) anchor.text += t.text;
      continue;
    }
    if (t.type === 'close') {
      switch (t.name) {
        case 'head': inHead = false; break;
        case 'title':
          if (inTitle) {
            doc.title = collapse(titleBuf);
            inTitle = false;
          }
          break;
        case 'h1':
          if (h1Buf !== null) {
            doc.h1.push(collapse(h1Buf));
            h1Buf = null;
          }
          break;
        case 'a':
          if (anchor) {
            if (!collapse(anchor.text) && !anchor.labelled) doc.emptyLinks.push(anchor.href);
            anchor = null;
          }
          break;
        case 'label': labelDepth = Math.max(0, labelDepth - 1); break;
        default:
      }
      continue;
    }

    const { name, attrs } = t;
    switch (name) {
      case 'html':
        if (attrs.lang !== undefined) doc.lang = attrs.lang.trim();
        break;
      case 'head': inHead = !t.selfClosing; break;
      case 'title':
        if (doc.title === null && !inTitle) {
          inTitle = true;
          titleBuf = '';
        }
        break;
      case 'meta': {
        doc.metas.push(attrs);
        const key = (attrs.name || attrs.property || '').toLowerCase();
        const content = attrs.content ?? '';
        if (key === 'description' && doc.description === null) doc.description = content.trim();
        else if (key === 'robots') doc.robotsMeta = content.toLowerCase();
        else if (key === 'viewport') doc.viewport = content;
        else if (key.startsWith('og:')) doc.openGraph[key.slice(3)] = content;
        break;
      }
      case 'link': {
        const rel = (attrs.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
        if (rel.includes('canonical') && doc.canonical === null) doc.canonical = attrs.href ?? '';
        if (rel.includes('stylesheet') && attrs.href) doc.stylesheets.push(attrs.href);
        if (rel.includes('icon') && attrs.href) doc.icons.push(attrs.href);
        break;
      }
      case 'script':
        if ((attrs.type || '').toLowerCase() === 'application/ld+json') doc.hasStructuredData = true;
        if (attrs.src) {
          doc.scripts.push(attrs.src);
          const type = (attrs.type || '').toLowerCase();
          if (inHead && !('async' in attrs) && !('defer' in attrs) && type !== 'module') {
            doc.renderBlockingScripts.push(attrs.src);
          }
        }
        break;
      case 'h1':
        doc.headingCount++;
        h1Buf = '';
        break;
      case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        doc.headingCount++;
        break;
      case 'img':
        doc.images.push({
          src: attrs.src ?? '',
          alt: attrs.alt,
          width: attrs.width,
          height: attrs.height,
          role: attrs.role,
          ariaHidden: attrs['aria-hidden'],
        });
        if (anchor && (attrs.alt ?? '').trim()) anchor.labelled = true;
        break;
      case 'iframe':
        if (attrs.src) doc.iframes.push(attrs.src);
        break;
      case 'a':
        if (attrs.href !== undefined) {
          doc.links.push(attrs.href);
          anchor = {
            href: attrs.href,
            text: '',
            labelled: Boolean((attrs['aria-label'] || attrs['aria-labelledby'] || attrs.title || '').trim()),
          };
        }
        break;
      case 'label':
        if (attrs.for) labelFor.add(attrs.for);
        if (!t.selfClosing) labelDepth++;
        break;
      case 'input': case 'select': case 'textarea': {
        const type = (attrs.type || 'text').toLowerCase();
        if (name === 'input' && NON_LABELLED_INPUT_TYPES.has(type)) break;
        controls.push({
          tag: name,
          type: name === 'input' ? type : name,
          id: attrs.id,
          name: attrs.name,
          wrapped: labelDepth > 0,
          named: Boolean((attrs['aria-label'] || attrs['aria-labelledby'] || attrs.title || '').trim()),
        });
        break;
      }
      default:
    }
  }

  doc.formControls = controls;
  doc.unlabelledControls = controls.filter(
    (c) => !c.wrapped && !c.named && !(c.id && labelFor.has(c.id)),
  );
  return doc;
}
