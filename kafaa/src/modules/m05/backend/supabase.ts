// M05 extension SupabaseBackend RPC mappings (owner: FS wave C · E3, FS21 + FS22). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261010233001_kafaa_fs33_assessment.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { AdOverview, AdStats, M05Rpc } from './rpc';

export function makeSupabaseM05(x: SupabaseExtCtx): M05Rpc {
  return {
    adaptiveOverview: async () => (await x.rpc<AdOverview | null>('kafaa_adaptive_overview')) ?? null,
    startAdaptive: (input) => x.call('kafaa_start_adaptive', { p: input ?? {} }, ['adaptive_attempts']),
    answerAdaptive: (input) => x.call('kafaa_answer_adaptive', { p: input ?? {} }, ['adaptive_attempts', 'integrity_reports', 'skill_evidence', 'person_skills']),
    adaptiveStats: async () => (await x.rpc<AdStats | null>('kafaa_adaptive_stats')) ?? null,
    saveAdaptiveItem: (input) => x.call('kafaa_save_adaptive_item', { p: input ?? {} }, ['adaptive_items']),
    startPerformanceTask: (input) => x.call('kafaa_start_performance_task', { p: input ?? {} }, ['task_attempts']),
    submitPerformanceTask: (input) => x.call('kafaa_submit_performance_task', { p: input ?? {} }, ['task_attempts', 'integrity_reports']),
    scorePerformanceTask: (input) => x.call('kafaa_score_performance_task', { p: input ?? {} }, ['task_attempts', 'skill_evidence', 'person_skills']),
    reviewIntegrity: (input) => x.call('kafaa_review_integrity', { p: input ?? {} }, ['integrity_reports', 'adaptive_attempts', 'task_attempts', 'skill_evidence', 'person_skills']),
  };
}
