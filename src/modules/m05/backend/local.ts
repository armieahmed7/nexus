// M05 extension LocalBackend RPCs (owner: FS wave C · E3, FS21 + FS22). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261010233001_kafaa_fs33_assessment.sql: same checks in the same order, the same refusal codes
// and messages (AD_MSG), the same audit rows, ledger rows, F01 evidence rows and integrity reports. Pages never import this file.
// Shared write (like the SQL SECURITY DEFINER functions): F01 skill_evidence `se:assessment:<attempt>:<skill>` (kind assessment,
// ref_table adaptive_attempts / task_attempts, basis evidenced; recorded evidence kept by recompute) + applySkills for the person.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { evidenceId } from '../../../domain/skills';
import { applySkills } from '../../../data/local/rpc.w0';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import {
  MIN_ITEMS_PER_LEVEL, adItemProblem, formOf, overviewFor, adaptiveNext, bankIsSafety, bankStats, itemUsage, latestPerPerson, levelOfDifficulty, nextStartOn, normGroup, normText, scoreAdaptive,
  type AdItemInput, type AdResponse, type BankLite, type ItemLite, type SkillLite,
} from '../adaptive';
import { adaptiveIntegrity, answerProblem, autoScores, scoreTask, scoresProblem, taskIntegrity, type TaskKey, type TaskLite } from '../perf';
import type { AdBankCard, AdItemView, AdResult, AdStepView, M05Rpc, TaskScoreView, TaskStartView, TaskSubmitView } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, '0')).join('');
const r1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;

/** User-facing refusal messages (identical in SQL). */
export const AD_MSG = {
  not_signed_in: 'Sign in to use future-skills assessments',
  forbidden: 'Future-skills assessments are for ENEC staff',
  bank_not_found: 'Assessment bank not found',
  too_soon: 'You can retake this assessment from ',
  unavailable: 'The bank has no active item for this step; ask the training manager',
  not_found: 'Attempt not found',
  done_already: 'This attempt is already complete',
  not_current: 'Answer the item on screen first',
  bad_choice: 'Choose one of the options',
  forbidden_item: 'Only the training manager edits adaptive banks',
  item_not_found: 'Item not found',
  item_invalid: 'Check the item: ',
  item_conflict: 'Each bank level needs at least two active items',
  task_not_found: 'Performance task not found',
  rubric_not_seen: 'Read the rubric first: every line is shown before the attempt',
  pending: 'Your last attempt on this task is waiting for an assessor',
  scored_already: 'This attempt is already scored',
  answer_invalid: 'Check your answer: ',
  forbidden_score: 'Only an assessor scores performance tasks',
  not_submitted: 'Only a submitted attempt can be scored',
  self_score: 'An assessor cannot score their own attempt',
  scores_invalid: 'Score every assessor line with a whole number from 0 to its maximum',
  integrity_missing: 'This attempt gates a credential and has no integrity report',
  comment_long: 'Keep the comment under 1,000 characters',
  report_not_found: 'Integrity report not found',
  not_review: 'Only a flagged report waiting for review can be decided',
  self_review: 'You cannot review your own integrity report',
  bad_decision: 'Choose accept or void',
  note: 'Give a reason of at least 10 characters',
} as const;
export const ITEM_PROBLEM_TEXT: Record<string, string> = {
  bank: 'unknown bank', skill: 'the skill must be one of the bank\'s skills', facet: 'a facet key (lower case letters, digits, _)',
  difficulty: 'difficulty from 1.00 to 4.99 (two decimals)', stem: 'a question in English and Arabic (up to 400 characters) is required',
  options: '3 or 4 options in both languages (up to 200 characters each)', correct: 'the answer must be one of the options',
  restricted: 'items never touch plant security or exam content', secure_copy: 'the question copies a secure-bank item',
};
export const ANSWER_PROBLEM_TEXT: Record<string, string> = {
  answer: 'an answer is required', series: 'mark the signal with the anomaly', index: 'mark the reading where it shows',
  decision: 'choose a decision', checks: 'tick only the listed checks, once each', justification: 'justify your decision in 20 to 1,500 characters',
};

