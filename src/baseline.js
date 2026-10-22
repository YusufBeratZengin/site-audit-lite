// Findings are matched by check id and affected URL; changing evidence is not a new issue.
import { SEVERITY_ORDER } from './catalog.js';

function occurrences(result) {
  if (!Array.isArray(result?.findings)) throw new Error('Baseline must contain a findings array.');
  return new Set(result.findings.flatMap((f) => f.affected.map((a) => JSON.stringify([f.id, a.url]))));
}

export function compareBaseline(result, previous) {
  const before = occurrences(previous);
  const after = occurrences(result);
  const findings = result.findings.map((f) => {
    const affected = f.affected.map((a) => ({ ...a, status: before.has(JSON.stringify([f.id, a.url])) ? 'unchanged' : 'new' }));
    return { ...f, affected, status: affected.some((a) => a.status === 'new') ? 'new' : 'unchanged' };
  });
  const fixed = previous.findings.map((f) => ({ ...f, status: 'fixed',
    affected: f.affected.filter((a) => !after.has(JSON.stringify([f.id, a.url]))).map((a) => ({ ...a, status: 'fixed' })),
  })).filter((f) => f.affected.length);
  return { ...result, findings, baseline: { fixed,
    new: findings.filter((f) => f.status === 'new').length,
    unchanged: findings.filter((f) => f.status === 'unchanged').length,
  } };
}

export function hasNewFindings(result, severity = 'error') {
  return result.findings.some((f) => f.status === 'new' && SEVERITY_ORDER[f.severity] <= SEVERITY_ORDER[severity]);
}
