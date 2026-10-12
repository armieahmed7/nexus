// M16 SupabaseBackend RPC mappings added by W3 · E5 (F24). Installed by src/data/ext/supabase.ts. Pages never import this file.
// setEngineWeights keeps its wave-0 mapping in SupabaseBackend (same SQL function, redefined in the W3E5 migration to log and ledger).
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { DecideResult, EngineChangeResult, M16Rpc, OptoutResult, OptoutStat, ProposeResult, SnapshotResult, SurfaceSnapshotResult, TaxonomyHealth } from './rpc';
import type { RequestRow } from '../taxonomyGov';

export function makeSupabaseM16(x: SupabaseExtCtx): M16Rpc {
  return {
    setRecoOptout: (surface, optedOut, reason = null) => x.call<OptoutResult>('kafaa_set_reco_optout', { p_surface: surface, p_opted_out: optedOut, p_reason: reason }, ['reco_optouts']),
    runFairnessSnapshot: (asOf = null) => x.call<SnapshotResult>('kafaa_run_fairness_snapshot', { p_as_of: asOf }, ['fairness_snapshots']),
    changeEngineWeights: (surface, engine, weights, rationale) => x.call<EngineChangeResult>('kafaa_change_engine_weights', { p_surface: surface, p_engine: engine, p_weights: weights, p_rationale: rationale }, ['engine_settings', 'engine_changes', 'engine_cards']),
    setEngineWeights: (surface, engine, weights = null) => x.call('kafaa_set_engine_weights', { p_surface: surface, p_engine: engine, p_weights: weights }, ['engine_settings', 'engine_changes', 'engine_cards']),
    optoutStats: async () => ((await x.rpc<OptoutStat[]>('kafaa_optout_stats')) ?? []).map((r) => ({ ...r, n: r.n == null ? null : Number(r.n) })),
    // FS54 / FS55 (wave F · E3): 20261010263001_kafaa_fs63_taxonomy_governance.sql
    proposeSkillChange: (input) => x.call<ProposeResult>('kafaa_propose_skill_change', { p: input ?? {} }, ['skill_change_requests']),
    decideSkillChange: (id, decision, note = null) => x.call<DecideResult>('kafaa_decide_skill_change', { p_id: id, p_decision: decision, p_note: note }, ['skill_change_requests', 'skill_changes', 'skills']),
    skillCouncilQueue: async () => (await x.rpc<RequestRow[]>('kafaa_skill_council_queue')) ?? [],
    taxonomyHealth: async () => await x.rpc<TaxonomyHealth>('kafaa_taxonomy_health'),
    runSurfaceFairness: (asOf = null) => x.call<SurfaceSnapshotResult>('kafaa_run_surface_fairness', { p_as_of: asOf }, ['surface_fairness']),
  };
}
