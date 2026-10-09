/**
 * F14 Knowledge refreshers (M19, wave 2 · E3): spaced practice from the open practice bank, without gamification. Pure rules shared
 * by the LocalBackend (backend/local.ts), the seed builder (scripts/seed/ext/f14-refreshers.mjs), the pages, the PGlite validator and
 * the tests. Import-free (node loads this file directly).
 * SQL mirror: supabase/migrations/20261009123001_kafaa_w2e3_mentoring_refreshers.sql (kafaa_refresh_pick, kafaa_next_refresher,
 * kafaa_submit_refresher, kafaa_refresher_item_stats). Same selection, order, schedule and suppression: change both together.
 *
 * Leitner boxes 1..5. A correct answer moves an item up one box, a wrong answer back to box 1; the next due date is today plus
 * BOX_DAYS[new box] (1, 3, 7, 14, 30 days). Selection: due items first (oldest due date, lowest box, heaviest topic, id), then
 * new items interleaved across competencies by weight (key (rank - 0.5) / weight, easy before medium before hard). Weight of a
 * competency: 0.25 base, +1 when my current role needs it, +1 when a qualification of mine that evidences it expires within a year.
 * Five questions a day or a week (my cadence); "extra" practice ignores the quota. Only approved practice-bank items, ever.
 * Progress is private: competency confidence bars only. No streaks, points, badges or rankings (spec commitment 5).
 */
import { MIN_GROUP_SIZE } from '../../auth/policy.ts';

export const BOX_DAYS = [0, 1, 3, 7, 14, 30];
export const MAX_BOX = 5;
export const SET_SIZE = 5;
export const REQUAL_WINDOW_DAYS = 365;
export const W_BASE = 0.25;
export const W_ROLE = 1;
export const W_REQUAL = 1;
export const CADENCES = ['daily', 'weekly', 'paused'] as const;
export type RefreshCadence = (typeof CADENCES)[number];
export const DIFF_RANK: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
export const TOO_EASY = 0.9;
export const TOO_HARD = 0.3;
export const MIN_GROUP = MIN_GROUP_SIZE;

export const MSG = {
  not_signed_in: 'Sign in to practise',
  forbidden: 'Knowledge refreshers are for staff',
  invalid: 'Answer one to five different questions, choosing one of the given options',
  not_practice: 'Only open practice-bank questions can be answered here',
  stats_forbidden: 'Refresher item statistics are for instructors and the training manager (aggregates only)',
} as const;

