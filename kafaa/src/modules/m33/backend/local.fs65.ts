// FS58 Adaptive problem-solving practice + FS59 Role-play practice library: LocalBackend RPCs (FS wave F · E5), spread into makeLocalM33.
// 1:1 mirror of supabase/migrations/20261010265001_kafaa_fs65_aps_roleplay.sql: the same checks in the same order, the same refusal codes
// and messages (APS_MSG, RP_MSG), the same audit rows, ledger rows and F01 evidence rows. Pages never import this file.
// FS58 never writes skill evidence and never reaches the ledger (practice, never a qualification gate).
// FS59 keeps the rubric ticks, never the answer text. A speak-up topic returns `speak_up` before anything is written (no session change,
// no audit row): the page routes the person to /speak-up. Shared writes (like the SQL SECURITY DEFINER functions): F01 skill_evidence
// `se:roleplay:<session>:<skill>` (kind rating, basis validated, ref_table roleplay_sessions, level 1-2) + applySkills for the person after a
// named reviewer validates; M14 notifications (kind roleplay, `nt-rp-*`).
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { applySkills } from '../../../data/local/rpc.w0';
import { hasContactDetails, postGuard } from '../../m22/domain';
import {
  apsScenarioProblem, apsStats, changeCount, judgeStage, nextReasons, normPicks, personSeed, pickScenario, quarterOf, responseOf, scoreAps, stageView,
  type ApsResponse, type ApsScenario, type ApsScenarioInput,
} from '../aps';
import {
  MAX_ANSWER, MIN_ANSWER, eligibleReviewers, evaluateTurn, evidenceId, evidenceSkills, rpScenarioProblem, rpStats, speakUpTopic, summarise,
  type RpScenario, type RpScenarioInput, type SkillLite, type TurnResult,
} from '../roleplay';
import type { ApsCatalogItem, ApsContext, ApsHeader, ApsResult, ApsStep, M33Rpc, RpContext, RpQueueItem, RpReviewer, RpStep } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, '0')).join('');
const str = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
const byStartedDesc = (x: Row, y: Row) => (String(x.started_at) < String(y.started_at) ? 1 : String(x.started_at) > String(y.started_at) ? -1 : 0);

/** User-facing refusal messages (identical in SQL). */
export const APS_MSG = {
  not_signed_in: 'Sign in to practise adaptive problem solving',
  forbidden: 'Problem-solving practice is for ENEC staff',
  forbidden_bank: 'Only the training manager edits the scenario bank',
  not_published: 'Scenario not found or not published',
  unavailable: 'No published scenarios yet; ask the training manager',
  not_found: 'Practice run not found',
  done_already: 'This practice run is already complete',
  not_current: 'Answer the stage on screen first',
  bad_choice: 'Choose one of the options',
  bad_picks: 'Pick facts from the list shown',
  scenario_not_found: 'Scenario not found',
  invalid: 'Check the scenario: ',
  conflict: 'Keep at least three published scenarios',
} as const;
export const APS_PROBLEM_TEXT: Record<string, string> = {
  code: 'a code like APS-OS-001', theme: 'a known theme', text: 'title, summary and context in English and Arabic', core_skill: 'one to three core skills',
  skills: 'one to four catalogue skills', difficulty: 'difficulty 1 to 3', minutes: '5 to 30 minutes', stages: 'two to four stages',
  first_stage: 'the first stage sets the plan (stage ids a-z, 0-9, -)', no_change: 'every later stage is a mid-task change, and there is at least one',
  stage_text: 'every stage needs its situation, question and debrief in English and Arabic', options: 'three or four options with a why in both languages',
  key: 'rate every option 0-3 with exactly one best (3)', keep: 'only a change stage may mark one option as keeping the plan',
  cues: 'facts to judge: none, or three to five with at least one that matters and one that does not', restricted: 'scenarios never touch plant security',
  status: 'status draft, published or retired',
};
export const RP_MSG = {
  not_signed_in: 'Sign in to practise role-play',
  forbidden: 'Role-play practice is for ENEC staff',
  not_published: 'Scenario not found or not published',
  not_found: 'Session not found',
  done_already: 'This session is already complete',
  not_current: 'Answer the turn on screen first',
  length: 'Write between 3 and 2,000 characters',
  speak_up: 'This sounds like a real concern, not practice. Use the speak-up channels; nothing you typed was stored.',
  restricted: 'Practice answers never touch plant security, safeguards or cyber details; nothing was stored',
  not_complete: 'Finish the session before asking for a review',
  below_mark: 'This session is below the scenario\'s mark; practise again before asking for a review',
  review_open: 'A review is already requested or decided for this session',
  reviewer: 'Choose a reviewer from the list: an instructor, the training manager or the HR authority, never yourself',
  context: 'Tell the reviewer the practice context in 5 to 400 characters',
  contact: 'Remove email addresses and phone numbers',
  not_requested: 'No review is waiting for this session',
  forbidden_review: 'Only instructors, the training manager and the HR authority validate role-play feedback',
  not_reviewer: 'Only the reviewer this session was sent to can decide it',
  self: 'You cannot validate your own session',
  decision: 'Choose validate or decline; a decline needs a reason of 5 to 300 characters',
  no_skills: 'This scenario names no skill that can carry evidence',
  forbidden_bank: 'Only the training manager edits the role-play library',
  scenario_not_found: 'Scenario not found',
  invalid: 'Check the scenario: ',
  conflict: 'Keep at least three published scenarios',
} as const;
export const RP_PROBLEM_TEXT: Record<string, string> = {
  code: 'a code like RP-PB-01', kind: 'a known kind', text: 'title, summary, setting, counterpart and your role in English and Arabic', core_skill: 'one to three core skills',
  skills: 'one to four catalogue skills that can carry evidence', level: 'evidence level 1 or 2', pass_pct: 'a mark between 50 and 90%', minutes: '5 to 40 minutes',
  rubric: 'three to eight criteria with distinct ids', criterion: 'every criterion needs a label, what it looks for and a tip in English and Arabic',
  check: 'every criterion needs a valid check (cue words, length, a question or a number)', turns: 'three to five turns with distinct ids',
  turn: 'every turn needs the counterpart\'s line, a hint and an example answer in English and Arabic', turn_criteria: 'every turn checks one to five known criteria',
  unused: 'every criterion is checked by at least one turn', restricted: 'scenarios never touch plant security', status: 'status draft, published or retired',
};

