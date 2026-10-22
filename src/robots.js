// Minimal robots.txt parser (REST-style longest match, `*` and `$` wildcards).

const MAX_CRAWL_DELAY_SECONDS = 10;

/**
 * Parse robots.txt text for a given user agent product token (e.g. "site-audit-lite").
 * Returns { allows(path), crawlDelay, sitemaps }.
 */
export function parseRobots(text, agentToken = 'site-audit-lite') {
  const token = agentToken.toLowerCase();
  const groups = [];
  const sitemaps = [];
  let current = null;
  let lastWasAgent = false;

  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }
    if (field === 'user-agent') {
      if (!lastWasAgent || !current) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'allow' || field === 'disallow') {
      if (value === '' && field === 'disallow') continue; // empty Disallow allows everything
      current.rules.push({ allow: field === 'allow', pattern: value });
    } else if (field === 'crawl-delay') {
      const n = Number.parseFloat(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }

  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules).map((r) => ({ ...r, regex: patternToRegex(r.pattern) }));
  const delays = chosen.map((g) => g.crawlDelay).filter((d) => d !== null);
  const crawlDelay = delays.length ? Math.min(Math.max(...delays), MAX_CRAWL_DELAY_SECONDS) : null;

  return {
    crawlDelay,
    sitemaps,
    allows(path) {
      let best = null;
      for (const rule of rules) {
        if (!rule.regex.test(path)) continue;
        const len = rule.pattern.length;
        if (best === null || len > best.len || (len === best.len && rule.allow)) {
          best = { len, allow: rule.allow };
        }
      }
      return best === null ? true : best.allow;
    },
  };
}

function patternToRegex(pattern) {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`);
}

/** A permissive policy used when robots.txt is missing or unreadable. */
export function allowAll() {
  return parseRobots('');
}
