/**
 * F01 Skills core: derive each person's skill state from evidence. Pure functions, import-free apart from types
 * (scripts/seed/ext/f01-skills.mjs runs them in node to build the seed). The SQL mirror is kafaa_skill_evidence_derive /
 * kafaa_skill_states_compute in supabase/migrations/20261009101001_kafaa_w0e1_skills_core.sql; the PGlite validator
 * (scripts/validate/w0-skills.mjs) proves both give the same states for every seeded person. Change them together.
 *
 * Evidence kinds
 *   derived (rebuilt on every recompute):  qual  - qualification record (current = verified; expired/suspended = evidenced, "lapsed")
 *                                          course - passed/completed training record (qualifying course level 2, else 1)
 *                                          assessment - passed, counted, graded exam attempt on a course form (level 2)
 *                                          jpm - passed JPM (level up to 3)
 *   recorded (written by other features, kept): rating (claimed or validated), ojt (evidenced), credential (evidenced)
 * Mapping: a source maps to the core skill of each competency it covers (level from the role requirement or the source cap)
 * and to any skill that lists the source id in evidence_keys (level = min(key_level, cap)).
 * Security-restricted standards contribute only to security-domain skills, never task detail; restricted JPMs are ignored.
 * Decay (FS03): non-qualification evidence (and lapsed qualifications) halves its weight every half-life of the skill's decay
 * class (engine_settings.skills.weights: half_life_fast 18, half_life_months 36 = standard, half_life_slow 60 months; class from
 * skills.decay_class when set, else the area default AREA_DECAY_CLASS); evidence older than its half-life counts one level lower
 * ("ageing"). A current qualification holds while the record is current.
 * Confidence (FS03): a calibrated blend instead of "max plus bonus". Each row weighs BASIS_WEIGHT (verified 1.0, evidenced 0.8,
 * validated 0.6, claimed 0.3) x decay; rows are grouped by independent source (qualification, training, assessment, self,
 * validation, work, credential; the best row per source counts) and combined with diminishing returns:
 * 1 - prod(1 - w_k x 0.5^(k-1)) over the sources, strongest first. The band (low / medium / high) and interval come from a
 * Wilson score interval on that confidence with 10 pseudo-observations per full-weight source (z = 1.28, an 80% interval).
 * SQL mirror: kafaa_skill_states_v2 in supabase/migrations/20261010212001_kafaa_fs12_decay.sql (scripts/validate/fs12-decay.mjs).
 */
import type { Reason } from './engines/types';

export type Basis = 'verified' | 'evidenced' | 'validated' | 'claimed';
export type EvidenceKind = 'qual' | 'course' | 'assessment' | 'jpm' | 'rating' | 'ojt' | 'credential';
export const DERIVED_KINDS: EvidenceKind[] = ['qual', 'course', 'assessment', 'jpm'];
export const RECORDED_KINDS: EvidenceKind[] = ['rating', 'ojt', 'credential'];
/** FS10: evidence of a derived kind that a feature records itself (not rebuilt from source records): the AI and digital fitness check
 *  writes `assessment` rows with ref_table fitness_attempts. Recompute keeps them like recorded kinds (SQL: kafaa_skill_states_v2 /
 *  kafaa_skills_apply as redefined in 20261010222001_kafaa_fs22_ai_fluency.sql). */
export const RECORDED_REF_TABLES = ['fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts', 'plant_visits', 'twin_attempts']; // FS21/FS22 (fsCe3): adaptive and performance-task results are recorded too; FS37 (fsDe5): sandbox drills; FS39/FS40 (fsEe1): confirmed plant visits, twin drills
export const isRecordedEvidence = (e: { kind: string; ref_table?: string | null }) => (RECORDED_KINDS as string[]).includes(e.kind) || RECORDED_REF_TABLES.includes(e.ref_table ?? '');
export const isDerivedEvidence = (e: { kind: string; ref_table?: string | null }) => (DERIVED_KINDS as string[]).includes(e.kind) && !RECORDED_REF_TABLES.includes(e.ref_table ?? '');
/** Standard-class half-life at the default setting (36 months). FS03: the live value comes from the DecayModel. */
export const HALF_LIFE_DAYS = 1096;
export const BASIS_RANK: Record<Basis, number> = { verified: 4, evidenced: 3, validated: 2, claimed: 1 };

