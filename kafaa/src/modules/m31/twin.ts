// FS40 Digital-twin diagnosis drills: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder and (mirrored in SQL)
// supabase/migrations/20261010251001_kafaa_fs51_next_gen.sql (kafaa_tw_score, kafaa_tw_sub_problem, kafaa_tw_problem, kafaa_tw_stats_core).
// Import-free apart from types. Same pattern as FS37 (src/modules/m29/drills.ts): scenarios without answers, a key staff never read,
// attempts Own only, scored on the server.
//
// Benchmarks: IAEA-AI ("Atoms for Algorithms": twin validation, anomaly triage), SMR-WF (digital-twin and simulator-based training).
//
//  - A drill shows a synthetic plant-model trend set (SIMULATED, system code SYN-TW-000, no OT link): a few signals over time with the
//    model's expected band. The learner chooses up to `max_checks` checks (each reveals a synthetic result), names the degrading
//    component and its failure mode, picks an action and the rationales that justify it.
//  - Scoring (scoreTwinDrill = SQL kafaa_tw_score): component right +4; mode right +2 (only with the right component); each useful check
//    +1, each other safe check -1, each unsafe check -2; best conservative action +3, another conservative action +2; each sound
//    rationale +1, each unsound one -1. Points never go below 0; pct = round half up of 100 x points / max.
//    Critical: an unsafe check or an unsafe action fails the drill whatever the score.
//    Passed = critical ok AND component right AND a conservative action AND pct >= pass mark.
//    Level = 2 only for a level-2 drill passed with the right mode, every useful check, no wasted check and pct >= LEVEL2_PCT, else 1;
//    never above the drill's level or TWIN_EVIDENCE_CAP (2).
//  - A pass writes F01 `assessment` evidence (ref_table twin_attempts) for every skill the drill names; the latest attempt on a drill
//    replaces earlier evidence from that drill (kept, inactive).
import type { Reason } from '../../domain/engines/types';

export const TWIN_EVIDENCE_CAP = 2;
export const LEVEL2_PCT = 85;
export const TWIN_STATUSES = ['draft', 'published', 'retired'] as const;
/** The FS02 twin and plant-data skills a drill may evidence (no new skills; never an original F01 skill). */
export const TWIN_SKILLS = ['sk-fs-ai-twin', 'sk-fs-ai-plantdata', 'sk-fs-ai-anomaly', 'sk-fs-dp-dic', 'sk-fs-ai-dataeng'];
export const RESTRICTED_TWIN_TERMS = ['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station', 'access code', 'firewall rule', 'network diagram', 'ip address'];

export interface Opt { id: string; en: string; ar: string }
export interface CheckOpt extends Opt { minutes: number; result_en: string; result_ar: string }
export interface Signal { id: string; name_en: string; name_ar: string; unit: string; values: number[]; band: [number, number] }
export interface Series { t_en: string; t_ar: string; t: number[]; signals: Signal[] }
export interface TwinKey {
  component_id: string; mode_id: string; useful_checks: string[]; unsafe_checks: string[]; conservative_actions: string[]; best_action: string; unsafe_actions: string[];
  sound_rationales: string[]; explain?: Record<string, { en: string; ar: string }>; pass_pct: number;
}
export interface TwinSubmission { checks: string[]; component_id: string; mode_id: string; action_id: string; rationale_ids: string[] }
export interface TwinScore {
  points: number;
  max: number;
  pct: number;
  component_ok: boolean;
  mode_ok: boolean;
  useful_found: number;
  useful_total: number;
  wasted: number;
  unsafe_checks: number;
  action: 'best' | 'conservative' | 'not_conservative' | 'unsafe';
  sound: number;
  unsound: number;
  critical_ok: boolean;
  passed: boolean;
  level: number;
  feedback: {
    checks: { id: string; verdict: 'useful' | 'wasted' | 'unsafe' }[];
    missed_checks: string[];
    component: { chosen: string; correct: string; right: boolean };
    mode: { chosen: string; correct: string; right: boolean };
    action: { chosen: string; best: string; verdict: 'best' | 'conservative' | 'not_conservative' | 'unsafe' };
    rationales: { id: string; sound: boolean }[];
    missed_rationales: string[];
  };
  reasons: Reason[];
}

const uniq = (xs: unknown): string[] => {
  const out: string[] = [];
  for (const x of Array.isArray(xs) ? xs : []) if (typeof x === 'string' && !out.includes(x)) out.push(x);
  return out;
};