const dayNo = (iso: string) => Math.floor(Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`) / 86_400_000);
export const addDaysIso = (iso: string, n: number) => new Date((dayNo(iso) + n) * 86_400_000).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => dayNo(to) - dayNo(from);
/** Monday of the ISO week of `iso` (SQL date_trunc('week', d)). */
export const weekStart = (iso: string) => {
  const d = dayNo(iso);
  const dow = (((d + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday; 0 = Sunday
  return addDaysIso(iso, -((dow + 6) % 7));
};
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const nextBox = (box: number, correct: boolean) => (correct ? Math.min(MAX_BOX, Math.max(1, box) + 1) : 1);
export const dueAfter = (box: number, today: string) => addDaysIso(today, BOX_DAYS[Math.max(1, Math.min(MAX_BOX, box))]);
export const stateId = (personId: string, itemId: string) => `rs:${personId}:${itemId}`;

// ───────────── rows (structural)
export interface ItemLite { id: string; bank: string; is_practice?: boolean | null; status: string; competency_id?: string | null; topic?: string | null; difficulty?: string | null; current_version?: number | null; reference?: string | null; p_value?: number | string | null }
export interface VersionLite { item_id: string; version: number; stem_en: string; stem_ar: string; options: { id: string; en: string; ar: string; [k: string]: unknown }[]; answer: string; rationale_en?: string | null; rationale_ar?: string | null }
export interface StateLite { id?: string; person_id: string; item_id: string; competency_id?: string | null; box: number; due_on: string; last_result?: string | null; last_at?: string | null; attempts?: number | null; correct?: number | null }
export interface RoleCompLite { role_id: string; competency_id: string }
export interface QualLite { person_id?: string; standard_id: string; expires_on?: string | null; security_mirror_only?: boolean | null }
export interface SkillLite { competency_id: string; evidence_keys?: string[] | null }

/** An approved item of the open practice bank (never the secure bank). */
export const isPracticeItem = (i: ItemLite | undefined | null): i is ItemLite => !!i && i.bank === 'practice' && i.is_practice === true && i.status === 'approved' && !!i.competency_id;

export interface CompWeight { competency_id: string; weight: number; role: boolean; requal_standard_id: string | null; requal_days: number | null }
/** Topic weights per competency for one person. */
export function competencyWeights(args: { comps: string[]; roleId: string | null; roleComps: RoleCompLite[]; quals: QualLite[]; skills: SkillLite[]; today: string }): Map<string, CompWeight> {
  const role = new Set(args.roleComps.filter((r) => r.role_id === args.roleId).map((r) => r.competency_id));
  const req = new Map<string, { std: string; days: number }>();
  for (const q of args.quals) {
    if (!q.expires_on || q.security_mirror_only) continue;
    const days = daysBetween(args.today, q.expires_on);
    if (days < 0 || days > REQUAL_WINDOW_DAYS) continue;
    for (const s of args.skills) {
      if (!(s.evidence_keys ?? []).includes(q.standard_id)) continue;
      const cur = req.get(s.competency_id);
      if (!cur || days < cur.days || (days === cur.days && q.standard_id < cur.std)) req.set(s.competency_id, { std: q.standard_id, days });
    }
  }
  const out = new Map<string, CompWeight>();
  for (const c of args.comps) {
    const r = req.get(c);
    out.set(c, { competency_id: c, weight: W_BASE + (role.has(c) ? W_ROLE : 0) + (r ? W_REQUAL : 0), role: role.has(c), requal_standard_id: r?.std ?? null, requal_days: r?.days ?? null });
  }
  return out;
}

export interface Pick extends CompWeight { item_id: string; state: 'due' | 'new'; box: number; due_on: string | null }
export interface PickResult { picks: Pick[]; due_count: number; new_count: number; next_due_on: string | null; used: number; limit: number; window: 'day' | 'week' }

/** Quota window and how many answers already fall inside it. Paused counts as weekly. */
export function quotaUsed(states: StateLite[], cadence: RefreshCadence, today: string): { used: number; window: 'day' | 'week' } {
  const window = cadence === 'daily' ? 'day' : 'week';
  const from = window === 'day' ? today : weekStart(today);
  return { window, used: states.filter((s) => s.last_at && String(s.last_at).slice(0, 10) >= from && String(s.last_at).slice(0, 10) <= today).length };
}

/** The server-side pick (kafaa_refresh_pick): due first, then new items interleaved by weight; up to the quota (or SET_SIZE when extra). */
export function pickRefresher(args: {
  items: ItemLite[]; states: StateLite[]; weights: Map<string, CompWeight>; today: string; cadence: RefreshCadence; extra?: boolean;
}): PickResult {
  const pool = args.items.filter(isPracticeItem);
  const byId = new Map(args.states.map((s) => [s.item_id, s]));
  const w = (c: string) => args.weights.get(c) ?? { competency_id: c, weight: W_BASE, role: false, requal_standard_id: null, requal_days: null };
  const due = pool.filter((i) => byId.has(i.id) && byId.get(i.id)!.due_on <= args.today)
    .map((i) => ({ i, s: byId.get(i.id)!, cw: w(i.competency_id!) }))
    .sort((a, b) => cmp(a.s.due_on, b.s.due_on) || a.s.box - b.s.box || b.cw.weight - a.cw.weight || cmp(a.i.id, b.i.id));
  const fresh = pool.filter((i) => !byId.has(i.id));
  const rank = new Map<string, number>();
  const byComp = new Map<string, ItemLite[]>();
  for (const i of fresh) (byComp.get(i.competency_id!) ?? byComp.set(i.competency_id!, []).get(i.competency_id!)!).push(i);
  for (const list of byComp.values()) list.sort((a, b) => (DIFF_RANK[a.difficulty ?? 'medium'] ?? 2) - (DIFF_RANK[b.difficulty ?? 'medium'] ?? 2) || cmp(a.id, b.id)).forEach((i, k) => rank.set(i.id, k + 1));
  const key = (i: ItemLite) => r4((rank.get(i.id)! - 0.5) / w(i.competency_id!).weight);
  const newer = fresh.map((i) => ({ i, k: key(i), cw: w(i.competency_id!) })).sort((a, b) => a.k - b.k || cmp(a.i.competency_id!, b.i.competency_id!) || cmp(a.i.id, b.i.id));
  const { used, window } = quotaUsed(args.states, args.cadence, args.today);
  const limit = args.extra ? SET_SIZE : Math.max(0, SET_SIZE - used);
  const picks: Pick[] = [
    ...due.map(({ i, s, cw }) => ({ ...cw, item_id: i.id, state: 'due' as const, box: s.box, due_on: s.due_on })),
    ...newer.map(({ i, cw }) => ({ ...cw, item_id: i.id, state: 'new' as const, box: 1, due_on: null })),
  ].slice(0, limit);
  const upcoming = args.states.filter((s) => s.due_on > args.today && pool.some((i) => i.id === s.item_id)).map((s) => s.due_on).sort();
  return { picks, due_count: due.length, new_count: fresh.length, next_due_on: upcoming[0] ?? null, used, limit, window };
}

/** Apply one answer to a state (kafaa_submit_refresher): new box, due date, counters. */
export function applyAnswer(prev: StateLite | undefined, correct: boolean, today: string) {
  const before = prev?.box ?? 1;
  const box = nextBox(before, correct);
  return { box_before: before, box, due_on: dueAfter(box, today), attempts: Number(prev?.attempts ?? 0) + 1, correct: Number(prev?.correct ?? 0) + (correct ? 1 : 0), last_result: correct ? 'correct' : 'wrong' };
}

export interface Confidence { competency_id: string; items: number; seen: number; mastered: number; pct: number }
/** Private competency confidence: share of the competency's practice items climbed up the boxes (box 1 = 0, box 5 = 1). */
export function confidenceByCompetency(items: ItemLite[], states: StateLite[]): Confidence[] {
  const pool = items.filter(isPracticeItem);
  const st = new Map(states.map((s) => [s.item_id, s]));
  const comps = [...new Set(pool.map((i) => i.competency_id!))].sort(cmp);
  return comps.map((c) => {
    const list = pool.filter((i) => i.competency_id === c);
    const boxes = list.map((i) => st.get(i.id)?.box ?? 0);
    const sum = boxes.reduce((s, b) => s + (b > 0 ? (b - 1) / (MAX_BOX - 1) : 0), 0);
    return { competency_id: c, items: list.length, seen: boxes.filter((b) => b > 0).length, mastered: boxes.filter((b) => b >= 4).length, pct: Math.round((100 * sum) / Math.max(1, list.length)) };
  });
}

// ───────────── instructor view: item difficulty from refreshers, aggregate only (people >= MIN_GROUP)
export interface ItemStat { item_id: string; competency_id: string; topic: string; difficulty: string; people: number | null; attempts: number | null; p_value: number | null; bank_p_value: number | null; flag: 'too_easy' | 'too_hard' | null; suppressed: boolean }
export interface CompStat { competency_id: string; people: number | null; attempts: number | null; p_value: number | null; suppressed: boolean }
export interface RefresherItemStats { min_group: number; items: ItemStat[]; by_competency: CompStat[] }
const p3 = (x: number) => Math.round(x * 1000) / 1000;
export function itemStatsOf(items: ItemLite[], states: StateLite[]): RefresherItemStats {
  const pool = items.filter(isPracticeItem).sort((a, b) => cmp(a.id, b.id));
  const out: ItemStat[] = pool.map((i) => {
    const rows = states.filter((s) => s.item_id === i.id && Number(s.attempts ?? 0) > 0);
    const people = new Set(rows.map((r) => r.person_id)).size;
    const att = rows.reduce((s, r) => s + Number(r.attempts ?? 0), 0);
    const cor = rows.reduce((s, r) => s + Number(r.correct ?? 0), 0);
    const sup = people < MIN_GROUP;
    const p = sup || !att ? null : p3(cor / att);
    return {
      item_id: i.id, competency_id: i.competency_id!, topic: i.topic ?? '', difficulty: i.difficulty ?? 'medium', people: sup ? null : people, attempts: sup ? null : att, p_value: p,
      bank_p_value: i.p_value == null ? null : Number(i.p_value), flag: p == null ? null : p > TOO_EASY ? 'too_easy' : p < TOO_HARD ? 'too_hard' : null, suppressed: sup,
    };
  });
  const comps = [...new Set(pool.map((i) => i.competency_id!))].sort(cmp);
  const by_competency = comps.map((c): CompStat => {
    const ids = new Set(pool.filter((i) => i.competency_id === c).map((i) => i.id));
    const rows = states.filter((s) => ids.has(s.item_id) && Number(s.attempts ?? 0) > 0);
    const people = new Set(rows.map((r) => r.person_id)).size;
    const att = rows.reduce((s, r) => s + Number(r.attempts ?? 0), 0);
    const cor = rows.reduce((s, r) => s + Number(r.correct ?? 0), 0);
    const sup = people < MIN_GROUP;
    return { competency_id: c, people: sup ? null : people, attempts: sup ? null : att, p_value: sup || !att ? null : p3(cor / att), suppressed: sup };
  });
  return { min_group: MIN_GROUP, items: out, by_competency };
}
