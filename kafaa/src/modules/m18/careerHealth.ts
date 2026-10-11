/**
 * FS35 Career Health check (Assess, Chart, Execute) (FS wave D · E4, M18). Pure rules, import-free apart from other pure rule
 * files (F05 months, FS34 coverage), so the seed builder, the PGlite validator, the LocalBackend and the page share them.
 * SQL mirror, change both together: supabase/migrations/20261010244001_kafaa_fs44_translator_health.sql
 *   careerHealth() = kafaa_fs35_health(p_person text, p_today date)
 *
 * Benchmarks: Career Health SG and the ACE framework (Assess your career health, Chart your path, Execute your plan; MOM
 * Singapore, 2025), WEF Future of Jobs 2025 (39% of workers' core skills are expected to change by 2030: the comparison line on
 * the change component).
 *
 * Five visible components, each with its inputs, a status (good / watch / act, or n/a) and the reasons behind it. There is
 * no single hidden score: the page shows "n of 5 in good shape", which anyone can recount from the five tiles.
 *   currency  share of my active skills whose evidence is current (FS03): a skill is "ageing" when every piece of evidence is
 *             past its half-life, "due" when its newest current evidence is within 6 months of the half-life (a current
 *             qualification holds while the record is current), else "current". good >= 80%, watch >= 60%.
 *   breadth   skill areas where I hold level 2 or more (security excluded), with the transferable (transversal and
 *             cross-sectoral) skills and the skills beyond my role's competencies. good >= 4 areas, watch >= 2.
 *   recency   months since my last completed learning (training records, external completions, completed pathways), and the
 *             number completed in the last 12 months. good <= 6 months, watch <= 12.
 *   mobility  current roles (not mine, not security, not concept) whose competencies I cover at 70% or more with the F05
 *             Navigator formula (FS34 coverageOf), and stretch roles at 50-69%. good >= 3, watch >= 1.
 *   change    my role in 2030 (FS11 map): the share of rated tasks that change (AI-assisted or partly automatable), the share
 *             of the 2030 profile that is new or raised, and my readiness for it. good >= 80% ready, watch >= 50%.
 * Own only: never shown to managers and never used in talent review (kafaa_health_snapshots is own_profile Own).
 */
import { monthsBetween, type Reason } from './career.ts';
import { coverageOf, profileOf } from './translate.ts';

export const HEALTH_KEYS = ['currency', 'breadth', 'recency', 'mobility', 'change'] as const;
export type HealthKey = (typeof HEALTH_KEYS)[number];
export type HealthStatus = 'good' | 'watch' | 'act' | 'na';
export const HEALTH_RULES = {
  currency: { good: 80, watch: 60, due_months: 6, default_hl: 36 },
  breadth: { good: 4, watch: 2, min_level: 2 },
  recency: { good: 6, watch: 12, window: 12 },
  mobility: { good: 3, watch: 1, reach_pct: 70, stretch_pct: 50, top: 3 },
  change: { good: 80, watch: 50, horizon: '2030' },
} as const;
export const ACTION_OF: Record<HealthKey, string> = { currency: 'refresh', breadth: 'broaden', recency: 'learn', mobility: 'explore', change: 'bridge' };
const TRANSFERABLE = ['transversal', 'cross_sectoral'];
const LEARN_RESULTS = ['passed', 'completed'];

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const rsn = (code: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code: `fs35_${code}`, key: `m18.fs35.reason.${code}`, ...(vars ? { vars } : {}), ...(ref ? { ref } : {}) });
/** Round half up of 100 × num / den with integers only (the FS11 rule; SQL computes the same). */
export const pctOf = (n: number, den: number): number | null => (den > 0 ? Math.floor((200 * n + den) / (2 * den)) : null);
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));

