/**
 * [G4] M11 rules: skills-gap arithmetic for the HR future-skills planner and the public-page guard.
 * Every number here is SIMULATED: an index from 0 to 100, never a headcount and never a forecast.
 * ENEC is evaluating these technologies; no deployment decision is implied.
 */

export const NO_DECISION_LINE_KEY = 'm11.common.noDecision';

/** Gap between a scenario's demand index and the current readiness index (both 0-100, SIMULATED). */
export function skillGap(demand: number, readiness: number): { gap: number; band: 'none' | 'low' | 'medium' | 'high' } {
  const gap = Math.max(0, Math.round((clamp(demand) - clamp(readiness)) * 10) / 10);
  return { gap, band: gap >= 30 ? 'high' : gap >= 15 ? 'medium' : gap > 0 ? 'low' : 'none' };
}
export const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 0));

/** What-if adjustment for the planner: scales a scenario's demand index by an adoption factor (0.5 to 1.5). */
export function adjustDemand(value: number, factor: number): number {
  return Math.round(clamp(value * Math.min(1.5, Math.max(0.5, factor))) * 10) / 10;
}

/** A gap plan action must name an owner role and a quarter in the form 2027-Q1, within the next five years. */
export function validGapPlan(p: { skill_key: string; action: string; owner_role: string; target_quarter: string }, now = new Date()): string[] {
  const problems: string[] = [];
  if (!p.skill_key) problems.push('skill');
  if (!['train', 'reskill', 'hire', 'partner', 'research'].includes(p.action)) problems.push('action');
  if (!p.owner_role || p.owner_role.trim().length < 3) problems.push('owner');
  const m = /^(\d{4})-Q([1-4])$/.exec(p.target_quarter ?? '');
  const y = now.getUTCFullYear();
  if (!m || Number(m[1]) < y || Number(m[1]) > y + 5) problems.push('quarter');
  return problems;
}

/**
 * Rule M11-R1 (acceptance): public M11 payloads carry no projected headcount or site information.
 * Used by the unit test over every public M11 table and by the /future page before render.
 */
export const HEADCOUNT_OR_SITE = /\b(headcount|fte|full[- ]time equivalents?|\d+\s*(staff|people|jobs|positions|operators|engineers|workers)|site (selection|identified|chosen)|candidate site|located at|to be built (at|in))\b/i;
export function publicTextIsClean(values: unknown[]): boolean {
  return values.every((v) => {
    const s = typeof v === 'string' ? v : v && typeof v === 'object' ? JSON.stringify(v) : '';
    return !HEADCOUNT_OR_SITE.test(s);
  });
}
