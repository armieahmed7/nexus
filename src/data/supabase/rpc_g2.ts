/**
 * G2 RPCs over Supabase: thin mappings to the SQL functions in supabase/migrations/20261008132001_kafaa_g2_learning.sql.
 * Argument names match the SQL parameter names exactly.
 */
import type { Result, Table } from '../types';
import { G2_TOUCHED, type G2Rpc } from '../rpc_g2';

type Call = <T>(fn: string, args: Record<string, unknown>, touched?: Table[]) => Promise<Result<T>>;

export function makeG2SupabaseRpc(call: Call): G2Rpc {
  const t = (k: keyof G2Rpc) => G2_TOUCHED[k] as Table[];
  return {
    enrolCourse: (courseId, sessionId, personId) => call('kafaa_enrol_course', { p_course_id: courseId, p_session_id: sessionId, p_person_id: personId ?? null }, t('enrolCourse')),
    decideEnrolment: (id, decision, note) => call('kafaa_decide_enrolment', { p_id: id, p_decision: decision, p_note: note ?? '' }, t('decideEnrolment')),
    sessionAvailability: (courseId) => call('kafaa_session_availability', { p_course_id: courseId }),
    cancelEnrolment: (id, reason) => call('kafaa_cancel_enrolment', { p_id: id, p_reason: reason ?? '' }, t('cancelEnrolment')),
    recordAttendance: (sessionId, marks) => call('kafaa_record_attendance', { p_session_id: sessionId, p_marks: marks }, t('recordAttendance')),
    completeEnrolment: (id, result, score, note) => call('kafaa_complete_enrolment', { p_id: id, p_result: result, p_score: score, p_note: note ?? '' }, t('completeEnrolment')),
    decideExternalRequest: (id, decision, note) => call('kafaa_decide_external_request', { p_id: id, p_decision: decision, p_note: note ?? '' }, t('decideExternalRequest')),
    curriculumSync: (personId) => call('kafaa_curriculum_sync', { p_person_id: personId }, t('curriculumSync')),
    decideDevPlan: (id, decision, note) => call('kafaa_decide_dev_plan', { p_id: id, p_decision: decision, p_note: note ?? '' }, t('decideDevPlan')),
    respondMentoring: (id, decision) => call('kafaa_respond_mentoring', { p_id: id, p_decision: decision }, t('respondMentoring')),
    saveItem: (p) => call('kafaa_save_item', { p }, t('saveItem')),
    retireItem: (id, reason) => call('kafaa_retire_item', { p_id: id, p_reason: reason ?? '' }, t('retireItem')),
    scheduleAttempt: (formId, personId, when, proctor) => call('kafaa_schedule_attempt', { p_form_id: formId, p_person_id: personId, p_scheduled_for: when, p_proctor: proctor }, t('scheduleAttempt')),
    startAttempt: (id) => call('kafaa_start_attempt', { p_id: id }, t('startAttempt')),
    submitAttempt: (id, answers) => call('kafaa_submit_attempt', { p_id: id, p_answers: answers }, t('submitAttempt')),
    releaseAttempt: (id, note) => call('kafaa_release_attempt', { p_id: id, p_note: note ?? '' }, t('releaseAttempt')),
    recordPerformance: (formId, personId, passed, score, note) => call('kafaa_record_performance', { p_form_id: formId, p_person_id: personId, p_passed: passed, p_score: score, p_note: note ?? '' }, t('recordPerformance')),
    attemptFeedback: (id) => call('kafaa_attempt_feedback', { p_id: id }),
    fileAppeal: (attemptId, reason, itemId) => call('kafaa_file_appeal', { p_attempt_id: attemptId, p_reason: reason ?? '', p_item_id: itemId }, t('fileAppeal')),
    decideAppeal: (id, decision, note, voidItemIds) => call('kafaa_decide_appeal', { p_id: id, p_decision: decision, p_note: note ?? '', p_void_item_ids: voidItemIds ?? [] }, t('decideAppeal')),
  };
}
