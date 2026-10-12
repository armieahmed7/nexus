// M35 SupabaseBackend RPC mappings (owners: wave F E1 (FS50, FS51) and wave G E1 (FS60, FS61)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// SQL: supabase/migrations/20261010261001_kafaa_fs61_strategy_forecasts.sql (FS50/FS51) and 20261010271001_kafaa_fs71_disclosure_pilots.sql (FS60/FS61).
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M35Rpc } from './rpc';

export function makeSupabaseM35(x: SupabaseExtCtx): M35Rpc {
  return {
    criticalSkillBoard: () => x.call('kafaa_critical_skill_board', {}, []),
    saveCriticalSkill: (input) => x.call('kafaa_save_critical_skill', { p: input ?? {} }, ['critical_skills']),
    reviewCriticalSkill: (input) => x.call('kafaa_review_critical_skill', { p: input ?? {} }, ['critical_skill_reviews', 'critical_skills']),
    computeSkillForecast: (params) => x.call('kafaa_compute_skill_forecast', { p_params: params ?? {} }, []),
    saveSkillForecast: (input) => x.call('kafaa_save_skill_forecast', { p: input ?? {} }, ['skill_forecasts']),
    releaseSkillForecast: (id, summaryEn, summaryAr) => x.call('kafaa_release_skill_forecast', { p_id: id, p_summary_en: summaryEn, p_summary_ar: summaryAr }, ['skill_forecasts']),
    // FS wave G · E1 (FS60, FS61): supabase/migrations/20261010271001_kafaa_fs71_disclosure_pilots.sql
    computeDisclosure: (period) => x.call('kafaa_compute_disclosure', { p_period: period ?? '' }, []),
    saveDisclosure: (input) => x.call('kafaa_save_disclosure', { p: input ?? {} }, ['hc_disclosures']),
    approveDisclosure: (id, metricIds) => x.call('kafaa_approve_disclosure', { p_id: id, p_metric_ids: metricIds ?? [] }, ['hc_disclosures']),
    pilotStats: () => x.call('kafaa_pilot_stats', {}, []),
    savePilot: (input) => x.call('kafaa_save_pilot', { p: input ?? {} }, ['skill_pilots']),
    signoffPilot: (id, input) => x.call('kafaa_signoff_pilot', { p_id: id, p: input ?? {} }, ['skill_pilots']),
    closePilot: (id, adoption) => x.call('kafaa_close_pilot', { p_id: id, p_adoption: adoption ?? '' }, ['skill_pilots']),
  };
}
