// FS81 LocalBackend RPCs (owner: FS wave I · E3, M30). Spread into makeLocalM30 (backend/local.ts). 1:1 mirror of
// supabase/migrations/20261010293001_kafaa_fs93_transition_plans.sql (kafaa_transition_plan_view, kafaa_transition_plans,
// kafaa_rung_alerts, kafaa_save_transition_plan, kafaa_review_transition_plan, kafaa_close_transition_plan,
// kafaa_acknowledge_transition_plan): the same checks in the same order, refusal codes and messages (TP_MSG), audit and ledger rows.
// Plans are visible to the person and to HR (transformation A) only; managers get nothing. Shared write, as in the SQL function:
// M14 notifications (kind `transition`, id `nt-tp-<plan>-r<revision>`). Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result, Table } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { bannedWording } from '../transform';
import {
  CLOSE_OUTCOMES, NOTE_MAX, REVIEW_MAX_GAP, REVIEW_OUTCOMES, REVIEW_WINDOW, STATUS_ORDER, TP_MSG, cleanPractice, cleanRetraining, daysFrom, doneReviews, isDate,
  nextReview, planAlert, planCandidates, planIdFor, planProblem, practiceProgress, previewOf, reviewState, roleRungAlerts,
  type CheckCtx, type OjtLogLite, type PlanRow, type ReviewEntry, type RungWorld,
} from '../transition';
import type { M30Rpc, SavePlanResult, TransitionPlanView } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Fs81Rpc = Pick<M30Rpc, 'transitionPlanView' | 'transitionPlans' | 'rungAlerts' | 'transitionCandidates' | 'previewTransitionPlan' | 'saveTransitionPlan' | 'reviewTransitionPlan' | 'closeTransitionPlan' | 'acknowledgeTransitionPlan'>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const day = (v: unknown) => (v == null ? null : String(v).slice(0, 10));

/** The rule world from the local tables (also used by tests and the seed builder through the same shape). */
export function rungWorldOf(raw: (t: string) => Row[]): RungWorld {
  return {
    roles: raw('job_roles') as never, maps: raw('role_transformations') as never, paths: raw('career_paths') as never, tasks: raw('jta_tasks') as never,
    levels: raw('ai_capability_levels') as never, taskSkills: raw('jta_task_skills') as never, skills: raw('skills') as never, scenarios: raw('sim_scenarios') as never,
  };
}
/** A stored plan with dates as YYYY-MM-DD (as SQL returns them in jsonb). */
export function planOf(r: Row): PlanRow {
  return {
    ...(r as PlanRow), protected_until: day(r.protected_until)!, start_on: day(r.start_on)!, end_on: day(r.end_on)!, next_review_on: day(r.next_review_on),
    reviews: (Array.isArray(r.reviews) ? r.reviews : []) as ReviewEntry[], retraining: Array.isArray(r.retraining) ? r.retraining : [], practice: Array.isArray(r.practice) ? r.practice : [],
    history: Array.isArray(r.history) ? r.history : [], revision: Number(r.revision ?? 1),
  };
}