/** Score one submission against the key (mirror of SQL kafaa_tw_score). `drillLevel` is the drill's evidence level (1 or 2). */
export function scoreTwinDrill(key: TwinKey, sub: TwinSubmission, drillLevel: number): TwinScore {
  const checks = uniq(sub?.checks);
  const rats = uniq(sub?.rationale_ids);
  const comp = typeof sub?.component_id === 'string' ? sub.component_id : '';
  const mode = typeof sub?.mode_id === 'string' ? sub.mode_id : '';
  const act = typeof sub?.action_id === 'string' ? sub.action_id : '';
  let points = 0;
  const componentOk = comp === key.component_id;
  const modeOk = componentOk && mode === key.mode_id;
  if (componentOk) points += 4;
  if (modeOk) points += 2;
  let useful = 0;
  let wasted = 0;
  let unsafe = 0;
  const fc = checks.map((c) => {
    if (key.unsafe_checks.includes(c)) { unsafe++; points -= 2; return { id: c, verdict: 'unsafe' as const }; }
    if (key.useful_checks.includes(c)) { useful++; points += 1; return { id: c, verdict: 'useful' as const }; }
    wasted++; points -= 1; return { id: c, verdict: 'wasted' as const };
  });
  const action: TwinScore['action'] = key.unsafe_actions.includes(act) ? 'unsafe' : act === key.best_action ? 'best' : key.conservative_actions.includes(act) ? 'conservative' : 'not_conservative';
  if (action === 'best') points += 3; else if (action === 'conservative') points += 2;
  let sound = 0;
  let unsound = 0;
  const fr = rats.map((r) => { const ok = key.sound_rationales.includes(r); if (ok) { sound++; points += 1; } else { unsound++; points -= 1; } return { id: r, sound: ok }; });
  const max = 4 + 2 + key.useful_checks.length + 3 + key.sound_rationales.length;
  points = Math.max(0, points);
  const pct = max > 0 ? Math.floor((200 * points + max) / (2 * max)) : 0;
  const criticalOk = unsafe === 0 && action !== 'unsafe';
  const conservative = action === 'best' || action === 'conservative';
  const passed = criticalOk && componentOk && conservative && pct >= key.pass_pct;
  const cap = Math.min(TWIN_EVIDENCE_CAP, Math.max(1, Math.floor(drillLevel)));
  const level = !passed ? 0 : cap >= 2 && modeOk && useful === key.useful_checks.length && wasted === 0 && pct >= LEVEL2_PCT ? 2 : 1;
  const reasons: Reason[] = [
    { code: componentOk ? 'fs40_component' : 'fs40_component_wrong', key: componentOk ? 'm31.tw.reason.component' : 'm31.tw.reason.componentWrong' },
    { code: modeOk ? 'fs40_mode' : 'fs40_mode_wrong', key: modeOk ? 'm31.tw.reason.mode' : 'm31.tw.reason.modeWrong' },
    { code: 'fs40_checks', key: 'm31.tw.reason.checks', vars: { useful, total: key.useful_checks.length, wasted } },
    { code: `fs40_action_${action}`, key: `m31.tw.reason.action.${action}` },
    { code: 'fs40_rationales', key: 'm31.tw.reason.rationales', vars: { sound, total: key.sound_rationales.length, unsound } },
  ];
  if (!criticalOk) reasons.push({ code: 'fs40_unsafe', key: 'm31.tw.reason.unsafe' });
  reasons.push(passed ? { code: 'fs40_level', key: 'm31.tw.reason.level', vars: { level, pct } } : { code: 'fs40_not_passed', key: 'm31.tw.reason.notPassed', vars: { pct, pass: key.pass_pct } });
  return {
    points, max, pct, component_ok: componentOk, mode_ok: modeOk, useful_found: useful, useful_total: key.useful_checks.length, wasted, unsafe_checks: unsafe, action, sound, unsound,
    critical_ok: criticalOk, passed, level,
    feedback: {
      checks: fc, missed_checks: key.useful_checks.filter((c) => !checks.includes(c)),
      component: { chosen: comp, correct: key.component_id, right: componentOk }, mode: { chosen: mode, correct: key.mode_id, right: modeOk },
      action: { chosen: act, best: key.best_action, verdict: action }, rationales: fr, missed_rationales: key.sound_rationales.filter((r) => !rats.includes(r)),
    },
    reasons,
  };
}

