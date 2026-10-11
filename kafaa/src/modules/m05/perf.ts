// FS22 Performance tasks and integrity reports: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder and (mirrored
// in SQL) supabase/migrations/20261010233001_kafaa_fs33_assessment.sql (kafaa_pt_* and kafaa_ir_*). Import-free apart from types.
//
// Benchmarks: skills-platform mechanics (SKILLS-TECH: assessment that shows what a person can do, not recall) and IAEA "Atoms for
// Algorithms" (IAEA-AI: AI output verification and the duty to challenge it, twin validation, anomaly triage).
//
// Performance task: a SIMULATED trend set (no plant, OT or simulator connection), a brief, decision options and a published rubric.
// The learner marks the anomaly (signal and reading), picks a decision, ticks the checks they made and justifies the decision.
//  - Rubric (published before the attempt; the learner confirms they read it): four lines of 0-3 points.
//      anomaly  (auto)      3 = the marked reading is inside the anomaly window of the right signal; 2 = within NEAR (3) readings of
//                           it; 1 = right signal, elsewhere; 0 = another signal.
//      quality  (assessor)  checks the data and independent indications before trusting a signal or a tool.
//      decision (auto, critical) the points of the chosen option (a safe, conservative action scores 3; an unsafe one 0).
//      justify  (assessor)  the justification cites the evidence, states uncertainty and challenges the tool where needed.
//  - Result: pass when total >= pass_pct of the maximum AND no critical line scores 0 (like a JPM critical step).
//  - Evidence on a pass: one F01 `assessment` row per task skill at the task's evidence level (ref_table task_attempts).
//  - Maker-checker: an assessor never scores their own attempt.
//
// Integrity report (every attempt that gates a credential, adaptive or task, carries one; written by the server when the attempt
// completes or is submitted, recomputed on resubmission):
//  - time on task (seconds); per-item times from the answer timestamps (adaptive) and the number answered in under 5 s;
//  - retakes: the person's other attempts on the same bank or task in the 30 days before this one started;
//  - resubmissions (tasks): answers replaced before scoring;
//  - item exposure (adaptive): repeat items = items this person already saw in their own earlier attempts on the bank; and, for
//    bank health, the share of earlier completed attempts by other people that saw each item (max and mean); tasks: how many other
//    people submitted the scenario before;
//  - flags: fast_answers (3+ answers under 5 s), short_time (adaptive under 15 s per item; task under its minimum minutes),
//    retakes (2+), resubmissions (2+), exposure (more than half the items were repeats for this person; a task seen by 20+ people).
//  - status clear (no flag) or review; an assessor accepts or voids a flagged report (voiding withdraws the attempt's evidence).
import type { Reason } from '../../domain/engines/types';

export const NEAR = 3;
export const LINE_MAX = 3;
export const JUSTIFY_MIN = 20;
export const JUSTIFY_MAX = 1500;
export const INTEGRITY = { FAST_ITEM_S: 5, FAST_FLAG: 3, MIN_ITEM_S: 15, RETAKE_WINDOW_DAYS: 30, RETAKE_FLAG: 2, RESUBMIT_FLAG: 2, TASK_EXPOSURE_FLAG: 20 } as const;
export const FLAGS = ['fast_answers', 'short_time', 'retakes', 'resubmissions', 'exposure'] as const;
export type Flag = (typeof FLAGS)[number];

export interface Series { key: string; label_en: string; label_ar: string; unit: string; values: number[] }
export interface TaskData { t0: string; step_min: number; series: Series[]; ai_flag?: { series: string; index: number; label_en: string; label_ar: string } | null }
export interface RubricLevel { score: number; en: string; ar: string }
export interface RubricLine { key: string; label_en: string; label_ar: string; max: number; mode: 'auto_anomaly' | 'auto_decision' | 'assessor'; critical: boolean; levels: RubricLevel[] }
export interface TaskLite { id: string; data: TaskData; decisions: { key: string }[]; checks: { key: string }[]; rubric: RubricLine[]; pass_pct: number; skill_ids: string[]; evidence_level: number; min_minutes: number; gates?: string[] | null }
export interface TaskKey { series: string; from_idx: number; to_idx: number; decision_points: number[] }
export interface TaskAnswer { series: string; index: number; decision: number; checks: string[]; justification: string }
export interface TaskScore { lines: { key: string; score: number; max: number; critical: boolean }[]; total: number; max: number; pct: number; passed: boolean; critical_failed: boolean; reasons: Reason[] }

