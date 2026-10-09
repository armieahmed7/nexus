/**
 * F28 Simulator scenario library and coverage (W4 · E3, module M04). Pure rules shared by the LocalBackend
 * (backend/simulator.local.ts), the seed builder (scripts/seed/ext/f28-simulator.mjs), the PGlite checks
 * (scripts/validate/w4e3-simulator.mjs) and the pages. The SQL mirror lives in
 * supabase/migrations/20261009143001_kafaa_w4e3_simulator.sql (kafaa_sim_*): change both together.
 *
 * Training scenarios only. A scenario can never have purpose = exam (refused with exam_content), and all free text goes
 * through contentIssue(): no exam material, no security / safeguards / cyber content, and malfunctions stay generic
 * (no equipment tags, setpoints or malfunction codes). Crew debriefs feed F01 skill evidence (kind ojt, basis evidenced,
 * never verified) for crew members marked present in the booked slot only.
 *
 * Import-free apart from `import type` (node loads this file directly).
 */
import type { Ranked, Reason, BiText } from '../../domain/engines/types';

export const SIM_CATEGORIES = ['normal', 'abnormal', 'emergency', 'severe_accident'] as const;
export type SimCategory = (typeof SIM_CATEGORIES)[number];
/** Category names for reasons (bilingual vars rendered by <WhyThis>). */
export const CATEGORY_TEXT: Record<string, BiText> = {
  normal: { en: 'normal evolutions', ar: 'العمليات العادية' }, abnormal: { en: 'abnormal conditions', ar: 'الحالات غير الطبيعية' },
  emergency: { en: 'emergencies', ar: 'حالات الطوارئ' }, severe_accident: { en: 'severe accidents', ar: 'الحوادث الجسيمة' },
};
export const SIM_POSITIONS = ['ss', 'sro', 'ro', 'sta', 'lo'] as const;
export type SimPosition = (typeof SIM_POSITIONS)[number];
export const SIM_FIDELITY = ['full_scope', 'limited_scope', 'desktop'] as const;
export const SIM_PROGRAMMES = ['coct', 'loct'] as const;
export const SCENARIO_STATUSES = ['draft', 'in_review', 'approved', 'retired'] as const;
export const CYCLE_STATUSES = ['draft', 'submitted', 'approved', 'closed'] as const;
export const DIMENSIONS = ['communication', 'procedure_use', 'diagnosis', 'leadership'] as const;
export type Dimension = (typeof DIMENSIONS)[number];
/** Team competency → F01 skill (core skill of the matching competency). */
export const DIMENSION_SKILL: Record<Dimension, string> = { communication: 'sk-co-02', procedure_use: 'sk-co-01', diagnosis: 'sk-pf-03', leadership: 'sk-ld-01' };
/** Control-room crew position from the person's job role. */
export const ROLE_POSITION: Record<string, SimPosition> = {
  'shift-supervisor': 'ss', 'senior-reactor-operator': 'sro', 'reactor-operator': 'ro', 'shift-technical-advisor': 'sta', 'local-operator': 'lo',
};
/** Competencies whose content is security-restricted (career path only): never part of a simulator scenario. */
export const SECURITY_COMPETENCIES = ['sa-01'];
/** Simulator time available to one crew in one cycle segment (two 8-hour simulator days). */
export const SEGMENT_MINUTES = 960;
export const TITLE_MIN = 5, TITLE_MAX = 120, SUMMARY_MIN = 20, SUMMARY_MAX = 1000, EVENTS_MAX = 600, NOTE_MIN = 10, NOTE_MAX = 1000, DEBRIEF_TEXT_MAX = 2000;
export const MAX_OBJECTIVES = 12, MAX_COMPETENCIES = 10;
export const DURATION_MIN = 30, DURATION_MAX = 480, DURATION_STEP = 15;
export const XAPI_COMPLETED = 'http://adlnet.gov/expapi/verbs/completed';

