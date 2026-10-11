/**
 * FS17 Future-skill learning pathways + FS18 curated, outcome-gated external catalogue: pure rules shared by the pages, the
 * LocalBackend, the seed builder and the PGlite validator. Import-free (node scripts load it directly).
 *
 * SQL twins (supabase/migrations/20261010231001_kafaa_fs31_pathways_catalogue.sql), proven equal on the seed by
 * scripts/validate/fs31-pathways.mjs:
 *   envelopeWeeks     = kafaa_pw_weeks          pathwayProblems = kafaa_pw_problems
 *   resolvePathway    = kafaa_pw_resolve        pathwayProgress = kafaa_pw_progress
 *   peerStats         = kafaa_pw_peer           catalogueCheck  = kafaa_xr_check
 *
 * Content resolution (FS17 "steps resolve content at run time"): a step names its kind (learn | practice | assess), optional pins
 * ("course:c-ai-gov") chosen by the training manager, and whether automatic discovery is on. Discovery takes any item that teaches
 * the step's skill at the pathway's level, so no code depends on the FS19 course pack:
 *   - a course teaches skill S at level L when one of its objectives carries { skill_id: S, level: L } (level defaults to 1);
 *     classroom / e-learning / blended / external courses are "learn", OJT / drill / simulator / clinic courses are "practice";
 *   - an FS18 external resource (published) teaches S at L when its skills list has { skill_id: S, level: L }; e-learning, MOOCs and
 *     courses are "learn", fellowships and programmes are "practice", and a resource with an assessment also counts for "assess";
 *   - an open, listed gig (F08 opportunity) that grows S is "practice" for levels 1-2 (security-type gigs never);
 *   - assessment: an FS10 fitness-check area that evidences S (levels 1-2; the check writes evidence up to level 2) and a current
 *     micro-credential aligned to S at level L;
 *   - assessment (FS wave C integration, data-only): an active FS21 adaptive bank that assesses S (levels up to the bank's evidence
 *     cap) and an active FS22 performance task that evidences S (levels up to the task's evidence level). These two are discovered
 *     only (never pinned); SQL twin redefined in 20261010239001_kafaa_fs3qa_integration.sql.
 * A step with nothing to resolve is "requested" and feeds the FS57 gap backlog (kafaa_pathway_gaps).
 */

// ───────────── shared shapes (structural; repository rows and seed rows both fit)
export type StepKind = 'learn' | 'practice' | 'assess';
export const STEP_KINDS: StepKind[] = ['learn', 'practice', 'assess'];
export type ItemType = 'course' | 'external' | 'opportunity' | 'credential' | 'fitness' | 'adaptive' | 'task';
export const ITEM_TYPES: ItemType[] = ['course', 'external', 'opportunity', 'credential', 'fitness', 'adaptive', 'task'];
/** Item types a training manager can pin (FS21/FS22 items are discovered only). */
export const PIN_TYPES: ItemType[] = ['course', 'external', 'opportunity', 'credential', 'fitness'];
export const LEARN_MODALITIES = ['classroom', 'elearning', 'blended', 'external'];
export const PRACTICE_MODALITIES = ['ojt', 'drill', 'simulator', 'clinic'];
export const EXT_LEARN_FORMATS = ['elearning', 'mooc', 'course'];
export const EXT_PRACTICE_FORMATS = ['fellowship', 'programme'];
export const EXT_FORMATS = ['elearning', 'mooc', 'course', 'fellowship', 'programme', 'webinar', 'reading'];
export const COST_BANDS = ['free', 'low', 'medium', 'high', 'varies'];
export const LANGS = ['en', 'ar', 'fr', 'es', 'pt', 'zh', 'ru', 'de', 'ko', 'ja'];
export const SECURITY_OPP_KINDS = ['security', 'protected_area', 'cyber', 'safeguards'];
export const MAX_ITEMS_PER_STEP = 4;
export const MAX_ACTIVE_PATHWAYS = 3;
export const ENVELOPE_MIN = 3;
export const ENVELOPE_MAX = 6;
export const WEEKLY_MIN = 0.5;
export const WEEKLY_MAX = 10;