/** First problem with an answer, or null. */
export function answerProblem(task: Pick<TaskLite, 'data' | 'decisions' | 'checks'>, a: Partial<TaskAnswer> | null | undefined): string | null {
  if (!a || typeof a !== 'object') return 'answer';
  const s = (task.data?.series ?? []).find((x) => x.key === a.series);
  if (!s) return 'series';
  if (!Number.isInteger(a.index) || (a.index as number) < 0 || (a.index as number) >= s.values.length) return 'index';
  if (!Number.isInteger(a.decision) || (a.decision as number) < 0 || (a.decision as number) >= (task.decisions ?? []).length) return 'decision';
  const keys = (task.checks ?? []).map((c) => c.key);
  if (!Array.isArray(a.checks) || a.checks.some((c) => typeof c !== 'string' || !keys.includes(c)) || new Set(a.checks).size !== a.checks.length) return 'checks';
  const j = typeof a.justification === 'string' ? a.justification.trim() : '';
  if (j.length < JUSTIFY_MIN || j.length > JUSTIFY_MAX) return 'justification';
  return null;
}

/** The two automatic rubric lines from the key. */
export function autoScores(key: TaskKey, a: Pick<TaskAnswer, 'series' | 'index' | 'decision'>): { anomaly: number; decision: number } {
  let anomaly = 0;
  if (a.series === key.series) {
    const i = Number(a.index);
    if (i >= key.from_idx && i <= key.to_idx) anomaly = 3;
    else if (i >= key.from_idx - NEAR && i <= key.to_idx + NEAR) anomaly = 2;
    else anomaly = 1;
  }
  const decision = Number((key.decision_points ?? [])[Number(a.decision)] ?? 0);
  return { anomaly, decision };
}

/** First problem with the assessor's scores (every assessor line, an integer 0..max), or null. */
export function scoresProblem(rubric: RubricLine[], scores: Record<string, unknown> | null | undefined): string | null {
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) return 'scores';
  for (const l of rubric.filter((x) => x.mode === 'assessor')) {
    const v = scores[l.key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > l.max) return 'scores';
  }
  return null;
}

/** Total, pass and critical result from the automatic and the assessor scores. */
export function scoreTask(task: Pick<TaskLite, 'rubric' | 'pass_pct'>, auto: { anomaly: number; decision: number }, manual: Record<string, number>): TaskScore {
  const lines = task.rubric.map((l) => ({
    key: l.key, max: Number(l.max), critical: !!l.critical,
    score: l.mode === 'auto_anomaly' ? auto.anomaly : l.mode === 'auto_decision' ? auto.decision : Number(manual[l.key] ?? 0),
  }));
  const total = lines.reduce((s, l) => s + l.score, 0);
  const max = lines.reduce((s, l) => s + l.max, 0);
  const critical_failed = lines.some((l) => l.critical && l.score === 0);
  const passed = !critical_failed && 100 * total >= Number(task.pass_pct) * max;
  const pct = max ? Math.floor((100 * total) / max + 0.5) : 0;
  const reasons: Reason[] = [{ code: 'fs22_total', key: 'm05.pt.reason.total', vars: { total, max, pass: Number(task.pass_pct) } }];
  for (const l of lines) reasons.push({ code: 'fs22_line', key: `m05.pt.reason.line.${l.key}`, vars: { score: l.score, max: l.max } });
  if (critical_failed) reasons.push({ code: 'fs22_critical', key: 'm05.pt.reason.critical' });
  reasons.push({ code: passed ? 'fs22_pass' : 'fs22_fail', key: `m05.pt.reason.${passed ? 'pass' : 'fail'}` });
  return { lines, total, max, pct, passed, critical_failed, reasons };
}

// ───────────── Integrity reports
export const secs = (from: string | null | undefined, to: string | null | undefined) => (from && to ? Math.floor((Date.parse(to) - Date.parse(from)) / 1000) : 0);
export interface IntegrityCore {
  time_on_task_s: number; items: number; fast_items: number; median_item_s: number | null; retakes: number; resubmissions: number; repeat_items: number;
  exposure_max: number | null; exposure_mean: number | null; exposure_n: number; flags: Flag[]; status: 'clear' | 'review';
}
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.floor((s[m - 1] + s[m]) / 2);
};
const share100 = (num: number, den: number) => (den > 0 ? Math.floor((200 * num + den) / (2 * den)) / 100 : 0);
interface AdAttemptLite { id: string; bank_id: string; person_id: string; status: string; started_at: string; completed_at: string | null; responses?: { item_id: string; at?: string | null }[] | null }
interface TaskAttemptLite { id: string; task_id: string; person_id: string; status: string; started_at: string; submitted_at: string | null; resubmissions?: number | null }
const before = (a: string | null | undefined, b: string) => !!a && Date.parse(a) < Date.parse(b);
const within = (a: string | null | undefined, start: string, days: number) => !!a && Date.parse(a) < Date.parse(start) && Date.parse(a) >= Date.parse(start) - days * 86400000;

