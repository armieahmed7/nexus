// M25 SupabaseBackend RPC mappings (owner: W4 · E1 · F25 Training effectiveness, F26 Training needs forecast). Installed by
// src/data/ext/supabase.ts. SQL: supabase/migrations/20261009141001_kafaa_w4e1_effectiveness.sql. Pages never import this file.
// Reads that return a Result envelope (board, reports) also go through x.call with no touched tables, so refusals reach the page.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M25Rpc } from './rpc';

export function makeSupabaseM25(x: SupabaseExtCtx): M25Rpc {
  return {
    submitL1: (input) => x.call('kafaa_submit_l1', { p: input ?? {} }, ['eval_responses', 'l3_observations']),
    scheduleL3: (courseId = null) => x.call('kafaa_schedule_l3', { p_course: courseId ?? null }, ['l3_observations']),
    l3Board: () => x.call('kafaa_l3_board', {}, ['audit_events']),
    recordL3: (id, input) => x.call('kafaa_record_l3', { p_id: id, p: input ?? {} }, ['l3_observations']),
    effectivenessReport: (courseId = null) => x.call('kafaa_effectiveness_report', { p_course: courseId ?? null }, ['audit_events']),
    flagRedesign: (courseId, note) => x.call('kafaa_flag_redesign', { p_course: courseId, p_note: note ?? '' }, ['redesign_flags']),
    computeDemand: (period) => x.call('kafaa_compute_demand', { p_period: period }, ['demand_snapshots']),
    demandReport: (period = null) => x.call('kafaa_demand_report', { p_period: period ?? null }, ['audit_events']),
    proposeSessions: (period, courseId, note = '') => x.call('kafaa_propose_sessions', { p_period: period, p_course: courseId, p_note: note ?? '' }, ['session_proposals']),
    withdrawProposal: (id) => x.call('kafaa_withdraw_proposal', { p_id: id }, ['session_proposals']),
    linkProposal: (id, sessionId) => x.call('kafaa_link_proposal', { p_id: id, p_session: sessionId }, ['session_proposals']),
    // FS56 / FS57 (FS wave F · E4): 20261010264001_kafaa_fs64_skill_change_coverage.sql
    skillChangeReport: () => x.call('kafaa_skill_change_report', {}, ['audit_events']),
    computeSkillChange: () => x.call('kafaa_compute_skill_change', {}, ['skill_change_measures']),
    curriculumCoverage: () => x.call('kafaa_curriculum_coverage', {}, ['audit_events']),
    syncGapBacklog: () => x.call('kafaa_sync_gap_backlog', {}, ['gap_backlog']),
    decideGap: (input) => x.call('kafaa_decide_gap', { p: input ?? {} }, ['gap_backlog']),
  };
}
