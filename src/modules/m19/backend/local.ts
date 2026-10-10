// M19 LocalBackend RPC implementations (owner: W1 · E3, F07 Learning Coach). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261009113001_kafaa_w1e3_coach.sql (kafaa_coach_feedback, kafaa_coach_insights):
// same checks, refusal codes, audit rows and suppression. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { addDaysIso, coachInsightsOf, feedbackId } from '../insights';
import { todayIso } from '../../../domain/rules';
import { COACH_KINDS, COACH_SIGNALS, DISMISS_DAYS, type CoachFeedbackResult, type CoachInsights, type M19Rpc, type RefresherOutcome, type RefresherQuestion, type RefresherSet } from './rpc';
import { makeLocalFs17 } from './local.fs17'; // FS17/FS18 (FS wave C · E1)
import { MSG as RMSG, SET_SIZE, applyAnswer, competencyWeights, isPracticeItem, itemStatsOf, pickRefresher, stateId, type ItemLite, type RefreshCadence, type StateLite, type VersionLite } from '../refresh';

export function makeLocalM19(b: LocalBackend, h: LocalRpcHelpers): M19Rpc {
  return {
    ...makeLocalFs17(b, h), // FS17/FS18
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

    // ───────────── W2 · E3 · F14 knowledge refreshers (mirror of kafaa_next_refresher / kafaa_submit_refresher / kafaa_refresher_item_stats)
    async nextRefresher(extra = false) {
      await b.whenReady();
      type R = RefresherSet;
      const who = b.identity().personId;
      if (!who) return h.refuse<R>('refresher.next', 'refresh_state', null, 'not_signed_in', RMSG.not_signed_in);
      const role = b.access().actingRole('skills_profile', ['Own']);
      if (!role) return h.refuse<R>('refresher.next', 'refresh_state', null, 'forbidden', RMSG.forbidden);
      const today = todayIso();
      const items = b.raw('items') as unknown as ItemLite[];
      const states = (b.raw('refresh_state') as unknown as StateLite[]).filter((x) => x.person_id === who);
      const cadence = ((b.raw('refresh_prefs') as { person_id: string; cadence: string }[]).find((x) => x.person_id === who)?.cadence ?? 'weekly') as RefreshCadence;
      const person = b.rawGet('people', who);
      const weights = competencyWeights({
        comps: [...new Set(items.filter(isPracticeItem).map((i) => i.competency_id!))], roleId: person?.job_role_id ?? null, roleComps: b.raw('role_competencies'),
        quals: (b.raw('qual_records') as never[]).filter((q: { person_id: string }) => q.person_id === who), skills: b.raw('skills') as never, today,
      });
      const pick = pickRefresher({ items, states, weights, today, cadence, extra: !!extra });
      const vers = b.raw('item_versions') as unknown as VersionLite[];
      const byId = new Map(items.map((i) => [i.id, i]));
      const questions: RefresherQuestion[] = pick.picks.map((p) => {
        const it = byId.get(p.item_id)!;
        const v = vers.find((x) => x.item_id === it.id && x.version === (it.current_version ?? 1))!;
        return { ...p, version: v.version, topic: it.topic ?? '', difficulty: it.difficulty ?? 'medium', stem_en: v.stem_en, stem_ar: v.stem_ar, options: (v.options ?? []).map((o) => ({ id: String(o.id), en: String(o.en), ar: String(o.ar) })) };
      });
      const data: R = { served_on: today, cadence, window: pick.window, used: pick.used, limit: pick.limit, due_count: pick.due_count, new_count: pick.new_count, next_due_on: pick.next_due_on, items: questions };
      return { ok: true, code: 'ok', message: 'Refresher', data };
    },
    async submitRefresher(answers) {
      await b.whenReady();
      type R = RefresherOutcome;
      const who = b.identity().personId;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('refresher.submit', 'refresh_state', null, code, msg, role);
      if (!who) return refuse('not_signed_in', RMSG.not_signed_in);
      const role = b.access().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', RMSG.forbidden);
      const list = Array.isArray(answers) ? answers : [];
      if (list.length < 1 || list.length > SET_SIZE || new Set(list.map((a) => a?.item_id)).size !== list.length || list.some((a) => !a || typeof a.item_id !== 'string' || typeof a.answer !== 'string'))
        return refuse('invalid', RMSG.invalid, role);
      const items = new Map((b.raw('items') as unknown as ItemLite[]).map((i) => [i.id, i]));
      const vers = b.raw('item_versions') as unknown as VersionLite[];
      if (list.some((a) => !isPracticeItem(items.get(a.item_id)))) return refuse('not_practice', RMSG.not_practice, role);
      const ver = (id: string) => { const it = items.get(id)!; return vers.find((v) => v.item_id === id && v.version === (it.current_version ?? 1))!; };
      if (list.some((a) => !(ver(a.item_id)?.options ?? []).some((o) => String(o.id) === a.answer))) return refuse('invalid', RMSG.invalid, role);
      const today = todayIso();
      const ts = nowTs();
      const results = [...list].sort((x, y) => (x.item_id < y.item_id ? -1 : 1)).map((a) => {
        const it = items.get(a.item_id)!;
        const v = ver(a.item_id);
        const correct = a.answer === v.answer;
        const id = stateId(who, a.item_id);
        const prev = b.rawGet('refresh_state', id) as unknown as StateLite | undefined;
        const next = applyAnswer(prev, correct, today);
        const row = { box: next.box, due_on: next.due_on, last_result: next.last_result, last_at: ts, attempts: next.attempts, correct: next.correct };
        if (prev) b.rawUpdate('refresh_state', id, row as never);
        else b.rawInsert('refresh_state', { id, person_id: who, item_id: a.item_id, competency_id: it.competency_id, created_at: ts, ...row } as never);
        return { item_id: a.item_id, answer: a.answer, correct, key: v.answer, rationale_en: v.rationale_en ?? '', rationale_ar: v.rationale_ar ?? '', reference: it.reference ?? null, competency_id: it.competency_id!, box_before: next.box_before, box_after: next.box, due_on: next.due_on };
      });
      const n = results.filter((r) => r.correct).length;
      return h.done<R>('refresher.submit', 'refresh_state', null, `${results.length} answered, ${n} correct`, role, null, '', 'Answers checked', { results, correct: n, total: results.length }, ['refresh_state']);
    },
    async refresherItemStats() {
      await b.whenReady();
      type R = ReturnType<typeof itemStatsOf>;
      const who = b.identity().personId;
      if (!who) return h.refuse<R>('refresher.stats', 'refresh_state', null, 'not_signed_in', RMSG.not_signed_in);
      const roles = b.access().roles;
      if (!roles.includes('instructor') && !roles.includes('training_manager')) return h.refuse<R>('refresher.stats', 'refresh_state', null, 'forbidden', RMSG.stats_forbidden, b.access().actingRole('skills_profile', ['Own']));
      return { ok: true, code: 'ok', message: 'Refresher item statistics', data: itemStatsOf(b.raw('items') as unknown as ItemLite[], b.raw('refresh_state') as unknown as StateLite[]) };
    },
  };
}
