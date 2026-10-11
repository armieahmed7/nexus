// M26 SupabaseBackend RPC mappings (owner: W4 · E2 · F27 SAT analysis workbench, F29 Accreditation readiness). Installed by
// src/data/ext/supabase.ts. SQL: supabase/migrations/20261009142001_kafaa_w4e2_sat.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { AccrEvidence, DifSurvey, Impact, M26Rpc, TaskFutureView } from './rpc';

export function makeSupabaseM26(x: SupabaseExtCtx): M26Rpc {
  return {
    // FS06 (wave A · E5): supabase/migrations/20261010215001_kafaa_fs15_task_future.sql
    setTaskFuture: (input) => x.call('kafaa_set_task_future', { p: input ?? {} }, ['jta_tasks', 'jta_task_skills', 'sat_changes']),
    taskFuture: async (roleId = null) => (await x.rpc<TaskFutureView | null>('kafaa_task_future', { p_role: roleId ?? null })) ?? null,
    designateSatAnalyst: (personId, active) => x.call('kafaa_designate_sat_analyst', { p_person: personId, p_active: active }, ['sat_analysts']),
    saveJtaTask: (input) => x.call('kafaa_save_jta_task', { p: input ?? {} }, ['jta_tasks', 'jta_analyses']),
    rateDif: (taskId, d, i, f, note = '') => x.call('kafaa_rate_dif', { p_task: taskId, p_d: d, p_i: i, p_f: f, p_note: note ?? '' }, ['dif_ratings']),
    decideTraining: (taskId, decision, note = '') => x.call('kafaa_decide_training', { p_task: taskId, p_decision: decision, p_note: note ?? '' }, ['jta_tasks']),
    saveObjective: (input) => x.call('kafaa_save_objective', { p: input ?? {} }, ['sat_objectives']),
    linkObjective: (input) => x.call('kafaa_link_objective', { p: input ?? {} }, ['task_objectives']),
    satImpact: async (taskId) => (await x.rpc<Impact | null>('kafaa_sat_impact', { p_task: taskId })) ?? null,
    openSatChange: (input) => x.call('kafaa_open_sat_change', { p: input ?? {} }, ['sat_changes', 'sat_change_items', 'jta_tasks']),
    resolveSatChangeItem: (itemId, outcome, note = '') => x.call('kafaa_resolve_sat_change_item', { p_id: itemId, p_outcome: outcome, p_note: note ?? '' }, ['sat_change_items', 'sat_changes']),
    setAnalysisStatus: (roleId, status) => x.call('kafaa_set_analysis_status', { p_role: roleId, p_status: status }, ['jta_analyses', 'notifications']),
    difSurvey: async () => (await x.rpc<DifSurvey | null>('kafaa_dif_survey')) ?? { open: false, role_id: null, tasks: [] },
    openSelfEval: (programmeId) => x.call('kafaa_open_self_eval', { p_programme: programmeId }, ['accr_selfevals']),
    rateCriterion: (input) => x.call('kafaa_rate_criterion', { p: input ?? {} }, ['accr_assessments', 'accr_selfevals']),
    finaliseSelfEval: (id) => x.call('kafaa_finalise_self_eval', { p_id: id }, ['accr_selfevals']),
    accrEvidence: async (programmeId) => (await x.rpc<AccrEvidence | null>('kafaa_accr_evidence', { p_programme: programmeId })) ?? null,
  };
}
