// M07 extension SupabaseBackend RPC mappings (owner: W3 · E3, F22). Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M07Rpc } from './rpc';

export function makeSupabaseM07(x: SupabaseExtCtx): M07Rpc {
  return {
    handoverAggregate: (period, scenario) =>
      x.call('kafaa_handover_aggregate', { p_period: period, p_ossa_end: scenario?.ossa_end ?? null, p_slip: scenario?.slip_months ?? null }, []),
    prepareHandoverRelease: (period) => x.call('kafaa_prepare_handover_release', { p_period: period }, ['observer_reports']),
    // W5E4 (F35) skills supply-and-demand outlook
    computeOutlook: (params) => x.call('kafaa_compute_outlook', { p_params: params ?? {} }, []),
    saveOutlook: (input) => x.call('kafaa_save_outlook', { p: input }, ['skill_outlooks']),
    releaseOutlook: (id, summaryEn, summaryAr) => x.call('kafaa_release_outlook', { p_id: id, p_summary_en: summaryEn, p_summary_ar: summaryAr }, ['skill_outlooks']),
    withdrawOutlook: (id, reason) => x.call('kafaa_withdraw_outlook', { p_id: id, p_reason: reason }, ['skill_outlooks']),
    releasedOutlooks: () => x.call('kafaa_released_outlooks', {}, []),
  };
}