// ───────────── FS03 · decay classes, half-lives and the calibrated confidence blend (SQL mirror: kafaa_skill_states_v2)
export type DecayClass = 'fast' | 'standard' | 'slow';
export const DECAY_CLASSES: DecayClass[] = ['fast', 'standard', 'slow'];
/** Engine-settings keys (surface skills). The standard class keeps the wave-0 key half_life_months. */
export const HALF_LIFE_KEYS: Record<DecayClass, string> = { fast: 'half_life_fast', standard: 'half_life_months', slow: 'half_life_slow' };
export const DEFAULT_HALF_LIFE_MONTHS: Record<DecayClass, number> = { fast: 18, standard: 36, slow: 60 };
/** Accepted range for a half-life (whole months); outside it the default is used (setEngineWeights refuses it). */
export const HALF_LIFE_RANGE = { min: 6, max: 120 } as const;
/** Default class per skill area (FS02's skills.decay_class overrides it). Digital and AI areas are fast; foundational plant
 *  science, engineering and nuclear safety are slow; everything else is standard. Same CASE in SQL. */
export const AREA_DECAY_CLASS: Record<string, DecayClass> = {
  digital: 'fast', ai_data: 'fast', digital_plant: 'fast', cyber_hygiene: 'fast',
  plant_systems: 'slow', engineering: 'slow', safety: 'slow',
};
/** Evidence weight by basis (FS03 card). */
export const BASIS_WEIGHT: Record<Basis, number> = { verified: 1, evidenced: 0.8, validated: 0.6, claimed: 0.3 };
/** Independent sources: the best row per source counts, extra sources add with diminishing returns. */
export type EvidenceSource = 'qualification' | 'training' | 'assessment' | 'self' | 'validation' | 'work' | 'credential';
export const EVIDENCE_SOURCES: EvidenceSource[] = ['qualification', 'assessment', 'work', 'credential', 'training', 'validation', 'self'];
export const sourceOf = (e: Pick<Evidence, 'kind' | 'basis'>): EvidenceSource =>
  e.kind === 'qual' ? 'qualification' : e.kind === 'course' ? 'training' : e.kind === 'assessment' || e.kind === 'jpm' ? 'assessment'
    : e.kind === 'rating' ? (e.basis === 'claimed' ? 'self' : 'validation') : e.kind === 'ojt' ? 'work' : 'credential';
/** Each extra independent source counts half as much as the one before it. */
export const DIMINISH = 0.5;
/** Pseudo-observations contributed by one full-weight source (sets the interval width). */
export const PSEUDO_N = 10;
/** z for an 80% Wilson interval. */
export const BAND_Z = 1.28;
/** Band thresholds on the cautious end of the interval (conf_low). */
export const BAND_HIGH = 0.6;
export const BAND_MEDIUM = 0.3;
export type ConfidenceBand = 'low' | 'medium' | 'high';

export const monthsToDays = (m: number) => Math.floor(m * 30.4375 + 0.5);
const okMonths = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= HALF_LIFE_RANGE.min && v <= HALF_LIFE_RANGE.max;
/** Half-life per class in months from the skills engine weights (missing or out-of-range values fall back to the default). */
export function halfLifeMonths(weights?: Record<string, unknown> | null): Record<DecayClass, number> {
  const w = weights ?? {};
  const pick = (c: DecayClass) => { const v = w[HALF_LIFE_KEYS[c]]; return okMonths(v) ? v : DEFAULT_HALF_LIFE_MONTHS[c]; };
  return { fast: pick('fast'), standard: pick('standard'), slow: pick('slow') };
}
/** A skill's decay class: its own decay_class (FS02) when valid, else the area default, else standard. */
export function decayClassOf(skill: { area?: string | null; decay_class?: string | null } | undefined | null): DecayClass {
  const own = skill?.decay_class;
  if (own === 'fast' || own === 'standard' || own === 'slow') return own;
  return AREA_DECAY_CLASS[String(skill?.area ?? '')] ?? 'standard';
}
export interface DecayModel {
  months: Record<DecayClass, number>;
  days: Record<DecayClass, number>;
  /** skill id -> class (skills not listed are standard). */
  classOf: Map<string, DecayClass>;
}
export function makeDecayModel(weights?: Record<string, unknown> | null, skills: { id: string; area?: string | null; decay_class?: string | null }[] = []): DecayModel {
  const months = halfLifeMonths(weights);
  return {
    months,
    days: { fast: monthsToDays(months.fast), standard: monthsToDays(months.standard), slow: monthsToDays(months.slow) },
    classOf: new Map(skills.map((s) => [s.id, decayClassOf(s)])),
  };
}
/** The model from the seed/LocalBackend tables: engine_settings row 'skills' plus the skill catalogue. */
export const decayModelFrom = (engineSettings: { id: string; weights?: unknown }[] | null | undefined, skills: { id: string; area?: string | null; decay_class?: string | null }[] | null | undefined) =>
  makeDecayModel((engineSettings ?? []).find((r) => r.id === 'skills')?.weights as Record<string, unknown> | undefined, skills ?? []);