export interface EvReason { observed_on?: string | null; ageing?: boolean | null; hl?: number | null; source?: string | null }
export interface HealthState { skill_id: string; level: number; active?: boolean | null; reasons?: EvReason[] | unknown }
export interface HealthSkill { id: string; area: string; reusability?: string | null; competency_id: string; core: boolean }
export interface MapLite {
  path_only: boolean;
  counts: { rated: number; grow: number; augmented: number; shrink: number };
  added: { horizon: string }[];
  bridge: { horizon: string; course_id: string | null }[];
  me: { ready_pct: number; months: number; requirements: number } | null;
}
export interface HealthData {
  person: { id: string; job_role_id?: string | null };
  roles: { id: string; lifecycle?: string | null; security_sensitive?: boolean | null }[];
  roleComps: { role_id: string; competency_id: string; required_level: number; importance: string }[];
  skills: HealthSkill[];
  states: HealthState[];
  training: { person_id: string; completed_on?: string | null; result?: string | null }[];
  external: { person_id: string; completed_on?: string | null }[];
  pathways: { person_id: string; status?: string | null; completed_on?: string | null }[];
  weights?: Record<string, number>;
  /** FS11 map of my role at 2030 (transformRole / kafaa_rt_map), null when I have no current role. */
  map: MapLite | null;
}
export type SkillCurrency = 'current' | 'due' | 'ageing';
export interface HealthComponent { key: HealthKey; status: HealthStatus; value: number | null; unit: 'pct' | 'count' | 'months'; inputs: Record<string, number | null>; refs: string[]; reasons: Reason[] }
export interface HealthAction { key: string; component: HealthKey; refs: string[] }
export interface HealthResult { as_of: string; person_id: string; role_id: string | null; components: HealthComponent[]; good: number; watch: number; act: number; actions: HealthAction[] }

const band = (v: number, good: number, watch: number, higherIsBetter = true): HealthStatus =>
  higherIsBetter ? (v >= good ? 'good' : v >= watch ? 'watch' : 'act') : (v <= good ? 'good' : v <= watch ? 'watch' : 'act');

/** Currency of one skill state from its stored FS03 reasons. */
export function skillCurrency(s: HealthState, today: string): SkillCurrency {
  const rs = (Array.isArray(s.reasons) ? (s.reasons as EvReason[]) : []).filter((r) => r && !r.ageing && r.observed_on);
  if (!rs.length) return 'ageing';
  const newest = [...rs].sort((a, b) => cmp(String(b.observed_on), String(a.observed_on)) || num(b.hl ?? HEALTH_RULES.currency.default_hl) - num(a.hl ?? HEALTH_RULES.currency.default_hl))[0];
  if (newest.source === 'qualification') return 'current';
  const hl = num(newest.hl ?? HEALTH_RULES.currency.default_hl);
  return monthsBetween(String(newest.observed_on), today) >= hl - HEALTH_RULES.currency.due_months ? 'due' : 'current';
}