export interface ScenarioLite { components: Opt[]; modes: Opt[]; checks: CheckOpt[]; actions: Opt[]; rationales: Opt[]; max_checks: number }
/** Problems in a submission against the drill shown (mirror of SQL kafaa_tw_sub_problem). */
export function twinSubProblem(s: ScenarioLite, sub: TwinSubmission): string | null {
  if (!sub || !Array.isArray(sub.checks) || !Array.isArray(sub.rationale_ids)) return 'shape';
  const ids = (xs: Opt[]) => new Set((xs ?? []).map((x) => x.id));
  const ck = ids(s.checks);
  if (sub.checks.some((c) => typeof c !== 'string' || !ck.has(c)) || new Set(sub.checks).size !== sub.checks.length) return 'checks';
  if (sub.checks.length > s.max_checks) return 'too_many';
  if (typeof sub.component_id !== 'string' || !ids(s.components).has(sub.component_id)) return 'component';
  if (typeof sub.mode_id !== 'string' || !ids(s.modes).has(sub.mode_id)) return 'mode';
  if (typeof sub.action_id !== 'string' || !ids(s.actions).has(sub.action_id)) return 'action';
  const rt = ids(s.rationales);
  if (sub.rationale_ids.length < 1 || sub.rationale_ids.length > 3 || sub.rationale_ids.some((r) => typeof r !== 'string' || !rt.has(r)) || new Set(sub.rationale_ids).size !== sub.rationale_ids.length) return 'rationales';
  return null;
}

export interface TwinInput {
  id?: string | null; code: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string; scenario_en: string; scenario_ar: string; system_en: string; system_ar: string;
  difficulty: number; level: number; skill_ids: string[]; series: Series; components: Opt[]; modes: Opt[]; checks: CheckOpt[]; actions: Opt[]; rationales: Opt[];
  max_checks: number; est_minutes: number; status: string; key: TwinKey;
}
const s = (x: unknown, max: number) => typeof x === 'string' && x.trim().length > 0 && x.trim().length <= max;
const optsOk = (xs: unknown, lo: number, hi: number) => Array.isArray(xs) && xs.length >= lo && xs.length <= hi && xs.every((o) => o && s(o.id, 30) && s(o.en, 240) && s(o.ar, 240))
  && new Set(xs.map((o) => o.id)).size === xs.length;
const isNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
/** First problem code of an authored drill, or null (mirror of SQL kafaa_tw_problem). `skills` = the twin and plant-data skills allowed. */
export function twinProblem(d: TwinInput, skills: string[]): string | null {
  if (!d || !s(d.title_en, 140) || !s(d.title_ar, 140) || !s(d.summary_en, 400) || !s(d.summary_ar, 400) || !s(d.scenario_en, 900) || !s(d.scenario_ar, 900) || !s(d.system_en, 140) || !s(d.system_ar, 140)) return 'texts';
  if (typeof d.code !== 'string' || !/^SYN-TW-\d{3}$/.test(d.code)) return 'synthetic';
  if (!Number.isInteger(d.difficulty) || d.difficulty < 1 || d.difficulty > 3) return 'difficulty';
  if (!Number.isInteger(d.level) || d.level < 1 || d.level > TWIN_EVIDENCE_CAP) return 'level';
  if (!Array.isArray(d.skill_ids) || d.skill_ids.length < 1 || d.skill_ids.length > 3 || d.skill_ids.some((x) => !skills.includes(x)) || new Set(d.skill_ids).size !== d.skill_ids.length) return 'skill';
  if (!(TWIN_STATUSES as readonly string[]).includes(d.status)) return 'status';
  if (!Number.isInteger(d.est_minutes) || d.est_minutes < 5 || d.est_minutes > 40) return 'minutes';
  const se = d.series;
  if (!se || !s(se.t_en, 40) || !s(se.t_ar, 40) || !Array.isArray(se.t) || se.t.length < 6 || se.t.length > 48 || se.t.some((x) => !isNum(x)) || !Array.isArray(se.signals) || se.signals.length < 2 || se.signals.length > 6
    || se.signals.some((g) => !g || !s(g.id, 20) || !s(g.name_en, 80) || !s(g.name_ar, 80) || !s(g.unit, 16) || !Array.isArray(g.values) || g.values.length !== se.t.length || g.values.some((v) => !isNum(v))
      || !Array.isArray(g.band) || g.band.length !== 2 || !isNum(g.band[0]) || !isNum(g.band[1]) || g.band[0] >= g.band[1])
    || new Set(se.signals.map((g) => g.id)).size !== se.signals.length) return 'series';
  if (!optsOk(d.components, 3, 6)) return 'components';
  if (!optsOk(d.modes, 2, 5)) return 'modes';
  if (!optsOk(d.checks, 3, 8) || d.checks.some((c) => !Number.isInteger(c.minutes) || c.minutes < 1 || c.minutes > 480 || !s(c.result_en, 300) || !s(c.result_ar, 300))) return 'checks';
  if (!Number.isInteger(d.max_checks) || d.max_checks < 1 || d.max_checks > d.checks.length) return 'max_checks';
  if (!optsOk(d.actions, 3, 5)) return 'actions';
  if (!optsOk(d.rationales, 3, 6)) return 'rationales';
  const k = d.key;
  const has = (xs: Opt[], id: unknown) => typeof id === 'string' && xs.some((x) => x.id === id);
  const sub = (ids: unknown, xs: Opt[]) => Array.isArray(ids) && ids.every((i) => has(xs, i)) && new Set(ids).size === ids.length;
  if (!k || !has(d.components, k.component_id) || !has(d.modes, k.mode_id) || !sub(k.useful_checks, d.checks) || !sub(k.unsafe_checks, d.checks) || k.useful_checks.length < 1
    || k.useful_checks.length > d.max_checks || k.useful_checks.some((c) => k.unsafe_checks.includes(c))
    || !sub(k.conservative_actions, d.actions) || !sub(k.unsafe_actions, d.actions) || k.conservative_actions.length < 1 || k.conservative_actions.some((a) => k.unsafe_actions.includes(a))
    || !k.conservative_actions.includes(k.best_action) || !sub(k.sound_rationales, d.rationales) || k.sound_rationales.length < 1 || k.sound_rationales.length > 3) return 'key';
  if (!Number.isInteger(k.pass_pct) || k.pass_pct < 50 || k.pass_pct > 95) return 'pass';
  const all = JSON.stringify([d.title_en, d.summary_en, d.scenario_en, d.system_en, d.series.signals.map((g) => g.name_en), d.components, d.modes, d.checks, d.actions, d.rationales]).toLowerCase();
  if (RESTRICTED_TWIN_TERMS.some((w) => all.includes(w))) return 'restricted';
  return null;
}