/** Default settings, every skill standard (callers that know the catalogue pass a real model). */
export const DEFAULT_DECAY: DecayModel = makeDecayModel(null, []);

/** Calibrated blend over the best contribution per source (any order): point estimate and pseudo-observation count. */
export function blendConfidence(contributions: number[]): { point: number; n: number } {
  const c = [...contributions].sort((a, b) => b - a);
  let rest = 1;
  let n = 0;
  for (let k = 0; k < c.length; k++) {
    const w = c[k] * Math.pow(DIMINISH, k);
    rest = rest * (1 - w);
    n = n + w;
  }
  return { point: 1 - rest, n: n * PSEUDO_N };
}
/** Wilson score interval (z = BAND_Z) for confidence p with n pseudo-observations, capped to [0, 0.99], 2 decimals. */
export function confidenceInterval(p: number, n: number): [number, number] {
  if (!(n > 0)) return [0, round2(Math.min(0.99, p))];
  const z2 = BAND_Z * BAND_Z;
  const den = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / den;
  const half = (BAND_Z / den) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return [round2(Math.max(0, centre - half)), round2(Math.min(0.99, centre + half))];
}
export const bandOf = (confLow: number): ConfidenceBand => (confLow >= BAND_HIGH ? 'high' : confLow >= BAND_MEDIUM ? 'medium' : 'low');
/** Course and assessment caps. */
export const QUALIFYING_COURSE_LEVEL = 2;
export const COURSE_LEVEL = 1;
export const ASSESSMENT_LEVEL = 2;
export const JPM_LEVEL_CAP = 3;

export interface SkillLite { id: string; competency_id: string; core: boolean; key_level: number; evidence_keys: string[] }
export interface Evidence {
  id: string;
  person_id: string;
  skill_id: string;
  kind: EvidenceKind;
  ref_table: string;
  ref_id: string;
  level: number;
  basis: Basis;
  status: 'current' | 'lapsed';
  observed_on: string;
  note?: string | null;
  recorded_by?: string | null;
  active?: boolean;
}
/** Compact reason stored in person_skills.reasons (same shape in SQL). */
export interface StoredReason {
  code: string;
  evidence_id: string;
  level: number;
  basis: Basis;
  observed_on: string;
  ageing: boolean;
  /** FS03: independent source, this row's weight (basis x decay) and the half-life (months) that applied. */
  source?: EvidenceSource;
  w?: number;
  hl?: number;
}
export interface SkillState {
  id: string;
  person_id: string;
  skill_id: string;
  level: number;
  confidence: number;
  basis: Basis;
  reasons: StoredReason[];
  evidence_count: number;
  /** FS03: how sure we are (band from conf_low) and the 80% interval around confidence. */
  confidence_band: ConfidenceBand;
  conf_low: number;
  conf_high: number;
}
type Row = Record<string, any>;
export interface SkillSources {
  skills: SkillLite[];
  competencies: Row[];
  role_competencies: Row[];
  qual_standards: Row[];
  qual_records: Row[];
  training_records: Row[];
  courses: Row[];
  attempts: Row[];
  assessment_forms: Row[];
  jpm_results: Row[];
  jpms: Row[];
}

const dayNo = (d: string) => Math.floor(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 86_400_000);
/** Same float operations as the SQL mirror (floor(x * 10^n + 0.5) / 10^n). */
export const round4 = (x: number) => Math.floor(x * 10000 + 0.5) / 10000;
export const round2 = (x: number) => Math.floor(x * 100 + 0.5) / 100;
export const evidenceId = (kind: string, refId: string, skillId: string) => `se:${kind}:${refId}:${skillId}`;
export const stateId = (personId: string, skillId: string) => `ps:${personId}:${skillId}`;

/** Skills a source maps to, with the level it evidences. */
function mapSkills(skills: SkillLite[], compLevels: Map<string, number>, key: string, cap: number, allow?: (s: SkillLite) => boolean) {
  const out: { skill: SkillLite; level: number }[] = [];
  for (const s of skills) {
    if (allow && !allow(s)) continue;
    const core = s.core && compLevels.has(s.competency_id) ? compLevels.get(s.competency_id)! : 0;
    const keyed = s.evidence_keys.includes(key) ? Math.min(s.key_level, cap) : 0;
    const level = Math.max(core, keyed);
    if (level > 0) out.push({ skill: s, level });
  }
  return out;
}