export const itemView = (i: Row): AdItemView => ({
  id: i.id, bank_id: i.bank_id, facet: i.facet, level: Number(i.level), stem_en: i.stem_en, stem_ar: i.stem_ar, options_en: [...(i.options_en ?? [])], options_ar: [...(i.options_ar ?? [])],
});
const bankOf = (r: Row): BankLite => ({
  id: r.id, skill_ids: r.skill_ids ?? [], safety_related: !!r.safety_related, mode: r.mode, cut_level: Number(r.cut_level), max_items: Number(r.max_items), min_items: Number(r.min_items),
  stable_window: Number(r.stable_window), evidence_cap: Number(r.evidence_cap), retake_days: Number(r.retake_days), gates: r.gates ?? [], status: r.status,
});
export const resultOf = (a: Row): AdResult => ({
  attempt_id: a.id, bank_id: a.bank_id, estimate: Number(a.estimate), stop: a.stop, criterion: a.mode === 'criterion', meets: a.meets ?? null, percentile: a.percentile ?? null,
  norm_n: a.norm_n ?? null, evidence: a.evidence ?? [], reasons: a.reasons ?? [], item_count: Number(a.item_count),
  path: (a.responses ?? []).map((r: Row) => ({ level: Number(r.level), correct: !!r.correct })), integrity_id: a.integrity_id ?? null,
});