export interface TwinAttemptLite { id: string; person_id: string; scenario_id: string; passed: boolean; pct: number; component_id: string; submitted_at: string }
export interface TwinStats {
  attempts: number;
  people: number | null;
  scenarios: { scenario_id: string; attempts: number | null; people: number | null; pass_pct: number | null; avg_pct: number | null; misdiagnosed_pct: number | null }[];
}
/** Training view (mirror of SQL kafaa_tw_stats_core): latest attempt per person and drill; cells under minGroup suppressed. */
export function twinStats(attempts: TwinAttemptLite[], keys: { scenario_id: string; component_id: string }[], scenarioIds: string[], minGroup: number): TwinStats {
  const latest = new Map<string, TwinAttemptLite>();
  for (const a of [...attempts].sort((x, y) => (x.submitted_at < y.submitted_at ? -1 : x.submitted_at > y.submitted_at ? 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0))) latest.set(`${a.person_id}|${a.scenario_id}`, a);
  const rows = [...latest.values()];
  const r1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;
  const people = new Set(rows.map((a) => a.person_id)).size;
  const comp = new Map(keys.map((k) => [k.scenario_id, k.component_id]));
  const scenarios = [...scenarioIds].sort().map((sid) => {
    const g = rows.filter((a) => a.scenario_id === sid);
    const big = g.length >= minGroup;
    return {
      scenario_id: sid, attempts: big ? attempts.filter((a) => a.scenario_id === sid).length : null, people: big ? g.length : null,
      pass_pct: big ? r1((100 * g.filter((a) => a.passed).length) / g.length) : null, avg_pct: big ? r1(g.reduce((m, a) => m + Number(a.pct), 0) / g.length) : null,
      misdiagnosed_pct: big ? r1((100 * g.filter((a) => a.component_id !== comp.get(sid)).length) / g.length) : null,
    };
  });
  return { attempts: attempts.length, people: people >= minGroup ? people : null, scenarios };
}

// ───────────── wave E integration (FS40 -> FS31/FS27): twin drills as a route to the skills they evidence
export interface TwinRouteLite { id: string; status: string; level: number | string; skill_ids?: string[] | null; sort?: number | string; listed?: boolean | null }
/**
 * Published twin drills that evidence any of the given skills at `minLevel` or above (a drill writes evidence at most at its own level,
 * never above TWIN_EVIDENCE_CAP), in drill-bank order. Used by the M17 "how to earn" routes (MC-TWINS, satisfiability) and the M20 gig
 * page (fg-dig-twin-validation). Drafts and retired drills are never a route.
 */
export function twinDrillsFor<T extends TwinRouteLite>(scenarios: T[], skillIds: string[], minLevel = 1): T[] {
  const want = new Set(skillIds);
  return scenarios
    .filter((s) => s.status === 'published' && s.listed !== false && Math.min(Number(s.level) || 1, TWIN_EVIDENCE_CAP) >= minLevel && (s.skill_ids ?? []).some((k) => want.has(k)))
    .sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