/** User-facing messages (identical in SQL kafaa_sim_msg). */
export const SIM_MSG = {
  not_signed_in: 'Sign in first',
  forbidden: 'Only simulator instructors and the training manager may change the scenario library',
  forbidden_approve: 'Only the training manager approves scenarios and cycle plans',
  forbidden_debrief: 'Only simulator instructors record crew debriefs',
  exam_content: "Exam scenarios are managed outside Kafa'a; the library holds training scenarios only",
  security_content: 'Security, safeguards and cyber content is not allowed in simulator scenarios',
  specific_content: 'Keep malfunctions generic: no equipment tags, setpoints or malfunction codes',
  invalid_purpose: 'A scenario purpose must be training',
  invalid_text: 'Give an English and an Arabic title (5 to 120 characters) and summary (20 to 1,000 characters); malfunction notes are limited to 600 characters',
  invalid_category: 'Choose a scenario category',
  invalid_objectives: 'Pick 1 to 12 training objectives from the catalogue',
  invalid_competencies: 'Pick at most 10 competencies from the framework',
  invalid_positions: 'Pick at least one crew position',
  invalid_duration: 'Duration must be 30 to 480 minutes in steps of 15',
  invalid_fidelity: 'Choose the simulator fidelity the scenario needs',
  invalid_programmes: 'Choose COCT, LOCT or both',
  not_found: 'Scenario not found',
  retired: 'A retired scenario cannot be changed',
  not_in_review: 'Only a scenario in review can be approved or returned',
  maker_checker: 'The author of a revision cannot approve it',
  note_required: 'Give a reason (10 to 1,000 characters)',
  invalid_decision: 'Unknown decision',
  cycle_not_found: 'Cycle not found',
  cycle_closed: 'A closed cycle cannot be changed',
  scenario_not_approved: 'Only approved scenarios can be planned or run',
  wrong_programme: 'This scenario is not written for the programme of this cycle',
  invalid_items: 'Each planned item needs a scenario and a segment of this cycle',
  duplicate: 'A scenario is planned twice in the same segment',
  over_capacity: 'Planned simulator time in a segment exceeds 16 hours',
  not_submitted: 'Only a submitted cycle can be approved',
  coverage_gaps: 'Required objectives are not covered; give a reason to approve with gaps',
  cycle_maker_checker: 'The planner of a cycle cannot approve it',
  slot_not_found: 'Simulator slot not found',
  slot_not_booked: 'Debriefs are recorded for booked crew slots only',
  slot_not_started: 'This slot has not started yet',
  already_recorded: 'This scenario already has a debrief for this slot',
  not_in_slot: 'Everyone on the debrief must be a member of the crew booked in the slot',
  no_attendees: 'Mark at least one crew member present',
  invalid_ratings: 'Rate each team competency from 1 to 5',
  invalid_debrief_text: 'Debrief notes are limited to 2,000 characters each',
  wrong_cycle: 'The cycle is not for this scenario or slot',
} as const;
export type SimMsgKey = keyof typeof SIM_MSG;

// ───────────── content check (exam, security, specifics). Same lists and patterns in SQL (kafaa_sim_content_issue).
export const EXAM_TERMS = [
  'exam', 'exams', 'examination', 'examinations', 'answer key', 'answer keys', 'licensing test', 'licence test', 'license test', 'test bank',
  'امتحان', 'الامتحان', 'امتحانات', 'الامتحانات', 'اختبار الترخيص', 'مفتاح الإجابة', 'بنك الأسئلة',
];
export const SECURITY_TERMS = [
  'security', 'safeguards', 'cyber', 'cybersecurity', 'sabotage', 'intruder', 'intruders', 'intrusion', 'armed', 'adversary', 'vital area', 'protected area',
  'perimeter', 'cctv', 'guard force', 'insider threat', 'design basis threat',
  'أمن', 'الأمن', 'أمني', 'الأمني', 'الأمنية', 'الضمانات', 'سيبراني', 'السيبراني', 'السيبرانية', 'تخريب', 'التخريب', 'تسلل', 'متسلل', 'كاميرات المراقبة', 'التهديد الداخلي',
];
/** Case-sensitive patterns on the raw text: equipment tags such as 1RC-PT-0455 or FW-V-123. */
export const SPECIFIC_RAW = ['(^|[^A-Za-z0-9])[0-9]?[A-Z]{2,3}-[A-Z]{1,3}-?[0-9]{2,4}[A-Z]?([^A-Za-z0-9]|$)'];
/** Patterns on the lower-cased text: setpoints with engineering units, simulator malfunction codes. */
export const SPECIFIC_LOWER = [
  '[0-9]+([.,][0-9]+)? ?(psig|psia|mpa|kpa|kg/cm2|gpm|degc|°c|ppm)([^a-z0-9]|$)',
  '(^|[^a-z0-9])mf[-_ ]?[a-z]{2,4}[0-9]{2,}',
];
const RAW_RE = SPECIFIC_RAW.map((p) => new RegExp(p));
const LOWER_RE = SPECIFIC_LOWER.map((p) => new RegExp(p));
/** Words only: lower-case, everything but a-z, 0-9 and Arabic letters becomes one space, padded with spaces. */
export const normWords = (s: unknown) => ` ${String(s ?? '').toLowerCase().replace(/[^a-z0-9ء-ي]+/g, ' ').trim()} `;
export type ContentCode = 'exam_content' | 'security_content' | 'specific_content';
/** The first issue across all texts: every text is checked for exam content first, then security, then specifics. */
export function contentIssue(texts: unknown[]): ContentCode | null {
  const words = texts.map(normWords);
  if (words.some((w) => EXAM_TERMS.some((k) => w.includes(` ${k} `)))) return 'exam_content';
  if (words.some((w) => SECURITY_TERMS.some((k) => w.includes(` ${k} `)))) return 'security_content';
  for (const t of texts) {
    const raw = String(t ?? '');
    if (RAW_RE.some((r) => r.test(raw)) || LOWER_RE.some((r) => r.test(raw.toLowerCase()))) return 'specific_content';
  }
  return null;
}

