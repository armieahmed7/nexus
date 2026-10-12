// FS77 Student future-skills starter and intake baselines (FS wave H · E5, M06): pure rules shared by the pages, the LocalBackend RPCs,
// the seed builder, the PGlite validator and the tests. The SQL mirror lives in supabase/migrations/20261010285001_kafaa_fs85_student_starter.sql
// (kafaa_ib_* and kafaa_ip_*); scripts/validate/fs85-student-starter.mjs proves SQL = TS on the seed and on generated cases.
// Import-free on purpose (node seed scripts load this file directly).
//
// The feature (PLAN FS77, handover section 4 wave H):
//   - an AI-literacy starter and an SMR orientation inside the public student journey: static lessons with sourced facts and a
//     non-scoring self-check; nothing is stored for anonymous visitors (signed-in students may keep their progress in their own
//     F34 journey checklist, keys "starter:<lesson>");
//   - intake-year baselines, set by HR (workforce_strategy W): for one intake year (and optionally one programme) which induction
//     modules the joiners already hold (skip), partly hold (short refresher) or do not hold (full module). Mandatory nuclear modules
//     (safety culture, radiation protection, site induction, cyber hygiene, AI at ENEC) can never be skipped by a baseline;
//   - induction plans read the baseline for the joiner's intake year (programme-specific first, then "all programmes"); with no
//     published baseline the plan is the full induction.

// ───────────── starter (public, client-side)
export const STARTER_TRACKS = ['ai', 'smr'] as const;
export type StarterTrack = (typeof STARTER_TRACKS)[number];
export const starterKey = (lessonId: string) => `starter:${lessonId}`;

export interface StarterSource {
  label: string;
  url: string;
  publisher?: string;
  as_of: string;
  /** true when the research pack marks the source secondary / unverified, or it is a news report of someone else's policy. */
  secondary?: boolean;
}
export interface StarterCheck {
  prompt_en: string;
  prompt_ar: string;
  options: { en: string; ar: string }[];
  correct: number;
  explain_en: string;
  explain_ar: string;
}
export interface StarterLesson {
  id: string;
  track: StarterTrack | string;
  sort: number;
  title_en: string;
  title_ar: string;
  summary_en: string;
  summary_ar: string;
  points: { en: string; ar: string }[] | unknown;
  self_check: StarterCheck | unknown;
  links: { to: string; label_en: string; label_ar: string }[] | unknown;
  induction_module_id?: string | null;
  sources: StarterSource[] | unknown;
  as_of: string;
  listed?: boolean;
}

/** Headcount, site and deployment claims never appear in public SMR text (same pattern as FS05 publicTextIsClean, plus deployment). */
export const HEADCOUNT_OR_SITE = /\b(headcount|fte|full[- ]time equivalents?|\d+\s*(staff|people|jobs|positions|operators|engineers|workers)|site (selection|identified|chosen)|candidate site|located at|to be built (at|in))\b/i;
export const DEPLOYMENT_CLAIM = /\b(will (be )?(build|built|deploy|deployed|operate)|deployment (is |has been )?(planned|decided|approved|confirmed)|to be deployed|first smr in the uae)\b/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS = /^https:\/\/\S+$/;
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function starterTextIsClean(values: unknown[]): boolean {
  return values.every((v) => {
    const x = typeof v === 'string' ? v : v && typeof v === 'object' ? JSON.stringify(v) : '';
    return !HEADCOUNT_OR_SITE.test(x) && !DEPLOYMENT_CLAIM.test(x);
  });
}
export const sourcesOf = (l: { sources: unknown }): StarterSource[] => (Array.isArray(l.sources) ? (l.sources as StarterSource[]) : []);
export const pointsOf = (l: { points: unknown }): { en: string; ar: string }[] => (Array.isArray(l.points) ? (l.points as { en: string; ar: string }[]) : []);
export const linksOf = (l: { links: unknown }): { to: string; label_en: string; label_ar: string }[] => (Array.isArray(l.links) ? (l.links as { to: string; label_en: string; label_ar: string }[]) : []);
export const checkOf = (l: { self_check: unknown }): StarterCheck | null => (l.self_check && typeof l.self_check === 'object' && !Array.isArray(l.self_check) ? (l.self_check as StarterCheck) : null);

