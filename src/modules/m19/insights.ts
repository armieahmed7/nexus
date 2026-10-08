/**
 * F07 Learning Coach: pure helpers shared by the LocalBackend RPCs, the seed builder and the tests.
 * coachInsightsOf is the TS twin of SQL kafaa_coach_insights (same grouping, rounding and suppression below MIN_GROUP_SIZE).
 * Import-free apart from `import type` and the policy constant, so node seed scripts can load it.
 */
import { MIN_GROUP_SIZE } from '../../auth/policy.ts';
import type { CoachInsightCell, CoachInsights } from './backend/rpc';

export const feedbackId = (personId: string, kind: string, itemId: string) => `cf:${personId}:${kind}:${itemId}`;
export const goalId = (personId: string) => `lg:${personId}`;
export const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

type Fb = { person_id: string; item_kind: string; signal: string };
type Goal = { person_id: string; hours_per_week: number | string };
type Person = { id: string; job_family_id?: string | null };

function cell(key: string, rows: Fb[]): CoachInsightCell {
  const live = rows.filter((r) => r.signal !== 'cleared');
  const people = new Set(live.map((r) => r.person_id)).size;
  if (people < MIN_GROUP_SIZE) return { key, people: null, saved: null, enrolled: null, dismissed: null, acceptance_pct: null, suppressed: true };
  const n = (s: string) => live.filter((r) => r.signal === s).length;
  const saved = n('saved'), enrolled = n('enrolled'), dismissed = n('dismissed');
  const den = saved + enrolled + dismissed;
  return { key, people, saved, enrolled, dismissed, acceptance_pct: den ? Math.round((1000 * (saved + enrolled)) / den) / 10 : null, suppressed: false };
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function coachInsightsOf(feedback: Fb[], goals: Goal[], people: Person[]): CoachInsights {
  const fam = new Map(people.map((p) => [p.id, p.job_family_id ?? 'unassigned']));
  const live = feedback.filter((r) => r.signal !== 'cleared');
  const group = (keyOf: (r: Fb) => string) => {
    const m = new Map<string, Fb[]>();
    for (const r of live) (m.get(keyOf(r)) ?? m.set(keyOf(r), []).get(keyOf(r))!).push(r);
    return [...m.keys()].sort().map((k) => cell(k, m.get(k)!));
  };
  const hours = goals.map((g) => Number(g.hours_per_week)).filter((h) => h > 0);
  const goalsOk = hours.length >= MIN_GROUP_SIZE;
  return {
    min_group: MIN_GROUP_SIZE,
    total: cell('all', live),
    by_kind: group((r) => r.item_kind),
    by_family: group((r) => fam.get(r.person_id) ?? 'unassigned'),
    goals: { people: goalsOk ? hours.length : null, median_hours: goalsOk ? median(hours) : null, suppressed: !goalsOk },
  };
}