// ───────────── scenario validation
export interface ObjectiveLite { id: string; code?: string; competency_id: string; category: string; title_en: string; title_ar: string; programmes?: string[]; active?: boolean }
export interface ScenarioInput {
  id?: string | null;
  purpose?: string;
  title_en: string; title_ar: string; summary_en: string; summary_ar: string;
  events_en?: string; events_ar?: string;
  category: string;
  objective_ids: string[];
  competency_ids?: string[];
  positions: string[];
  duration_min: number;
  fidelity: string;
  programmes: string[];
  submit?: boolean;
}
export interface ScenarioClean {
  title_en: string; title_ar: string; summary_en: string; summary_ar: string; events_en: string; events_ar: string;
  category: SimCategory; objective_ids: string[]; competency_ids: string[]; positions: string[]; duration_min: number; fidelity: string; programmes: string[];
}
export type Check<T> = { ok: true; value: T } | { ok: false; code: string; key: SimMsgKey };
const no = <T>(code: string, key: SimMsgKey = code as SimMsgKey): Check<T> => ({ ok: false, code, key });
const strLen = (v: unknown) => (typeof v === 'string' ? v.trim().length : -1);
const sortU = (a: string[]) => [...new Set(a)].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

export function validateScenario(p: ScenarioInput, ctx: { objectives: Map<string, ObjectiveLite>; competencies: Set<string> }): Check<ScenarioClean> {
  if (p?.purpose !== undefined && p.purpose !== null && p.purpose !== 'training') return p.purpose === 'exam' ? no('exam_content') : no('invalid', 'invalid_purpose');
  const texts = [p?.title_en, p?.title_ar, p?.summary_en, p?.summary_ar, p?.events_en ?? '', p?.events_ar ?? ''];
  const issue = contentIssue(texts);
  if (issue) return no(issue);
  if (strLen(p.title_en) < TITLE_MIN || strLen(p.title_en) > TITLE_MAX || strLen(p.title_ar) < TITLE_MIN || strLen(p.title_ar) > TITLE_MAX
    || strLen(p.summary_en) < SUMMARY_MIN || strLen(p.summary_en) > SUMMARY_MAX || strLen(p.summary_ar) < SUMMARY_MIN || strLen(p.summary_ar) > SUMMARY_MAX
    || (p.events_en != null && strLen(p.events_en) > EVENTS_MAX) || (p.events_ar != null && strLen(p.events_ar) > EVENTS_MAX)) return no('invalid', 'invalid_text');
  if (!(SIM_CATEGORIES as readonly string[]).includes(p.category)) return no('invalid', 'invalid_category');
  if (!isStrArr(p.objective_ids)) return no('invalid', 'invalid_objectives');
  const objs = sortU(p.objective_ids);
  if (objs.length < 1 || objs.length > MAX_OBJECTIVES || objs.length !== p.objective_ids.length || objs.some((o) => { const x = ctx.objectives.get(o); return !x || x.active === false; })) return no('invalid', 'invalid_objectives');
  const comps = p.competency_ids ?? [];
  if (!isStrArr(comps) || comps.some((c) => !ctx.competencies.has(c))) return no('invalid', 'invalid_competencies');
  const allComps = sortU([...comps, ...objs.map((o) => ctx.objectives.get(o)!.competency_id)]);
  if (allComps.some((c) => SECURITY_COMPETENCIES.includes(c))) return no('security_content');
  if (allComps.length > MAX_COMPETENCIES) return no('invalid', 'invalid_competencies');
  if (!isStrArr(p.positions) || !p.positions.length || p.positions.some((x) => !(SIM_POSITIONS as readonly string[]).includes(x))) return no('invalid', 'invalid_positions');
  const d = p.duration_min;
  if (typeof d !== 'number' || !Number.isInteger(d) || d < DURATION_MIN || d > DURATION_MAX || d % DURATION_STEP !== 0) return no('invalid', 'invalid_duration');
  if (!(SIM_FIDELITY as readonly string[]).includes(p.fidelity)) return no('invalid', 'invalid_fidelity');
  if (!isStrArr(p.programmes) || !p.programmes.length || p.programmes.some((x) => !(SIM_PROGRAMMES as readonly string[]).includes(x))) return no('invalid', 'invalid_programmes');
  const posOrder = (x: string) => SIM_POSITIONS.indexOf(x as SimPosition);
  return {
    ok: true,
    value: {
      title_en: p.title_en.trim(), title_ar: p.title_ar.trim(), summary_en: p.summary_en.trim(), summary_ar: p.summary_ar.trim(),
      events_en: String(p.events_en ?? '').trim(), events_ar: String(p.events_ar ?? '').trim(),
      category: p.category as SimCategory, objective_ids: objs, competency_ids: allComps,
      positions: [...new Set(p.positions)].sort((x, y) => posOrder(x) - posOrder(y)), duration_min: d, fidelity: p.fidelity, programmes: sortU(p.programmes),
    },
  };
}