export function makeLocalM05(b: LocalBackend, h: LocalRpcHelpers): M05Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const skills = () => new Map(raw('skills').map((s) => [s.id, s as SkillLite]));
  const items = () => raw('adaptive_items').map((i) => ({ ...i, level: Number(i.level), difficulty: Number(i.difficulty) })) as unknown as (ItemLite & Row)[];
  const attempts = () => raw('adaptive_attempts');
  const writeEvidence = (pid: string, refTable: string, refId: string, list: { skill_id: string; level: number }[], note: string, by: string) => {
    const today = todayIso();
    for (const e of list) {
      const id = evidenceId('assessment', refId, e.skill_id);
      if (get('skill_evidence', id)) continue;
      ins('skill_evidence', {
        id, person_id: pid, skill_id: e.skill_id, kind: 'assessment', ref_table: refTable, ref_id: refId, level: e.level, basis: 'evidenced', status: 'current',
        observed_on: today, note, recorded_by: by, active: true, created_at: nowTs(),
      });
    }
  };
  const step = (a: Row, item: Row | null, level: number, result: AdResult | null, resumed?: boolean): AdStepView => ({
    attempt_id: a.id, done: !!result, answered: (a.responses ?? []).length, max: Number(get('adaptive_banks', a.bank_id)?.max_items ?? 20), level, item: item ? itemView(item) : null, result,
    ...(resumed === undefined ? {} : { resumed }),
  });

  return {
    async adaptiveOverview() {
      await b.whenReady();
      const pid = me();
      if (!pid || !ctx().has('skills_profile', ['Own'])) return null;
      const banks = raw('adaptive_banks').map((r) => ({ ...bankOf(r), sort: Number(r.sort) }));
      const cards: AdBankCard[] = overviewFor(pid, banks, skills(), attempts() as never, todayIso(), MIN_GROUP_SIZE);
      return { banks: cards };
    },

    async startAdaptive(input) {
      await b.whenReady();
      type R = AdStepView;
      const pid = me();
      const bid = typeof input?.bank_id === 'string' ? input.bank_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('assess.adaptive.start', 'adaptive_attempts', null, code, msg, role);
      if (!pid) return refuse('not_signed_in', AD_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', AD_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const br = get('adaptive_banks', bid);
      if (!br || br.status !== 'active') return refuse('not_found', AD_MSG.bank_not_found, role);
      const bank = bankOf(br);
      const mine = attempts().filter((a) => a.person_id === pid && a.bank_id === bid);
      const open = mine.filter((a) => a.status === 'in_progress').sort((x, y) => (String(x.started_at) < String(y.started_at) ? 1 : -1))[0];
      if (open) {
        const e = adaptiveNext(bank, items(), open.responses ?? [], Number(open.form));
        return h.done<R>('assess.adaptive.start', 'adaptive_attempts', open.id, 'resumed', role, null, '', 'Assessment resumed', step(open, get('adaptive_items', open.current_item_id) ?? null, e.level, null, true), ['adaptive_attempts']);
      }
      const next = nextStartOn(bank, mine as never, todayIso());
      if (next) return refuse('too_soon', AD_MSG.too_soon + next, role);
      const attemptNo = mine.length + 1;
      const form = formOf(pid, attemptNo);
      const first = adaptiveNext(bank, items(), [], form);
      if (!first.item_id) return refuse('unavailable', AD_MSG.unavailable, role);
      const id = `aa-${hex(8)}`;
      const row = {
        id, bank_id: bid, bank_version: Number(br.version), person_id: pid, attempt_no: attemptNo, form, mode: bankIsSafety(bank, skills()) ? 'criterion' : bank.mode, status: 'in_progress',
        started_at: nowTs(), completed_at: null, responses: [], current_item_id: first.item_id, item_count: 0, stop: null, estimate: null, meets: null, percentile: null, norm_n: null,
        reasons: [], evidence: [], gating: (bank.gates ?? []).length > 0, integrity_id: null, counts: true,
      };
      ins('adaptive_attempts', row);
      return h.done<R>('assess.adaptive.start', 'adaptive_attempts', id, br.code, role, null, '', 'Assessment started', step(row, get('adaptive_items', first.item_id)!, first.level, null, false), ['adaptive_attempts']);
    },

    async answerAdaptive(input) {
      await b.whenReady();
      type R = AdStepView;
      const pid = me();
      const aid = typeof input?.attempt_id === 'string' ? input.attempt_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('assess.adaptive.answer', 'adaptive_attempts', aid || null, code, msg, role);
      if (!pid) return refuse('not_signed_in', AD_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', AD_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const a = get('adaptive_attempts', aid);
      if (!a || a.person_id !== pid) return refuse('not_found', AD_MSG.not_found, role);
      if (a.status !== 'in_progress') return refuse('invalid', AD_MSG.done_already, role);
      if (!input?.item_id || input.item_id !== a.current_item_id) return refuse('invalid', AD_MSG.not_current, role);
      const item = get('adaptive_items', a.current_item_id);
      if (!item) return refuse('not_found', AD_MSG.item_not_found, role);
      const choice = input?.choice;
      if (!Number.isInteger(choice) || choice < 0 || choice >= (item.options_en ?? []).length) return refuse('invalid', AD_MSG.bad_choice, role);
      const br = get('adaptive_banks', a.bank_id)!;
      const bank = bankOf(br);
      const responses: AdResponse[] = [...(a.responses ?? []), { item_id: item.id, level: Number(item.level), facet: item.facet, choice, correct: choice === Number(item.correct), at: nowTs() }];
      const nx = adaptiveNext(bank, items(), responses, Number(a.form));
      if (!nx.done) {
        upd('adaptive_attempts', aid, { responses, current_item_id: nx.item_id, item_count: responses.length });
        return h.done<R>('assess.adaptive.answer', 'adaptive_attempts', aid, `${responses.length}`, role, null, '', 'Answer recorded',
          step({ ...a, responses }, get('adaptive_items', nx.item_id)!, nx.level, null), ['adaptive_attempts']);
      }
      const safety = bankIsSafety(bank, skills());
      const sc = scoreAdaptive({ ...bank, mode: a.mode }, safety, responses, nx.stop!, normGroup(attempts() as never, bank.id, pid));
      const done = nowTs();
      // the latest attempt on a bank replaces that bank's earlier evidence (kept, inactive)
      const mineIds = new Set(attempts().filter((x) => x.person_id === pid && x.bank_id === bank.id && x.id !== aid).map((x) => x.id));
      for (const old of raw('skill_evidence').filter((x) => x.person_id === pid && x.ref_table === 'adaptive_attempts' && mineIds.has(x.ref_id) && x.active)) upd('skill_evidence', old.id, { active: false });
      writeEvidence(pid, 'adaptive_attempts', aid, sc.evidence, `Adaptive assessment ${br.code}`, pid);
      let integrityId: string | null = null;
      if (a.gating) {
        const finished = { ...a, responses, completed_at: done, status: 'completed' };
        const ir = adaptiveIntegrity(finished as never, attempts().map((x) => (x.id === aid ? finished : x)) as never);
        integrityId = `ir-${aid}`;
        ins('integrity_reports', { id: integrityId, kind: 'adaptive', attempt_id: aid, person_id: pid, ref_id: bank.id, gates: [...(bank.gates ?? [])], created_at: done, ...ir, decision: null, reviewed_by: null, reviewed_at: null, review_note: null });
      }
      upd('adaptive_attempts', aid, {
        responses, current_item_id: null, item_count: responses.length, status: 'completed', completed_at: done, stop: sc.stop, estimate: sc.estimate, meets: sc.meets,
        percentile: sc.percentile, norm_n: sc.norm_n, reasons: sc.reasons, evidence: sc.evidence, integrity_id: integrityId,
      });
      await applySkills(b, pid, todayIso());
      const fin = get('adaptive_attempts', aid)!;
      return h.done<R>('assess.adaptive.complete', 'adaptive_attempts', aid, `${br.code} level ${sc.estimate}`, role, 'kafaa.assessment.adaptive', `Adaptive assessment ${br.code}: level ${sc.estimate}`,
        'Assessment complete', step(fin, null, nx.level, resultOf(fin)), ['adaptive_attempts', 'integrity_reports', 'skill_evidence', 'person_skills']);
    },

    async adaptiveStats() {
      await b.whenReady();
      if (!me() || !ctx().has('secure_items', ['W', 'A'])) return null;
      const sk = skills();
      const all = attempts();
      const banks = raw('adaptive_banks').sort((x, y) => Number(x.sort) - Number(y.sort) || (x.id < y.id ? -1 : 1));
      const its = items().sort((x, y) => (x.id < y.id ? -1 : 1));
      return { banks: banks.map((r) => { const bank = bankOf(r); return bankStats(bank, bankIsSafety(bank, sk), all as never, MIN_GROUP_SIZE); }), items: itemUsage(its, all as never) };
    },

    async saveAdaptiveItem(input: AdItemInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string; level: number };
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('assess.adaptive.item', 'adaptive_items', given, code, msg, role);
      if (!me()) return refuse('not_signed_in', AD_MSG.not_signed_in);
      if (!ctx().has('secure_items', ['A'])) return refuse('forbidden', AD_MSG.forbidden_item);
      const role = ctx().actingRole('secure_items', ['A']);
      const cur = given ? get('adaptive_items', given) : undefined;
      if (given && !cur) return refuse('not_found', AD_MSG.item_not_found, role);
      const secureIds = new Set(raw('items').filter((i) => i.bank === 'secure').map((i) => i.id));
      const stems = new Set<string>();
      for (const v of raw('item_versions')) if (secureIds.has(v.item_id)) { stems.add(normText(v.stem_en)); stems.add(normText(v.stem_ar)); }
      const problem = adItemProblem(input, raw('adaptive_banks').map((x) => ({ id: x.id, skill_ids: x.skill_ids ?? [] })), stems);
      if (problem) return refuse('invalid', AD_MSG.item_invalid + ITEM_PROBLEM_TEXT[problem], role);
      const status = input.status === 'retired' ? 'retired' : 'active';
      const level = levelOfDifficulty(input.difficulty);
      if (cur && cur.status === 'active' && (status === 'retired' || cur.bank_id !== input.bank_id || Number(cur.level) !== level)) {
        const left = items().filter((i) => i.status === 'active' && i.id !== cur.id && i.bank_id === cur.bank_id && Number(i.level) === Number(cur.level)).length;
        if (left < MIN_ITEMS_PER_LEVEL) return refuse('conflict', AD_MSG.item_conflict, role);
      }
      const s = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
      const patch = {
        bank_id: input.bank_id, skill_id: input.skill_id, facet: input.facet, level, difficulty: input.difficulty, stem_en: s(input.stem_en), stem_ar: s(input.stem_ar),
        options_en: input.options_en.map(s), options_ar: input.options_ar.map(s), correct: input.correct, explain_en: s(input.explain_en), explain_ar: s(input.explain_ar),
        status, updated_by: me(), updated_at: nowTs(),
      };
      let id: string;
      let version: number;
      if (cur) {
        id = cur.id;
        version = Number(cur.version) + 1;
        upd('adaptive_items', id, { ...patch, version });
      } else {
        id = `ai-${input.bank_id.replace(/^ab-/, '')}-${hex(4)}`;
        version = 1;
        const sort = items().filter((i) => i.bank_id === input.bank_id).reduce((m, i) => Math.max(m, Number(i.sort)), 0) + 1;
        ins('adaptive_items', { id, ...patch, p_value: null, calib_n: 0, version, sort });
      }
      return h.done<R>('assess.adaptive.item', 'adaptive_items', id, `v${version} ${status}`, role, null, '', cur ? 'Item saved' : 'Item added', { id, version, status, level }, ['adaptive_items']);
    },

    async startPerformanceTask(input) {
      await b.whenReady();
      type R = TaskStartView;
      const pid = me();
      const tid = typeof input?.task_id === 'string' ? input.task_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('assess.task.start', 'task_attempts', null, code, msg, role);
      if (!pid) return refuse('not_signed_in', AD_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', AD_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const task = get('performance_tasks', tid);
      if (!task || task.status !== 'active') return refuse('not_found', AD_MSG.task_not_found, role);
      if (input?.rubric_seen !== true) return refuse('rubric_not_seen', AD_MSG.rubric_not_seen, role);
      const mine = raw('task_attempts').filter((a) => a.person_id === pid && a.task_id === tid);
      const open = mine.find((a) => a.status === 'in_progress');
      if (open) return h.done<R>('assess.task.start', 'task_attempts', open.id, 'resumed', role, null, '', 'Task resumed', { attempt_id: open.id, task_id: tid, rubric_version: Number(open.rubric_version), resumed: true }, ['task_attempts']);
      if (mine.some((a) => a.status === 'submitted')) return refuse('pending', AD_MSG.pending, role);
      const id = `ta-${hex(8)}`;
      ins('task_attempts', {
        id, task_id: tid, person_id: pid, attempt_no: mine.length + 1, rubric_version: Number(task.rubric_version), status: 'in_progress', started_at: nowTs(), submitted_at: null,
        answer: {}, resubmissions: 0, auto_scores: {}, scores: {}, total: null, max: null, passed: null, critical_failed: false, scored_by: null, scored_at: null, comment: null,
        gating: (task.gates ?? []).length > 0, integrity_id: null, evidence: [], counts: true,
      });
      return h.done<R>('assess.task.start', 'task_attempts', id, task.code, role, null, '', 'Task started', { attempt_id: id, task_id: tid, rubric_version: Number(task.rubric_version), resumed: false }, ['task_attempts']);
    },

    async submitPerformanceTask(input) {
      await b.whenReady();
      type R = TaskSubmitView;
      const pid = me();
      const aid = typeof input?.attempt_id === 'string' ? input.attempt_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('assess.task.submit', 'task_attempts', aid || null, code, msg, role);
      if (!pid) return refuse('not_signed_in', AD_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', AD_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const a = get('task_attempts', aid);
      if (!a || a.person_id !== pid) return refuse('not_found', AD_MSG.not_found, role);
      if (a.status === 'scored') return refuse('invalid', AD_MSG.scored_already, role);
      const task = get('performance_tasks', a.task_id)!;
      const problem = answerProblem(task as never, input?.answer);
      if (problem) return refuse('invalid', AD_MSG.answer_invalid + ANSWER_PROBLEM_TEXT[problem], role);
      const key = raw('perf_task_keys').find((k) => k.task_id === a.task_id) as unknown as TaskKey;
      const ans = input.answer;
      const answer = { series: ans.series, index: ans.index, decision: ans.decision, checks: [...ans.checks], justification: ans.justification.trim() };
      const auto = autoScores(key, answer);
      const resub = a.status === 'submitted' ? Number(a.resubmissions) + 1 : Number(a.resubmissions);
      const at = nowTs();
      const next = { ...a, status: 'submitted', submitted_at: at, answer, auto_scores: auto, resubmissions: resub };
      let integrityId: string | null = a.integrity_id ?? null;
      let ir = null;
      if (a.gating) {
        ir = taskIntegrity(next as never, task as never, raw('task_attempts').map((x) => (x.id === aid ? next : x)) as never);
        integrityId = `ir-${aid}`;
        const row = { kind: 'task', attempt_id: aid, person_id: pid, ref_id: a.task_id, gates: [...(task.gates ?? [])], created_at: at, ...ir, decision: null, reviewed_by: null, reviewed_at: null, review_note: null };
        if (get('integrity_reports', integrityId)) upd('integrity_reports', integrityId, row); else ins('integrity_reports', { id: integrityId, ...row });
      }
      upd('task_attempts', aid, { status: 'submitted', submitted_at: at, answer, auto_scores: auto, resubmissions: resub, integrity_id: integrityId });
      return h.done<R>('assess.task.submit', 'task_attempts', aid, a.status === 'submitted' ? `resubmitted ${resub}` : 'submitted', role, null, '', a.status === 'submitted' ? 'Answer replaced' : 'Answer submitted for scoring',
        { attempt_id: aid, resubmissions: resub, integrity_id: integrityId, integrity: ir }, ['task_attempts', 'integrity_reports']);
    },

    async scorePerformanceTask(input) {
      await b.whenReady();
      type R = TaskScoreView;
      const pid = me();
      const aid = typeof input?.attempt_id === 'string' ? input.attempt_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('assess.task.score', 'task_attempts', aid || null, code, msg, role);
      if (!pid) return refuse('not_signed_in', AD_MSG.not_signed_in);
      if (!ctx().has('signoff', ['A'])) return refuse('forbidden', AD_MSG.forbidden_score);
      const role = ctx().actingRole('signoff', ['A']);
      const a = get('task_attempts', aid);
      if (!a) return refuse('not_found', AD_MSG.not_found, role);
      if (a.status !== 'submitted') return refuse('invalid', AD_MSG.not_submitted, role);
      if (a.person_id === pid) return refuse('self_score', AD_MSG.self_score, role);
      const task = get('performance_tasks', a.task_id)! as unknown as TaskLite & Row;
      if (scoresProblem(task.rubric, input?.scores)) return refuse('invalid', AD_MSG.scores_invalid, role);
      const comment = typeof input?.comment === 'string' ? input.comment.trim() : '';
      if (comment.length > 1000) return refuse('invalid', AD_MSG.comment_long, role);
      if (a.gating && (!a.integrity_id || !raw('integrity_reports').some((r) => r.id === a.integrity_id))) return refuse('integrity_missing', AD_MSG.integrity_missing, role);
      const manual: Record<string, number> = {};
      for (const l of task.rubric.filter((x) => x.mode === 'assessor')) manual[l.key] = Number(input.scores[l.key]);
      const sc = scoreTask(task, a.auto_scores, manual);
      const evidence = sc.passed ? [...(task.skill_ids ?? [])].sort().map((skill_id) => ({ skill_id, level: Number(task.evidence_level) })) : [];
      writeEvidence(a.person_id, 'task_attempts', aid, evidence, `Performance task ${task.code}`, pid);
      upd('task_attempts', aid, {
        status: 'scored', scores: manual, total: sc.total, max: sc.max, passed: sc.passed, critical_failed: sc.critical_failed, scored_by: pid, scored_at: nowTs(), comment: comment || null, evidence,
      });
      if (evidence.length) await applySkills(b, a.person_id, todayIso());
      return h.done<R>('assess.task.score', 'task_attempts', aid, `${sc.total}/${sc.max} ${sc.passed ? 'pass' : 'fail'}`, role, 'kafaa.assessment.task_scored', `Performance task ${task.code}: ${sc.passed ? 'pass' : 'not yet'}`,
        'Attempt scored', { attempt_id: aid, total: sc.total, max: sc.max, pct: sc.pct, passed: sc.passed, critical_failed: sc.critical_failed, evidence, reasons: sc.reasons },
        ['task_attempts', 'skill_evidence', 'person_skills']);
    },

    async reviewIntegrity(input) {
      await b.whenReady();
      type R = { report_id: string; decision: string };
      const pid = me();
      const rid = typeof input?.report_id === 'string' ? input.report_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('assess.integrity.review', 'integrity_reports', rid || null, code, msg, role);
      if (!pid) return refuse('not_signed_in', AD_MSG.not_signed_in);
      if (!ctx().has('signoff', ['A'])) return refuse('forbidden', AD_MSG.forbidden_score);
      const role = ctx().actingRole('signoff', ['A']);
      const r = get('integrity_reports', rid);
      if (!r) return refuse('not_found', AD_MSG.report_not_found, role);
      if (r.status !== 'review' || r.decision) return refuse('invalid', AD_MSG.not_review, role);
      if (r.person_id === pid) return refuse('self_review', AD_MSG.self_review, role);
      const decision = input?.decision;
      if (decision !== 'accepted' && decision !== 'voided') return refuse('invalid', AD_MSG.bad_decision, role);
      const note = typeof input?.note === 'string' ? input.note.trim() : '';
      if (note.length < 10) return refuse('invalid', AD_MSG.note, role);
      upd('integrity_reports', rid, { decision, reviewed_by: pid, reviewed_at: nowTs(), review_note: note });
      if (decision === 'voided') {
        upd(r.kind === 'adaptive' ? 'adaptive_attempts' : 'task_attempts', r.attempt_id, { counts: false });
        for (const e of raw('skill_evidence').filter((x) => x.ref_id === r.attempt_id && x.active && (x.ref_table === 'adaptive_attempts' || x.ref_table === 'task_attempts'))) upd('skill_evidence', e.id, { active: false });
        await applySkills(b, r.person_id, todayIso());
      }
      return h.done<R>('assess.integrity.review', 'integrity_reports', rid, decision, role, 'kafaa.assessment.integrity_review', `Integrity report ${rid}: ${decision}`,
        decision === 'voided' ? 'Attempt voided; its evidence is withdrawn' : 'Report accepted', { report_id: rid, decision },
        ['integrity_reports', 'adaptive_attempts', 'task_attempts', 'skill_evidence', 'person_skills']);
    },
  };
}
