// M16 LocalBackend RPCs added by W3 · E5 (F24 Recommendation transparency, opt-out and fairness monitor). Installed on every
// LocalRpc by src/data/ext/local.ts (spread after makeW0LocalRpc, so setEngineWeights here replaces the wave-0 one).
// 1:1 mirror of supabase/migrations/20261009135001_kafaa_w3e5_transparency.sql: same checks in the same order, refusal codes,
// messages, audit rows and ledger rows. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { SCHEMA } from '../../../data/schema';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { SURFACES } from '../../../domain/engines/types';
import { OPTOUT_SURFACES, fairnessSnapshot, isoWeek, type FairnessData } from '../fairness';
import { ENGINE_MSG, RATIONALE_MIN, sameWeights, validWeights } from '../transparency';
import type { EngineChangeResult, M16Rpc, OptoutResult, OptoutStat, SnapshotResult } from './rpc';

/** Everything the fairness monitor reads, straight from the in-memory tables (no RLS: the RPC is the gate). */
export function localFairnessData(b: LocalBackend): FairnessData {
  const raw = (t: string) => b.raw(t as never) as unknown as never[];
  return {
    people: raw('people'), roles: raw('job_roles'), edges: raw('career_paths'), roleComps: raw('role_competencies'), competencies: raw('competencies'), skills: raw('skills'),
    states: raw('person_skills'), licences: raw('licences'), standards: raw('qual_standards'), qualRecords: raw('qual_records'), programmes: raw('programmes'), courses: raw('courses'),
    trainingRecords: raw('training_records'), enrolments: raw('enrolments'), weights: (b.rawGet('engine_settings', 'recommend')?.weights ?? undefined) as never,
    optouts: raw('reco_optouts'), applications: raw('opportunity_applications'), mentoring: raw('mentoring_requests'), nominations: raw('leadership_nominations'),
    placements: Object.prototype.hasOwnProperty.call(SCHEMA, 'review_placements') ? raw('review_placements') : null,
  };
}

