// M10 extension SupabaseBackend RPC mappings (owner: FS wave G · E4, FS66 + FS67). Installed by src/data/ext/supabase.ts (one-line hook,
// FS66). SQL: supabase/migrations/20261010274001_kafaa_fs74_university_alignment.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M10Rpc } from './rpc';

export function makeSupabaseM10(x: SupabaseExtCtx): M10Rpc {
  return {
    saveProgramme: (input) => x.call('kafaa_save_programme', { p: input ?? {} }, ['programme_alignments']),
    endorseProgramme: (id, input) => x.call('kafaa_endorse_programme', { p_id: id, p: input ?? {} }, ['programme_alignments', 'programme_graduates', 'skill_evidence', 'person_skills', 'notifications']),
    recordGraduateHire: (input) => x.call('kafaa_record_graduate_hire', { p: input ?? {} }, ['programme_graduates', 'skill_evidence', 'person_skills', 'notifications']),
    saveFellowship: (input) => x.call('kafaa_save_fellowship', { p: input ?? {} }, ['fellowships', 'fellowship_milestones']),
    updateMilestone: (id, action, note = '') => x.call('kafaa_update_milestone', { p_id: id, p_action: action, p_note: note ?? '' }, ['fellowship_milestones', 'fellowships', 'notifications']),
    withdrawFellowship: (id, reason) => x.call('kafaa_withdraw_fellowship', { p_id: id, p_reason: reason ?? '' }, ['fellowships']),
    fellowshipStats: () => x.call('kafaa_fellowship_stats', {}, ['audit_events']),
  };
}
