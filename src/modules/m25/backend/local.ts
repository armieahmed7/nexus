// M25 LocalBackend RPC implementations (owner: W4 · E1 · F25 Training effectiveness, F26 Training needs forecast).
// 1:1 mirror of supabase/migrations/20261009141001_kafaa_w4e1_effectiveness.sql: same checks in the same order, the same refusal
// codes and messages (MSG), the same audit and ledger rows. Rules: ../eff.ts and ../needs.ts. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { lineManagerOf, type AssignmentLite, type PersonLite } from '../../m20/domain';
import {
  completionsOf, l1Id, l1Open, l3Id, l3Status, l3Template, l3ToSchedule, l3WindowOpens, scorecard, validL3Items, validRatings, L1_ITEMS, type L3Item, type ScoreInput,
} from '../eff';
import {
  computeDemand, needsReport, periodsFrom, proposalDates, proposalSize, quarterBounds, quarterOfIso, sessionKindFor, type DemandInput,
} from '../needs';
import type { DemandReportResult, EffectivenessReport, L3Board, L3View, M25Rpc } from './rpc';

/** User-facing refusal messages (identical in the SQL functions). */
export const MSG = {
  not_signed_in: 'Sign in first',
  forbidden_l1: 'Only the learner can give feedback on their own course',
  completion_not_found: 'No completed course found for this feedback',
  no_survey: 'This course has no evaluation form',
  window_closed: 'Feedback closes 90 days after completion',
  duplicate_l1: 'You have already given feedback on this course completion',
  invalid_ratings: 'Rate every question from 1 to 5',
  forbidden_tm: 'Only the training manager can do this',
  forbidden_report: 'Training effectiveness results are for training staff, managers and HR, as aggregates only',
  forbidden_l3: 'Only the observer of record, the line manager or the training manager can record this observation',
  l3_not_found: 'Observation not found',
  l3_closed: 'This observation is already recorded or cancelled',
  too_early: 'The observation window opens 60 days after completion',
  invalid_items: 'Rate every checklist item (yes, partly, no or not applicable); notes up to 500 characters',
  course_not_found: 'Course not found',
  flag_note: 'Explain the redesign need in 10 to 500 characters',
  duplicate_flag: 'This course already has an open redesign flag',
  invalid_period: 'Choose the current quarter or one of the next three',
  forbidden_needs: 'The training needs forecast is for training staff, managers and HR',
  no_snapshot: 'Compute the demand for this quarter first',
  no_shortfall: 'Demand for this course is already covered by scheduled and draft sessions',
  proposal_not_found: 'Proposal not found',
  proposal_closed: 'Only draft proposals can change',
  session_mismatch: 'Pick a scheduled session of the same course in the proposal quarter',
} as const;

type Row = Record<string, any>;
const LA = 'learning_analytics';
const ok = <T>(message: string, data: T): Result<T> => ({ ok: true, code: 'ok', message, audit_seq: null, ledger_seq: null, data }) as Result<T>;

