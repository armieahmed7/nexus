// M19 LocalBackend RPC implementations (owner: W1 · E3, F07 Learning Coach). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261009113001_kafaa_w1e3_coach.sql (kafaa_coach_feedback, kafaa_coach_insights):
// same checks, refusal codes, audit rows and suppression. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { addDaysIso, coachInsightsOf, feedbackId } from '../insights';
import { todayIso } from '../../../domain/rules';
import { COACH_KINDS, COACH_SIGNALS, DISMISS_DAYS, type CoachFeedbackResult, type CoachInsights, type M19Rpc } from './rpc';

export function makeLocalM19(b: LocalBackend, h: LocalRpcHelpers): M19Rpc {
  return {
    async coachFeedback(itemKind, itemId, signal, competencyIds = []) {
      await b.whenReady();
      type R = CoachFeedbackResult;
      const who = b.identity();
      const ctx = b.access();
      const entity = `${itemKind}:${itemId}`;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('coach.feedback', 'coach_feedback', entity, code, msg, role);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to give feedback to the coach');
      const role = ctx.actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', 'The learning coach is for staff');
      if (!COACH_KINDS.includes(itemKind) || !COACH_SIGNALS.includes(signal) || !itemId || !String(itemId).trim() || String(itemId).length > 200)
        return refuse('invalid', 'Unknown suggestion or feedback', role);
      const comps = (Array.isArray(competencyIds) ? competencyIds : []).filter((c) => typeof c === 'string' && c.length > 0 && c.length <= 40).slice(0, 12);
      const id = feedbackId(who.personId, itemKind, itemId);
      const hidden_until = signal === 'dismissed' ? addDaysIso(todayIso(), DISMISS_DAYS) : null;
      const row = { signal, competency_ids: comps, at: nowTs(), hidden_until };
      if (b.rawGet('coach_feedback', id)) b.rawUpdate('coach_feedback', id, row as never);
      else b.rawInsert('coach_feedback', { id, person_id: who.personId, item_kind: itemKind, item_id: itemId, ...row } as never);
      return h.done<R>('coach.feedback', 'coach_feedback', id, `${entity} ${signal}`, role, null, '', 'Feedback saved', { id, signal, hidden_until }, ['coach_feedback']);
    },
    async coachInsights() {
      await b.whenReady();
      type R = CoachInsights;
      const who = b.identity();
      const ctx = b.access();
      if (!who.personId) return h.refuse<R>('coach.insights', 'coach_feedback', null, 'not_signed_in', 'Sign in to see coach insights');
      const role = ctx.actingRole('skills_profile', ['Agg', 'A']);
      if (!role) return h.refuse<R>('coach.insights', 'coach_feedback', null, 'forbidden', 'Coach insights are for HR and the training manager (aggregates only)');
      const data = coachInsightsOf(b.raw('coach_feedback'), b.raw('learning_goals'), b.raw('people'));
      return { ok: true, code: 'ok', message: 'Coach insights', data };
    },
  };
}