// ───────────── cycles and coverage
export interface ScenarioLite {
  id: string; title_en: string; title_ar: string; category: string; objective_ids: string[]; competency_ids: string[]; positions?: string[];
  duration_min: number; status: string; programmes: string[]; fidelity?: string;
}
export interface Requirement { objective_id: string; min_runs: number }
export interface CycleLite { id: string; programme: string; segments: number; requirements: Requirement[]; required_competency_ids: string[]; status: string; starts_on?: string; ends_on?: string }
export interface CycleItemLite { id?: string; cycle_id: string; scenario_id: string; segment: number; active?: boolean }
export interface DebriefLite { id: string; cycle_id?: string | null; scenario_id: string; held_on: string; crew?: string | null; ratings?: Record<string, number>; self_ratings?: Record<string, number> | null; present_count?: number }
export interface PlanItemInput { scenario_id: string; segment: number }

export const cycleItemId = (cycleId: string, scenarioId: string, segment: number) => `sci:${cycleId}:${scenarioId}:${segment}`;
export const debriefId = (slotId: string, scenarioId: string) => `cd:${slotId}:${scenarioId}`;
export const debriefMemberId = (debrief: string, personId: string) => `${debrief}:${personId}`;

/** Planned items must be approved scenarios written for the cycle's programme, segments in range, no duplicates, and at most
 *  SEGMENT_MINUTES of simulator time per segment. Returns the clean, sorted list. */
export function validatePlan(items: unknown, cycle: CycleLite, scenarios: Map<string, ScenarioLite>): Check<PlanItemInput[]> {
  if (!Array.isArray(items) || items.length > 80) return no('invalid', 'invalid_items');
  const out: PlanItemInput[] = [];
  for (const it of items as Record<string, unknown>[]) {
    if (!it || typeof it.scenario_id !== 'string' || typeof it.segment !== 'number' || !Number.isInteger(it.segment)) return no('invalid', 'invalid_items');
    if (it.segment < 1 || it.segment > cycle.segments) return no('invalid', 'invalid_items');
    const s = scenarios.get(it.scenario_id);
    if (!s) return no('invalid', 'invalid_items');
    if (s.status !== 'approved') return no('scenario_not_approved');
    if (!(s.programmes ?? []).includes(cycle.programme)) return no('wrong_programme');
    out.push({ scenario_id: s.id, segment: it.segment });
  }
  const keys = out.map((x) => `${x.segment}|${x.scenario_id}`);
  if (new Set(keys).size !== keys.length) return no('duplicate');
  for (let k = 1; k <= cycle.segments; k++) {
    if (out.filter((x) => x.segment === k).reduce((n, x) => n + scenarios.get(x.scenario_id)!.duration_min, 0) > SEGMENT_MINUTES) return no('over_capacity');
  }
  return { ok: true, value: out.sort((a, b) => a.segment - b.segment || (a.scenario_id < b.scenario_id ? -1 : a.scenario_id > b.scenario_id ? 1 : 0)) };
}

