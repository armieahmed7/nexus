/**
 * W0 (F01 skills core, F02 engine settings) RPCs for the LocalBackend. 1:1 mirror of
 * supabase/migrations/20261009101001_kafaa_w0e1_skills_core.sql (kafaa_recompute_skills, kafaa_skills_apply,
 * kafaa_set_engine_weights): same checks, refusal codes and audit rows. Change both files together.
 */
import type { LocalBackend } from './LocalBackend';
import type { Result, RowOf } from '../types';
import type { LocalRpcHelpers } from '../ext/types';
import { sha256Hex, nowTs } from '../audit';
import { todayIso } from '../../domain/rules';
import { decayModelFrom, isDerivedEvidence, isRecordedEvidence, deriveStates, gatherEvidence, statesDigestText, type Evidence, type SkillSources } from '../../domain/skills';
import { SURFACES } from '../../domain/engines/types';

export interface SkillsRecomputeResult {
  people: number;
  states: number;
  evidence: number;
  /** sha256 over "id|level|confidence*100|basis" lines of the active states in scope: identical runs give identical digests. */
  digest: string;
}
export interface W0Rpc {
  /** F01: rebuild derived skill evidence and states. Self, a manager or instructor in scope, or a training manager (anyone; null = everyone). */
  recomputeSkills(personId?: string | null): Promise<Result<SkillsRecomputeResult>>;
  /** F02: choose the engine for a surface and (optionally) its weights. Platform admins only; audited. */
  setEngineWeights(surface: string, engine: 'deterministic' | 'model', weights?: Record<string, number> | null): Promise<Result>;
}

/** kafaa_skills_apply: upsert derived evidence and states for one person (or everyone); never removes rows. */
export async function applySkills(b: LocalBackend, person: string | null, now: string): Promise<SkillsRecomputeResult> {
  const src: SkillSources = {
    skills: b.raw('skills') as never, competencies: b.raw('competencies'), role_competencies: b.raw('role_competencies'), qual_standards: b.raw('qual_standards'),
    qual_records: b.raw('qual_records'), training_records: b.raw('training_records'), courses: b.raw('courses'), attempts: b.raw('attempts'),
    assessment_forms: b.raw('assessment_forms'), jpm_results: b.raw('jpm_results'), jpms: b.raw('jpms'),
  };
  const inScope = (p: string) => person == null || p === person;
  const derived = gatherEvidence(src, { person, now });
  const derivedIds = new Set(derived.map((e) => e.id));
  for (const d of derived) {
    const cur = b.rawGet('skill_evidence', d.id);
    if (!cur) b.rawInsert('skill_evidence', { ...d, note: null, recorded_by: null, active: true, created_at: nowTs() } as never);
    else if (cur.level !== d.level || cur.basis !== d.basis || cur.status !== d.status || cur.observed_on !== d.observed_on || !cur.active)
      b.rawUpdate('skill_evidence', d.id, { level: d.level, basis: d.basis, status: d.status, observed_on: d.observed_on, active: true });
  }
  for (const e of b.raw('skill_evidence')) if (e.active && isDerivedEvidence(e) && inScope(e.person_id) && !derivedIds.has(e.id)) b.rawUpdate('skill_evidence', e.id, { active: false });
  const recorded = b.raw('skill_evidence').filter((e) => e.active && isRecordedEvidence(e) && inScope /* FS10: fitness-check rows */(e.person_id)) as unknown as Evidence[];
  // FS03: per-class half-lives from engine_settings (skills) and each skill's decay class
  const states = deriveStates([...derived, ...recorded], now, decayModelFrom(b.raw('engine_settings') as never, b.raw('skills') as never));
  const ids = new Set(states.map((s) => s.id));
  const ts = nowTs();
  for (const s of states) {
    const cur = b.rawGet('person_skills', s.id);
    if (!cur) b.rawInsert('person_skills', { ...s, active: true, updated_at: ts } as never);
    else if (cur.level !== s.level || Number(cur.confidence) !== s.confidence || cur.basis !== s.basis || JSON.stringify(cur.reasons) !== JSON.stringify(s.reasons) || cur.evidence_count !== s.evidence_count || !cur.active
      || cur.confidence_band !== s.confidence_band || Number(cur.conf_low) !== s.conf_low || Number(cur.conf_high) !== s.conf_high) // FS03
      b.rawUpdate('person_skills', s.id, { level: s.level, confidence: s.confidence, basis: s.basis, reasons: s.reasons, evidence_count: s.evidence_count, active: true, updated_at: ts,
        confidence_band: s.confidence_band, conf_low: s.conf_low, conf_high: s.conf_high } as never);
  }
  for (const p of b.raw('person_skills')) if (p.active && inScope(p.person_id) && !ids.has(p.id)) b.rawUpdate('person_skills', p.id, { active: false, level: 0, confidence: 0, basis: 'none', reasons: [], evidence_count: 0, updated_at: ts, confidence_band: 'low', conf_low: 0, conf_high: 0 } as never);
  const active = b.raw('person_skills').filter((p) => p.active && inScope(p.person_id)) as RowOf<'person_skills'>[];
  return {
    people: new Set(active.map((p) => p.person_id)).size,
    states: active.length,
    evidence: b.raw('skill_evidence').filter((e) => e.active && inScope(e.person_id)).length,
    digest: await sha256Hex(statesDigestText(active.map((p) => ({ id: p.id, level: p.level, confidence: Number(p.confidence), basis: p.basis as never })))),
  };
}