export function makeLocalFs81(b: LocalBackend, h: LocalRpcHelpers): Fs81Rpc {
  const raw = (t: string) => (b.raw(t as Table) as unknown as Row[]) ?? [];
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as Table, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as Table, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as Table, id, patch as never);
  const me = () => b.identity().personId;
  const isHr = () => b.access().has('transformation', ['A']);
  const hrRole = () => b.access().actingRole('transformation', ['A']);
  const world = () => rungWorldOf(raw);
  const notify = (id: string, person: string, en: string, ar: string) => {
    if (!get('notifications', id)) ins('notifications', { id, person_id: person, kind: 'transition', title_en: en, title_ar: ar, body_en: null, body_ar: null, link: '/my/transition-plan', severity: 'info', created_at: nowTs(), read_at: null });
  };
  const view = (r: Row, w: RungWorld, logs: OjtLogLite[], today: string): TransitionPlanView => {
    const plan = planOf(r);
    const person = get('people', plan.person_id);
    const mine = plan.person_id === me();
    return {
      plan: { ...plan, person_name: String(person?.display_name ?? plan.person_id), person_name_ar: String(person?.display_name_ar ?? person?.display_name ?? plan.person_id) },
      alert: planAlert(plan, w), progress: practiceProgress(plan, logs), review_state: plan.status === 'active' ? reviewState(plan.next_review_on, today) : 'none',
      mine, can_decide: isHr() && !mine,
    };
  };
  const logsOf = () => raw('ojt_logs').map((l) => ({ person_id: l.person_id, task_id: l.task_id, status: l.status, on_date: day(l.on_date)! })) as OjtLogLite[];
  const order = (a: Row, c: Row) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[c.status] ?? 9) || String(day(a.next_review_on) ?? '9999').localeCompare(String(day(c.next_review_on) ?? '9999')) || (a.id < c.id ? -1 : a.id > c.id ? 1 : 0);
  const hist = (cur: Row | undefined, action: string, status: string, revision: number, extra: Row = {}) => [...(Array.isArray(cur?.history) ? cur!.history : []), { at: nowTs(), by: me(), action, status, revision, ...extra }];

  return {
    async transitionPlanView(planId = null) {
      await b.whenReady();
      const who = me();
      if (!who) return null;
      let r: Row | undefined;
      if (str(planId)) {
        r = get('transition_plans', str(planId));
        if (!r || (r.person_id !== who && !isHr())) return null;
      } else {
        r = raw('transition_plans').filter((x) => x.person_id === who).sort((a, c) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[c.status] ?? 9) || String(c.created_at).localeCompare(String(a.created_at)) || (a.id < c.id ? 1 : -1))[0];
        if (!r) return null;
      }
      return view(r, world(), logsOf(), todayIso());
    },

    async transitionPlans() {
      await b.whenReady();
      if (!me() || !isHr()) return null;
      const w = world(), logs = logsOf(), today = todayIso();
      return [...raw('transition_plans')].sort(order).map((r) => view(r, w, logs, today));
    },

    async rungAlerts(horizon = '2030') {
      await b.whenReady();
      if (!me() || !b.access().has('transformation', ['W', 'A', 'Agg'])) return null;
      return roleRungAlerts(horizon, world());
    },

    async transitionCandidates() {
      await b.whenReady();
      if (!me() || !isHr()) return null;
      return planCandidates(raw('people') as never, raw('job_roles') as never, raw('transition_plans') as never);
    },

    async previewTransitionPlan(input) {
      await b.whenReady();
      const who = me();
      if (!who || !isHr()) return null;
      const p = (input && typeof input === 'object' ? input : {}) as Row;
      const cur = str(p.plan_id) ? get('transition_plans', str(p.plan_id)) : undefined;
      return previewOf(p as never, cur ? planOf(cur) : null, { me: who, people: raw('people') as never, plans: raw('transition_plans').map(planOf), courseIds: raw('courses').map((c) => c.id as string), world: world() });
    },

    async saveTransitionPlan(input) {
      await b.whenReady();
      type R = SavePlanResult;
      const who = me();
      const p = (input && typeof input === 'object' ? input : {}) as Row;
      const pid = str(p.plan_id);
      if (!who) return h.refuse<R>('transition.save', 'transition_plans', pid || null, 'not_signed_in', TP_MSG.not_signed_in);
      const role = hrRole();
      if (!role) return h.refuse<R>('transition.save', 'transition_plans', pid || null, 'forbidden', TP_MSG.forbidden);
      const cur = pid ? get('transition_plans', pid) : undefined;
      if (pid && !cur) return h.refuse<R>('transition.save', 'transition_plans', pid, 'not_found', TP_MSG.not_found, role);
      if (cur && cur.status !== 'draft' && cur.status !== 'active') return h.refuse<R>('transition.save', 'transition_plans', pid, 'not_editable', TP_MSG.not_editable, role);
      const activate = p.activate === true || cur?.status === 'active';
      const ctx: CheckCtx = {
        me: who, people: raw('people') as never, plans: raw('transition_plans').map(planOf), courseIds: raw('courses').map((c) => c.id as string), world: world(),
      };
      const code = planProblem({ ...p, activate } as never, cur ? planOf(cur) : null, ctx);
      if (code) return h.refuse<R>('transition.save', 'transition_plans', pid || null, code, TP_MSG[code], role);
      const id = cur ? (cur.id as string) : planIdFor(str(p.person_id), raw('transition_plans') as never);
      const reviews: ReviewEntry[] = [...doneReviews(cur ? planOf(cur) : null), ...(p.review_dates as string[]).map((d) => ({ due_on: d, done_on: null, outcome: null, note: null, by: null }))];
      const status = activate ? 'active' : 'draft';
      const becomes = activate && cur?.status !== 'active';
      const revision = cur ? Number(cur.revision) + 1 : 1;
      const ts = nowTs();
      const person = get('people', str(p.person_id))!;
      const row = {
        protected_role_id: str(p.protected_role_id), protected_until: p.protected_until, target_role_id: str(p.target_role_id), horizon: p.horizon, trigger: p.trigger,
        start_on: p.start_on, end_on: p.end_on, reviews, next_review_on: nextReview(reviews), retraining: cleanRetraining(p.retraining), practice: cleanPractice(p.practice),
        note_en: str(p.note_en), note_ar: str(p.note_ar), status, revision, updated_by: who, updated_at: ts,
        history: hist(cur, cur ? (becomes ? 'activate' : 'update') : (becomes ? 'create_activate' : 'create'), status, revision),
        ...(becomes ? { activated_by: who, activated_at: ts } : {}),
      };
      if (cur) upd('transition_plans', id, row);
      else ins('transition_plans', { id, person_id: person.id, current_role_id: person.job_role_id ?? null, simulated: true, acknowledged_at: null, created_by: who, created_at: ts,
        activated_by: null, activated_at: null, closed_by: null, closed_at: null, close_note: null, ...row });
      if (becomes) notify(`nt-tp-${id}-r${revision}`, person.id, `Your transition plan is active: next review on ${row.next_review_on}`, `أصبحت خطة الانتقال الخاصة بك نافذة: المراجعة التالية في ${row.next_review_on}`);
      const n = planAlert({ ...row }, ctx.world);
      return h.done<R>(becomes ? 'transition.activate' : 'transition.save', 'transition_plans', id,
        `${status} r${revision}, ${reviews.length} reviews, ${row.retraining.length} retraining steps, ${row.practice.length} practice items, ${n.tasks.length} rung tasks`, role,
        becomes ? 'kafaa.transition.activate' : null, `${id} transition plan activated (SIMULATED HR record)`,
        becomes ? 'Transition plan activated; the person is notified' : 'Transition plan saved', { id, status, revision, next_review_on: row.next_review_on }, ['transition_plans', 'notifications']);
    },

    async reviewTransitionPlan(input) {
      await b.whenReady();
      type R = { id: string; next_review_on: string | null };
      const who = me();
      const p = (input && typeof input === 'object' ? input : {}) as Row;
      const pid = str(p.plan_id);
      if (!who) return h.refuse<R>('transition.review', 'transition_plans', pid || null, 'not_signed_in', TP_MSG.not_signed_in);
      const role = hrRole();
      if (!role) return h.refuse<R>('transition.review', 'transition_plans', pid || null, 'forbidden', TP_MSG.forbidden);
      const cur = get('transition_plans', pid);
      if (!cur) return h.refuse<R>('transition.review', 'transition_plans', pid || null, 'not_found', TP_MSG.not_found, role);
      if (cur.person_id === who) return h.refuse<R>('transition.review', 'transition_plans', pid, 'self_plan', TP_MSG.self_plan, role);
      if (cur.status !== 'active') return h.refuse<R>('transition.review', 'transition_plans', pid, 'not_active', TP_MSG.not_active, role);
      const plan = planOf(cur);
      const today = todayIso();
      const idx = plan.reviews.findIndex((x) => !x.done_on);
      if (idx < 0 || daysFrom(today, plan.reviews[idx].due_on) > REVIEW_WINDOW) return h.refuse<R>('transition.review', 'transition_plans', pid, 'no_review_due', TP_MSG.no_review_due, role);
      const nx = p.next_review_on ?? null;
      const last = plan.reviews[plan.reviews.length - 1].due_on;
      const left = plan.reviews.length - idx - 1;
      const note = p.note == null ? '' : p.note;
      if (!(REVIEW_OUTCOMES as readonly unknown[]).includes(p.outcome) || typeof note !== 'string' || note.trim().length > NOTE_MAX
        || (nx !== null && (!isDate(nx) || daysFrom(today, nx) <= 0 || daysFrom(today, nx) > REVIEW_MAX_GAP || daysFrom(last, nx) <= 0 || daysFrom(nx, plan.end_on) < 0))
        || (left === 0 && nx === null)) return h.refuse<R>('transition.review', 'transition_plans', pid, 'invalid_outcome', TP_MSG.invalid_outcome, role);
      if (bannedWording(note) !== null) return h.refuse<R>('transition.review', 'transition_plans', pid, 'banned_wording', TP_MSG.banned_wording, role);
      const reviews = plan.reviews.map((x, i) => (i === idx ? { due_on: x.due_on, done_on: today, outcome: p.outcome as string, note: note.trim() || null, by: who } : x));
      if (nx) reviews.push({ due_on: nx, done_on: null, outcome: null, note: null, by: null });
      const revision = plan.revision + 1;
      const next = nextReview(reviews);
      upd('transition_plans', pid, { reviews, next_review_on: next, revision, updated_by: who, updated_at: nowTs(), history: hist(cur, 'review', 'active', revision, { outcome: p.outcome }) });
      return h.done<R>('transition.review', 'transition_plans', pid, `review ${plan.reviews[idx].due_on} ${p.outcome}, next ${next ?? 'none'}`, role, null, '', 'Review recorded', { id: pid, next_review_on: next }, ['transition_plans']);
    },

    async closeTransitionPlan(input) {
      await b.whenReady();
      type R = { id: string; status: 'completed' | 'withdrawn' };
      const who = me();
      const p = (input && typeof input === 'object' ? input : {}) as Row;
      const pid = str(p.plan_id);
      if (!who) return h.refuse<R>('transition.close', 'transition_plans', pid || null, 'not_signed_in', TP_MSG.not_signed_in);
      const role = hrRole();
      if (!role) return h.refuse<R>('transition.close', 'transition_plans', pid || null, 'forbidden', TP_MSG.forbidden);
      const cur = get('transition_plans', pid);
      if (!cur) return h.refuse<R>('transition.close', 'transition_plans', pid || null, 'not_found', TP_MSG.not_found, role);
      if (cur.person_id === who) return h.refuse<R>('transition.close', 'transition_plans', pid, 'self_plan', TP_MSG.self_plan, role);
      const note = str(p.note);
      if (!(CLOSE_OUTCOMES as readonly unknown[]).includes(p.outcome) || note.length < 5 || note.length > NOTE_MAX) return h.refuse<R>('transition.close', 'transition_plans', pid, 'invalid_close', TP_MSG.invalid_close, role);
      if (!(cur.status === 'active' || (cur.status === 'draft' && p.outcome === 'withdrawn'))) return h.refuse<R>('transition.close', 'transition_plans', pid, 'not_active', TP_MSG.not_active, role);
      if (bannedWording(note) !== null) return h.refuse<R>('transition.close', 'transition_plans', pid, 'banned_wording', TP_MSG.banned_wording, role);
      const status = p.outcome as 'completed' | 'withdrawn';
      const revision = Number(cur.revision) + 1;
      upd('transition_plans', pid, { status, next_review_on: null, closed_by: who, closed_at: nowTs(), close_note: note, revision, updated_by: who, updated_at: nowTs(), history: hist(cur, status === 'completed' ? 'complete' : 'withdraw', status, revision) });
      notify(`nt-tp-${pid}-r${revision}`, cur.person_id, status === 'completed' ? 'Your transition plan is complete' : 'Your transition plan was withdrawn', status === 'completed' ? 'اكتملت خطة الانتقال الخاصة بك' : 'سُحبت خطة الانتقال الخاصة بك');
      return h.done<R>(status === 'completed' ? 'transition.complete' : 'transition.withdraw', 'transition_plans', pid, `${status} r${revision}`, role, 'kafaa.transition.close',
        `${pid} transition plan ${status} (SIMULATED HR record)`, status === 'completed' ? 'Transition plan completed' : 'Transition plan withdrawn', { id: pid, status }, ['transition_plans', 'notifications']);
    },

    async acknowledgeTransitionPlan(planId) {
      await b.whenReady();
      type R = { id: string; acknowledged_at: string };
      const who = me();
      const pid = str(planId);
      if (!who) return h.refuse<R>('transition.acknowledge', 'transition_plans', pid || null, 'not_signed_in', TP_MSG.not_signed_in);
      const cur = get('transition_plans', pid);
      if (!cur || cur.person_id !== who) return h.refuse<R>('transition.acknowledge', 'transition_plans', pid || null, 'not_found', TP_MSG.not_found);
      if (cur.status !== 'active') return h.refuse<R>('transition.acknowledge', 'transition_plans', pid, 'not_active', TP_MSG.not_active);
      if (cur.acknowledged_at) return h.refuse<R>('transition.acknowledge', 'transition_plans', pid, 'already', TP_MSG.already);
      const ts = nowTs();
      upd('transition_plans', pid, { acknowledged_at: ts, history: hist(cur, 'acknowledge', 'active', Number(cur.revision)) });
      return h.done<R>('transition.acknowledge', 'transition_plans', pid, 'acknowledged by the person', null, null, '', 'Plan acknowledged', { id: pid, acknowledged_at: ts }, ['transition_plans']);
    },
  };
}