/** First problem of a starter lesson (null when publishable): every fact cites an https source with an as-of date; SMR text is clean. */
export function lessonProblem(l: StarterLesson): string | null {
  if (!(STARTER_TRACKS as readonly string[]).includes(String(l.track))) return 'track';
  if (!s(l.title_en) || !s(l.title_ar) || !s(l.summary_en) || !s(l.summary_ar)) return 'text';
  const pts = pointsOf(l);
  if (pts.length < 2 || pts.length > 5 || pts.some((p) => !s(p?.en) || !s(p?.ar))) return 'points';
  const c = checkOf(l);
  if (!c || !s(c.prompt_en) || !s(c.prompt_ar) || !Array.isArray(c.options) || c.options.length < 2 || c.options.length > 4 || c.options.some((o) => !s(o?.en) || !s(o?.ar))
    || !Number.isInteger(c.correct) || c.correct < 0 || c.correct >= c.options.length || !s(c.explain_en) || !s(c.explain_ar)) return 'check';
  const src = sourcesOf(l);
  if (!src.length || src.some((x) => !s(x?.label) || !HTTPS.test(String(x?.url ?? '')) || !ISO_DATE.test(String(x?.as_of ?? '')))) return 'sources';
  if (!ISO_DATE.test(String(l.as_of ?? '').slice(0, 10))) return 'as_of';
  if (linksOf(l).some((k) => !/^\/[a-z0-9/_-]*$/.test(String(k?.to ?? '')) || !s(k?.label_en) || !s(k?.label_ar))) return 'links';
  if (l.track === 'smr' && !starterTextIsClean([l.title_en, l.summary_en, pts, c])) return 'smr_claim';
  return null;
}

/** Lessons done per track from a checklist (the signed-in student's journey, or the visitor's in-page state). */
export function starterProgress(lessons: { id: string; track: string }[], checklist: Record<string, string> | null | undefined) {
  const out: Record<string, { done: number; total: number }> = {};
  for (const t of STARTER_TRACKS) out[t] = { done: 0, total: 0 };
  for (const l of lessons) {
    const o = out[l.track];
    if (!o) continue;
    o.total++;
    if ((checklist ?? {})[starterKey(l.id)] === 'done') o.done++;
  }
  return out;
}

// ───────────── induction modules and intake baselines
export const PLAN_PROGRAMMES = ['dnt', 'energy-pioneers', 'gdp', 'gpo', 'direct'] as const;
export type PlanProgramme = (typeof PLAN_PROGRAMMES)[number];
export const BASELINE_SCOPES = ['all', ...PLAN_PROGRAMMES] as const;
export const ENTRY_STATUSES = ['held', 'partial', 'not_held'] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];
export const ENTRY_BASES = ['national_curriculum', 'programme_curriculum', 'intake_diagnostic', 'none'] as const;
export const YEAR_MIN = 2020;
export const YEAR_MAX = 2035;
export const NOTE_MAX = 300;
export const BASELINE_NOTE_MAX = 600;

export interface InductionModule {
  id: string;
  sort: number;
  area: string;
  hours: number;
  refresh_hours: number;
  mandatory: boolean;
  listed?: boolean;
}
export interface BaselineEntry {
  module_id: string;
  status: EntryStatus;
  basis: string;
  source_url: string | null;
  note_en: string;
  note_ar: string;
}
export interface BaselineRow {
  id: string;
  intake_year: number;
  programme: string;
  status: string;
  version: number;
  entries: BaselineEntry[] | unknown;
}

export const baselineId = (year: number, programme: string, version: number) => `ib-${year}-${programme}-v${version}`;
export const planId = (person: string) => `ip-${person}`;
const byModule = (a: { sort: number; id: string }, b: { sort: number; id: string }) => Number(a.sort) - Number(b.sort) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export const listedModules = (modules: InductionModule[]) => modules.filter((m) => m.listed !== false).sort(byModule);
export const entriesOf = (b: { entries: unknown } | null | undefined): BaselineEntry[] => (b && Array.isArray(b.entries) ? (b.entries as BaselineEntry[]) : []);
const strLen = (v: unknown, max: number) => v == null || (typeof v === 'string' && v.trim().length <= max);

/** First problem of a baseline draft (HR input), null when valid. Codes: year, programme, entries, module, duplicate, status, basis, mandatory,
 *  source, note. Checks entries in order and returns the first entry's first problem (the SQL kafaa_ib_problem walks them the same way). */
