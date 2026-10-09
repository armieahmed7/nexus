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
    withdrawInstructorTrack: (trackId, note) => x.call('kafaa_withdraw_instructor_track', { p_track: trackId, p_note: note }, [...T, 'evaluator_quals', 'skill_evidence', 'person_skills']),
  };
}