type Row = Record<string, unknown>;
export interface SkillRef { id: string; name_en?: string; name_ar?: string; area?: string | null; fs_area?: string | null; lifecycle?: string | null; key_level?: number | null; competency_id?: string | null }
export interface PathwayRow { id: string; skill_id: string; level: number; version?: number; title_en: string; title_ar: string; envelope_months: number; weekly_hours: number | string; status?: string; listed?: boolean; sort?: number }
export interface StepRow { id: string; pathway_id: string; n: number; kind: string; title_en: string; title_ar: string; hours: number | string; pins?: string[] | null; auto?: boolean | null; version?: number }
export interface CourseC { id: string; code?: string; title_en: string; title_ar: string; modality: string; audience: string; duration_hours?: number | string | null; objectives?: unknown }
export interface ExternalC { id: string; title_en: string; title_ar: string; provider_en?: string; provider_ar?: string; format: string; hours?: number | string | null; skills?: unknown; has_assessment?: boolean | null; status: string; url?: string }
export interface OppC { id: string; title_en: string; title_ar?: string | null; kind: string; status: string; listed?: boolean | null; skills_gained?: string[] | null; hours_week?: number | null }
export interface CredC { id: string; title_en: string; title_ar: string; status: string; alignment?: unknown; hours?: number | string | null }
export interface FitC { id: string; name_en: string; name_ar: string; skill_ids?: string[] | null }
/** FS21 adaptive bank and FS22 performance task (wave C integration; data-only). */
export interface AdaptiveC { id: string; name_en: string; name_ar: string; status: string; skill_ids?: string[] | null; evidence_cap?: number | null }
export interface TaskC { id: string; title_en: string; title_ar: string; status: string; skill_ids?: string[] | null; evidence_level?: number | null }
export interface Content { courses: CourseC[]; externals: ExternalC[]; opportunities: OppC[]; credentials: CredC[]; fitness: FitC[]; adaptive?: AdaptiveC[]; tasks?: TaskC[] }

export interface ResolvedItem { type: ItemType; id: string; title_en: string; title_ar: string; hours: number | null; external: boolean; pinned: boolean; link: string }
export interface ResolvedStep { step_id: string; n: number; kind: StepKind; title_en: string; title_ar: string; hours: number; status: 'resolved' | 'requested'; items: ResolvedItem[] }
export interface ResolvedPathway { pathway_id: string; skill_id: string; level: number; weeks: number; capacity: number; total_hours: number; fits: boolean; requested: number; steps: ResolvedStep[] }

const num = (v: unknown) => (v == null || v === '' ? null : Number(v));
const r2 = (x: number) => Math.round(x * 100) / 100;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const arr = <T = Row>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Weeks in an envelope of `months` (52/12 weeks a month, rounded). SQL: kafaa_pw_weeks. */
export const envelopeWeeks = (months: number) => Math.round((Number(months) * 52) / 12);

/** Does a course teach skill S at level L (an objective { skill_id, level })? */
export function courseTeaches(c: CourseC, skill: string, level: number): boolean {
  return arr(c.objectives).some((o) => o && typeof o === 'object' && (o as Row).skill_id === skill && Number((o as Row).level ?? 1) === level);
}
/** Does an external resource teach skill S at level L? */
export function externalTeaches(x: ExternalC, skill: string, level: number): boolean {
  return arr(x.skills).some((o) => o && typeof o === 'object' && (o as Row).skill_id === skill && Number((o as Row).level) === level);
}
const credAligned = (c: CredC, skill: string, level: number) => arr(c.alignment).some((o) => (o as Row)?.skill_id === skill && Number((o as Row).level) === level);

const LINK: Record<ItemType, (id: string) => string> = {
  course: (id) => `/learn/course/${id}`,
  external: (id) => `/learn/external?item=${id}`,
  opportunity: (id) => `/opportunities/${id}`,
  credential: () => '/my/skills/credentials',
  fitness: () => '/my/ai-fluency/check',
  adaptive: (id) => `/my/assessments/adaptive/${id}`,
  task: (id) => `/my/assessments/tasks/${id}`,
};