export function careerHealth(d: HealthData, today: string): HealthResult {
  const me = d.person.id;
  const roleId = d.person.job_role_id ?? null;
  const live = d.states.filter((s) => s.active !== false);
  const skillById = new Map(d.skills.map((s) => [s.id, s]));
  const comps: HealthComponent[] = [];

  // currency
  {
    const R = HEALTH_RULES.currency;
    const rows = live.map((s) => ({ s, c: skillCurrency(s, today) }));
    const n = { current: 0, due: 0, ageing: 0 };
    for (const x of rows) n[x.c]++;
    const total = rows.length;
    const pct = pctOf(n.current, total);
    const refs = rows.filter((x) => x.c !== 'current').sort((a, b) => Number(b.c === 'ageing') - Number(a.c === 'ageing') || num(b.s.level) - num(a.s.level) || cmp(a.s.skill_id, b.s.skill_id)).slice(0, 5).map((x) => x.s.skill_id);
    const reasons = total ? [rsn('currency_rule', { current: n.current, total, pct: pct! }), rsn('currency_split', { due: n.due, ageing: n.ageing, months: R.due_months })] : [rsn('currency_none')];
    comps.push({ key: 'currency', status: pct == null ? 'na' : band(pct, R.good, R.watch), value: pct, unit: 'pct', inputs: { total, current: n.current, due: n.due, ageing: n.ageing }, refs, reasons });
  }
  // breadth
  {
    const R = HEALTH_RULES.breadth;
    const held = live.filter((s) => num(s.level) >= R.min_level && skillById.has(s.skill_id) && skillById.get(s.skill_id)!.area !== 'security');
    const areas = [...new Set(held.map((s) => skillById.get(s.skill_id)!.area))].sort(cmp);
    const all = new Set(d.skills.filter((s) => s.area !== 'security').map((s) => s.area)).size;
    const transferable = held.filter((s) => TRANSFERABLE.includes(String(skillById.get(s.skill_id)!.reusability))).length;
    const mine = new Set(d.roleComps.filter((r) => r.role_id === roleId).map((r) => r.competency_id));
    const beyond = roleId ? held.filter((s) => !mine.has(skillById.get(s.skill_id)!.competency_id)).length : 0;
    const reasons = held.length ? [rsn('breadth_rule', { n: areas.length, of: all, level: R.min_level }), rsn('breadth_transfer', { n: transferable }), rsn('breadth_beyond', { n: beyond })] : [rsn('breadth_none')];
    comps.push({ key: 'breadth', status: live.length === 0 ? 'na' : band(areas.length, R.good, R.watch), value: areas.length, unit: 'count', inputs: { areas: areas.length, of: all, transferable, beyond_role: beyond }, refs: areas, reasons });
  }
  // recency
  {
    const R = HEALTH_RULES.recency;
    const dates = [
      ...d.training.filter((t) => t.person_id === me && t.completed_on && LEARN_RESULTS.includes(String(t.result))).map((t) => String(t.completed_on).slice(0, 10)),
      ...d.external.filter((t) => t.person_id === me && t.completed_on).map((t) => String(t.completed_on).slice(0, 10)),
      ...d.pathways.filter((t) => t.person_id === me && t.status === 'completed' && t.completed_on).map((t) => String(t.completed_on).slice(0, 10)),
    ].filter((x) => x <= today).sort(cmp);
    const last = dates.length ? dates[dates.length - 1] : null;
    const since = last ? monthsBetween(last, today) : null;
    const inWindow = dates.filter((x) => monthsBetween(x, today) < R.window).length;
    const reasons = last ? [rsn('recency_last', { date: last, months: since! }), rsn('recency_window', { n: inWindow, months: R.window })] : [rsn('recency_none')];
    comps.push({ key: 'recency', status: since == null ? 'act' : band(since, R.good, R.watch, false), value: since, unit: 'months', inputs: { months_since: since, last_12m: inWindow, total: dates.length }, refs: last ? [last] : [], reasons });
  }
  // mobility
  {
    const R = HEALTH_RULES.mobility;
    const have = profileOf(d.skills, live.map((s) => ({ skill_id: s.skill_id, level: num(s.level) })));
    const withComps = new Set(d.roleComps.map((r) => r.role_id));
    const scored = d.roles
      .filter((r) => (r.lifecycle ?? 'current') === 'current' && !r.security_sensitive && r.id !== roleId && withComps.has(r.id))
      .map((r) => ({ id: r.id, pct: coverageOf(have, d.roleComps, r.id, d.weights).pct }))
      .sort((a, b) => b.pct - a.pct || cmp(a.id, b.id));
    const reach = scored.filter((x) => x.pct >= R.reach_pct);
    const stretch = scored.filter((x) => x.pct >= R.stretch_pct && x.pct < R.reach_pct).length;
    const refs = scored.slice(0, R.top).map((x) => x.id);
    const reasons = [rsn('mobility_rule', { n: reach.length, pct: R.reach_pct, of: scored.length }), rsn('mobility_stretch', { n: stretch, from: R.stretch_pct, to: R.reach_pct - 1 })];
    if (scored.length) reasons.push(rsn('mobility_best', { pct: scored[0].pct }, { table: 'job_roles', id: scored[0].id }));
    comps.push({ key: 'mobility', status: band(reach.length, R.good, R.watch), value: reach.length, unit: 'count', inputs: { reach: reach.length, stretch, roles: scored.length, best_pct: scored.length ? scored[0].pct : null }, refs, reasons });
  }
  // change (FS11)
  {
    const R = HEALTH_RULES.change;
    const m = d.map;
    if (!roleId || !m) comps.push({ key: 'change', status: 'na', value: null, unit: 'pct', inputs: { rated: null, exposure_pct: null, change_pct: null, ready_pct: null, months: null }, refs: [], reasons: [rsn('change_no_role')] });
    else if (m.path_only || !m.me) comps.push({ key: 'change', status: 'na', value: null, unit: 'pct', inputs: { rated: null, exposure_pct: null, change_pct: null, ready_pct: null, months: null }, refs: [], reasons: [rsn('change_path_only')] });
    else {
      const rated = num(m.counts.rated);
      const exposure = pctOf(num(m.counts.augmented) + num(m.counts.shrink), rated);
      const added = m.added.filter((a) => a.horizon === R.horizon).length;
      const change = pctOf(added, num(m.me.requirements));
      const ready = num(m.me.ready_pct);
      const refs = [...new Set(m.bridge.filter((b) => b.horizon === R.horizon && b.course_id).map((b) => b.course_id as string))].slice(0, 3);
      const reasons = [
        exposure == null ? rsn('change_no_tasks') : rsn('change_tasks', { pct: exposure, n: num(m.counts.augmented) + num(m.counts.shrink), of: rated }),
        rsn('change_profile', { n: added, of: num(m.me.requirements), pct: change ?? 0 }),
        rsn('change_ready', { pct: ready, months: num(m.me.months) }),
      ];
      comps.push({ key: 'change', status: band(ready, R.good, R.watch), value: ready, unit: 'pct', inputs: { rated, exposure_pct: exposure, change_pct: change, ready_pct: ready, months: num(m.me.months) }, refs, reasons });
    }
  }
  const count = (s: HealthStatus) => comps.filter((c) => c.status === s).length;
  const actions: HealthAction[] = comps.filter((c) => c.status === 'watch' || c.status === 'act').map((c) => ({ key: ACTION_OF[c.key], component: c.key, refs: c.key === 'breadth' ? [] : c.key === 'recency' ? [] : c.refs }));
  return { as_of: today, person_id: me, role_id: roleId, components: comps, good: count('good'), watch: count('watch'), act: count('act'), actions };
}