export function baselineProblem(input: unknown, modulesIn: InductionModule[]): string | null {
  const p = (input && typeof input === 'object' && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const mods = new Map(listedModules(modulesIn).map((m) => [m.id, m]));
  const y = p.intake_year;
  if (typeof y !== 'number' || !Number.isInteger(y) || y < YEAR_MIN || y > YEAR_MAX) return 'year';
  if (typeof p.programme !== 'string' || !(BASELINE_SCOPES as readonly string[]).includes(p.programme)) return 'programme';
  const e = p.entries;
  if (!Array.isArray(e) || e.length < 1 || e.length > mods.size) return 'entries';
  const seen = new Set<string>();
  for (const x of e as unknown[]) {
    const r = (x && typeof x === 'object' && !Array.isArray(x) ? x : null) as Record<string, unknown> | null;
    if (!r || typeof r.module_id !== 'string' || !mods.has(r.module_id)) return 'module';
    if (seen.has(r.module_id)) return 'duplicate';
    seen.add(r.module_id);
    if (typeof r.status !== 'string' || !(ENTRY_STATUSES as readonly string[]).includes(r.status)) return 'status';
    if (typeof r.basis !== 'string' || !(ENTRY_BASES as readonly string[]).includes(r.basis)) return 'basis';
    if (mods.get(r.module_id)!.mandatory && r.status !== 'not_held') return 'mandatory';
    if (r.status !== 'not_held' && r.basis === 'none') return 'basis';
    if (r.source_url != null && (typeof r.source_url !== 'string' || !HTTPS.test(r.source_url))) return 'source';
    if (r.basis === 'national_curriculum' && r.source_url == null) return 'source';
    if (!strLen(r.note_en, NOTE_MAX) || !strLen(r.note_ar, NOTE_MAX)) return 'note';
  }
  if (!strLen(p.note_en, BASELINE_NOTE_MAX) || !strLen(p.note_ar, BASELINE_NOTE_MAX)) return 'note';
  return null;
}

/** Entries as both backends store them: trimmed notes, explicit nulls, in module order. */
export function cleanEntries(entries: unknown, modulesIn: InductionModule[]): BaselineEntry[] {
  const order = new Map(listedModules(modulesIn).map((m, i) => [m.id, i]));
  return (Array.isArray(entries) ? (entries as Record<string, unknown>[]) : [])
    .map((r) => ({
      module_id: String(r.module_id), status: r.status as EntryStatus, basis: String(r.basis),
      source_url: typeof r.source_url === 'string' ? r.source_url : null, note_en: s(r.note_en), note_ar: s(r.note_ar),
    }))
    .sort((a, b) => (order.get(a.module_id) ?? 999) - (order.get(b.module_id) ?? 999));
}

/** The published baseline an induction plan reads: the joiner's programme for that intake year first (highest version), else "all". */
export function baselineFor<B extends BaselineRow>(baselines: B[], year: number, programme: string): B | null {
  const pick = (scope: string) => baselines
    .filter((b) => b.status === 'published' && Number(b.intake_year) === Number(year) && b.programme === scope)
    .sort((a, b) => Number(b.version) - Number(a.version))[0] ?? null;
  return (programme !== 'all' ? pick(programme) : null) ?? pick('all');
}

export type PlanAction = 'full' | 'refresher' | 'skip';
export type PlanReason = 'mandatory' | 'no_baseline' | 'no_entry' | 'held' | 'partial' | 'not_held';
export interface PlanItem {
  module_id: string;
  action: PlanAction;
  hours: number;
  planned_hours: number;
  reason: PlanReason;
  basis: string | null;
}
export interface InductionPlan {
  baseline_id: string | null;
  baseline_version: number | null;
  items: PlanItem[];
  hours_total: number;
  hours_planned: number;
  hours_saved: number;
}
const tenths = (n: number) => Math.round(Number(n) * 10);

/** The induction plan for one joiner, read from the baseline for their intake year (null = no published baseline = full induction). */
export function inductionPlan(modulesIn: InductionModule[], baseline: BaselineRow | null): InductionPlan {
  const ents = new Map(entriesOf(baseline).map((e) => [e.module_id, e]));
  const items: PlanItem[] = listedModules(modulesIn).map((m) => {
    const hours = Number(m.hours);
    const e = ents.get(m.id);
    const full = (reason: PlanReason): PlanItem => ({ module_id: m.id, action: 'full', hours, planned_hours: hours, reason, basis: reason === 'not_held' ? e?.basis ?? null : null });
    if (m.mandatory) return full('mandatory');
    if (!baseline) return full('no_baseline');
    if (!e) return full('no_entry');
    if (e.status === 'held') return { module_id: m.id, action: 'skip', hours, planned_hours: 0, reason: 'held', basis: e.basis };
    if (e.status === 'partial') return { module_id: m.id, action: 'refresher', hours, planned_hours: Math.min(Number(m.refresh_hours), hours), reason: 'partial', basis: e.basis };
    return full('not_held');
  });
  const total = items.reduce((a, x) => a + tenths(x.hours), 0);
  const planned = items.reduce((a, x) => a + tenths(x.planned_hours), 0);
  return {
    baseline_id: baseline?.id ?? null, baseline_version: baseline ? Number(baseline.version) : null, items,
    hours_total: total / 10, hours_planned: planned / 10, hours_saved: (total - planned) / 10,
  };
}

/** A stored plan is stale when the baseline its intake year would read now is not the one it was built from. */
export function planStale(plan: { baseline_id: string | null; intake_year: number; programme: string }, baselines: BaselineRow[]): boolean {
  return (baselineFor(baselines, Number(plan.intake_year), plan.programme)?.id ?? null) !== (plan.baseline_id ?? null);
}

/** First problem of a plan request (HR input). Codes: person, programme, year. */
export function planProblem(input: unknown, person: { kind?: string | null } | null | undefined): string | null {
  const p = (input && typeof input === 'object' && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  if (!person || !['staff', 'applicant'].includes(String(person.kind))) return 'person';
  if (typeof p.programme !== 'string' || !(PLAN_PROGRAMMES as readonly string[]).includes(p.programme)) return 'programme';
  const y = p.intake_year;
  if (typeof y !== 'number' || !Number.isInteger(y) || y < YEAR_MIN || y > YEAR_MAX) return 'year';
  return null;
}

// ───────────── joiners HR can build a plan for (TS mirror of kafaa_ip_joiners)
export const OFFER_PROGRAMMES = ['dnt', 'energy-pioneers', 'gdp', 'gpo'] as const;
export interface Joiner {
  person_id: string;
  name: string;
  kind: string;
  programme: string;
  intake_year: number;
  source: 'plan' | 'offer' | 'hire';
  plan_id: string | null;
}
type Row = Record<string, unknown>;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Joiners: everyone with an induction plan, offered or accepted applicants of the four entry programmes (intake the year after the
 *  decision), and entry-level staff hired in the last 365 days ("direct" hires). One row per person (plan > offer > hire), by person id. */
export function joinerCandidates(world: { people: object[]; applications: object[]; induction_plans: object[] }, today: string): Joiner[] {
  const people = new Map((world.people as Row[]).map((p) => [String(p.id), p]));
  const out = new Map<string, Joiner>();
  const name = (id: string) => String(people.get(id)?.display_name ?? id);
  const kind = (id: string) => String(people.get(id)?.kind ?? '');
  for (const pl of world.induction_plans as Row[]) {
    const id = String(pl.person_id);
    out.set(id, { person_id: id, name: name(id), kind: kind(id), programme: String(pl.programme), intake_year: Number(pl.intake_year), source: 'plan', plan_id: String(pl.id) });
  }
  const apps = (world.applications as Row[])
    .filter((a) => ['offer', 'accepted'].includes(String(a.stage)) && (OFFER_PROGRAMMES as readonly string[]).includes(String(a.programme_id)) && people.has(String(a.person_id)))
    .sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
  for (const a of apps) {
    const id = String(a.person_id);
    if (out.has(id)) continue;
    out.set(id, { person_id: id, name: name(id), kind: kind(id), programme: String(a.programme_id), intake_year: Number(String(a.updated_at).slice(0, 4)) + 1, source: 'offer', plan_id: null });
  }
  const from = addDays(today, -365);
  for (const p of world.people as Row[]) {
    const id = String(p.id);
    const hd = p.hire_date == null ? null : String(p.hire_date).slice(0, 10);
    if (out.has(id) || p.kind !== 'staff' || p.level !== 'entry' || p.status === 'leaver' || !hd || hd <= from || hd > today) continue;
    out.set(id, { person_id: id, name: name(id), kind: 'staff', programme: 'direct', intake_year: Number(hd.slice(0, 4)), source: 'hire', plan_id: null });
  }
  return [...out.values()].sort((a, b) => (a.person_id < b.person_id ? -1 : a.person_id > b.person_id ? 1 : 0));
}

/** Refusal messages shared by both backends (the SQL functions return the same text). */
export const IB_MSG: Record<string, string> = {
  not_signed_in: 'Sign in first',
  forbidden_baseline: 'Only HR (workforce strategy W) sets intake baselines',
  forbidden_plan: 'Only HR (workforce strategy W) builds induction plans',
  forbidden_joiners: 'Joiners are listed for HR and training staff only',
  year: `Give an intake year between ${YEAR_MIN} and ${YEAR_MAX}`,
  programme: 'Choose all programmes or one entry programme',
  entries: 'List at least one induction module, each once',
  module: 'Every entry names a listed induction module',
  duplicate: 'Each induction module appears once',
  status: 'Each entry is held, partly held or not held',
  basis: 'A held or partly held module needs its basis (national curriculum, programme curriculum or intake diagnostic)',
  mandatory: 'Mandatory nuclear modules are never skipped or shortened by a baseline',
  source: 'A national-curriculum basis cites an https source',
  note: `Notes are at most ${NOTE_MAX} characters per entry and ${BASELINE_NOTE_MAX} for the baseline`,
  person: 'Choose a joiner (an applicant or a member of staff)',
};