function itemOf(type: ItemType, row: Row, pinned: boolean): ResolvedItem {
  const hours = type === 'course' ? num(row.duration_hours) : type === 'external' ? num(row.hours) : type === 'opportunity' ? num(row.hours_week) : type === 'credential' ? num(row.hours) : null;
  const named = type === 'fitness' || type === 'adaptive';
  const en = String(named ? row.name_en : row.title_en);
  const ar = String((named ? row.name_ar : row.title_ar) || en);
  return { type, id: String(row.id), title_en: en, title_ar: ar, hours, external: type === 'external', pinned, link: LINK[type](String(row.id)) };
}

/** Is a pinned item usable right now (exists and is live)? Returns its row or null. */
function pinned(content: Content, ref: string): { type: ItemType; row: Row } | null {
  const i = ref.indexOf(':');
  if (i < 1) return null;
  const type = ref.slice(0, i) as ItemType;
  const id = ref.slice(i + 1);
  const find = <T extends { id: string }>(list: T[]) => list.find((x) => x.id === id) as unknown as Row | undefined;
  let row: Row | undefined;
  if (type === 'course') { row = find(content.courses); if (row && !['staff', 'public'].includes(String(row.audience))) row = undefined; }
  else if (type === 'external') { row = find(content.externals); if (row && row.status !== 'published') row = undefined; }
  else if (type === 'opportunity') { row = find(content.opportunities); if (row && (row.status !== 'open' || row.listed === false || SECURITY_OPP_KINDS.includes(String(row.kind)))) row = undefined; }
  else if (type === 'credential') { row = find(content.credentials); if (row && row.status !== 'current') row = undefined; }
  else if (type === 'fitness') row = find(content.fitness);
  else return null;
  return row ? { type, row } : null;
}

/** Automatic discovery for one step (see the header). Sorted by type order, then id. */
export function discover(kind: StepKind, skill: string, level: number, content: Content): ResolvedItem[] {
  const out: ResolvedItem[] = [];
  const add = (type: ItemType, rows: Row[]) => { for (const r of [...rows].sort((a, b) => cmp(String(a.id), String(b.id)))) out.push(itemOf(type, r, false)); };
  const staffCourse = (c: CourseC) => ['staff', 'public'].includes(c.audience) && courseTeaches(c, skill, level);
  const pubExt = content.externals.filter((x) => x.status === 'published' && externalTeaches(x, skill, level));
  if (kind === 'learn') {
    add('course', content.courses.filter((c) => staffCourse(c) && LEARN_MODALITIES.includes(c.modality)) as unknown as Row[]);
    add('external', pubExt.filter((x) => EXT_LEARN_FORMATS.includes(x.format)) as unknown as Row[]);
  } else if (kind === 'practice') {
    add('course', content.courses.filter((c) => staffCourse(c) && PRACTICE_MODALITIES.includes(c.modality)) as unknown as Row[]);
    add('external', pubExt.filter((x) => EXT_PRACTICE_FORMATS.includes(x.format)) as unknown as Row[]);
    if (level <= 2) add('opportunity', content.opportunities.filter((o) => o.status === 'open' && o.listed !== false && !SECURITY_OPP_KINDS.includes(o.kind) && (o.skills_gained ?? []).includes(skill)) as unknown as Row[]);
  } else {
    add('external', pubExt.filter((x) => !!x.has_assessment) as unknown as Row[]);
    add('credential', content.credentials.filter((c) => c.status === 'current' && credAligned(c, skill, level)) as unknown as Row[]);
    if (level <= 2) add('fitness', content.fitness.filter((f) => (f.skill_ids ?? []).includes(skill)) as unknown as Row[]);
    add('adaptive', (content.adaptive ?? []).filter((b) => b.status === 'active' && (b.skill_ids ?? []).includes(skill) && level <= Number(b.evidence_cap ?? 3)) as unknown as Row[]);
    add('task', (content.tasks ?? []).filter((k) => k.status === 'active' && (k.skill_ids ?? []).includes(skill) && level <= Number(k.evidence_level ?? 2)) as unknown as Row[]);
  }
  return out;
}

