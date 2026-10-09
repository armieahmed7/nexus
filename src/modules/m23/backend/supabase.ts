// M23 SupabaseBackend RPC mappings (owner: W3 · E1 · F18, F19). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261009131001_kafaa_w3e1_talent.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M23Rpc } from './rpc';

export function makeSupabaseM23(x: SupabaseExtCtx): M23Rpc {
  return {
    talentCycles: () => x.call('kafaa_talent_cycles', {}, []),
    talentBoard: (cycleId) => x.call('kafaa_talent_board', { p_cycle_id: cycleId ?? null }, []),
    placeTalent: (input) => x.call('kafaa_place_talent', { p: input ?? {} }, ['review_placements', 'review_cycles']),
    calibrateCycle: (cycleId, changes, finish) => x.call('kafaa_calibrate_cycle', { p_cycle_id: cycleId ?? null, p_changes: changes ?? [], p_finish: finish === true }, ['review_cycles', 'review_placements']),
    lockCycle: (cycleId, note) => x.call('kafaa_lock_cycle', { p_cycle_id: cycleId ?? null, p_note: note ?? '' }, ['review_cycles', 'review_placements', 'talent_priorities', 'talent_pool', 'notifications']),
    talentAggregates: (cycleId) => x.call('kafaa_talent_aggregates', { p_cycle_id: cycleId ?? null }, []),
    successionBoard: () => x.call('kafaa_succession_board', {}, []),
    successionCandidates: (slateId) => x.call('kafaa_succession_candidates', { p_slate_id: slateId ?? null }, []),
    proposeSuccessor: (input) => x.call('kafaa_propose_successor', { p: input ?? {} }, ['successors', 'succession_slates']),
    withdrawSuccessor: (id, note) => x.call('kafaa_withdraw_successor', { p_id: id ?? null, p_note: note ?? '' }, ['successors', 'succession_slates']),
    confirmSlate: (slateId, note) => x.call('kafaa_confirm_slate', { p_slate_id: slateId ?? null, p_note: note ?? '' }, ['succession_slates', 'successors']),
    rollupBench: (period) => x.call('kafaa_rollup_bench', { p_period: period ?? null }, ['critical_roles', 'bench_rollups']),
  };
}
