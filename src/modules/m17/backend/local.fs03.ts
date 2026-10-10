// FS03 (future-skills wave A · E2, M17) LocalBackend RPCs: skillConfidenceStats and setSkillHalfLives. 1:1 mirror of
// kafaa_skill_confidence_stats / kafaa_fs03_stats and kafaa_set_skill_half_lives in supabase/migrations/20261010212001_kafaa_fs12_decay.sql:
// same checks, order, refusal codes, messages and audit/ledger rows. The engine-change write mirrors kafaa_engine_apply_change (W3E5).
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import type { Fs03Rpc, SetHalfLivesResult } from './rpc';
import { todayIso } from '../../../domain/rules';
import { RECORDED_KINDS, decayModelFrom, deriveStates, gatherEvidence, halfLifeMonths, makeDecayModel, type Evidence, type SkillSources } from '../../../domain/skills';
import { applySkills } from '../../../data/local/rpc.w0';
import { nowTs } from '../../../data/audit';
import { FS03_MSG, checkHalfLives, confidenceStats, previewWeights, toWeights, type StateLite } from '../decay';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export function makeLocalM17Fs03(b: LocalBackend, h: LocalRpcHelpers): Fs03Rpc {
  const raw = (t: string) => b.raw(t as never) as unknown as Row[];
  /** Every person's evidence as kafaa_skill_states_v2 sees it: derived from records now, plus active recorded rows. */
  const evidenceNow = (now: string): Evidence[] => {
    const src: SkillSources = {
      skills: raw('skills'), competencies: raw('competencies'), role_competencies: raw('role_competencies'), qual_standards: raw('qual_standards'), qual_records: raw('qual_records'),
      training_records: raw('training_records'), courses: raw('courses'), attempts: raw('attempts'), assessment_forms: raw('assessment_forms'), jpm_results: raw('jpm_results'), jpms: raw('jpms'),
    };
    return [...gatherEvidence(src, { person: null, now }), ...(raw('skill_evidence').filter((e) => e.active && RECORDED_KINDS.includes(e.kind)) as Evidence[])];
  };
  return {
    async skillConfidenceStats(hl = null) {
      await b.whenReady();
      const ctx = b.access();
      if (!(ctx.has('integrations', ['R', 'A']) || ctx.has('skills_profile', ['A', 'Agg']))) throw new Error(FS03_MSG.stats_forbidden);
      if (hl != null && (typeof hl !== 'object' || Array.isArray(hl))) throw new Error("Kafa'a · the preview takes an object of half-lives");
      const today = todayIso();
      const weights = (b.rawGet('engine_settings', 'skills')?.weights ?? {}) as Record<string, unknown>;
      const pw = previewWeights(hl as Record<string, unknown> | null);
      let preview = null;
      if (pw) {
        const ev = evidenceNow(today);
        const skills = raw('skills');
        preview = { weights: pw, now: deriveStates(ev, today, makeDecayModel(weights, skills)) as StateLite[], next: deriveStates(ev, today, makeDecayModel({ ...weights, ...pw }, skills)) as StateLite[] };
      }
      return confidenceStats({
        states: raw('person_skills') as StateLite[], skills: raw('skills'), awards: raw('microcred_awards'), evidence: raw('skill_evidence').filter((e) => e.ref_table === 'microcred_awards'),
        changes: raw('engine_changes'), weights, today, preview,
      });
    },

    async setSkillHalfLives(input) {
      await b.whenReady();
      type R = SetHalfLivesResult;
      const A = 'skills.half_lives';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'engine_settings', 'skills', code, msg, role);
      if (!b.identity().personId) return refuse('not_signed_in', FS03_MSG.not_signed_in);
      const role = b.access().actingRole('integrations', ['A']);
      if (!role) return refuse('forbidden', FS03_MSG.forbidden);
      const chk = checkHalfLives(input);
      if (chk !== 'ok') return refuse('invalid', FS03_MSG[chk], role);
      const why = String(input.rationale).trim();
      const row0 = b.rawGet('engine_settings', 'skills');
      const cur = row0 ? { engine: row0.engine as string, weights: { ...((row0.weights ?? {}) as Record<string, number>) } } : null;
      const m = halfLifeMonths(cur?.weights);
      if (m.fast === input.fast && m.standard === input.standard && m.slow === input.slow) return refuse('no_change', FS03_MSG.no_change, role);
      const before = new Map(raw('person_skills').filter((p) => p.active).map((p) => [p.id, { level: p.level, band: p.confidence_band }]));
      // kafaa_engine_apply_change: settings, change log, card versions
      const engine = cur?.engine ?? 'deterministic';
      const after = { ...(cur?.weights ?? {}), ...toWeights(input) };
      const ts = nowTs();
      const row = { engine, weights: after, updated_by: b.identity().personId, updated_at: ts };
      if (row0) b.rawUpdate('engine_settings', 'skills', row as never);
      else b.rawInsert('engine_settings', { id: 'skills', surface: 'skills', ...row } as never);
      const n = raw('engine_changes').filter((c) => c.surface === 'skills').length;
      const id = `ec:skills:${String(n + 1).padStart(3, '0')}`;
      const cards = raw('engine_cards').filter((c) => c.engine_surface === 'skills').map((c) => c.id as string).sort();
      b.rawInsert('engine_changes', {
        id, surface: 'skills', engine_before: cur?.engine ?? null, engine_after: engine, weights_before: cur?.weights ?? {}, weights_after: after, rationale: why, card_ids: cards,
        changed_by: b.identity().personId, changed_by_role: role, changed_at: ts, audit_seq: null, ledger_seq: null,
      } as never);
      for (const c of cards) { const card = b.rawGet('engine_cards', c)!; b.rawUpdate('engine_cards', c, { version: card.version + 1, last_changed_at: ts, last_change_id: id } as never); }
      const rec = await applySkills(b, null, todayIso());
      let moved = 0, down = 0, up = 0;
      for (const p of raw('person_skills')) {
        const x = p.active ? before.get(p.id) : undefined;
        if (!x || (x.band === p.confidence_band && x.level === p.level)) continue;
        moved++;
        if (p.level < x.level) down++;
        if (p.level > x.level) up++;
      }
      const r = await h.done<R>('engine.settings', 'engine_settings', 'skills', `skills: ${engine} (${why})`, role, 'kafaa.ai.engine_change',
        `Engine settings for skills: ${cur?.engine ?? 'default'} -> ${engine}; change ${id}`, FS03_MSG.saved,
        { change_id: id, surface: 'skills', months: { fast: input.fast, standard: input.standard, slow: input.slow }, recompute: rec, moved, level_down: down, level_up: up } as R & Record<string, unknown>,
        ['engine_settings', 'engine_changes', 'engine_cards', 'person_skills', 'skill_evidence']);
      b.rawUpdate('engine_changes', id, { audit_seq: r.audit_seq ?? null, ledger_seq: r.ledger_seq ?? null } as never);
      return r as Result<R>;
    },
  };
}
// keep the helper referenced for tests that build a model from the backend tables
export const localDecayModel = (b: LocalBackend) => decayModelFrom(b.raw('engine_settings') as never, b.raw('skills') as never);
