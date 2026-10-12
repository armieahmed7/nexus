// M28 SupabaseBackend RPC mappings (owners: wave B E1 (FS07, FS08) and wave H E1 (FS70, FS71, FS72)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M28Rpc } from './rpc';

export function makeSupabaseM28(x: SupabaseExtCtx): M28Rpc {
  return {
    saveAlignment: (input) => x.call('kafaa_save_alignment', { p: input ?? {} }, ['skill_alignments']),
    reviewAlignment: (id) => x.call('kafaa_review_alignment', { p_id: id ?? '' }, ['skill_alignments']),
    retireAlignment: (id, reason) => x.call('kafaa_retire_alignment', { p_id: id ?? '', p_reason: reason ?? '' }, ['skill_alignments']),
    setSkillGoal: (skillId, targetLevel, active) => x.call('kafaa_set_skill_goal', { p_skill: skillId ?? '', p_level: targetLevel ?? null, p_active: active !== false }, ['skill_goals']),
    // FS wave H · E1 (FS70, FS71, FS72): supabase/migrations/20261010281001_kafaa_fs81_skill_signals.sql
    computeSkillSignals: (quarter) => x.call('kafaa_compute_skill_signals', { p_quarter: quarter ?? '' }, []),
    publishSkillSignals: (quarter, summaryEn, summaryAr) => x.call('kafaa_publish_skill_signals', { p_quarter: quarter ?? '', p_summary_en: summaryEn ?? '', p_summary_ar: summaryAr ?? '' }, ['skill_signal_runs', 'skill_signals']),
    submitManagerPulse: (input) => x.call('kafaa_submit_manager_pulse', { p: input ?? {} }, ['manager_pulse']),
    managerPulseSummary: (year) => x.call('kafaa_manager_pulse_summary', { p_year: year ?? null }, []),
    saveTechnology: (input) => x.call('kafaa_save_technology', { p: input ?? {} }, ['technologies']),
    tagTechnology: (input) => x.call('kafaa_tag_technology', { p: input ?? {} }, ['technology_links']),
    computeTechnologyBadges: (quarter) => x.call('kafaa_compute_technology_badges', { p_quarter: quarter ?? '' }, []),
    publishTechnologyBadges: (quarter) => x.call('kafaa_publish_technology_badges', { p_quarter: quarter ?? '' }, ['technology_badges']),
    refreshSkillSuggestions: () => x.call('kafaa_refresh_skill_suggestions', {}, ['skill_suggestions']),
    respondSuggestion: (id, response) => x.call('kafaa_respond_suggestion', { p_id: id ?? '', p_response: response ?? '' }, ['skill_suggestions', 'skill_evidence', 'person_skills']),
    runSuggestionFairness: (asOf) => x.call('kafaa_run_suggestion_fairness', { p_as_of: asOf ?? null }, ['skill_suggestion_fairness']),
    suggestionStats: () => x.call('kafaa_suggestion_stats', {}, []),
  };
}