export function makeLocalM16(b: LocalBackend, h: LocalRpcHelpers): M16Rpc {
  /** The shared write of changeEngineWeights and setEngineWeights (SQL kafaa_engine_apply_change). */
  const applyChange = async (surface: string, engine: string, weights: Record<string, number> | null, rationale: string | null, role: string, message: string): Promise<Result<EngineChangeResult>> => {
    const row0 = b.rawGet('engine_settings', surface);
    // copy before the update: rawUpdate changes the stored row in place
    const cur = row0 ? { engine: row0.engine, weights: { ...((row0.weights ?? {}) as Record<string, number>) } } : null;
    const ts = nowTs();
    const after = weights ?? cur?.weights ?? {};
    const row = { engine, weights: after, updated_by: b.identity().personId, updated_at: ts };
    if (row0) b.rawUpdate('engine_settings', surface, row as never);
    else b.rawInsert('engine_settings', { id: surface, surface, ...row } as never);
    const n = b.raw('engine_changes').filter((c) => c.surface === surface).length;
    const id = `ec:${surface}:${String(n + 1).padStart(3, '0')}`;
    const cards = b.raw('engine_cards').filter((c) => c.engine_surface === surface).map((c) => c.id).sort();
    b.rawInsert('engine_changes', {
      id, surface, engine_before: cur?.engine ?? null, engine_after: engine, weights_before: cur?.weights ?? {}, weights_after: after, rationale, card_ids: cards,
      changed_by: b.identity().personId, changed_by_role: role, changed_at: ts, audit_seq: null, ledger_seq: null,
    } as never);
    for (const c of cards) { const card = b.rawGet('engine_cards', c)!; b.rawUpdate('engine_cards', c, { version: card.version + 1, last_changed_at: ts, last_change_id: id } as never); }
    const r = await h.done<EngineChangeResult>('engine.settings', 'engine_settings', surface, `${surface}: ${engine}${rationale ? ` (${rationale})` : ''}`, role, 'kafaa.ai.engine_change',
      `Engine settings for ${surface}: ${cur?.engine ?? 'default'} -> ${engine}; change ${id}`, message, { change_id: id, surface, engine, cards }, ['engine_settings', 'engine_changes', 'engine_cards']);
    b.rawUpdate('engine_changes', id, { audit_seq: r.audit_seq ?? null, ledger_seq: r.ledger_seq ?? null } as never);
    return r;
  };
  const engineChecks = (surface: string, engine: string, weights: unknown, refuse: (code: string, msg: string, r?: string | null) => Promise<Result<never>>, role: string | null) => {
    if (!role) return refuse('forbidden', ENGINE_MSG.forbidden, null);
    if (!surface || !SURFACES.includes(surface as never)) return refuse('invalid', ENGINE_MSG.surface);
    if (engine !== 'deterministic' && engine !== 'model') return refuse('invalid', ENGINE_MSG.engine);
    if (weights != null && !validWeights(weights)) return refuse('invalid', ENGINE_MSG.weights);
    return null;
  };

  return {
    async setRecoOptout(surface, optedOut, reason = null) {
      await b.whenReady();
      type R = OptoutResult;
      const me = b.identity().personId;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('reco.optout', 'reco_optouts', surface ?? null, code, msg, role);
      if (!me) return refuse('not_signed_in', 'Sign in to change your recommendation settings');
      const role = b.access().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', 'Recommendations are for staff with a skills profile');
      if (!OPTOUT_SURFACES.includes(surface as never) || typeof optedOut !== 'boolean') return refuse('invalid', 'Unknown recommendation surface', role);
      const why = (reason ?? '').trim();
      if (why.length > 500) return refuse('invalid', 'Keep the reason under 500 characters', role);
      const id = `ro:${me}:${surface}`;
      const cur = b.rawGet('reco_optouts', id);
      const ts = nowTs();
      if (cur) b.rawUpdate('reco_optouts', id, { opted_out: optedOut, reason: why || null, updated_at: ts } as never);
      else b.rawInsert('reco_optouts', { id, person_id: me, surface, opted_out: optedOut, reason: why || null, created_at: ts, updated_at: ts } as never);
      return h.done<R>('reco.optout', 'reco_optouts', id, `${surface}: ${optedOut ? 'opted out' : 'opted in'}`, role, 'kafaa.ai.optout',
        `${optedOut ? 'Opted out of' : 'Opted back in to'} ${surface} recommendations`, optedOut ? 'Ranked suggestions are off for this surface' : 'Ranked suggestions are back on for this surface',
        { id, surface, opted_out: optedOut }, ['reco_optouts']);
    },

    async runFairnessSnapshot(asOf = null) {
      await b.whenReady();
      type R = SnapshotResult;
      const role = b.access().actingRole('integrations', ['A']);
      const today = todayIso();
      const day = asOf ?? today;
      const refuse = (code: string, msg: string, r: string | null = role) => h.refuse<R>('fairness.snapshot', 'fairness_snapshots', day, code, msg, r);
      if (!role) return refuse('forbidden', 'Only a platform admin or AI governance lead may run the fairness snapshot', null);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)) || day > today || day < new Date(Date.parse(today) - 366 * 86_400_000).toISOString().slice(0, 10))
        return refuse('invalid', 'Choose a date within the last year');
      const rows = fairnessSnapshot(localFairnessData(b), day);
      const ts = nowTs();
      const by = b.identity().personId;
      for (const r of rows) {
        const row = { ...r, run_by: by, created_at: ts };
        if (b.rawGet('fairness_snapshots', r.id)) b.rawUpdate('fairness_snapshots', r.id, row as never);
        else b.rawInsert('fairness_snapshots', row as never);
      }
      const flagged = new Set(rows.filter((r) => r.flagged).map((r) => `${r.metric}:${r.dimension}`)).size;
      const suppressed = new Set(rows.filter((r) => r.suppressed).map((r) => `${r.metric}:${r.dimension}`)).size;
      const period = isoWeek(day);
      const hipo = rows.find((r) => r.metric === 'hipo_pool')?.source ?? 'leadership_nominations';
      return h.done<R>('fairness.snapshot', 'fairness_snapshots', period, `${period}: ${rows.length} rows, ${flagged} flagged, ${suppressed} suppressed`, role, 'kafaa.ai.fairness_snapshot',
        `Fairness snapshot ${period} (as of ${day}): ${flagged} comparisons below four-fifths, ${suppressed} suppressed`, 'Fairness snapshot saved',
        { period, as_of: day, rows: rows.length, flagged, suppressed, hipo_source: hipo }, ['fairness_snapshots']);
    },

    async changeEngineWeights(surface, engine, weights, rationale) {
      await b.whenReady();
      type R = EngineChangeResult;
      const role = b.access().actingRole('integrations', ['A']);
      const refuse = (code: string, msg: string, r: string | null = role) => h.refuse<R>('engine.settings', 'engine_settings', surface ?? null, code, msg, r) as Promise<Result<never>>;
      const bad = await engineChecks(surface, engine, weights, refuse, role);
      if (bad) return bad;
      const why = (rationale ?? '').trim();
      if (why.length < RATIONALE_MIN || why.length > 500) return refuse('invalid', ENGINE_MSG.rationale);
      const cur = b.rawGet('engine_settings', surface);
      if (cur && cur.engine === engine && (weights == null || sameWeights(cur.weights as Record<string, number>, weights))) return refuse('no_change', ENGINE_MSG.noChange);
      return applyChange(surface, engine, weights, why, role!, 'Engine settings changed and logged');
    },

    async setEngineWeights(surface, engine, weights = null) {
      await b.whenReady();
      const role = b.access().actingRole('integrations', ['A']);
      const refuse = (code: string, msg: string, r: string | null = role) => h.refuse('engine.settings', 'engine_settings', surface, code, msg, r) as Promise<Result<never>>;
      const bad = await engineChecks(surface, engine, weights, refuse, role);
      if (bad) return bad;
      return applyChange(surface, engine, weights ?? null, null, role!, 'Engine settings saved');
    },

    async optoutStats() {
      await b.whenReady();
      const ctx = b.access();
      if (!ctx.has('integrations', ['R', 'A']) && !ctx.has('skills_profile', ['Agg', 'A'])) throw new Error("Kafa'a · opt-out counts are aggregate-only and restricted");
      return OPTOUT_SURFACES.map((surface): OptoutStat => {
        const n = new Set(b.raw('reco_optouts').filter((o) => o.surface === surface && o.opted_out).map((o) => o.person_id)).size;
        return { surface, n: n < MIN_GROUP_SIZE ? null : n, suppressed: n < MIN_GROUP_SIZE };
      });
    },
  };
}
