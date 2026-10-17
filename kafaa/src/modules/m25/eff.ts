/**
 * F25 Training effectiveness (Kirkpatrick levels 1 to 4): pure rules shared by both backends, the seed builder, the pages and
 * the PGlite validator. Import-free apart from types (node loads it directly). SQL mirror: kafaa_ev_* in
 * supabase/migrations/20261009141001_kafaa_w4e1_effectiveness.sql; the validator proves SQL = TS on the seed.
 *
 *   L1 reaction   a short post-course form (5 items on a 1-5 scale + "would you recommend it"). Responses are anonymous to
 *                 instructors and managers: the person id is kept only to stop duplicates and to schedule L3. Course results
 *                 show only when at least MIN_N (10) people answered.
 *   L2 learning   the gain from a released pre-course knowledge check to a released post-course check (M05 attempts on the
 *                 two forms named in the course's evaluation design). Unreleased attempts never count. Shown at 10+ pairs.
 *   L3 behaviour  a supervisor observation checklist built from the course objectives, scheduled 90 days after completion of a
 *                 qualifying course (the line manager records it from day 60). Shown at 10+ completed observations.
 *   L4 results    linked SAMPLE KPIs (rework rate, HU-event rate, qualification first-time pass). Association, not causation.
 */
import type { Reason } from '../../domain/engines/types';

export const MIN_N = 10;
export const L1_ITEMS = ['relevance', 'objectives', 'delivery', 'confidence', 'time'] as const;
export type L1Item = (typeof L1_ITEMS)[number];
/** Days after completion during which a learner can still give L1 feedback. */
export const L1_WINDOW_DAYS = 90;
/** L3 observation due this many days after completion of a qualifying course. */
export const L3_DAYS = 90;
/** The observer may record from this many days before the due date (the "60/90-day" window). */
export const L3_EARLY_DAYS = 30;
export const L3_RATINGS = ['yes', 'partly', 'no', 'na'] as const;
export type L3Rating = (typeof L3_RATINGS)[number];
export const COMMITTEES = ['all_staff', 'operations', 'maintenance', 'rp_chem', 'engineering', 'emergency', 'leadership', 'training'] as const;
export type Committee = (typeof COMMITTEES)[number];
/** Redesign thresholds: L1 means are kept ×10 (3.5 → 35); percentages are whole numbers. */
export const THRESHOLDS = { relevance: 35, recommend: 70, gain: 30, transfer: 70 } as const;
/** Reasons that make a course a redesign candidate (KPI movement is association only and never triggers a redesign). */
export const REDESIGN_CODES = ['low_relevance', 'low_recommend', 'low_gain', 'low_transfer'];

type Row = Record<string, any>;