/** FS17 resolvePathway(): every step with its live content (pins first, then discovery; at most 4), or "requested". */
export function resolvePathway(p: PathwayRow, steps: StepRow[], content: Content): ResolvedPathway {
  const ver = Number(p.version ?? 1);
  const mine = steps.filter((s) => s.pathway_id === p.id && Number(s.version ?? 1) === ver).sort((a, b) => a.n - b.n || cmp(a.id, b.id));
  const out: ResolvedStep[] = mine.map((s) => {
    const items: ResolvedItem[] = [];
    const seen = new Set<string>();
    for (const ref of s.pins ?? []) {
      const hit = pinned(content, ref);
      const key = hit ? `${hit.type}:${String(hit.row.id)}` : '';
      if (hit && !seen.has(key)) { seen.add(key); items.push(itemOf(hit.type, hit.row, true)); }
    }
    if (s.auto !== false) for (const it of discover(s.kind as StepKind, p.skill_id, Number(p.level), content)) {
      const key = `${it.type}:${it.id}`;
      if (!seen.has(key)) { seen.add(key); items.push(it); }
    }
    const list = items.slice(0, MAX_ITEMS_PER_STEP);
    return { step_id: s.id, n: s.n, kind: s.kind as StepKind, title_en: s.title_en, title_ar: s.title_ar, hours: Number(s.hours), status: list.length ? 'resolved' : 'requested', items: list };
  });
  const weeks = envelopeWeeks(p.envelope_months);
  const capacity = r2(weeks * Number(p.weekly_hours));
  const total = r2(out.reduce((n, s) => n + s.hours, 0));
  return { pathway_id: p.id, skill_id: p.skill_id, level: Number(p.level), weeks, capacity, total_hours: total, fits: total <= capacity, requested: out.filter((s) => s.status === 'requested').length, steps: out };
}

// ───────────── progress (derived from the person's records; never typed in)
export interface PersonRecords {
  courses: string[]; // course ids with a passed / completed / attended training record
  externals: string[]; // external resource ids with a self-declared completion
  externalsVerified?: string[]; // (FS79) verified external completions
  opportunities: string[]; // opportunity ids with a completed application
  credentials: string[]; // micro-credential definition ids awarded to the person
  fitness: boolean; // a completed FS10 fitness check
  adaptive?: string[]; // (wave C integration) FS21 bank ids with a completed attempt that counts
  tasks?: string[]; // (wave C integration) FS22 task ids with a scored, passed attempt that counts
}
export interface StepProgress { step_id: string; done: boolean; via: string | null; self_declared: boolean }
export interface PathwayProgress { steps: StepProgress[]; done: number; total: number; pct: number; self_declared: number; complete: boolean }
export function pathwayProgress(resolved: ResolvedPathway, rec: PersonRecords): PathwayProgress {
  const ver = new Set(rec.externalsVerified ?? []);
  const steps = resolved.steps.map((s): StepProgress => {
    let via: string | null = null;
    let self = false;
    for (const it of s.items) {
      const hit = it.type === 'course' ? rec.courses.includes(it.id) : it.type === 'external' ? rec.externals.includes(it.id) || ver.has(it.id)
        : it.type === 'opportunity' ? rec.opportunities.includes(it.id) : it.type === 'credential' ? rec.credentials.includes(it.id)
        : it.type === 'adaptive' ? (rec.adaptive ?? []).includes(it.id) : it.type === 'task' ? (rec.tasks ?? []).includes(it.id) : rec.fitness;
      if (!hit) continue;
      const selfDecl = it.type === 'external' && !ver.has(it.id);
      if (via === null || (self && !selfDecl)) { via = `${it.type}:${it.id}`; self = selfDecl; }
    }
    return { step_id: s.step_id, done: via !== null, via, self_declared: via !== null && self };
  });
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, pct: steps.length ? Math.round((100 * done) / steps.length) : 0, self_declared: steps.filter((s) => s.self_declared).length, complete: steps.length > 0 && done === steps.length };
}
export const COURSE_DONE_RESULTS = ['passed', 'completed', 'attended'];
/** The records one person holds, from raw rows (LocalBackend and seed). SQL: inside kafaa_pw_progress. */
export function recordsOf(person: string, t: { training_records: Row[]; external_completions: Row[]; opportunity_applications: Row[]; microcred_awards: Row[]; fitness_attempts: Row[]; adaptive_attempts?: Row[]; task_attempts?: Row[] }): PersonRecords {
  return {
    courses: [...new Set(t.training_records.filter((r) => r.person_id === person && COURSE_DONE_RESULTS.includes(String(r.result))).map((r) => String(r.course_id)))],
    externals: [...new Set(t.external_completions.filter((r) => r.person_id === person).map((r) => String(r.resource_id)))],
    externalsVerified: [...new Set(t.external_completions.filter((r) => r.person_id === person && r.evidence === 'verified').map((r) => String(r.resource_id)))],
    opportunities: [...new Set(t.opportunity_applications.filter((r) => r.person_id === person && r.status === 'completed').map((r) => String(r.opportunity_id)))],
    credentials: [...new Set(t.microcred_awards.filter((r) => r.person_id === person && r.status === 'awarded').map((r) => String(r.def_id)))],
    fitness: t.fitness_attempts.some((r) => r.person_id === person && r.status === 'completed'),
    adaptive: [...new Set((t.adaptive_attempts ?? []).filter((r) => r.person_id === person && r.status === 'completed' && r.counts !== false).map((r) => String(r.bank_id)))],
    tasks: [...new Set((t.task_attempts ?? []).filter((r) => r.person_id === person && r.status === 'scored' && r.passed === true && r.counts !== false).map((r) => String(r.task_id)))],
  };
}