/** Derived evidence (kinds qual, course, assessment, jpm) for one person (or everyone when person is null). */
export function gatherEvidence(src: SkillSources, opts: { person?: string | null; now: string }): Evidence[] {
  const now = opts.now.slice(0, 10);
  const who = (p: string) => opts.person == null || p === opts.person;
  const domainOf = new Map(src.competencies.map((c) => [c.id, c.domain]));
  const security = (s: SkillLite) => domainOf.get(s.competency_id) === 'security';
  const stdComp = new Map<string, Map<string, number>>();
  for (const q of src.qual_standards) {
    const m = new Map<string, number>();
    for (const rc of src.role_competencies) if ((q.role_ids ?? []).includes(rc.role_id)) m.set(rc.competency_id, Math.max(m.get(rc.competency_id) ?? 0, rc.required_level));
    stdComp.set(q.id, m);
  }
  const std = new Map(src.qual_standards.map((q) => [q.id, q]));
  const course = new Map(src.courses.map((c) => [c.id, c]));
  const form = new Map(src.assessment_forms.map((f) => [f.id, f]));
  const jpm = new Map(src.jpms.map((j) => [j.id, j]));
  const out: Evidence[] = [];
  const push = (e: Omit<Evidence, 'id'>) => out.push({ id: evidenceId(e.kind, e.ref_id, e.skill_id), ...e });

  for (const r of src.qual_records) {
    if (!who(r.person_id) || !['qualified', 'due', 'renewed', 'expired', 'suspended'].includes(r.status)) continue;
    const s = std.get(r.standard_id);
    if (!s) continue;
    const current = ['qualified', 'due', 'renewed'].includes(r.status) && (!r.expires_on || String(r.expires_on).slice(0, 10) >= now);
    const observed = String(r.qualified_on ?? r.last_synced).slice(0, 10);
    for (const { skill, level } of mapSkills(src.skills, stdComp.get(s.id)!, s.id, 4, s.security_restricted ? security : undefined)) {
      push({ person_id: r.person_id, skill_id: skill.id, kind: 'qual', ref_table: 'qual_records', ref_id: r.id, level: current ? level : Math.max(1, level - 1), basis: current ? 'verified' : 'evidenced', status: current ? 'current' : 'lapsed', observed_on: observed });
    }
  }
  for (const t of src.training_records) {
    if (!who(t.person_id) || !['passed', 'completed'].includes(t.result)) continue;
    const c = course.get(t.course_id);
    if (!c) continue;
    const cap = c.qualifying ? QUALIFYING_COURSE_LEVEL : COURSE_LEVEL;
    const comps = new Map<string, number>((c.competency_ids ?? []).map((id: string) => [id, cap]));
    for (const { skill, level } of mapSkills(src.skills, comps, c.id, cap)) {
      push({ person_id: t.person_id, skill_id: skill.id, kind: 'course', ref_table: 'training_records', ref_id: t.id, level, basis: 'evidenced', status: 'current', observed_on: String(t.completed_on).slice(0, 10) });
    }
  }
  for (const a of src.attempts) {
    if (!who(a.person_id) || a.passed !== true || a.counts === false || !['graded', 'released'].includes(a.status)) continue;
    const f = form.get(a.form_id);
    const c = f && !f.is_practice && f.course_id ? course.get(f.course_id) : undefined;
    const when = a.submitted_at ?? a.started_at ?? a.scheduled_for;
    if (!c || !when) continue;
    const comps = new Map<string, number>((c.competency_ids ?? []).map((id: string) => [id, ASSESSMENT_LEVEL]));
    for (const { skill, level } of mapSkills(src.skills, comps, c.id, ASSESSMENT_LEVEL)) {
      push({ person_id: a.person_id, skill_id: skill.id, kind: 'assessment', ref_table: 'attempts', ref_id: a.id, level, basis: 'evidenced', status: 'current', observed_on: String(when).slice(0, 10) });
    }
  }
  for (const r of src.jpm_results) {
    if (!who(r.person_id) || r.result !== 'pass') continue;
    const j = jpm.get(r.jpm_id);
    const s = j ? std.get(j.standard_id) : undefined;
    if (!s || s.security_restricted) continue;
    const comps = new Map<string, number>([...stdComp.get(s.id)!].map(([k, v]) => [k, Math.min(v, JPM_LEVEL_CAP)]));
    for (const { skill, level } of mapSkills(src.skills, comps, s.id, JPM_LEVEL_CAP)) {
      push({ person_id: r.person_id, skill_id: skill.id, kind: 'jpm', ref_table: 'jpm_results', ref_id: r.id, level, basis: 'evidenced', status: 'current', observed_on: String(r.date).slice(0, 10) });
    }
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

interface Scored { e: Evidence; eff: number; conf: number; ageing: boolean; hl: number }
function score(e: Evidence, now: string, model: DecayModel): Scored {
  const holds = e.kind === 'qual' && e.status === 'current';
  const cls = model.classOf.get(e.skill_id) ?? 'standard';
  const hlDays = model.days[cls];
  const age = Math.max(0, dayNo(now) - dayNo(e.observed_on));
  const decay = holds ? 1 : round4(Math.pow(0.5, age / hlDays));
  const ageing = !holds && age > hlDays;
  return { e, eff: ageing ? Math.max(1, e.level - 1) : e.level, conf: round4(BASIS_WEIGHT[e.basis] * decay), ageing, hl: model.months[cls] };
}
/** Strongest first: non-claimed before claimed, then effective level, basis, confidence, most recent, id. */
function compare(a: Scored, b: Scored): number {
  const strong = (x: Scored) => (x.e.basis === 'claimed' ? 0 : 1);
  return strong(b) - strong(a) || b.eff - a.eff || BASIS_RANK[b.e.basis] - BASIS_RANK[a.e.basis] || b.conf - a.conf
    || (a.e.observed_on < b.e.observed_on ? 1 : a.e.observed_on > b.e.observed_on ? -1 : 0) || (a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0);
}
export const reasonCode = (e: Evidence) => (e.kind === 'qual' ? (e.status === 'lapsed' ? 'qual_lapsed' : 'qual') : e.kind === 'rating' ? `rating_${e.basis}` : e.kind);

/** State of one skill for one person from its active evidence rows (all the same person and skill). Null without evidence. */
export function deriveSkillState(evidence: Evidence[], now: string, model: DecayModel = DEFAULT_DECAY): Omit<SkillState, 'id' | 'person_id' | 'skill_id'> | null {
  const list = evidence.filter((e) => e.active !== false).map((e) => score(e, now.slice(0, 10), model)).sort(compare);
  if (!list.length) return null;
  const w = list[0];
  // FS03: best contribution per independent source, blended with diminishing returns
  const best = new Map<EvidenceSource, number>();
  for (const x of list) { const k = sourceOf(x.e); best.set(k, Math.max(best.get(k) ?? 0, x.conf)); }
  const blend = blendConfidence([...best.values()]);
  const confidence = round2(Math.min(0.99, blend.point));
  const [lo, hi] = confidenceInterval(confidence, blend.n);
  return {
    level: w.eff,
    confidence,
    basis: w.e.basis,
    evidence_count: list.length,
    reasons: list.map((x) => ({ code: reasonCode(x.e), evidence_id: x.e.id, level: x.eff, basis: x.e.basis, observed_on: x.e.observed_on, ageing: x.ageing, source: sourceOf(x.e), w: x.conf, hl: x.hl })),
    confidence_band: bandOf(lo),
    conf_low: lo,
    conf_high: hi,
  };
}

/** States for every (person, skill) pair that has active evidence, sorted by id. */
export function deriveStates(evidence: Evidence[], now: string, model: DecayModel = DEFAULT_DECAY): SkillState[] {
  const groups = new Map<string, Evidence[]>();
  for (const e of evidence) {
    if (e.active === false) continue;
    const k = stateId(e.person_id, e.skill_id);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(e);
  }
  const out: SkillState[] = [];
  for (const [id, list] of groups) {
    const s = deriveSkillState(list, now, model)!;
    out.push({ id, person_id: list[0].person_id, skill_id: list[0].skill_id, ...s });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Canonical text hashed into the recompute digest (same in SQL): one line per state, sorted by id. */
export const statesDigestText = (states: Pick<SkillState, 'id' | 'level' | 'confidence' | 'basis'>[]) =>
  [...states].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((s) => `${s.id}|${s.level}|${Math.round(s.confidence * 100)}|${s.basis}`).join('\n');

/** Engine reasons (for <WhyThis>) from a stored state. FS03: ageing reasons name the half-life that applied (m17 keys). */
export function skillReasons(reasons: StoredReason[]): Reason[] {
  return reasons.map((r): Reason => (r.ageing && r.hl
    ? { code: r.code, key: `m17.dk.reason.${r.code}_ageing`, vars: { level: r.level, date: r.observed_on, months: r.hl }, ref: { table: 'skill_evidence', id: r.evidence_id } }
    : { code: r.code, key: `common.skills.reason.${r.code}${r.ageing ? '_ageing' : ''}`, vars: { level: r.level, date: r.observed_on }, ref: { table: 'skill_evidence', id: r.evidence_id } }));
}