export function makeLocalM25(b: LocalBackend, h: LocalRpcHelpers): M25Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => b.raw(t as never) as unknown as Row[];
  const get = (t: string, id: string) => b.rawGet(t as never, id) as unknown as Row | undefined;
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const nameOf = (id: string | null | undefined) => { const p = id ? get('people', id) : undefined; return { en: p ? String(p.display_name ?? '') : '', ar: p ? String(p.display_name_ar || p.display_name || '') : '' }; };
  const lm = (pid: string) => lineManagerOf(pid, raw('people') as unknown as PersonLite[], raw('role_assignments') as unknown as AssignmentLite[], todayIso());
  const tmRole = () => ctx().actingRole(LA, ['A']);
  const comps = () => completionsOf(raw('training_records'), raw('enrolments'));
  const leavers = () => new Set(raw('people').filter((p) => p.status === 'leaver').map((p) => String(p.id)));
  const scoreInput = (): ScoreInput => ({
    courses: raw('courses'), surveys: raw('eval_surveys'), completions: comps(), responses: raw('eval_responses'), attempts: raw('attempts'),
    observations: raw('l3_observations'), kpis: raw('course_kpi_links'), flags: raw('redesign_flags'),
  });
  const demandInput = (): DemandInput => ({
    people: raw('people'), courses: raw('courses'), curriculum_rules: raw('curriculum_rules'), training_records: raw('training_records'), enrolments: raw('enrolments'),
    qual_records: raw('qual_records'), qual_standards: raw('qual_standards'), links: raw('needs_links'), roadmaps: raw('roadmaps'), coach_feedback: raw('coach_feedback'),
    future_interest: raw('future_interest'), future_resources: raw('future_resources'), klra_actions: raw('klra_actions'), klra_positions: raw('klra_positions'),
  });
  /** Insert one L3 observation (observer = line manager of record at scheduling time). */
  const scheduleOne = (id: string, c: { ref: string; person_id: string; course_id: string; completed_on: string }, dueOn: string) => {
    const course = get('courses', c.course_id) ?? {};
    const survey = raw('eval_surveys').find((s) => s.course_id === c.course_id);
    const tpl: L3Item[] = Array.isArray(survey?.l3_items) && survey!.l3_items.length ? survey!.l3_items : l3Template(course);
    ins('l3_observations', {
      id, person_id: c.person_id, course_id: c.course_id, completion_ref: c.ref, completed_on: c.completed_on, observer_person_id: lm(c.person_id), due_on: dueOn,
      items: tpl.map((i) => ({ key: i.key, competency_id: i.competency_id ?? null, en: i.en, ar: i.ar, rating: null })), status: 'scheduled', note: null,
      recorded_by: null, recorded_at: null, scheduled_at: nowTs(), open_read: false,
    });
  };
  const canObserve = (o: Row) => {
    const who = me();
    if (!who) return false;
    if (ctx().has(LA, ['A'])) return true;
    if (!ctx().has(LA, ['W'])) return false;
    return o.observer_person_id === who || lm(o.person_id) === who;
  };

  return {
    // ───────────────────────────── F25
    async submitL1(input) {
      await b.whenReady();
      type R = { id: string; l3_id: string | null };
      const ref = String(input?.completion_ref ?? '');
      const who = me();
      if (!who) return h.refuse<R>('eval.l1_submit', 'eval_responses', null, 'not_signed_in', MSG.not_signed_in);
      const role = ctx().actingRole(LA, ['Own']);
      if (!role) return h.refuse<R>('eval.l1_submit', 'eval_responses', null, 'forbidden', MSG.forbidden_l1);
      const c = comps().find((x) => x.ref === ref);
      if (!c || c.person_id !== who) return h.refuse<R>('eval.l1_submit', 'eval_responses', null, 'not_found', MSG.completion_not_found, role);
      const survey = raw('eval_surveys').find((s) => s.course_id === c.course_id && s.active !== false);
      if (!survey) return h.refuse<R>('eval.l1_submit', 'eval_responses', c.course_id, 'no_survey', MSG.no_survey, role);
      const today = todayIso();
      if (!l1Open(c, today)) return h.refuse<R>('eval.l1_submit', 'eval_responses', c.course_id, 'window_closed', MSG.window_closed, role);
      if (get('eval_responses', l1Id(ref))) return h.refuse<R>('eval.l1_submit', 'eval_responses', c.course_id, 'duplicate', MSG.duplicate_l1, role);
      if (!validRatings(input?.ratings) || typeof input?.recommend !== 'boolean') return h.refuse<R>('eval.l1_submit', 'eval_responses', c.course_id, 'invalid', MSG.invalid_ratings, role);
      ins('eval_responses', {
        id: l1Id(ref), course_id: c.course_id, person_id: who, completion_ref: ref, completed_on: c.completed_on,
        ratings: Object.fromEntries(L1_ITEMS.map((k) => [k, input.ratings[k]])), recommend: input.recommend, submitted_at: nowTs(), open_read: false,
      });
      let l3: string | null = null;
      const next = l3ToSchedule([c], raw('courses'), raw('eval_surveys'), new Set(raw('l3_observations').map((o) => o.id)), null, leavers());
      if (next.length) { scheduleOne(next[0].id, c, next[0].due_on); l3 = next[0].id; }
      return h.done<R>('eval.l1_submit', 'eval_responses', c.course_id, 'L1 reaction recorded', role, null, '', 'Thank you. Your feedback is anonymous to instructors and managers.', { id: l1Id(ref), l3_id: l3 }, ['eval_responses', 'l3_observations']);
    },

    async scheduleL3(courseId = null) {
      await b.whenReady();
      type R = { scheduled: number };
      if (!me()) return h.refuse<R>('eval.l3_schedule', 'l3_observations', courseId ?? null, 'not_signed_in', MSG.not_signed_in);
      const role = tmRole();
      if (!role) return h.refuse<R>('eval.l3_schedule', 'l3_observations', courseId ?? null, 'forbidden', MSG.forbidden_tm);
      if (courseId && !get('courses', courseId)) return h.refuse<R>('eval.l3_schedule', 'l3_observations', courseId, 'not_found', MSG.course_not_found, role);
      const next = l3ToSchedule(comps(), raw('courses'), raw('eval_surveys'), new Set(raw('l3_observations').map((o) => o.id)), courseId ?? null, leavers());
      for (const n of next) scheduleOne(n.id, n.c, n.due_on);
      return h.done<R>('eval.l3_schedule', 'l3_observations', courseId ?? 'all', `${next.length} scheduled`, role, null, '', next.length ? `${next.length} observations scheduled` : 'Every qualifying completion already has an observation', { scheduled: next.length }, ['l3_observations']);
    },

    async l3Board() {
      await b.whenReady();
      type R = L3Board;
      const who = me();
      if (!who) return h.refuse<R>('eval.l3_board', 'l3_observations', null, 'not_signed_in', MSG.not_signed_in);
      const all = ctx().has(LA, ['A', 'R']);
      if (!all && !ctx().has(LA, ['W'])) return h.refuse<R>('eval.l3_board', 'l3_observations', null, 'forbidden', MSG.forbidden_l3);
      const today = todayIso();
      const rows: L3View[] = raw('l3_observations')
        .filter((o) => all || o.observer_person_id === who || lm(o.person_id) === who)
        .map((o) => {
          const p = nameOf(o.person_id), ob = nameOf(o.observer_person_id);
          const view = l3Status({ status: o.status, due_on: String(o.due_on) }, today);
          return {
            id: o.id, person_id: o.person_id, person_name: p.en, person_name_ar: p.ar, course_id: o.course_id, completed_on: String(o.completed_on), due_on: String(o.due_on),
            opens_on: l3WindowOpens(String(o.due_on)), observer_person_id: o.observer_person_id ?? null, observer_name: ob.en, observer_name_ar: ob.ar, status: o.status, view,
            items: (o.items as L3Item[]) ?? [], note: o.note ?? null, recorded_at: o.recorded_at ?? null,
            can_record: o.status === 'scheduled' && canObserve(o) && l3WindowOpens(String(o.due_on)) <= today,
          };
        })
        .sort((a, c) => (a.due_on < c.due_on ? -1 : a.due_on > c.due_on ? 1 : a.id < c.id ? -1 : 1));
      return ok('L3 observations', { mode: all ? 'all' : 'mine', rows });
    },

    async recordL3(id, input) {
      await b.whenReady();
      type R = { id: string };
      if (!me()) return h.refuse<R>('eval.l3_record', 'l3_observations', id ?? null, 'not_signed_in', MSG.not_signed_in);
      const o = id ? get('l3_observations', id) : undefined;
      if (!o) return h.refuse<R>('eval.l3_record', 'l3_observations', id ?? null, 'not_found', MSG.l3_not_found);
      const role = ctx().has(LA, ['A']) ? tmRole() : ctx().actingRole(LA, ['W']);
      if (!canObserve(o)) return h.refuse<R>('eval.l3_record', 'l3_observations', id, 'forbidden', MSG.forbidden_l3, role);
      if (o.status !== 'scheduled') return h.refuse<R>('eval.l3_record', 'l3_observations', id, 'closed', MSG.l3_closed, role);
      if (l3WindowOpens(String(o.due_on)) > todayIso()) return h.refuse<R>('eval.l3_record', 'l3_observations', id, 'too_early', MSG.too_early, role);
      const tpl = (o.items as L3Item[]) ?? [];
      const note = typeof input?.note === 'string' ? input.note.trim() : '';
      if (!validL3Items(input?.items, tpl) || note.length > 500) return h.refuse<R>('eval.l3_record', 'l3_observations', id, 'invalid', MSG.invalid_items, role);
      const by = new Map(input.items.map((i) => [i.key, i.rating]));
      upd('l3_observations', id, { items: tpl.map((t) => ({ ...t, rating: by.get(t.key) })), status: 'done', note: note || null, recorded_by: me(), recorded_at: nowTs() });
      return h.done<R>('eval.l3_record', 'l3_observations', id, `L3 observation recorded (${o.course_id})`, role, 'kafaa.eval.l3_record', `L3 observation ${o.course_id}`, 'Observation recorded', { id }, ['l3_observations']);
    },

    async effectivenessReport(courseId = null) {
      await b.whenReady();
      type R = EffectivenessReport;
      if (!me()) return h.refuse<R>('eval.report', 'eval_responses', courseId ?? null, 'not_signed_in', MSG.not_signed_in);
      if (!ctx().has(LA, ['Agg', 'R', 'A'])) return h.refuse<R>('eval.report', 'eval_responses', courseId ?? null, 'forbidden', MSG.forbidden_report);
      if (courseId && !raw('eval_surveys').some((s) => s.course_id === courseId && s.active !== false)) return h.refuse<R>('eval.report', 'eval_responses', courseId, 'not_found', MSG.course_not_found);
      const today = todayIso();
      return ok('Training effectiveness', { as_of: today, min_group: 10, cards: scorecard(scoreInput(), today, courseId ?? null) });
    },

    async flagRedesign(courseId, note) {
      await b.whenReady();
      type R = { id: string };
      if (!me()) return h.refuse<R>('eval.redesign_flag', 'redesign_flags', courseId ?? null, 'not_signed_in', MSG.not_signed_in);
      const role = tmRole();
      if (!role) return h.refuse<R>('eval.redesign_flag', 'redesign_flags', courseId ?? null, 'forbidden', MSG.forbidden_tm);
      if (!courseId || !raw('eval_surveys').some((s) => s.course_id === courseId)) return h.refuse<R>('eval.redesign_flag', 'redesign_flags', courseId ?? null, 'not_found', MSG.course_not_found, role);
      const n = typeof note === 'string' ? note.trim() : '';
      if (n.length < 10 || n.length > 500) return h.refuse<R>('eval.redesign_flag', 'redesign_flags', courseId, 'invalid', MSG.flag_note, role);
      if (raw('redesign_flags').some((f) => f.course_id === courseId && f.status === 'open')) return h.refuse<R>('eval.redesign_flag', 'redesign_flags', courseId, 'duplicate', MSG.duplicate_flag, role);
      const card = scorecard(scoreInput(), todayIso(), courseId)[0];
      const id = `rf-${courseId}-${raw('redesign_flags').filter((f) => f.course_id === courseId).length + 1}`;
      const who = nameOf(me());
      ins('redesign_flags', { id, course_id: courseId, reasons: card ? card.reasons : [], note: n, status: 'open', raised_by: me(), raised_by_name: who.en, raised_at: nowTs(), sat_ref: null });
      return h.done<R>('eval.redesign_flag', 'redesign_flags', id, `redesign ${courseId}`, role, 'kafaa.eval.redesign_flag', `Course ${courseId} flagged for redesign`, 'Flagged for redesign; the SAT workbench picks it up', { id }, ['redesign_flags']);
    },

    // ───────────────────────────── F26
    async computeDemand(period) {
      await b.whenReady();
      type R = { period: string; rows: number; total: number };
      if (!me()) return h.refuse<R>('needs.compute', 'demand_snapshots', period ?? null, 'not_signed_in', MSG.not_signed_in);
      const role = tmRole();
      if (!role) return h.refuse<R>('needs.compute', 'demand_snapshots', period ?? null, 'forbidden', MSG.forbidden_tm);
      const today = todayIso();
      if (!periodsFrom(today).includes(period)) return h.refuse<R>('needs.compute', 'demand_snapshots', period ?? null, 'invalid', MSG.invalid_period, role);
      const rows = computeDemand(demandInput(), period, today);
      const at = nowTs();
      const fresh = new Set(rows.map((r) => r.id));
      for (const old of raw('demand_snapshots').filter((s) => s.period === period && !fresh.has(s.id)))
        upd('demand_snapshots', old.id, { count: 0, suppressed: true, detail: [], computed_at: at, computed_by: me() });
      for (const r of rows) {
        const patch = { period, course_id: r.course_id, source: r.source, count: r.count, suppressed: r.suppressed, detail: r.detail, computed_at: at, computed_by: me(), open_read: false };
        if (get('demand_snapshots', r.id)) upd('demand_snapshots', r.id, patch); else ins('demand_snapshots', { id: r.id, ...patch });
      }
      const total = rows.reduce((t, r) => t + r.count, 0);
      return h.done<R>('needs.compute', 'demand_snapshots', period, `${rows.length} cells, ${total} needs`, role, null, '', `Demand for ${period} recomputed`, { period, rows: rows.length, total }, ['demand_snapshots']);
    },

    async demandReport(period = null) {
      await b.whenReady();
      type R = DemandReportResult;
      if (!me()) return h.refuse<R>('needs.report', 'demand_snapshots', period ?? null, 'not_signed_in', MSG.not_signed_in);
      if (!ctx().has(LA, ['Agg', 'R', 'A'])) return h.refuse<R>('needs.report', 'demand_snapshots', period ?? null, 'forbidden', MSG.forbidden_needs);
      const today = todayIso();
      const periods = periodsFrom(today);
      const p = period || quarterOfIso(today);
      if (!periods.includes(p)) return h.refuse<R>('needs.report', 'demand_snapshots', p, 'invalid', MSG.invalid_period);
      const snaps = raw('demand_snapshots').filter((s) => s.period === p);
      const at = snaps.map((s) => String(s.computed_at)).sort().pop() ?? null;
      const exact = ctx().has(LA, ['R', 'A']);
      const rep = needsReport(snaps, { sessions: raw('sessions'), simulator_slots: raw('simulator_slots'), proposals: raw('session_proposals'), courses: raw('courses') }, p, exact, at);
      // W4 integration (F31 -> F26): instructor capacity is the qualified F31 pool (kafaa_instructor_tracks, status qualified).
      const instructors = new Set(raw('instructor_tracks').filter((x) => x.status === 'qualified').map((x) => x.person_id)).size;
      return ok('Training needs', { ...rep, periods, can_compute: ctx().has(LA, ['A']), instructors });
    },

    async proposeSessions(period, courseId, note = '') {
      await b.whenReady();
      type R = { id: string; sessions: number };
      if (!me()) return h.refuse<R>('needs.propose', 'session_proposals', courseId ?? null, 'not_signed_in', MSG.not_signed_in);
      const role = tmRole();
      if (!role) return h.refuse<R>('needs.propose', 'session_proposals', courseId ?? null, 'forbidden', MSG.forbidden_tm);
      const today = todayIso();
      if (!periodsFrom(today).includes(period)) return h.refuse<R>('needs.propose', 'session_proposals', courseId ?? null, 'invalid', MSG.invalid_period, role);
      const course = courseId ? get('courses', courseId) : undefined;
      if (!course) return h.refuse<R>('needs.propose', 'session_proposals', courseId ?? null, 'not_found', MSG.course_not_found, role);
      const snaps = raw('demand_snapshots').filter((s) => s.period === period);
      if (!snaps.length) return h.refuse<R>('needs.propose', 'session_proposals', courseId, 'no_snapshot', MSG.no_snapshot, role);
      const rep = needsReport(snaps, { sessions: raw('sessions'), simulator_slots: raw('simulator_slots'), proposals: raw('session_proposals'), courses: raw('courses') }, period, true);
      const row = rep.rows.find((r) => r.course_id === courseId);
      const size = proposalSize(row?.shortfall ?? 0, row?.draft_seats ?? 0, String(course.modality));
      if (!row || size.sessions <= 0) return h.refuse<R>('needs.propose', 'session_proposals', courseId, 'no_shortfall', MSG.no_shortfall, role);
      const id = `sp-${period.toLowerCase()}-${courseId}-${raw('session_proposals').filter((x) => x.course_id === courseId && x.period === period).length + 1}`;
      ins('session_proposals', {
        id, period, course_id: courseId, kind: sessionKindFor(String(course.modality)), sessions: size.sessions, seats_each: size.seats_each, dates: proposalDates(period, size.sessions),
        demand: row.total, shortfall: row.shortfall, status: 'draft', session_id: null, note: String(note ?? '').trim().slice(0, 500), created_by: me(), created_at: nowTs(), decided_by: null, decided_at: null,
      });
      return h.done<R>('needs.propose', 'session_proposals', id, `${size.sessions} x ${size.seats_each} seats`, role, null, '', `${size.sessions} draft sessions proposed; they are not published`, { id, sessions: size.sessions }, ['session_proposals']);
    },

    async withdrawProposal(id) {
      await b.whenReady();
      type R = { id: string };
      if (!me()) return h.refuse<R>('needs.withdraw', 'session_proposals', id ?? null, 'not_signed_in', MSG.not_signed_in);
      const role = tmRole();
      if (!role) return h.refuse<R>('needs.withdraw', 'session_proposals', id ?? null, 'forbidden', MSG.forbidden_tm);
      const p = id ? get('session_proposals', id) : undefined;
      if (!p) return h.refuse<R>('needs.withdraw', 'session_proposals', id ?? null, 'not_found', MSG.proposal_not_found, role);
      if (p.status !== 'draft') return h.refuse<R>('needs.withdraw', 'session_proposals', id, 'closed', MSG.proposal_closed, role);
      upd('session_proposals', id, { status: 'withdrawn', decided_by: me(), decided_at: nowTs() });
      return h.done<R>('needs.withdraw', 'session_proposals', id, 'withdrawn', role, null, '', 'Draft withdrawn', { id }, ['session_proposals']);
    },

    async linkProposal(id, sessionId) {
      await b.whenReady();
      type R = { id: string };
      if (!me()) return h.refuse<R>('needs.link', 'session_proposals', id ?? null, 'not_signed_in', MSG.not_signed_in);
      const role = tmRole();
      if (!role) return h.refuse<R>('needs.link', 'session_proposals', id ?? null, 'forbidden', MSG.forbidden_tm);
      const p = id ? get('session_proposals', id) : undefined;
      if (!p) return h.refuse<R>('needs.link', 'session_proposals', id ?? null, 'not_found', MSG.proposal_not_found, role);
      if (p.status !== 'draft') return h.refuse<R>('needs.link', 'session_proposals', id, 'closed', MSG.proposal_closed, role);
      const s = sessionId ? get('sessions', sessionId) : undefined;
      const qb = quarterBounds(String(p.period));
      if (!s || s.course_id !== p.course_id || s.status !== 'scheduled' || String(s.starts_at).slice(0, 10) < qb.start || String(s.starts_at).slice(0, 10) > qb.end)
        return h.refuse<R>('needs.link', 'session_proposals', id, 'invalid', MSG.session_mismatch, role);
      upd('session_proposals', id, { status: 'scheduled', session_id: sessionId, decided_by: me(), decided_at: nowTs() });
      return h.done<R>('needs.link', 'session_proposals', id, `scheduled as ${sessionId}`, role, null, '', 'Linked to the scheduled session', { id }, ['session_proposals']);
    },
  };
}
