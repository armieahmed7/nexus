// M02 extension SupabaseBackend RPC mappings (owner: W4 · E5, F31). Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M02Rpc } from './rpc';

const T = ['instructor_tracks', 'instructor_observations', 'teaching_hours'] as const;

export function makeSupabaseM02(x: SupabaseExtCtx): M02Rpc {
  return {
    nominateInstructor: (input) => x.call('kafaa_nominate_instructor', { p: input }, ['instructor_tracks', 'notifications']),
    decideInstructorNomination: (trackId, decision, note) =>
      x.call('kafaa_decide_instructor_nomination', { p_track: trackId, p_decision: decision, p_note: note ?? null }, ['instructor_tracks', 'enrolments', 'notifications']),
    recordInstructorObservation: (input) => x.call('kafaa_record_instructor_observation', { p: input }, ['instructor_observations', 'instructor_tracks', 'notifications']),
    qualifyInstructor: (trackId, note) =>
      x.call('kafaa_qualify_instructor', { p_track: trackId, p_note: note ?? null }, ['instructor_tracks', 'evaluator_quals', 'skill_evidence', 'person_skills', 'notifications']),
    instructorCurrencySweep: () => x.call('kafaa_instructor_currency_sweep', {}, ['instructor_tracks', 'evaluator_quals', 'skill_evidence', 'person_skills', 'notifications']),
    logTeachingHours: (input) => x.call('kafaa_log_teaching_hours', { p: input }, ['teaching_hours']),
    syncTeachingHours: (personId) => x.call('kafaa_sync_teaching_hours', { p_person: personId }, ['teaching_hours']),
    // W5 · E1 · F38 (supabase/migrations/20261009151001_kafaa_w5e1_microcred_ojt.sql)
    logPractice: (input) => x.call('kafaa_log_practice', { p: input }, ['ojt_logs', 'notifications', 'xapi_statements']),
    ackPractice: (input) => x.call('kafaa_ack_practice', { p: input }, ['ojt_logs', 'notifications']),
    requestEvaluation: (taskId, evaluatorId, note) => x.call('kafaa_request_evaluation', { p_task: taskId, p_evaluator: evaluatorId, p_note: note ?? null }, ['ojt_eval_requests', 'notifications']),
    closeEvaluationRequest: (id, action, note) => x.call('kafaa_close_evaluation_request', { p_request: id, p_action: action, p_note: note ?? null }, ['ojt_eval_requests', 'notifications']),
    ojtPreceptors: (taskId) => x.rpc('kafaa_ojt_preceptors', { p_task: taskId }),
    withdrawInstructorTrack: (trackId, note) => x.call('kafaa_withdraw_instructor_track', { p_track: trackId, p_note: note }, [...T, 'evaluator_quals', 'skill_evidence', 'person_skills']),
    // FS wave C · E4 · FS23/FS24 (supabase/migrations/20261010234001_kafaa_fs34_descriptors_scale.sql)
    saveDescriptor: (input) => x.call('kafaa_save_descriptor', { p: input ?? {} }, ['skill_descriptors']),
    setLevelRange: (input) => x.call('kafaa_set_level_range', { p: input ?? {} }, ['skill_level_ranges', 'skill_descriptors']),
    recogniseAuthority: (input) => x.call('kafaa_recognise_authority', { p: input ?? {} }, ['authority_recognitions', 'notifications']),
    authorityCandidates: () => x.rpc('kafaa_authority_candidates', {}),
  };
}
