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
 * Decay: non-qualification evidence (and lapsed qualifications) halves its confidence every 36 months (1096 days); evidence
 * older than that counts one level lower ("ageing"). A current qualification holds while the record is current.
 */
import type { Reason } from './engines/types';

export type Basis = 'verified' | 'evidenced' | 'validated' | 'claimed';
export type EvidenceKind = 'qual' | 'course' | 'assessment' | 'jpm' | 'rating' | 'ojt' | 'credential';
export const DERIVED_KINDS: EvidenceKind[] = ['qual', 'course', 'assessment', 'jpm'];
export const RECORDED_KINDS: EvidenceKind[] = ['rating', 'ojt', 'credential'];
export const HALF_LIFE_DAYS = 1096;
export const BASIS_RANK: Record<Basis, number> = { verified: 4, evidenced: 3, validated: 2, claimed: 1 };
export const BASE_CONFIDENCE = { verified: 0.95, evidenced: 0.8, jpm: 0.85, validated: 0.7, claimed: 0.4 };
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

interface Scored { e: Evidence; eff: number; conf: number; ageing: boolean }
function score(e: Evidence, now: string): Scored {
  const holds = e.kind === 'qual' && e.status === 'current';
  const age = Math.max(0, dayNo(now) - dayNo(e.observed_on));
  const decay = holds ? 1 : round4(Math.pow(0.5, age / HALF_LIFE_DAYS));
  const ageing = !holds && age > HALF_LIFE_DAYS;
  const base = e.basis === 'verified' ? BASE_CONFIDENCE.verified : e.basis === 'evidenced' ? (e.kind === 'jpm' ? BASE_CONFIDENCE.jpm : BASE_CONFIDENCE.evidenced) : e.basis === 'validated' ? BASE_CONFIDENCE.validated : BASE_CONFIDENCE.claimed;
  return { e, eff: ageing ? Math.max(1, e.level - 1) : e.level, conf: round4(base * decay), ageing };
}
/** Strongest first: non-claimed before claimed, then effective level, basis, confidence, most recent, id. */
function compare(a: Scored, b: Scored): number {
  const strong = (x: Scored) => (x.e.basis === 'claimed' ? 0 : 1);
  return strong(b) - strong(a) || b.eff - a.eff || BASIS_RANK[b.e.basis] - BASIS_RANK[a.e.basis] || b.conf - a.conf
    || (a.e.observed_on < b.e.observed_on ? 1 : a.e.observed_on > b.e.observed_on ? -1 : 0) || (a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0);
}
export const reasonCode = (e: Evidence) => (e.kind === 'qual' ? (e.status === 'lapsed' ? 'qual_lapsed' : 'qual') : e.kind === 'rating' ? `rating_${e.basis}` : e.kind);

/** State of one skill for one person from its active evidence rows (all the same person and skill). Null without evidence. */
export function deriveSkillState(evidence: Evidence[], now: string): Omit<SkillState, 'id' | 'person_id' | 'skill_id'> | null {
  const list = evidence.filter((e) => e.active !== false).map((e) => score(e, now.slice(0, 10))).sort(compare);
  if (!list.length) return null;
  const w = list[0];
  const confidence = round2(Math.min(0.99, w.conf + 0.05 * Math.min(list.length - 1, 4)));
  return {
    level: w.eff,
    confidence,
    basis: w.e.basis,
    evidence_count: list.length,
    reasons: list.map((x) => ({ code: reasonCode(x.e), evidence_id: x.e.id, level: x.eff, basis: x.e.basis, observed_on: x.e.observed_on, ageing: x.ageing })),
  };
}

/** States for every (person, skill) pair that has active evidence, sorted by id. */
export function deriveStates(evidence: Evidence[], now: string): SkillState[] {
  const groups = new Map<string, Evidence[]>();
  for (const e of evidence) {
    if (e.active === false) continue;
    const k = stateId(e.person_id, e.skill_id);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(e);
  }
  const out: SkillState[] = [];
  for (const [id, list] of groups) {
    const s = deriveSkillState(list, now)!;
    out.push({ id, person_id: list[0].person_id, skill_id: list[0].skill_id, ...s });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Canonical text hashed into the recompute digest (same in SQL): one line per state, sorted by id. */
export const statesDigestText = (states: Pick<SkillState, 'id' | 'level' | 'confidence' | 'basis'>[]) =>
  [...states].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((s) => `${s.id}|${s.level}|${Math.round(s.confidence * 100)}|${s.basis}`).join('\n');

/** Engine reasons (for <WhyThis>) from a stored state. */
export function skillReasons(reasons: StoredReason[]): Reason[] {
  return reasons.map((r) => ({ code: r.code, key: `common.skills.reason.${r.code}${r.ageing ? '_ageing' : ''}`, vars: { level: r.level, date: r.observed_on }, ref: { table: 'skill_evidence', id: r.evidence_id } }));
}