export type CoverStatus = 'covered' | 'under' | 'missing';
export interface CoverageRow { objective_id: string; min_runs: number; planned: number; runs: number; status: CoverStatus; segments: number[]; scenario_ids: string[] }
export interface CompetencyCover { competency_id: string; planned: number; status: 'covered' | 'missing' }
export interface SegmentLoad { segment: number; minutes: number; scenarios: number; over: boolean; categories: string[] }
export interface Coverage {
  cycle_id: string; rows: CoverageRow[]; competencies: CompetencyCover[]; segments: SegmentLoad[]; categories: Record<string, number>; missing_categories: string[];
  extras: string[]; required: number; covered: number; under: number; missing: number; pct: number; planned_items: number; runs: number;
}
/** The coverage matrix of a cycle: every required objective planned at least min_runs times across the cycle (else under or
 *  missing), every required competency hit at least once, category balance and simulator time per segment. */
export function cycleCoverage(cycle: CycleLite, items: CycleItemLite[], scenarios: Map<string, ScenarioLite>, debriefs: DebriefLite[] = []): Coverage {
  const live = items.filter((i) => i.cycle_id === cycle.id && i.active !== false && scenarios.has(i.scenario_id));
  const runs = debriefs.filter((d) => d.cycle_id === cycle.id);
  const rows: CoverageRow[] = [...cycle.requirements].sort((a, b) => (a.objective_id < b.objective_id ? -1 : 1)).map((r) => {
    const hits = live.filter((i) => scenarios.get(i.scenario_id)!.objective_ids.includes(r.objective_id));
    const planned = hits.length;
    const nRuns = runs.filter((d) => scenarios.get(d.scenario_id)?.objective_ids.includes(r.objective_id)).length;
    return {
      objective_id: r.objective_id, min_runs: r.min_runs, planned, runs: nRuns,
      status: planned >= r.min_runs ? 'covered' : planned > 0 ? 'under' : 'missing',
      segments: [...new Set(hits.map((h) => h.segment))].sort((a, b) => a - b), scenario_ids: sortU(hits.map((h) => h.scenario_id)),
    };
  });
  const competencies: CompetencyCover[] = sortU(cycle.required_competency_ids ?? []).map((c) => {
    const planned = live.filter((i) => scenarios.get(i.scenario_id)!.competency_ids.includes(c)).length;
    return { competency_id: c, planned, status: planned > 0 ? 'covered' : 'missing' };
  });
  const segments: SegmentLoad[] = Array.from({ length: cycle.segments }, (_, k) => {
    const seg = live.filter((i) => i.segment === k + 1).map((i) => scenarios.get(i.scenario_id)!);
    const minutes = seg.reduce((n, s) => n + s.duration_min, 0);
    return { segment: k + 1, minutes, scenarios: seg.length, over: minutes > SEGMENT_MINUTES, categories: sortU(seg.map((s) => s.category)) };
  });
  const categories = Object.fromEntries(SIM_CATEGORIES.map((c) => [c, live.filter((i) => scenarios.get(i.scenario_id)!.category === c).length]));
  const req = new Set(cycle.requirements.map((r) => r.objective_id));
  const extras = sortU(live.flatMap((i) => scenarios.get(i.scenario_id)!.objective_ids).filter((o) => !req.has(o)));
  const covered = rows.filter((r) => r.status === 'covered').length;
  return {
    cycle_id: cycle.id, rows, competencies, segments, categories, missing_categories: SIM_CATEGORIES.filter((c) => categories[c] === 0), extras,
    required: rows.length, covered, under: rows.filter((r) => r.status === 'under').length, missing: rows.filter((r) => r.status === 'missing').length,
    pct: rows.length ? Math.floor((covered * 100) / rows.length) : 100, planned_items: live.length, runs: runs.length,
  };
}
/** Number of required objectives planned fewer than min_runs times (the approval gap check; SQL kafaa_sim_gap_count). */
export const gapCount = (c: Coverage) => c.under + c.missing;