export function adaptiveIntegrity(a: AdAttemptLite, all: AdAttemptLite[]): IntegrityCore {
  const rs = a.responses ?? [];
  const times: number[] = [];
  let prev = a.started_at;
  for (const r of rs) { times.push(secs(prev, r.at ?? prev)); prev = r.at ?? prev; }
  const fast = times.filter((x) => x < INTEGRITY.FAST_ITEM_S).length;
  const time = secs(a.started_at, a.completed_at);
  const retakes = all.filter((x) => x.id !== a.id && x.person_id === a.person_id && x.bank_id === a.bank_id && x.status === 'completed' && within(x.completed_at, a.started_at, INTEGRITY.RETAKE_WINDOW_DAYS)).length;
  const prior = all.filter((x) => x.bank_id === a.bank_id && x.person_id !== a.person_id && x.status === 'completed' && before(x.completed_at, a.started_at));
  const counts = rs.map((r) => prior.filter((p) => (p.responses ?? []).some((q) => q.item_id === r.item_id)).length);
  const n = prior.length;
  const mineBefore = new Set(all.filter((x) => x.person_id === a.person_id && x.bank_id === a.bank_id && x.id !== a.id && x.status === 'completed' && before(x.completed_at, a.started_at))
    .flatMap((x) => (x.responses ?? []).map((q) => q.item_id)));
  const repeat = rs.filter((r) => mineBefore.has(r.item_id)).length;
  const maxC = counts.length ? Math.max(...counts) : 0;
  const sumC = counts.reduce((s, x) => s + x, 0);
  const flags: Flag[] = [];
  if (fast >= INTEGRITY.FAST_FLAG) flags.push('fast_answers');
  if (time < INTEGRITY.MIN_ITEM_S * rs.length) flags.push('short_time');
  if (retakes >= INTEGRITY.RETAKE_FLAG) flags.push('retakes');
  if (rs.length > 0 && 2 * repeat > rs.length) flags.push('exposure');
  return {
    time_on_task_s: time, items: rs.length, fast_items: fast, median_item_s: median(times), retakes, resubmissions: 0, repeat_items: repeat,
    exposure_max: share100(maxC, n), exposure_mean: share100(sumC, n * rs.length), exposure_n: n, flags, status: flags.length ? 'review' : 'clear',
  };
}

export function taskIntegrity(a: TaskAttemptLite, task: Pick<TaskLite, 'min_minutes'>, all: TaskAttemptLite[]): IntegrityCore {
  const time = secs(a.started_at, a.submitted_at);
  const retakes = all.filter((x) => x.id !== a.id && x.person_id === a.person_id && x.task_id === a.task_id && x.status !== 'in_progress' && within(x.submitted_at, a.started_at, INTEGRITY.RETAKE_WINDOW_DAYS)).length;
  const seenBy = new Set(all.filter((x) => x.task_id === a.task_id && x.person_id !== a.person_id && x.status !== 'in_progress' && before(x.submitted_at, a.started_at)).map((x) => x.person_id)).size;
  const resub = Number(a.resubmissions ?? 0);
  const flags: Flag[] = [];
  if (time < Number(task.min_minutes) * 60) flags.push('short_time');
  if (retakes >= INTEGRITY.RETAKE_FLAG) flags.push('retakes');
  if (resub >= INTEGRITY.RESUBMIT_FLAG) flags.push('resubmissions');
  if (seenBy >= INTEGRITY.TASK_EXPOSURE_FLAG) flags.push('exposure');
  return {
    time_on_task_s: time, items: 0, fast_items: 0, median_item_s: null, retakes, resubmissions: resub, repeat_items: 0, exposure_max: null, exposure_mean: null, exposure_n: seenBy,
    flags, status: flags.length ? 'review' : 'clear',
  };
}

/** Readings of a series as (time label, value) for charts: t0 plus step_min per reading (UTC, HH:MM). */
export function readingTime(data: Pick<TaskData, 't0' | 'step_min'>, index: number): string {
  const t = new Date(Date.parse(data.t0) + index * Number(data.step_min) * 60000);
  return t.toISOString().slice(11, 16);
}
/** Synthetic-data guard: a task's data may hold only numbers and labels (no links, hosts, tags or connection strings). */
export function dataIsSynthetic(data: unknown): boolean {
  const txt = JSON.stringify(data ?? {}).toLowerCase();
  return !/(https?:|\bopc\b|modbus|scada|historian|pi:\/\/|\\\\|tag:|\.local\b)/.test(txt);
}
