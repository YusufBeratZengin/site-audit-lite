// Scoring. Every category starts at 100 points.
//
// Each failed check deducts SEVERITY_PENALTY[severity] points (error 20,
// warning 8, info 2). A page-scope check is scaled by the share of audited
// pages it affects; a site-scope check always deducts the full amount.
// Category scores are clamped to 0..100. The overall score is the average of
// the category scores weighted by CATEGORIES[..].weight (SEO 30, Security 25,
// Accessibility 20, Performance 15, Links 10).

import { CATEGORIES, SEVERITY_PENALTY } from './catalog.js';

export function gradeFor(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function computeScores(findings, pageCount) {
  const pages = Math.max(1, pageCount);
  const categories = {};
  for (const [key, meta] of Object.entries(CATEGORIES)) {
    categories[key] = { label: meta.label, weight: meta.weight, score: 100, penalty: 0 };
  }

  for (const finding of findings) {
    const cat = categories[finding.category];
    const share = finding.scope === 'page' ? Math.min(1, finding.affected.length / pages) : 1;
    cat.penalty += SEVERITY_PENALTY[finding.severity] * share;
  }

  let weighted = 0;
  let totalWeight = 0;
  for (const cat of Object.values(categories)) {
    cat.penalty = Math.round(cat.penalty * 10) / 10;
    cat.score = Math.max(0, Math.round(100 - cat.penalty));
    cat.grade = gradeFor(cat.score);
    weighted += cat.score * cat.weight;
    totalWeight += cat.weight;
  }
  const overall = Math.round(weighted / totalWeight);
  return { overall, grade: gradeFor(overall), categories };
}