/** Rank approved scenarios that would close the cycle's coverage gaps. Score: 2 per missing objective it hits, 1 per
 *  under-covered objective, 0.5 per required competency still missing, 0.5 for a missing category; ties go to the shorter
 *  scenario. Every result carries reasons (m04.reasons.scn_*). */
export function suggestScenarios(cycle: CycleLite, cov: Coverage, scenarios: ScenarioLite[], objectives: Map<string, ObjectiveLite>, compLabel: (id: string) => BiText): Ranked<ScenarioLite>[] {
  const missing = new Set(cov.rows.filter((r) => r.status === 'missing').map((r) => r.objective_id));
  const under = new Map(cov.rows.filter((r) => r.status === 'under').map((r) => [r.objective_id, r]));
  const compMissing = new Set(cov.competencies.filter((c) => c.status === 'missing').map((c) => c.competency_id));
  const catMissing = new Set(cov.missing_categories);
  const out: Ranked<ScenarioLite>[] = [];
  for (const s of scenarios) {
    if (s.status !== 'approved' || !s.programmes.includes(cycle.programme)) continue;
    const reasons: Reason[] = [];
    let score = 0;
    for (const o of s.objective_ids) {
      const ob = objectives.get(o);
      const label = { en: ob ? `${ob.code ?? o} ${ob.title_en}` : o, ar: ob ? `${ob.code ?? o} ${ob.title_ar}` : o };
      if (missing.has(o)) { score += 2; reasons.push({ code: 'scn_missing', key: 'm04.reasons.scn_missing', vars: { objective: label }, weight: 2 }); }
      else if (under.has(o)) { score += 1; const r = under.get(o)!; reasons.push({ code: 'scn_under', key: 'm04.reasons.scn_under', vars: { objective: label, planned: r.planned, min: r.min_runs }, weight: 1 }); }
    }
    for (const c of s.competency_ids) if (compMissing.has(c)) { score += 0.5; reasons.push({ code: 'scn_comp', key: 'm04.reasons.scn_comp', vars: { competency: compLabel(c) }, weight: 0.5 }); }
    if (catMissing.has(s.category)) { score += 0.5; reasons.push({ code: 'scn_category', key: 'm04.reasons.scn_category', vars: { category: CATEGORY_TEXT[s.category] ?? { en: s.category, ar: s.category } }, weight: 0.5 }); }
    if (score <= 0) continue;
    reasons.push({ code: 'scn_duration', key: 'm04.reasons.scn_duration', vars: { minutes: s.duration_min } });
    out.push({ id: s.id, score, reasons, item: s });
  }
  return out.sort((a, b) => b.score - a.score || a.item!.duration_min - b.item!.duration_min || (a.id < b.id ? -1 : 1));
}

