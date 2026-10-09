// M07 extension SupabaseBackend RPC mappings (owner: W3 · E3, F22). Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M07Rpc } from './rpc';

export function makeSupabaseM07(x: SupabaseExtCtx): M07Rpc {
  return {
    handoverAggregate: (period, scenario) =>
      x.call('kafaa_handover_aggregate', { p_period: period, p_ossa_end: scenario?.ossa_end ?? null, p_slip: scenario?.slip_months ?? null }, []),
    prepareHandoverRelease: (period) => x.call('kafaa_prepare_handover_release', { p_period: period }, ['observer_reports']),
  };
}