// ───────────── small helpers (identical integer arithmetic in SQL)
/** a / b rounded half away from zero, like SQL round(numeric). b > 0. */
export function rdiv(a: number, b: number): number {
  const q = Math.round(Math.abs(a) / b);
  return a < 0 ? -q : q;
}
export function addDaysIso(d: string, n: number): string {
  const x = new Date(`${String(d).slice(0, 10)}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
export const iso = (d: unknown): string => String(d ?? '').slice(0, 10);

// ───────────── completions
export interface Completion { ref: string; person_id: string; course_id: string; completed_on: string }
/** Completed training: transcript rows (passed or completed) and completed enrolments. ref = tr:<id> | en:<id>. */
export function completionsOf(trainingRecords: Row[], enrolments: Row[]): Completion[] {
  const out: Completion[] = [];
  for (const t of trainingRecords) if (['passed', 'completed'].includes(t.result)) out.push({ ref: `tr:${t.id}`, person_id: t.person_id, course_id: t.course_id, completed_on: iso(t.completed_on) });
  for (const e of enrolments) if (e.status === 'completed' && e.completed_at) out.push({ ref: `en:${e.id}`, person_id: e.person_id, course_id: e.course_id, completed_on: iso(e.completed_at) });
  return out.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
}
export const l1Id = (ref: string) => `l1:${ref}`;
export const l3Id = (ref: string) => `l3:${ref}`;
export function l1Open(c: { completed_on: string }, now: string): boolean {
  return c.completed_on <= now && c.completed_on >= addDaysIso(now, -L1_WINDOW_DAYS);
}
export function l3DueOn(completedOn: string, days = L3_DAYS): string {
  return addDaysIso(completedOn, days);
}
export function l3WindowOpens(dueOn: string): string {
  return addDaysIso(dueOn, -L3_EARLY_DAYS);
}
export function l3Status(o: { status: string; due_on: string }, now: string): 'scheduled' | 'due' | 'overdue' | 'done' | 'cancelled' {
  if (o.status !== 'scheduled') return o.status as 'done' | 'cancelled';
  if (o.due_on < now) return 'overdue';
  if (l3WindowOpens(o.due_on) <= now) return 'due';
  return 'scheduled';
}

// ───────────── validation
export function validRatings(r: unknown): r is Record<L1Item, number> {
  if (!r || typeof r !== 'object') return false;
  return L1_ITEMS.every((k) => {
    const v = (r as Record<string, unknown>)[k];
    return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
  });
}
export interface L3Item { key: string; en: string; ar: string; competency_id?: string | null; rating?: L3Rating | null }
/** Every checklist item rated with yes/partly/no/na, and at least one item not "na". */
export function validL3Items(items: unknown, template: L3Item[]): boolean {
  if (!Array.isArray(items) || !template.length) return false;
  const by = new Map((items as Row[]).map((i) => [String(i?.key), i?.rating]));
  if (!template.every((t) => L3_RATINGS.includes(by.get(t.key) as L3Rating))) return false;
  return template.some((t) => by.get(t.key) !== 'na');
}
/** The L3 checklist for a course: one item per course objective ("applies it on the job"), plus the safety behaviours item. */
export function l3Template(course: Row): L3Item[] {
  const objs: Row[] = Array.isArray(course?.objectives) ? course.objectives : [];
  const items: L3Item[] = objs.map((o, i) => ({ key: `o${i + 1}`, competency_id: o.competency_id ?? null, en: `On the job: ${o.en}`, ar: `في العمل: ${o.ar}` }));
  items.push({ key: 'hu', competency_id: null, en: 'Uses human-performance tools and asks when unsure', ar: 'يستخدم أدوات الأداء البشري ويسأل عند الشك' });
  return items;
}

// ───────────── scorecard
export interface L1Block { n: number | null; rate: number | null; items: Record<L1Item, number | null>; recommend: number | null; suppressed: boolean }
export interface L2Block { forms: boolean; pairs: number | null; pre: number | null; post: number | null; gain: number | null; norm_gain: number | null; unreleased_excluded: boolean; suppressed: boolean }
export interface L3Block { qualifying: boolean; scheduled: number | null; done: number | null; overdue: number | null; applied: number | null; suppressed: boolean }
export interface KpiView { id: string; kpi: string; label_en: string; label_ar: string; unit: string; direction: string; series: { period: string; value: number; delivered?: boolean }[]; trend: 'improving' | 'worsening' | 'flat' }
export interface CourseCard {
  course_id: string; committee: string; completions: number | null;
  l1: L1Block; l2: L2Block; l3: L3Block; l4: { sample: true; caveat: true; kpis: KpiView[] };
  levels: number; redesign: boolean; open_flag: string | null; reasons: Reason[];
}
export interface ScoreInput {
  courses: Row[]; surveys: Row[]; completions: Completion[]; responses: Row[]; attempts: Row[]; observations: Row[]; kpis: Row[]; flags: Row[];
}
const cell = (n: number) => (n >= MIN_N ? n : null);
const R = (code: string, vars?: Reason['vars']): Reason => ({ code, key: `m25.reasons.${code}`, ...(vars ? { vars } : {}) });
const latest = (rows: Row[]) =>
  [...rows].sort((a, b) => {
    const x = a.submitted_at ? Date.parse(String(a.submitted_at)) : null;
    const y = b.submitted_at ? Date.parse(String(b.submitted_at)) : null;
    if (x !== y) { if (x === null) return 1; if (y === null) return -1; return x < y ? 1 : -1; }
    return a.id < b.id ? 1 : -1;
  })[0];

export function kpiTrend(series: { value: number }[], direction: string): KpiView['trend'] {
  if (series.length < 2) return 'flat';
  const first = Number(series[0].value), last = Number(series[series.length - 1].value);
  if (last === first) return 'flat';
  const lower = last < first;
  return (direction === 'lower_better') === lower ? 'improving' : 'worsening';
}

export function courseCard(courseId: string, x: ScoreInput, now: string): CourseCard {
  const course = x.courses.find((c) => c.id === courseId) ?? {};
  const survey = x.surveys.find((s) => s.course_id === courseId) ?? {};
  const comps = x.completions.filter((c) => c.course_id === courseId);
  // L1
  const resp = x.responses.filter((r) => r.course_id === courseId);
  const n1 = resp.length;
  const items = Object.fromEntries(L1_ITEMS.map((k) => [k, n1 >= MIN_N ? rdiv(resp.reduce((s, r) => s + Number(r.ratings?.[k] ?? 0), 0) * 10, n1) : null])) as Record<L1Item, number | null>;
  const l1: L1Block = {
    n: cell(n1), rate: n1 >= MIN_N && comps.length ? rdiv(100 * n1, comps.length) : null, items,
    recommend: n1 >= MIN_N ? rdiv(100 * resp.filter((r) => r.recommend === true).length, n1) : null, suppressed: n1 < MIN_N,
  };
  // L2: latest released pre and post attempt per person, paired
  const pre = survey.pre_form_id ?? null, post = survey.post_form_id ?? null;
  const rel = (a: Row) => a.status === 'released' && a.released === true && a.score !== null && a.score !== undefined;
  const on = (f: string | null) => x.attempts.filter((a) => f && a.form_id === f);
  const byPerson = (rows: Row[]) => {
    const m = new Map<string, Row[]>();
    for (const a of rows) m.set(a.person_id, [...(m.get(a.person_id) ?? []), a]);
    return new Map([...m].map(([k, v]) => [k, latest(v)]));
  };
  const preBy = byPerson(on(pre).filter(rel)), postBy = byPerson(on(post).filter(rel));
  const pairs = [...preBy.keys()].filter((p) => postBy.has(p));
  const np = pairs.length;
  const preSum = pairs.reduce((s, p) => s + Number(preBy.get(p)!.score), 0);
  const postSum = pairs.reduce((s, p) => s + Number(postBy.get(p)!.score), 0);
  const show2 = np >= MIN_N;
  const l2: L2Block = {
    forms: !!(pre && post), pairs: show2 ? np : null,
    pre: show2 ? rdiv(preSum * 10, np) : null, post: show2 ? rdiv(postSum * 10, np) : null,
    gain: show2 ? rdiv((postSum - preSum) * 10, np) : null,
    norm_gain: show2 && 100 * np - preSum > 0 ? rdiv(100 * (postSum - preSum), 100 * np - preSum) : null,
    unreleased_excluded: [...on(pre), ...on(post)].some((a) => !rel(a) && ['graded', 'submitted', 'released'].includes(a.status)),
    suppressed: !!(pre && post) && !show2,
  };
  // L3
  const obs = x.observations.filter((o) => o.course_id === courseId && o.status !== 'cancelled');
  const done = obs.filter((o) => o.status === 'done');
  let pts = 0, rated = 0;
  for (const o of done) for (const it of (o.items as Row[]) ?? []) {
    if (it.rating === 'yes') { pts += 2; rated++; } else if (it.rating === 'partly') { pts += 1; rated++; } else if (it.rating === 'no') rated++;
  }
  const l3: L3Block = {
    qualifying: course.qualifying === true, scheduled: cell(obs.length), done: cell(done.length),
    overdue: cell(obs.filter((o) => o.status === 'scheduled' && o.due_on < now).length),
    applied: done.length >= MIN_N && rated > 0 ? rdiv(pts * 100, 2 * rated) : null, suppressed: course.qualifying === true && done.length < MIN_N,
  };
  // L4
  const kpis: KpiView[] = x.kpis.filter((k) => k.course_id === courseId).sort((a, b) => (a.id < b.id ? -1 : 1)).map((k) => ({
    id: k.id, kpi: k.kpi, label_en: k.label_en, label_ar: k.label_ar, unit: k.unit, direction: k.direction, series: k.series ?? [], trend: kpiTrend(k.series ?? [], k.direction),
  }));
  // reasons
  const reasons: Reason[] = [];
  if (l1.suppressed) reasons.push(R('l1_small', { min: MIN_N }));
  else {
    if ((l1.items.relevance ?? 99) < THRESHOLDS.relevance) reasons.push(R('low_relevance', { v: l1.items.relevance! / 10, t: THRESHOLDS.relevance / 10 }));
    if ((l1.recommend ?? 999) < THRESHOLDS.recommend) reasons.push(R('low_recommend', { v: l1.recommend!, t: THRESHOLDS.recommend }));
  }
  if (!l2.forms) reasons.push(R('l2_none'));
  else if (l2.suppressed) reasons.push(R('l2_small', { min: MIN_N }));
  else if (l2.norm_gain !== null && l2.norm_gain < THRESHOLDS.gain) reasons.push(R('low_gain', { v: l2.norm_gain, t: THRESHOLDS.gain }));
  if (l2.unreleased_excluded) reasons.push(R('l2_unreleased'));
  if (l3.qualifying) {
    if (l3.suppressed) reasons.push(R('l3_small', { min: MIN_N }));
    else if (l3.applied !== null && l3.applied < THRESHOLDS.transfer) reasons.push(R('low_transfer', { v: l3.applied, t: THRESHOLDS.transfer }));
    if (l3.overdue !== null) reasons.push(R('l3_overdue', { n: l3.overdue }));
  }
  for (const k of kpis) if (k.trend === 'worsening') reasons.push(R('kpi_worse', { kpi: { en: k.label_en, ar: k.label_ar } }));
  const redesign = reasons.some((r) => REDESIGN_CODES.includes(r.code));
  const levels = (l1.suppressed ? 0 : 1) + (l2.pairs !== null ? 1 : 0) + (l3.done !== null ? 1 : 0) + (kpis.length ? 1 : 0);
  if (!redesign && levels > 0 && !l1.suppressed) reasons.push(R('on_track'));
  const flag = x.flags.filter((f) => f.course_id === courseId && f.status === 'open').sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  return {
    course_id: courseId, committee: survey.committee ?? 'all_staff', completions: cell(comps.length), l1, l2, l3,
    l4: { sample: true, caveat: true, kpis }, levels, redesign, open_flag: flag ? flag.id : null, reasons,
  };
}

/** The scorecard: every course with an active evaluation design, sorted by course id. */
export function scorecard(x: ScoreInput, now: string, courseId: string | null = null): CourseCard[] {
  return x.surveys
    .filter((s) => s.active !== false && (!courseId || s.course_id === courseId))
    .map((s) => s.course_id as string)
    .sort()
    .map((c) => courseCard(c, x, now));
}

/** L3 observations to schedule: completions of qualifying courses with no observation yet (one per completion; leavers skipped). */
export function l3ToSchedule(comps: Completion[], courses: Row[], surveys: Row[], existing: Set<string>, courseId: string | null = null, leavers: Set<string> = new Set()): { id: string; c: Completion; due_on: string }[] {
  const q = new Set(courses.filter((c) => c.qualifying === true).map((c) => c.id));
  const days = new Map(surveys.map((s) => [s.course_id, Number(s.l3_days ?? L3_DAYS)]));
  return comps
    .filter((c) => q.has(c.course_id) && days.has(c.course_id) && (!courseId || c.course_id === courseId) && !existing.has(l3Id(c.ref)) && !leavers.has(c.person_id))
    .map((c) => ({ id: l3Id(c.ref), c, due_on: l3DueOn(c.completed_on, days.get(c.course_id)) }));
}

// ───────────── committee pack (export rows; suppressed cells print "<10")
/** What a suppressed cell holds in the CSV export. On screen it shows as t('common.suppressedShort') ("أقل من 10" in Arabic). */
export const SUPPRESSED_CELL = '<10';
export interface PackRow { course: string; code: string; committee: string; completions: string; l1_n: string; relevance: string; recommend: string; l2_pairs: string; gain: string; l3_done: string; applied: string; kpis: string; redesign: string }
export function packRows(cards: CourseCard[], label: (courseId: string) => { code: string; title: string }, kpiText: (k: KpiView) => string, yes: string, no: string): PackRow[] {
  const s = (v: number | null, f?: (n: number) => string) => (v === null ? SUPPRESSED_CELL : f ? f(v) : String(v));
  return cards.map((c) => ({
    course: label(c.course_id).title, code: label(c.course_id).code, committee: c.committee, completions: s(c.completions),
    l1_n: s(c.l1.n), relevance: s(c.l1.items.relevance, (n) => (n / 10).toFixed(1)), recommend: s(c.l1.recommend, (n) => `${n}%`),
    l2_pairs: c.l2.forms ? s(c.l2.pairs) : '', gain: c.l2.forms ? s(c.l2.norm_gain, (n) => `${n}%`) : '',
    l3_done: c.l3.qualifying ? s(c.l3.done) : '', applied: c.l3.qualifying ? s(c.l3.applied, (n) => `${n}%`) : '',
    kpis: c.l4.kpis.map(kpiText).join('; '), redesign: c.redesign ? yes : no,
  }));
}
