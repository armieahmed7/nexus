/**
 * F23 reserve matching: reuses the F08 opportunity engine (matchOpportunities: cosine fit of the needed skills, with reasons) on
 * the member's frozen skill snapshot, then adds three reserve-specific signals, each with its own reason for <WhyThis>:
 *   pref          the request's engagement type is one the member prefers (1) or not (0)
 *   availability  open 1, limited 0.6, outage-only 0.5, paused 0
 *   recency       how fresh the frozen snapshot is: departing or < 1 year 1, 1-3 years 0.8, 3-5 years 0.5, > 5 years 0.3
 * score = 0.6 fit + 0.2 pref + 0.1 availability + 0.1 recency. Deterministic; no personal attribute (age, gender, nationality) is an input.
 */
import { matchOpportunities, type MatchSkill } from './match';
import { bandOf, type SnapshotSkill } from './reserve';
import type { BiText, Ranked, Reason, Weights } from '../../domain/engines/types';

export const RESERVE_WEIGHTS = { fit: 0.6, pref: 0.2, availability: 0.1, recency: 0.1 };
export const AVAIL_SCORE: Record<string, number> = { open: 1, limited: 0.6, outage_only: 0.5, paused: 0 };
export const RECENCY_SCORE: Record<string, number> = { departing: 1, lt_1y: 1, y1_3: 0.8, y3_5: 0.5, gt_5y: 0.3 };
export const ENG_LABEL: Record<string, BiText> = {
  mentor: { en: 'mentoring', ar: 'الإرشاد' },
  capture_interview: { en: 'a knowledge-capture interview', ar: 'مقابلة توثيق المعرفة' },
  instructor: { en: 'guest instruction', ar: 'التدريب كمدرب ضيف' },
  reviewer: { en: 'independent review', ar: 'المراجعة المستقلة' },
};
const AVAIL_LABEL: Record<string, BiText> = {
  open: { en: 'open to requests', ar: 'متاح للطلبات' }, limited: { en: 'limited availability', ar: 'إتاحة محدودة' },
  outage_only: { en: 'outage periods only', ar: 'فترات الانقطاع فقط' }, paused: { en: 'paused', ar: 'متوقف مؤقتاً' },
};
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const R = (code: string, vars?: Reason['vars'], weight?: number, ref?: Reason['ref']): Reason => ({ code, key: `m20.reasons.${code}`, vars, weight, ref });

export interface ReserveMember { id: string; skill_snapshot: unknown; engagement_prefs: string[]; availability: string; hours_month: number; departed_on: string | null; snapshot_on: string }
export interface ReserveReq { id: string; skills_needed: string[]; engagement: string }
export interface ReserveMatch { fit: number; pref: number; availability: number; recency: number; have: number; need: number }

function scoreOne(m: ReserveMember, r: ReserveReq, skills: MatchSkill[], today: string, weights?: Weights): { score: number; reasons: Reason[]; parts: ReserveMatch } {
  const snap = ((m.skill_snapshot as SnapshotSkill[]) ?? []).map((s) => ({ skill_id: s.skill_id, level: s.level, active: true }));
  const base = matchOpportunities({ opps: [{ id: r.id, skills_needed: r.skills_needed, skills_gained: [] }], states: snap, skills, roleComps: [], weights: { skills: 1, development: 0, target: 0, ...(weights ?? {}) } })[0];
  const fit = base.item!.skills;
  const reasons = base.reasons.filter((x) => x.code === 'fit' || x.code === 'have' || x.code === 'stretch' || x.code === 'open').map((x) => (x.code === 'fit' ? { ...x, weight: r4(RESERVE_WEIGHTS.fit * fit) } : x));
  const pref = (m.engagement_prefs ?? []).includes(r.engagement) ? 1 : 0;
  reasons.push(R(pref ? 'res_pref' : 'res_pref_no', { kind: ENG_LABEL[r.engagement] ?? { en: r.engagement, ar: r.engagement } }, r4(RESERVE_WEIGHTS.pref * pref)));
  const availability = AVAIL_SCORE[m.availability] ?? 0;
  reasons.push(R('res_avail', { status: AVAIL_LABEL[m.availability] ?? { en: m.availability, ar: m.availability }, hours: m.hours_month }, r4(RESERVE_WEIGHTS.availability * availability)));
  const band = bandOf(m.departed_on, today);
  const recency = RECENCY_SCORE[band] ?? 0;
  reasons.push(R('res_recency', { date: m.snapshot_on }, r4(RESERVE_WEIGHTS.recency * recency)));
  const score = r4(RESERVE_WEIGHTS.fit * fit + RESERVE_WEIGHTS.pref * pref + RESERVE_WEIGHTS.availability * availability + RESERVE_WEIGHTS.recency * recency);
  return { score, reasons, parts: { fit, pref, availability, recency, have: base.item!.have, need: base.item!.need } };
}
const byScore = <T,>(a: Ranked<T>, b: Ranked<T>) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The alumni board: open requests ranked for one member. */
export function rankRequestsForMember<Q extends ReserveReq>(m: ReserveMember, reqs: Q[], skills: MatchSkill[], today: string, weights?: Weights): Ranked<{ req: Q } & ReserveMatch>[] {
  return reqs.map((r) => { const s = scoreOne(m, r, skills, today, weights); return { id: r.id, score: s.score, reasons: s.reasons, item: { req: r, ...s.parts } }; }).sort(byScore);
}
/** The HR shortlist: active members ranked for one request (withdrawn members never reach this list). */
export function rankMembersForRequest<M extends ReserveMember>(r: ReserveReq, members: M[], skills: MatchSkill[], today: string, weights?: Weights): Ranked<{ member: M } & ReserveMatch>[] {
  return members.map((m) => { const s = scoreOne(m, r, skills, today, weights); return { id: m.id, score: s.score, reasons: s.reasons, item: { member: m, ...s.parts } }; }).sort(byScore);
}