type Fs65Keys = 'startAps' | 'submitAps' | 'apsContext' | 'apsStats' | 'saveApsScenario' | 'startRoleplay' | 'roleplayTurn' | 'roleplayContext' | 'roleplayReviewers'
  | 'requestRoleplayReview' | 'withdrawRoleplayReview' | 'roleplayReviewQueue' | 'attachRoleplayEvidence' | 'roleplayStats' | 'saveRoleplayScenario';

export function makeLocalFs65(b: LocalBackend, h: LocalRpcHelpers): Pick<M33Rpc, Fs65Keys> {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const today = () => todayIso();
  const scenarios = () => raw('aps_scenarios').map((s) => ({ ...s, sort: Number(s.sort) })) as unknown as (ApsScenario & Row)[];
  const rpScenarios = () => raw('roleplay_scenarios').map((s) => ({ ...s, sort: Number(s.sort) })) as unknown as (RpScenario & Row)[];
  const coreIds = () => raw('core_skills').filter((c) => (c.status ?? 'active') === 'active').map((c) => c.id as string);
  const skillMap = () => new Map<string, SkillLite>(raw('skills').map((s) => [s.id, { id: s.id, area: s.area ?? null, lifecycle: s.lifecycle ?? null, fs_area: s.fs_area ?? null }]));
  const policies = () => raw('refusal_policies').map((p) => ({ category: p.category, patterns: p.patterns ?? [], enabled: p.enabled }));
  const person = (id: string | null | undefined) => get('people', id);
  const notify = (id: string, pid: string | null | undefined, en: string, ar: string, link: string, severity = 'info') => {
    if (!pid || !person(pid) || get('notifications', id)) return;
    ins('notifications', { id, person_id: pid, kind: 'roleplay', title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
  };
  /** A business refusal that writes nothing at all (speak-up topics: no audit row, no session change). */
  const quiet = <T,>(): Result<T> => ({ ok: false, code: 'speak_up', message: RP_MSG.speak_up, audit_seq: null, ledger_seq: null, data: { route: '/speak-up' } as unknown as T });

  // ───────────── FS58 helpers
  const header = (s: ApsScenario): ApsHeader => ({
    id: s.id, code: s.code, theme: s.theme, title_en: s.title_en, title_ar: s.title_ar, context_en: s.context_en, context_ar: s.context_ar,
    difficulty: Number(s.difficulty), est_minutes: Number(s.est_minutes), stages: s.stages.length, changes: changeCount(s),
  });
  const resultOf = (a: Row): ApsResult => ({
    attempt_id: a.id, scenario_id: a.scenario_id, period: a.period, points: Number(a.points), max_points: Number(a.max_points), score: Number(a.score), band: a.band,
    dims: a.dims, reasons: a.reasons ?? [], stages: (a.responses ?? []).length,
  });
  const apsStatsNow = () => apsStats(raw('aps_attempts') as never, raw('people') as never, scenarios(), today(), MIN_GROUP_SIZE);
  const stageOf = (s: ApsScenario | undefined, id: string | undefined) => (s && id ? s.stages.find((x) => x.id === id) : undefined);

  // ───────────── FS59 helpers
  const reviewersFor = (pid: string | null) => eligibleReviewers(raw('people') as never, raw('role_assignments') as never, pid);
  const nameOf = (id: string | null | undefined) => { const p = person(id); return { en: p?.display_name ?? '', ar: p?.display_name_ar || p?.display_name || '' }; };
  const roleOf = (id: string) => {
    const roles = raw('role_assignments').filter((a) => a.person_id === id && a.status === 'active').map((a) => a.role as string);
    return ['hr_director', 'training_manager', 'instructor'].find((r) => roles.includes(r)) ?? '';
  };
  const rpResultOf = (s: Row): RpStep['result'] => ({
    session_id: s.id, scenario_id: s.scenario_id, passed: Number(s.passed), total: Number(s.total), pct: Number(s.pct), ready: !!s.ready, reasons: s.reasons ?? [], turns: s.turns ?? [],
  });
  const queueItem = (s: Row): RpQueueItem => {
    const sc = get('roleplay_scenarios', s.scenario_id);
    const n = nameOf(s.person_id);
    return {
      session_id: s.id, person_id: s.person_id, person_name: n.en, person_name_ar: n.ar, scenario_id: s.scenario_id, code: sc?.code ?? '', kind: sc?.kind ?? '',
      title_en: sc?.title_en ?? '', title_ar: sc?.title_ar ?? '', level: Number(sc?.level ?? 1), pass_pct: Number(sc?.pass_pct ?? 70), passed: Number(s.passed ?? 0),
      total: Number(s.total ?? 0), pct: Number(s.pct ?? 0), turns: s.turns ?? [], rubric: sc?.rubric ?? [], completed_at: s.completed_at ?? null, requested_at: s.requested_at ?? null,
      review_context: s.review_context ?? null, review_status: s.review_status, reviewed_at: s.reviewed_at ?? null, review_note: s.review_note ?? null,
      skills: sc ? evidenceSkills(sc.skill_ids ?? [], skillMap()) : [], evidence_ids: s.evidence_ids ?? [],
    };
  };

  return {
    // ═════════════ FS58
    async startAps(input) {
      await b.whenReady();
      type R = ApsStep;
      const pid = me();
      const sidIn = typeof input?.scenario_id === 'string' && input.scenario_id ? input.scenario_id : null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('aps.start', 'aps_attempts', null, code, msg, role);
      if (!pid) return refuse('not_signed_in', APS_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', APS_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const mine = raw('aps_attempts').filter((a) => a.person_id === pid);
      const open = mine.filter((a) => a.status === 'in_progress').sort(byStartedDesc)[0];
      if (open && (!sidIn || open.scenario_id === sidIn)) {
        const sc = get('aps_scenarios', open.scenario_id) as ApsScenario | undefined;
        const n = (open.responses ?? []).length;
        if (sc) {
          return h.done<R>('aps.start', 'aps_attempts', open.id, 'resumed', role, null, '', 'Practice resumed',
            { attempt_id: open.id, scenario: header(sc), done: false, answered: n, total: (open.stage_ids ?? []).length, stage: (() => { const st = stageOf(sc, open.stage_ids[n]); return st ? stageView(st) : null; })(), feedback: null, result: null, resumed: true }, ['aps_attempts']);
        }
      }
      const pub = scenarios().filter((s) => s.status === 'published');
      let sid = sidIn;
      if (sid && !pub.some((s) => s.id === sid)) return refuse('not_found', APS_MSG.not_published, role);
      if (open) upd('aps_attempts', open.id, { status: 'abandoned' });
      const attemptNo = mine.length + 1;
      if (!sid) {
        const done = new Map<string, number>();
        for (const a of mine) if (a.status === 'completed') done.set(a.scenario_id, (done.get(a.scenario_id) ?? 0) + 1);
        sid = pickScenario(pub, done, attemptNo, personSeed(pid));
      }
      if (!sid) return refuse('unavailable', APS_MSG.unavailable, role);
      const sc = get('aps_scenarios', sid) as ApsScenario;
      const id = `aps-a-${hex(8)}`;
      ins('aps_attempts', {
        id, person_id: pid, scenario_id: sid, scenario_version: Number(sc.version ?? 1), attempt_no: attemptNo, period: quarterOf(today()), status: 'in_progress',
        stage_ids: sc.stages.map((s) => s.id), responses: [], points: null, max_points: null, score: null, band: null, dims: {}, reasons: [], started_at: nowTs(), completed_at: null,
      });
      return h.done<R>('aps.start', 'aps_attempts', id, sid, role, null, '', 'Practice started',
        { attempt_id: id, scenario: header(sc), done: false, answered: 0, total: sc.stages.length, stage: stageView(sc.stages[0]), feedback: null, result: null, resumed: false }, ['aps_attempts']);
    },

    async submitAps(input) {
      await b.whenReady();
      type R = ApsStep;
      const pid = me();
      const aid = typeof input?.attempt_id === 'string' ? input.attempt_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('aps.answer', 'aps_attempts', aid || null, code, msg, role);
      if (!pid) return refuse('not_signed_in', APS_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', APS_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const a = get('aps_attempts', aid);
      if (!a || a.person_id !== pid) return refuse('not_found', APS_MSG.not_found, role);
      if (a.status !== 'in_progress') return refuse('invalid', APS_MSG.done_already, role);
      const prev: ApsResponse[] = a.responses ?? [];
      const current = (a.stage_ids ?? [])[prev.length];
      if (!input?.stage_id || input.stage_id !== current) return refuse('invalid', APS_MSG.not_current, role);
      const sc = get('aps_scenarios', a.scenario_id) as ApsScenario | undefined;
      const st = stageOf(sc, current);
      if (!sc || !st) return refuse('not_found', APS_MSG.scenario_not_found, role);
      const choice = input?.choice;
      if (typeof choice !== 'number' || !Number.isInteger(choice) || choice < 0 || choice >= st.options.length) return refuse('invalid', APS_MSG.bad_choice, role);
      const picks = normPicks(input?.picks, (st.cues ?? []).length);
      if (!picks) return refuse('invalid', APS_MSG.bad_picks, role);
      const fb = judgeStage(st, choice, picks);
      const responses = [...prev, responseOf(fb)];
      const next = (a.stage_ids ?? [])[responses.length];
      if (next) {
        upd('aps_attempts', aid, { responses });
        const nx = stageOf(sc, next);
        return h.done<R>('aps.answer', 'aps_attempts', aid, `${responses.length}`, role, null, '', 'Answer recorded',
          { attempt_id: aid, scenario: header(sc), done: false, answered: responses.length, total: (a.stage_ids ?? []).length, stage: nx ? stageView(nx) : null, feedback: fb, result: null }, ['aps_attempts']);
      }
      const s = scoreAps(responses);
      upd('aps_attempts', aid, { responses, status: 'completed', completed_at: nowTs(), points: s.points, max_points: s.max_points, score: s.score, band: s.band, dims: s.dims, reasons: s.reasons });
      return h.done<R>('aps.complete', 'aps_attempts', aid, `${s.score}`, role, null, '', 'Practice complete',
        { attempt_id: aid, scenario: header(sc), done: true, answered: responses.length, total: (a.stage_ids ?? []).length, stage: null, feedback: fb, result: resultOf(get('aps_attempts', aid)!) }, ['aps_attempts']);
    },

    async apsContext() {
      await b.whenReady();
      const pid = me();
      if (!pid || !ctx().has('skills_profile', ['Own'])) return null;
      const mine = raw('aps_attempts').filter((a) => a.person_id === pid);
      const open = mine.filter((a) => a.status === 'in_progress').sort(byStartedDesc)[0];
      const done = mine.filter((a) => a.status === 'completed').sort((x, y) => (String(x.completed_at) < String(y.completed_at) ? -1 : String(x.completed_at) > String(y.completed_at) ? 1 : 0));
      const pub = scenarios().filter((s) => s.status === 'published').sort((x, y) => x.sort - y.sort || (x.id < y.id ? -1 : 1));
      const items: ApsCatalogItem[] = pub.map((s) => {
        const xs = done.filter((a) => a.scenario_id === s.id);
        return {
          ...header(s), summary_en: s.summary_en, summary_ar: s.summary_ar, core_skill_ids: [...s.core_skill_ids], skill_ids: [...s.skill_ids],
          mine: xs.length, best: xs.length ? Math.max(...xs.map((a) => Number(a.score))) : null, last: xs.length ? Number(xs[xs.length - 1].score) : null,
        };
      });
      const counts = new Map<string, number>();
      for (const a of done) counts.set(a.scenario_id, (counts.get(a.scenario_id) ?? 0) + 1);
      const nid = pickScenario(pub, counts, mine.length + 1, personSeed(pid));
      const st = apsStatsNow();
      const nsc = nid ? pub.find((s) => s.id === nid) : undefined;
      const out: ApsContext = {
        period: quarterOf(today()), in_progress: open ? { attempt_id: open.id, scenario_id: open.scenario_id } : null, scenarios: items, completed: done.length,
        enec_avg: st.avg, enec_n: st.avg == null ? null : st.participants, next: nsc ? { scenario_id: nsc.id, reasons: nextReasons(nsc, counts.get(nsc.id) ?? 0) } : null,
      };
      return out;
    },

    async apsStats() {
      await b.whenReady();
      if (!me() || !ctx().has('skills_profile', ['Agg'])) return null;
      return apsStatsNow();
    },

    async saveApsScenario(input: ApsScenarioInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string };
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('aps.scenario', 'aps_scenarios', given, code, msg, role);
      if (!me()) return refuse('not_signed_in', APS_MSG.not_signed_in);
      if (!ctx().has('secure_items', ['A'])) return refuse('forbidden', APS_MSG.forbidden_bank);
      const role = ctx().actingRole('secure_items', ['A']);
      const cur = given ? get('aps_scenarios', given) : undefined;
      if (given && !cur) return refuse('not_found', APS_MSG.scenario_not_found, role);
      const problem = apsScenarioProblem(input, { coreSkillIds: coreIds(), skillIds: raw('skills').filter((s) => s.lifecycle !== 'obsolete').map((s) => s.id) });
      if (problem) return refuse('invalid', APS_MSG.invalid + APS_PROBLEM_TEXT[problem], role);
      if (raw('aps_scenarios').some((s) => s.code === input.code && s.id !== cur?.id)) return refuse('conflict', 'Another scenario already uses this code', role);
      const status = input.status === 'published' || input.status === 'retired' ? input.status : 'draft';
      if (cur && cur.status === 'published' && status !== 'published' && raw('aps_scenarios').filter((s) => s.status === 'published' && s.id !== cur.id).length < 3) return refuse('conflict', APS_MSG.conflict, role);
      const s = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
      const stages = input.stages.map((st) => ({
        id: st.id, kind: st.kind, info_en: s(st.info_en), info_ar: s(st.info_ar), question_en: s(st.question_en), question_ar: s(st.question_ar),
        options: st.options.map((o) => ({ en: s(o.en), ar: s(o.ar), eff: Number(o.eff), note_en: s(o.note_en), note_ar: s(o.note_ar), ...(o.keep ? { keep: true } : {}) })),
        cues: (st.cues ?? []).map((c) => ({ en: s(c.en), ar: s(c.ar), relevant: !!c.relevant })), debrief_en: s(st.debrief_en), debrief_ar: s(st.debrief_ar),
      }));
      const patch = {
        code: input.code, theme: input.theme, title_en: s(input.title_en), title_ar: s(input.title_ar), summary_en: s(input.summary_en), summary_ar: s(input.summary_ar),
        context_en: s(input.context_en), context_ar: s(input.context_ar), core_skill_ids: [...input.core_skill_ids], skill_ids: [...input.skill_ids], difficulty: input.difficulty,
        est_minutes: input.est_minutes, stages, status, updated_by: me(), updated_at: nowTs(),
      };
      let id: string;
      let version: number;
      if (cur) {
        id = cur.id;
        version = Number(cur.version) + 1;
        upd('aps_scenarios', id, { ...patch, version });
      } else {
        id = `aps-${input.code.toLowerCase()}-${hex(3)}`;
        version = 1;
        const sort = raw('aps_scenarios').reduce((m, x) => Math.max(m, Number(x.sort)), 0) + 1;
        ins('aps_scenarios', { id, ...patch, sources: [], version, sort });
      }
      return h.done<R>('aps.scenario', 'aps_scenarios', id, `v${version} ${status}`, role, null, '', cur ? 'Scenario saved' : 'Scenario added', { id, version, status }, ['aps_scenarios']);
    },

    // ═════════════ FS59
    async startRoleplay(input) {
      await b.whenReady();
      type R = RpStep;
      const pid = me();
      const sid = typeof input?.scenario_id === 'string' ? input.scenario_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('roleplay.start', 'roleplay_sessions', null, code, msg, role);
      if (!pid) return refuse('not_signed_in', RP_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', RP_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const sc = get('roleplay_scenarios', sid) as (RpScenario & Row) | undefined;
      if (!sc || sc.status !== 'published') return refuse('not_found', RP_MSG.not_published, role);
      const open = raw('roleplay_sessions').filter((s) => s.person_id === pid && s.scenario_id === sid && s.status === 'in_progress').sort(byStartedDesc)[0];
      if (open) {
        const n = (open.turns ?? []).length;
        return h.done<R>('roleplay.start', 'roleplay_sessions', open.id, 'resumed', role, null, '', 'Practice resumed',
          { session_id: open.id, scenario_id: sid, done: false, answered: n, total: sc.turns.length, turn: sc.turns[n] ?? null, feedback: null, result: null, resumed: true }, ['roleplay_sessions']);
      }
      const id = `rp-s-${hex(8)}`;
      ins('roleplay_sessions', {
        id, person_id: pid, scenario_id: sid, scenario_version: Number(sc.version ?? 1), period: quarterOf(today()), status: 'in_progress', turns: [], passed: null, total: null, pct: null,
        ready: false, reasons: [], started_at: nowTs(), completed_at: null, review_status: 'none', reviewer_id: null, review_context: null, requested_at: null, reviewed_by: null,
        reviewed_at: null, review_note: null, level: 0, evidence_ids: [],
      });
      return h.done<R>('roleplay.start', 'roleplay_sessions', id, sid, role, null, '', 'Practice started',
        { session_id: id, scenario_id: sid, done: false, answered: 0, total: sc.turns.length, turn: sc.turns[0], feedback: null, result: null, resumed: false }, ['roleplay_sessions']);
    },

    async roleplayTurn(input) {
      await b.whenReady();
      type R = RpStep;
      const text = typeof input?.text === 'string' ? input.text : '';
      if (speakUpTopic(text)) return quiet<R>();
      const pid = me();
      const sid = typeof input?.session_id === 'string' ? input.session_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('roleplay.turn', 'roleplay_sessions', sid || null, code, msg, role);
      if (!pid) return refuse('not_signed_in', RP_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', RP_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const s = get('roleplay_sessions', sid);
      if (!s || s.person_id !== pid) return refuse('not_found', RP_MSG.not_found, role);
      if (s.status !== 'in_progress') return refuse('invalid', RP_MSG.done_already, role);
      const sc = get('roleplay_scenarios', s.scenario_id) as (RpScenario & Row) | undefined;
      if (!sc) return refuse('not_found', RP_MSG.not_published, role);
      const prev: TurnResult[] = s.turns ?? [];
      const turn = sc.turns[prev.length];
      if (!turn || input?.turn_id !== turn.id) return refuse('invalid', RP_MSG.not_current, role);
      const t = text.trim();
      if (t.length < MIN_ANSWER || t.length > MAX_ANSWER) return refuse('invalid', RP_MSG.length, role);
      if (postGuard(text, policies())) return refuse('security_restricted', RP_MSG.restricted, role);
      const res = { ...evaluateTurn(turn, sc.rubric, text), at: nowTs() };
      const turns = [...prev, res];
      const fb = { ...res, passed: res.criteria.filter((c) => c.pass).length, total: res.criteria.length };
      if (turns.length < sc.turns.length) {
        upd('roleplay_sessions', sid, { turns });
        return h.done<R>('roleplay.turn', 'roleplay_sessions', sid, `${fb.passed}/${fb.total}`, role, null, '', 'Answer checked',
          { session_id: sid, scenario_id: sc.id, done: false, answered: turns.length, total: sc.turns.length, turn: sc.turns[turns.length], feedback: fb, result: null }, ['roleplay_sessions']);
      }
      const sum = summarise(turns, sc.rubric, Number(sc.pass_pct));
      upd('roleplay_sessions', sid, { turns, status: 'completed', completed_at: nowTs(), passed: sum.passed, total: sum.total, pct: sum.pct, ready: sum.ready, reasons: sum.reasons });
      return h.done<R>('roleplay.complete', 'roleplay_sessions', sid, `${sum.pct}`, role, null, '', 'Session complete',
        { session_id: sid, scenario_id: sc.id, done: true, answered: turns.length, total: sc.turns.length, turn: null, feedback: fb, result: rpResultOf(get('roleplay_sessions', sid)!) }, ['roleplay_sessions']);
    },

    async roleplayContext() {
      await b.whenReady();
      const pid = me();
      if (!pid || !ctx().has('skills_profile', ['Own'])) return null;
      const mine = raw('roleplay_sessions').filter((s) => s.person_id === pid);
      const st = rpStats(raw('roleplay_sessions') as never, raw('people') as never, rpScenarios(), today(), MIN_GROUP_SIZE);
      const out: RpContext = {
        period: quarterOf(today()),
        open: mine.filter((s) => s.status === 'in_progress').sort(byStartedDesc).map((s) => ({ session_id: s.id, scenario_id: s.scenario_id })),
        sessions: mine.length, completed: mine.filter((s) => s.status === 'completed').length, validated: mine.filter((s) => s.review_status === 'validated').length,
        enec_pct: st.pct, enec_n: st.pct == null ? null : st.participants,
      };
      return out;
    },

    async roleplayReviewers() {
      await b.whenReady();
      const pid = me();
      if (!pid || !ctx().has('skills_profile', ['Own'])) return null;
      return reviewersFor(pid).map((id): RpReviewer => { const n = nameOf(id); return { id, name_en: n.en, name_ar: n.ar, role: roleOf(id) }; });
    },

    async requestRoleplayReview(input) {
      await b.whenReady();
      type R = { review_status: string };
      const context = typeof input?.context === 'string' ? input.context : '';
      if (speakUpTopic(context)) return quiet<R>();
      const pid = me();
      const sid = typeof input?.session_id === 'string' ? input.session_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('roleplay.review.request', 'roleplay_sessions', sid || null, code, msg, role);
      if (!pid) return refuse('not_signed_in', RP_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', RP_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const s = get('roleplay_sessions', sid);
      if (!s || s.person_id !== pid) return refuse('not_found', RP_MSG.not_found, role);
      if (s.status !== 'completed') return refuse('invalid', RP_MSG.not_complete, role);
      if (s.review_status === 'requested' || s.review_status === 'validated') return refuse('conflict', RP_MSG.review_open, role);
      if (!s.ready) return refuse('invalid', RP_MSG.below_mark, role);
      const rid = typeof input?.reviewer_id === 'string' ? input.reviewer_id : '';
      if (!reviewersFor(pid).includes(rid)) return refuse('invalid', RP_MSG.reviewer, role);
      const c = context.trim();
      if (c.length < 5 || c.length > 400) return refuse('invalid', RP_MSG.context, role);
      if (postGuard(context, policies())) return refuse('security_restricted', RP_MSG.restricted, role);
      if (hasContactDetails(context)) return refuse('contact_details', RP_MSG.contact, role);
      upd('roleplay_sessions', sid, { review_status: 'requested', reviewer_id: rid, review_context: c, requested_at: nowTs(), reviewed_by: null, reviewed_at: null, review_note: null });
      const sc = get('roleplay_scenarios', s.scenario_id);
      notify(`nt-rp-${sid}-req-${rid}`, rid, `Role-play feedback to review: ${sc?.title_en ?? ''}`, `ملاحظات تمرين لعب أدوار بانتظار مراجعتك: ${sc?.title_ar ?? ''}`, '/training/role-play?tab=reviews', 'info');
      return h.done<R>('roleplay.review.request', 'roleplay_sessions', sid, rid, role, null, '', 'Review requested: the reviewer sees this session\'s feedback, never your answers', { review_status: 'requested' }, ['roleplay_sessions', 'notifications']);
    },

    async withdrawRoleplayReview(sessionId) {
      await b.whenReady();
      type R = { review_status: string };
      const pid = me();
      const sid = typeof sessionId === 'string' ? sessionId : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('roleplay.review.withdraw', 'roleplay_sessions', sid || null, code, msg, role);
      if (!pid) return refuse('not_signed_in', RP_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', RP_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const s = get('roleplay_sessions', sid);
      if (!s || s.person_id !== pid) return refuse('not_found', RP_MSG.not_found, role);
      if (s.review_status !== 'requested') return refuse('invalid', RP_MSG.not_requested, role);
      upd('roleplay_sessions', sid, { review_status: 'withdrawn' });
      return h.done<R>('roleplay.review.withdraw', 'roleplay_sessions', sid, null, role, null, '', 'Review request withdrawn', { review_status: 'withdrawn' }, ['roleplay_sessions']);
    },

    async roleplayReviewQueue() {
      await b.whenReady();
      const pid = me();
      if (!pid || !ctx().has('recognition', ['A'])) return null;
      const mineAsReviewer = raw('roleplay_sessions').filter((s) => s.reviewer_id === pid);
      const items = mineAsReviewer.filter((s) => s.review_status === 'requested').sort((x, y) => (String(x.requested_at) < String(y.requested_at) ? -1 : String(x.requested_at) > String(y.requested_at) ? 1 : x.id < y.id ? -1 : 1)).map(queueItem);
      const decided = mineAsReviewer.filter((s) => s.review_status === 'validated' || s.review_status === 'declined')
        .sort((x, y) => (String(x.reviewed_at) < String(y.reviewed_at) ? 1 : String(x.reviewed_at) > String(y.reviewed_at) ? -1 : x.id < y.id ? -1 : 1)).slice(0, 20).map(queueItem);
      return { items, decided };
    },

    async attachRoleplayEvidence(input) {
      await b.whenReady();
      type R = { review_status: string; evidence_ids: string[] };
      const pid = me();
      const sid = typeof input?.session_id === 'string' ? input.session_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('roleplay.review.decide', 'roleplay_sessions', sid || null, code, msg, role);
      if (!pid) return refuse('not_signed_in', RP_MSG.not_signed_in);
      if (!ctx().has('recognition', ['A'])) return refuse('forbidden', RP_MSG.forbidden_review);
      const role = ctx().actingRole('recognition', ['A']);
      const s = get('roleplay_sessions', sid);
      if (!s) return refuse('not_found', RP_MSG.not_found, role);
      if (s.person_id === pid) return refuse('maker_checker', RP_MSG.self, role);
      if (s.review_status !== 'requested') return refuse('invalid', RP_MSG.not_requested, role);
      if (s.reviewer_id !== pid) return refuse('forbidden', RP_MSG.not_reviewer, role);
      const decision = input?.decision;
      const note = str(input?.note);
      if ((decision !== 'validate' && decision !== 'decline') || (decision === 'decline' && (note.length < 5 || note.length > 300)) || note.length > 300) return refuse('invalid', RP_MSG.decision, role);
      const sc = get('roleplay_scenarios', s.scenario_id) as (RpScenario & Row) | undefined;
      const skills = sc ? evidenceSkills(sc.skill_ids ?? [], skillMap()) : [];
      if (decision === 'validate' && !skills.length) return refuse('invalid', RP_MSG.no_skills, role);
      if (decision === 'decline') {
        upd('roleplay_sessions', sid, { review_status: 'declined', reviewed_by: pid, reviewed_at: nowTs(), review_note: note });
        notify(`nt-rp-${sid}-declined`, s.person_id, `Role-play feedback not validated yet: ${sc?.title_en ?? ''}`, `لم تُعتمد ملاحظات تمرين لعب الأدوار بعد: ${sc?.title_ar ?? ''}`, '/my/role-play?tab=history', 'warn');
        return h.done<R>('roleplay.review.decide', 'roleplay_sessions', sid, `declined: ${note}`, role, null, '', 'Returned with your reason; no evidence was written', { review_status: 'declined', evidence_ids: [] }, ['roleplay_sessions', 'notifications']);
      }
      const level = Math.max(1, Math.min(2, Number(sc!.level)));
      const on = today();
      const ids: string[] = [];
      for (const sk of skills) {
        const eid = evidenceId(sid, sk);
        const patch = { level, basis: 'validated', status: 'current', observed_on: on, note: `Validated role-play feedback (${sc!.code}, ${s.passed} of ${s.total} criteria)`, recorded_by: pid, active: true };
        if (get('skill_evidence', eid)) upd('skill_evidence', eid, patch);
        else ins('skill_evidence', { id: eid, person_id: s.person_id, skill_id: sk, kind: 'rating', ref_table: 'roleplay_sessions', ref_id: sid, ...patch, created_at: nowTs() });
        ids.push(eid);
      }
      upd('roleplay_sessions', sid, { review_status: 'validated', reviewed_by: pid, reviewed_at: nowTs(), review_note: note || null, level, evidence_ids: ids });
      await applySkills(b, s.person_id, on);
      notify(`nt-rp-${sid}-validated`, s.person_id, `Role-play feedback validated: ${sc!.title_en}`, `اعتُمدت ملاحظات تمرين لعب الأدوار: ${sc!.title_ar}`, '/my/skills', 'ok');
      return h.done<R>('roleplay.review.decide', 'roleplay_sessions', sid, `validated ${ids.length} skills at level ${level}`, role, 'kafaa.roleplay.evidence',
        `Role-play session ${sid} by ${s.person_id} validated by ${pid}: ${ids.length} skill evidence rows (validated rating, level ${level}); practice feedback, not a qualification`,
        'Validated: the evidence is on their skills profile', { review_status: 'validated', evidence_ids: ids }, ['roleplay_sessions', 'skill_evidence', 'person_skills', 'notifications']);
    },

    async roleplayStats() {
      await b.whenReady();
      if (!me() || !ctx().has('skills_profile', ['Agg'])) return null;
      return rpStats(raw('roleplay_sessions') as never, raw('people') as never, rpScenarios(), today(), MIN_GROUP_SIZE);
    },

    async saveRoleplayScenario(input: RpScenarioInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string };
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('roleplay.scenario', 'roleplay_scenarios', given, code, msg, role);
      if (!me()) return refuse('not_signed_in', RP_MSG.not_signed_in);
      if (!ctx().has('secure_items', ['A'])) return refuse('forbidden', RP_MSG.forbidden_bank);
      const role = ctx().actingRole('secure_items', ['A']);
      const cur = given ? get('roleplay_scenarios', given) : undefined;
      if (given && !cur) return refuse('not_found', RP_MSG.scenario_not_found, role);
      const sm = skillMap();
      const problem = rpScenarioProblem(input, { coreSkillIds: coreIds(), evidenceSkillIds: evidenceSkills([...sm.keys()], sm) });
      if (problem) return refuse('invalid', RP_MSG.invalid + RP_PROBLEM_TEXT[problem], role);
      if (raw('roleplay_scenarios').some((s) => s.code === input.code && s.id !== cur?.id)) return refuse('conflict', 'Another scenario already uses this code', role);
      const status = input.status === 'published' || input.status === 'retired' ? input.status : 'draft';
      if (cur && cur.status === 'published' && status !== 'published' && raw('roleplay_scenarios').filter((s) => s.status === 'published' && s.id !== cur.id).length < 3) return refuse('conflict', RP_MSG.conflict, role);
      const s = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
      const patch = {
        code: input.code, kind: input.kind, title_en: s(input.title_en), title_ar: s(input.title_ar), summary_en: s(input.summary_en), summary_ar: s(input.summary_ar),
        setting_en: s(input.setting_en), setting_ar: s(input.setting_ar), counterpart_en: s(input.counterpart_en), counterpart_ar: s(input.counterpart_ar), role_en: s(input.role_en), role_ar: s(input.role_ar),
        core_skill_ids: [...input.core_skill_ids], skill_ids: [...input.skill_ids], level: input.level, pass_pct: input.pass_pct, est_minutes: input.est_minutes,
        turns: input.turns.map((t) => ({ id: t.id, prompt_en: s(t.prompt_en), prompt_ar: s(t.prompt_ar), hint_en: s(t.hint_en), hint_ar: s(t.hint_ar), example_en: s(t.example_en), example_ar: s(t.example_ar), criteria: [...t.criteria] })),
        rubric: input.rubric.map((c) => ({ id: c.id, label_en: s(c.label_en), label_ar: s(c.label_ar), desc_en: s(c.desc_en), desc_ar: s(c.desc_ar), tip_en: s(c.tip_en), tip_ar: s(c.tip_ar), check: c.check })),
        status, listed: status === 'published', updated_by: me(), updated_at: nowTs(),
      };
      let id: string;
      let version: number;
      if (cur) {
        id = cur.id;
        version = Number(cur.version) + 1;
        upd('roleplay_scenarios', id, { ...patch, version });
      } else {
        id = `rp-${input.code.toLowerCase()}-${hex(3)}`;
        version = 1;
        const sort = raw('roleplay_scenarios').reduce((m, x) => Math.max(m, Number(x.sort)), 0) + 1;
        ins('roleplay_scenarios', { id, ...patch, sources: [], version, sort });
      }
      return h.done<R>('roleplay.scenario', 'roleplay_scenarios', id, `v${version} ${status}`, role, null, '', cur ? 'Scenario saved' : 'Scenario added', { id, version, status }, ['roleplay_scenarios']);
    },
  };
}