// ───────────── Plans (the Chart step) and snapshots
export const PLAN_ACTIONS = ['refresh', 'broaden', 'learn', 'explore', 'bridge', 'conversation'] as const;
export const MAX_NOTE = 600;
export interface HealthPlan { actions: string[]; note: string; review_on: string | null; focus_role_id: string | null }
/** Normalises a plan; null when invalid (unknown action, note too long, bad date). */
export function normPlan(raw: unknown): HealthPlan | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const acts = p.actions == null ? [] : p.actions;
  if (!Array.isArray(acts) || acts.some((a) => typeof a !== 'string' || !(PLAN_ACTIONS as readonly string[]).includes(a))) return null;
  const note = p.note == null ? '' : p.note;
  if (typeof note !== 'string' || note.length > MAX_NOTE) return null;
  const review = p.review_on == null || p.review_on === '' ? null : p.review_on;
  if (review !== null && (typeof review !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(review))) return null;
  const focus = p.focus_role_id == null || p.focus_role_id === '' ? null : p.focus_role_id;
  if (focus !== null && (typeof focus !== 'string' || focus.length > 80)) return null;
  return { actions: PLAN_ACTIONS.filter((a) => (acts as string[]).includes(a)), note: note.trim(), review_on: review as string | null, focus_role_id: focus as string | null };
}