export function makeW0LocalRpc(b: LocalBackend, h: LocalRpcHelpers): W0Rpc {
  return {
    async recomputeSkills(personId = null) {
      await b.whenReady();
      type R = SkillsRecomputeResult;
      const who = b.identity();
      const ctx = b.access();
      const entity = personId ?? 'all';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('skills.recompute', 'person_skills', entity, code, msg, role);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to recompute skills');
      let role: string | null;
      if (personId == null) {
        role = ctx.actingRole('skills_profile', ['A']);
        if (!role) return refuse('forbidden', "Only a training manager may recompute everyone's skills");
      } else {
        if (!b.rawGet('people', personId)) return refuse('not_found', 'Person not found');
        if (personId === who.personId && ctx.has('skills_profile', ['Own', 'Scope'])) role = ctx.actingRole('skills_profile', ['Own', 'Scope']);
        else if (ctx.has('skills_profile', ['A'])) role = ctx.actingRole('skills_profile', ['A']);
        else if (ctx.has('skills_profile', ['Scope']) && ctx.inScope('skills_profile', personId)) role = ctx.actingRole('skills_profile', ['Scope']);
        else return refuse('forbidden', 'This person is not in your scope');
      }
      const r = await applySkills(b, personId, todayIso());
      return h.done<R>('skills.recompute', 'person_skills', entity, `${r.people} people, ${r.states} states, ${r.evidence} evidence rows`, role, null, '', 'Skills recomputed', r, ['person_skills', 'skill_evidence']);
    },
    async setEngineWeights(surface, engine, weights = null) {
      await b.whenReady();
      const role = b.access().actingRole('integrations', ['A']);
      const refuse = (code: string, msg: string, r: string | null = role) => h.refuse('engine.settings', 'engine_settings', surface, code, msg, r);
      if (!role) return refuse('forbidden', 'Only a platform admin may change engine settings', null);
      if (!surface || !SURFACES.includes(surface as never)) return refuse('invalid', 'Unknown surface');
      if (engine !== 'deterministic' && engine !== 'model') return refuse('invalid', 'Engine must be deterministic or model');
      if (weights != null && (typeof weights !== 'object' || Array.isArray(weights) || Object.values(weights).some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 10)))
        return refuse('invalid', 'Weights must be numbers between 0 and 10');
      const cur = b.rawGet('engine_settings', surface);
      const row = { engine, weights: weights ?? cur?.weights ?? {}, updated_by: b.identity().personId, updated_at: nowTs() };
      if (cur) b.rawUpdate('engine_settings', surface, row as never);
      else b.rawInsert('engine_settings', { id: surface, surface: surface as never, ...row } as never);
      return h.done('engine.settings', 'engine_settings', surface, `${surface}: ${engine}`, role, null, '', 'Engine settings saved', undefined, ['engine_settings']);
    },
  };
}