// ───────────── colleagues' completion times (suppressed under MIN_GROUP_SIZE)
export interface PeerStats { started: number | null; completed: number | null; median_weeks: number | null; suppressed: boolean }
const dayNo = (iso: string) => Math.floor(Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`) / 86_400_000);
/** Weeks one completion took: ceil(days / 7), at least 1. */
export const weeksTaken = (start: string, end: string) => Math.max(1, Math.ceil((dayNo(end) - dayNo(start)) / 7));
export function peerStats(enrolments: Row[], pathwayId: string, min: number): PeerStats {
  const mine = enrolments.filter((e) => e.pathway_id === pathwayId && e.status !== 'withdrawn');
  const done = mine.filter((e) => e.status === 'completed' && e.completed_on && e.started_on).map((e) => weeksTaken(String(e.started_on), String(e.completed_on))).sort((a, b) => a - b);
  if (done.length < min) return { started: mine.length >= min ? mine.length : null, completed: null, median_weeks: null, suppressed: true };
  const m = done.length % 2 ? done[(done.length - 1) / 2] : (done[done.length / 2 - 1] + done[done.length / 2]) / 2;
  return { started: mine.length, completed: done.length, median_weeks: Math.round(m * 10) / 10, suppressed: false };
}

// ───────────── pathway checks (savePathway). Codes in this order; SQL kafaa_pw_problems returns the same list.
export const PW_PROBLEMS = ['skill', 'level', 'title', 'envelope', 'weekly', 'steps', 'sequence', 'over_envelope', 'pins'] as const;
export interface PathwayInput { id?: string; skill_id?: unknown; level?: unknown; title_en?: unknown; title_ar?: unknown; summary_en?: unknown; summary_ar?: unknown; outcome_en?: unknown; outcome_ar?: unknown; envelope_months?: unknown; weekly_hours?: unknown; status?: unknown; steps?: unknown }
const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const len = (v: unknown, lo: number, hi: number) => typeof v === 'string' && v.trim().length >= lo && v.trim().length <= hi;
/** A skill a pathway may teach: an FS02 future skill (fs_area set), not obsolete, never in the security area. */
export const pathwaySkillOk = (s: SkillRef | undefined | null) => !!s && !!s.fs_area && s.lifecycle !== 'obsolete' && s.area !== 'security';
export function pathwayProblems(p: PathwayInput, skills: SkillRef[]): string[] {
  const out: string[] = [];
  const sk = skills.find((s) => s.id === p.skill_id);
  if (!pathwaySkillOk(sk)) out.push('skill');
  if (!isInt(p.level) || (p.level as number) < 1 || (p.level as number) > 3) out.push('level');
  if (!len(p.title_en, 3, 140) || !len(p.title_ar, 3, 140)) out.push('title');
  if (!isInt(p.envelope_months) || (p.envelope_months as number) < ENVELOPE_MIN || (p.envelope_months as number) > ENVELOPE_MAX) out.push('envelope');
  if (!isNum(p.weekly_hours) || (p.weekly_hours as number) < WEEKLY_MIN || (p.weekly_hours as number) > WEEKLY_MAX) out.push('weekly');
  const steps = Array.isArray(p.steps) ? (p.steps as Row[]) : null;
  const stepOk = (s: Row) => !!s && typeof s === 'object' && STEP_KINDS.includes(s.kind as StepKind) && isNum(s.hours) && (s.hours as number) > 0 && (s.hours as number) <= 200 && len(s.title_en, 3, 140) && len(s.title_ar, 3, 140);
  const stepsOk = !!steps && steps.length >= 3 && steps.length <= 8 && steps.every(stepOk);
  if (!stepsOk) out.push('steps');
  if (stepsOk) {
    const order = steps!.map((s) => STEP_KINDS.indexOf(s.kind as StepKind));
    const sorted = order.every((k, i) => i === 0 || k >= order[i - 1]);
    if (!sorted || !STEP_KINDS.every((_, k) => order.includes(k))) out.push('sequence');
    if (isInt(p.envelope_months) && isNum(p.weekly_hours) && !out.includes('envelope') && !out.includes('weekly')) {
      const total = r2(steps!.reduce((n, s) => n + Number(s.hours), 0));
      if (total > r2(envelopeWeeks(p.envelope_months as number) * (p.weekly_hours as number))) out.push('over_envelope');
    }
    const pinOk = (x: unknown) => typeof x === 'string' && /^(course|external|opportunity|credential|fitness):[A-Za-z0-9._:-]{1,80}$/.test(x);
    if (steps!.some((s) => s.pins != null && (!Array.isArray(s.pins) || (s.pins as unknown[]).length > 6 || !(s.pins as unknown[]).every(pinOk)))) out.push('pins');
  }
  return out;
}

// ───────────── FS18 catalogue criteria and the publish gate (catalogueCheck). SQL: kafaa_xr_check.
export interface CriterionRow { id: string; min_score: number; required: boolean; status?: string; sort?: number }
export const XR_PROBLEMS = ['title', 'provider', 'url', 'as_of', 'skills', 'languages', 'cost', 'format', 'hours'] as const;
export interface CatalogueCheck { ok: boolean; problems: string[]; failing: string[] }
const HTTPS = /^https:\/\/[^\s/$.?#][^\s]*$/;
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
export function catalogueCheck(x: Row, criteria: CriterionRow[], skills: SkillRef[], today: string): CatalogueCheck {
  const problems: string[] = [];
  if (!len(x.title_en, 3, 200) || !len(x.title_ar, 3, 200)) problems.push('title');
  if (!len(x.provider_en, 2, 140) || !len(x.provider_ar, 2, 140)) problems.push('provider');
  if (typeof x.url !== 'string' || !HTTPS.test(x.url) || typeof x.provider_url !== 'string' || !HTTPS.test(x.provider_url)) problems.push('url');
  if (!isDate(x.as_of) || (x.as_of as string) > today) problems.push('as_of');
  const sk = Array.isArray(x.skills) ? (x.skills as Row[]) : [];
  if (!sk.length || sk.length > 8 || !sk.every((e) => e && typeof e === 'object' && pathwaySkillOk(skills.find((s) => s.id === e.skill_id)) && isInt(e.level) && (e.level as number) >= 1 && (e.level as number) <= 3)) problems.push('skills');
  const langs = Array.isArray(x.languages) ? (x.languages as unknown[]) : [];
  if (!langs.length || !langs.every((l) => typeof l === 'string' && LANGS.includes(l))) problems.push('languages');
  if (!COST_BANDS.includes(String(x.cost_band))) problems.push('cost');
  if (!EXT_FORMATS.includes(String(x.format))) problems.push('format');
  if (x.hours != null && (!isNum(x.hours) || (x.hours as number) <= 0 || (x.hours as number) > 2000)) problems.push('hours');
  const scores = x.criteria && typeof x.criteria === 'object' && !Array.isArray(x.criteria) ? (x.criteria as Row) : {};
  const failing = criteria.filter((c) => (c.status ?? 'published') === 'published' && c.required)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || cmp(a.id, b.id))
    .filter((c) => { const v = scores[c.id]; return !(isInt(v) && (v as number) >= c.min_score && (v as number) <= 3); }).map((c) => c.id);
  return { ok: problems.length === 0 && failing.length === 0, problems, failing };
}

// ───────────── Coach ranking (TS; reads only rows the person may read). Reasons carry i18n keys m19.pw.reasons.*
export interface PwReason { code: string; key: string; vars?: Record<string, string | number | { en: string; ar: string }>; ref?: { table: string; id: string }; weight?: number }
export interface RankedPathway { id: string; score: number; reasons: PwReason[]; skill_id: string; level: number }
export interface Requirement { kind: string; ref_id: string; level: number }
export interface RankInput {
  pathways: (PathwayRow & { requested?: number; peer?: PeerStats | null })[];
  skills: SkillRef[];
  have: Map<string, number>;
  roleTitle: { en: string; ar: string } | null;
  now: Requirement[];
  y2030: Requirement[];
  goals: string[];
  weeklyGoal: number | null;
  enrolled: Map<string, string>;
}
const R = (code: string, vars?: PwReason['vars'], ref?: PwReason['ref'], weight?: number): PwReason => ({ code, key: `m19.pw.reasons.${code}`, vars, ref, weight });
export const RANK_MAX = 6;
export function rankPathways(input: RankInput): RankedPathway[] {
  const skills = new Map(input.skills.map((s) => [s.id, s]));
  const role = input.roleTitle ?? { en: '', ar: '' };
  const nowComp = new Map<string, number>();
  for (const q of input.now) if (q.kind === 'competency') nowComp.set(q.ref_id, Math.max(nowComp.get(q.ref_id) ?? 0, Number(q.level)));
  const out: RankedPathway[] = [];
  for (const p of input.pathways) {
    const s = skills.get(p.skill_id);
    if (!s || !pathwaySkillOk(s) || s.lifecycle === 'declining') continue;
    const L = Number(p.level);
    const have = input.have.get(p.skill_id) ?? 0;
    if (have >= L || L > have + 1 || input.enrolled.has(p.id)) continue;
    const name = { en: s.name_en ?? s.id, ar: s.name_ar || s.name_en || s.id };
    const reasons: PwReason[] = [];
    let score = 0;
    const direct = input.y2030.find((q) => q.kind === 'skill' && q.ref_id === p.skill_id && Number(q.level) >= L);
    if (direct) { score += 3; reasons.push(R('gap_2030', { skill: name, level: Number(direct.level), have, role }, undefined, 3)); }
    const comp = s.competency_id ? input.y2030.find((q) => q.kind === 'competency' && q.ref_id === s.competency_id && Number(q.level) > (nowComp.get(q.ref_id) ?? 0)) : undefined;
    if (!direct && comp) { score += 1.5; reasons.push(R('rising_2030', { skill: name, role }, undefined, 1.5)); }
    if (s.competency_id && nowComp.has(s.competency_id)) { score += 1; reasons.push(R('today_role', { skill: name, role }, undefined, 1)); }
    if (input.goals.includes(p.skill_id)) { score += 2; reasons.push(R('my_goal', { skill: name }, undefined, 2)); }
    if (score <= 0) continue;
    if (s.lifecycle === 'emerging' || s.lifecycle === 'growing') { score += 0.5; reasons.push(R(`lifecycle_${s.lifecycle}`, { skill: name }, undefined, 0.5)); }
    if (have > 0) reasons.push(R('next_level', { have, level: L }));
    if (input.weeklyGoal != null && input.weeklyGoal > 0) {
      if (Number(p.weekly_hours) <= input.weeklyGoal) { score += 0.25; reasons.push(R('fits_goal', { hours: Number(p.weekly_hours), goal: input.weeklyGoal }, undefined, 0.25)); }
      else { score -= 0.25; reasons.push(R('over_goal', { hours: Number(p.weekly_hours), goal: input.weeklyGoal }, undefined, -0.25)); }
    }
    reasons.push(R('envelope', { months: Number(p.envelope_months), hours: Number(p.weekly_hours) }));
    if (p.peer && !p.peer.suppressed && p.peer.median_weeks != null) reasons.push(R('peers', { n: p.peer.completed ?? 0, weeks: p.peer.median_weeks }));
    if ((p.requested ?? 0) > 0) { score -= 0.25; reasons.push(R('requested', { n: p.requested ?? 0 }, undefined, -0.25)); }
    out.push({ id: p.id, score: Math.round(score * 100) / 100, reasons, skill_id: p.skill_id, level: L });
  }
  return out.sort((a, b) => b.score - a.score || a.level - b.level || cmp(a.id, b.id)).slice(0, RANK_MAX);
}

/** External picks for the coach: published resources teaching a skill of a ranked pathway at its level, with reasons. */
export interface RankedExternal { id: string; score: number; reasons: PwReason[]; skill_id: string }
export function rankExternals(ranked: RankedPathway[], externals: (ExternalC & { cost_band?: string; languages?: string[] | null })[], skills: SkillRef[], max = 4): RankedExternal[] {
  const names = new Map(skills.map((s) => [s.id, { en: s.name_en ?? s.id, ar: s.name_ar || s.name_en || s.id }]));
  const out: RankedExternal[] = [];
  for (const x of externals.filter((e) => e.status === 'published')) {
    const hit = ranked.find((p) => externalTeaches(x, p.skill_id, p.level));
    if (!hit) continue;
    const reasons = [R('ext_for_skill', { skill: names.get(hit.skill_id) ?? { en: hit.skill_id, ar: hit.skill_id }, level: hit.level }, { table: 'external_resources', id: x.id })];
    let score = hit.score;
    if (x.cost_band === 'free') { score += 0.3; reasons.push(R('ext_free')); }
    if ((x.languages ?? []).includes('ar')) { score += 0.2; reasons.push(R('ext_arabic')); }
    reasons.push(R('ext_external'));
    out.push({ id: x.id, score: Math.round(score * 100) / 100, reasons, skill_id: hit.skill_id });
  }
  return out.sort((a, b) => b.score - a.score || cmp(a.id, b.id)).slice(0, max);
}

/** User-facing refusal messages (identical in SQL kafaa_pw_msgs()). */
export const PW_MSG = {
  not_signed_in: 'Sign in to use future-skill pathways',
  forbidden: 'Future-skill pathways are for ENEC staff',
  forbidden_edit: 'Only the training manager edits pathways and the external catalogue',
  not_found: 'Pathway not found',
  already: 'You already follow this pathway',
  held: 'You already hold this skill at this level',
  too_many: 'You can follow up to three pathways at a time; finish or leave one first',
  steps_open: 'Some steps are not done yet',
  not_active: 'This pathway is not active for you',
  invalid: 'Check the pathway: ',
  xr_not_found: 'Resource not found',
  xr_invalid: 'Check the resource: ',
  xr_criteria: 'The resource does not meet the published criteria: ',
  xr_reason: 'Give a reason of 5 to 300 characters',
  xr_not_published: 'Only published resources can be recorded',
  xr_date: 'The completion date must be a real date, not in the future',
  xr_duplicate: 'You already recorded this resource',
  xr_note: 'Notes are limited to 300 characters',
} as const;