// ───────────── crew debriefs
export interface PersonLite { id: string; crew?: string | null; kind?: string; status?: string; job_role_id?: string | null }
export interface SlotLite { id: string; crew?: string | null; booking_kind: string; status: string; starts_at: string; simulator?: string }
export interface RosterEntry { person_id: string; position: SimPosition }
/** The crew booked in a slot: active staff of that crew holding a control-room position, ordered by position then id. */
export function crewRoster(slot: Pick<SlotLite, 'crew'>, people: PersonLite[]): RosterEntry[] {
  if (!slot.crew) return [];
  return people
    .filter((p) => p.crew === slot.crew && (p.kind ?? 'staff') === 'staff' && (p.status ?? 'active') === 'active' && p.job_role_id && ROLE_POSITION[p.job_role_id])
    .map((p) => ({ person_id: p.id, position: ROLE_POSITION[p.job_role_id!] }))
    .sort((a, b) => SIM_POSITIONS.indexOf(a.position) - SIM_POSITIONS.indexOf(b.position) || (a.person_id < b.person_id ? -1 : 1));
}
/** A slot can be debriefed when it is booked for a crew (not free, not maintenance) and has started. */
export function slotCheck(slot: SlotLite | undefined, nowIso: string): SimMsgKey | null {
  if (!slot) return 'slot_not_found';
  if (slot.status !== 'booked' || !slot.crew || ['free', 'maintenance'].includes(slot.booking_kind)) return 'slot_not_booked';
  if (slot.starts_at > nowIso) return 'slot_not_started';
  return null;
}
/** Ratings for all four team competencies, integers 1..5. */
export function cleanRatings(r: unknown): Record<Dimension, number> | null {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const o = r as Record<string, unknown>;
  if (Object.keys(o).some((k) => !(DIMENSIONS as readonly string[]).includes(k))) return null;
  const out = {} as Record<Dimension, number>;
  for (const d of DIMENSIONS) {
    const v = o[d];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) return null;
    out[d] = v;
  }
  return out;
}
/** Evidence level from a crew rating: 4-5 → 3, 3 → 2, below standard → no evidence. Never 4 and never verified. */
export const evidenceLevel = (score: number) => (score >= 4 ? 3 : score === 3 ? 2 : 0);
export const meanScore = (r: Record<string, number>) => {
  const v = DIMENSIONS.map((d) => r[d]).filter((x) => typeof x === 'number');
  return v.length ? Math.floor((v.reduce((a, b) => a + b, 0) * 100) / v.length + 0.5) / 100 : 0;
};
export interface EvidenceRow {
  id: string; person_id: string; skill_id: string; kind: 'ojt'; ref_table: 'crew_debrief_members'; ref_id: string; level: number; basis: 'evidenced'; status: 'current';
  observed_on: string; note: string; recorded_by: string; active: true;
}
/** F01 evidence for one present crew member: one ojt row per rated team competency at or above standard, in skill order. */
export function debriefEvidence(memberId: string, personId: string, ratings: Record<Dimension, number>, heldOn: string, by: string, scenarioTitle: string): EvidenceRow[] {
  return DIMENSIONS.filter((d) => evidenceLevel(ratings[d]) > 0)
    .map((d) => ({ d, skill: DIMENSION_SKILL[d] }))
    .sort((a, b) => (a.skill < b.skill ? -1 : 1))
    .map(({ d, skill }) => ({
      id: `se:ojt:${memberId}:${skill}`, person_id: personId, skill_id: skill, kind: 'ojt' as const, ref_table: 'crew_debrief_members' as const, ref_id: memberId,
      level: evidenceLevel(ratings[d]), basis: 'evidenced' as const, status: 'current' as const, observed_on: heldOn.slice(0, 10),
      note: `Simulator crew debrief: ${scenarioTitle}`, recorded_by: by, active: true as const,
    }));
}
export interface XapiStatement {
  actor_person_id: string; verb: string; object_type: 'scenario'; object_id: string;
  result: { score: { scaled: number }; success: boolean; extensions: Record<string, number> };
  context: { platform: 'kafaa'; registration: string; extensions: Record<string, string | null> };
  timestamp: string;
}
/** xAPI 2.0-shaped "completed" statements, one per crew member present (F30 emitter; no names, no free text). */
export function debriefStatements(d: { id: string; slot_id: string; scenario_id: string; cycle_id?: string | null; crew: string; held_on: string; ratings: Record<string, number> }, members: { person_id: string; position: string; present: boolean }[]): XapiStatement[] {
  const m = meanScore(d.ratings);
  return members.filter((x) => x.present).map((x) => ({
    actor_person_id: x.person_id, verb: XAPI_COMPLETED, object_type: 'scenario' as const, object_id: d.scenario_id,
    result: { score: { scaled: Math.floor((m / 5) * 100 + 0.5) / 100 }, success: m >= 3, extensions: Object.fromEntries(DIMENSIONS.map((k) => [k, d.ratings[k]])) },
    context: { platform: 'kafaa' as const, registration: d.id, extensions: { slot_id: d.slot_id, crew: d.crew, cycle_id: d.cycle_id ?? null, position: x.position } },
    timestamp: `${d.held_on.slice(0, 10)}T00:00:00Z`,
  }));
}

/** Instructor vs crew self-ratings per crew and team competency (debrief insights). */
export function crewInsights(debriefs: DebriefLite[]) {
  const crews = sortU(debriefs.map((d) => d.crew ?? '').filter(Boolean));
  return crews.map((c) => {
    const ds = debriefs.filter((d) => d.crew === c);
    const dims = DIMENSIONS.map((dim) => {
      const ins = ds.map((d) => d.ratings?.[dim]).filter((x): x is number => typeof x === 'number');
      const self = ds.map((d) => d.self_ratings?.[dim]).filter((x): x is number => typeof x === 'number');
      const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
      const i = avg(ins), s = avg(self);
      return { dimension: dim, instructor: i, self: s, gap: i != null && s != null ? Math.round((s - i) * 10) / 10 : null };
    });
    return { crew: c, debriefs: ds.length, dims };
  });
}
