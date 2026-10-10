// M29 LocalBackend RPC implementations (owners: wave B E2 (FS09, FS10), wave D E5 (FS36, FS37) and wave I E2 (FS80)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// FS09/FS10: 1:1 mirror of supabase/migrations/20261010222001_kafaa_fs22_ai_fluency.sql: same checks in the same order, the same
// refusal codes and messages (FIT_MSG), the same audit rows, ledger rows and F01 evidence rows. Pages never import this file.
// Shared write (like the SQL SECURITY DEFINER functions): F01 skill_evidence `se:assessment:<attempt>:<skill>` (kind assessment,
// ref_table fitness_attempts, basis evidenced, level <= 2) + applySkills for the taker.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { evidenceId } from '../../../domain/skills';
import { applySkills } from '../../../data/local/rpc.w0';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { aiRung, rungStats, targetGap, type RungCell, type SkillTrackRow, type StateLite } from '../fluency';
import {
  MAX_ITEMS, MIN_ITEMS_PER_CELL, fitnessStats, isAboveBasic, isStaff, itemProblem, nextQuarterStart, nextStep, pickItem, quarterOfDate, scoreAttempt,
  type FitArea, type FitItem, type FitResponse, type ItemInput,
} from '../fitness';
import type { AiFluencyStats, AiFluencyView, FitnessContext, FitnessItemView, FitnessResult, FitnessStep, M29Rpc } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, '0')).join('');

/** User-facing refusal messages (identical in SQL). */
export const FIT_MSG = {
  not_signed_in: 'Sign in to use the AI and digital fitness check',
  forbidden: 'The fitness check is for ENEC staff',
  forbidden_item: 'Only the training manager edits the fitness item bank',
  too_soon: 'This quarter\'s check is complete; the next one opens on ',
  unavailable: 'The item bank has no active item for this step; ask the training manager',
  not_found: 'Attempt not found',
  done_already: 'This attempt is already complete',
  not_current: 'Answer the item on screen first',
  bad_choice: 'Choose one of the options',
  item_not_found: 'Item not found',
  item_invalid: 'Check the item: ',
  item_conflict: 'Each area and difficulty needs at least two active items',
} as const;
export const ITEM_PROBLEM_TEXT: Record<string, string> = {
  area: 'unknown area', difficulty: 'difficulty must be 1, 2 or 3', stem: 'a question in English and Arabic (up to 400 characters) is required',
  options: '3 or 4 options in both languages (up to 200 characters each)', correct: 'the answer must be one of the options',
  restricted: 'items never touch plant security',
};

export const itemView = (i: Row): FitnessItemView => ({
  id: i.id, area_id: i.area_id, difficulty: Number(i.difficulty), stem_en: i.stem_en, stem_ar: i.stem_ar, options_en: [...(i.options_en ?? [])], options_ar: [...(i.options_ar ?? [])],
});

export function makeLocalM29(b: LocalBackend, h: LocalRpcHelpers): M29Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const areas = () => raw('fitness_areas').map((a) => ({ ...a, weight: Number(a.weight) })) as FitArea[];
  const items = () => raw('fitness_items') as unknown as (FitItem & Row)[];
  const statesBy = () => {
    const m = new Map<string, StateLite[]>();
    for (const s of raw('person_skills')) if (s.active) (m.get(s.person_id) ?? m.set(s.person_id, []).get(s.person_id)!).push(s as StateLite);
    return m;
  };
  const targetOf = (family: string | null | undefined) => raw('ai_role_targets').find((t) => t.family_id === family) ?? null;
  const resultOf = (a: Row): FitnessResult => ({
    attempt_id: a.id, period: a.period, score: Number(a.score), band: a.band, above_basic: isAboveBasic(a.band), area_levels: a.area_levels ?? {},
    evidence: a.evidence ?? [], reasons: a.reasons ?? [], item_count: Number(a.item_count),
  });
  const stats = () => fitnessStats(raw('fitness_attempts') as never, raw('people') as never, areas(), todayIso(), MIN_GROUP_SIZE);

  return {
    async aiFluency() {
      await b.whenReady();
      const pid = me();
      if (!pid || !ctx().has('ai_literacy', ['Own'])) return null;
      const person = get('people', pid);
      const family = person?.job_family_id ?? null;
      const res = aiRung(pid, raw('ai_rungs') as unknown as RungCell[], raw('ai_skill_tracks') as unknown as SkillTrackRow[], statesBy().get(pid) ?? []);
      const t = targetOf(family);
      const gap = targetGap(res, t ? { rung: Number(t.rung), plus_cells: t.plus_cells ?? [] } : null);
      const view: AiFluencyView = {
        person_id: pid, family_id: family, result: res,
        target: t ? { rung: Number(t.rung), plus_cells: [...(t.plus_cells ?? [])], fitness_target: Number(t.fitness_target), rationale_en: t.rationale_en, rationale_ar: t.rationale_ar } : null,
        target_met: gap.met, target_missing: gap.missing,
      };
      return view;
    },

    async aiFluencyStats() {
      await b.whenReady();
      if (!me() || !ctx().has('ai_literacy', ['Agg'])) return null;
      const cells = raw('ai_rungs') as unknown as RungCell[];
      const tracks = raw('ai_skill_tracks') as unknown as SkillTrackRow[];
      const by = statesBy();
      const rows = raw('people').filter((p) => isStaff(p as never)).sort((x, y) => (x.id < y.id ? -1 : 1)).map((p) => {
        const r = aiRung(p.id, cells, tracks, by.get(p.id) ?? []);
        const t = targetOf(p.job_family_id);
        return { person_id: p.id, family_id: p.job_family_id ?? null, rung: r.rung, target_met: targetGap(r, t ? { rung: Number(t.rung), plus_cells: t.plus_cells ?? [] } : null).met };
      });
      const o = raw('ai_org_targets').find((x) => x.metric === 'practitioner_or_above');
      const out: AiFluencyStats = { ...rungStats(rows, MIN_GROUP_SIZE), org_target: o ? { id: o.id, pct: Number(o.pct), due_on: String(o.due_on).slice(0, 10) } : null };
      return out;
    },

    async startFitness() {
      await b.whenReady();
      type R = FitnessStep;
      const pid = me();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('ai.fitness.start', 'fitness_attempts', null, code, msg, role);
      if (!pid) return refuse('not_signed_in', FIT_MSG.not_signed_in);
      if (!ctx().has('ai_literacy', ['Own'])) return refuse('forbidden', FIT_MSG.forbidden);
      const role = ctx().actingRole('ai_literacy', ['Own']);
      const today = todayIso();
      const period = quarterOfDate(today);
      const mine = raw('fitness_attempts').filter((a) => a.person_id === pid);
      const open = mine.filter((a) => a.status === 'in_progress').sort((x, y) => (String(x.started_at) < String(y.started_at) ? 1 : -1))[0];
      if (open) {
        const it = get('fitness_items', open.current_item_id);
        return h.done<R>('ai.fitness.start', 'fitness_attempts', open.id, 'resumed', role, null, '', 'Fitness check resumed',
          { attempt_id: open.id, done: false, answered: (open.responses ?? []).length, max: MAX_ITEMS, item: it ? itemView(it) : null, result: null, resumed: true }, ['fitness_attempts']);
      }
      if (mine.some((a) => a.status === 'completed' && a.period === period)) return refuse('too_soon', FIT_MSG.too_soon + nextQuarterStart(period), role);
      const attemptNo = mine.length + 1;
      const step = nextStep(areas(), [])!;
      const item = pickItem(items(), step, new Set(), attemptNo);
      if (!item) return refuse('unavailable', FIT_MSG.unavailable, role);
      const id = `fa-${hex(8)}`;
      ins('fitness_attempts', {
        id, person_id: pid, period, attempt_no: attemptNo, status: 'in_progress', started_at: nowTs(), completed_at: null, responses: [], current_item_id: item.id, item_count: 0,
        area_levels: {}, score: null, band: null, reasons: [], evidence: [],
      });
      return h.done<R>('ai.fitness.start', 'fitness_attempts', id, period, role, null, '', 'Fitness check started',
        { attempt_id: id, done: false, answered: 0, max: MAX_ITEMS, item: itemView(item), result: null, resumed: false }, ['fitness_attempts']);
    },

    async submitFitness(input) {
      await b.whenReady();
      type R = FitnessStep;
      const pid = me();
      const aid = typeof input?.attempt_id === 'string' ? input.attempt_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('ai.fitness.answer', 'fitness_attempts', aid || null, code, msg, role);
      if (!pid) return refuse('not_signed_in', FIT_MSG.not_signed_in);
      if (!ctx().has('ai_literacy', ['Own'])) return refuse('forbidden', FIT_MSG.forbidden);
      const role = ctx().actingRole('ai_literacy', ['Own']);
      const a = get('fitness_attempts', aid);
      if (!a || a.person_id !== pid) return refuse('not_found', FIT_MSG.not_found, role);
      if (a.status !== 'in_progress') return refuse('invalid', FIT_MSG.done_already, role);
      if (!input?.item_id || input.item_id !== a.current_item_id) return refuse('invalid', FIT_MSG.not_current, role);
      const item = get('fitness_items', a.current_item_id);
      if (!item) return refuse('not_found', FIT_MSG.item_not_found, role);
      const choice = input?.choice;
      if (!Number.isInteger(choice) || choice < 0 || choice >= (item.options_en ?? []).length) return refuse('invalid', FIT_MSG.bad_choice, role);
      const responses: FitResponse[] = [...(a.responses ?? []), { item_id: item.id, area_id: item.area_id, difficulty: Number(item.difficulty), choice, correct: choice === Number(item.correct) }];
      const ar = areas();
      const step = nextStep(ar, responses);
      const next = step ? pickItem(items(), step, new Set(responses.map((r) => r.item_id)), Number(a.attempt_no)) : null;
      if (next) {
        upd('fitness_attempts', aid, { responses, current_item_id: next.id, item_count: responses.length });
        return h.done<R>('ai.fitness.answer', 'fitness_attempts', aid, `${responses.length}`, role, null, '', 'Answer recorded',
          { attempt_id: aid, done: false, answered: responses.length, max: MAX_ITEMS, item: itemView(next), result: null }, ['fitness_attempts']);
      }
      const today = todayIso();
      const sc = scoreAttempt(ar, responses);
      upd('fitness_attempts', aid, {
        responses, current_item_id: null, item_count: responses.length, status: 'completed', completed_at: nowTs(), area_levels: sc.levels, score: sc.score, band: sc.band,
        reasons: sc.reasons, evidence: sc.evidence,
      });
      // The latest check replaces earlier checks' evidence (kept, inactive): the check says where I stand now.
      for (const old of raw('skill_evidence').filter((x) => x.person_id === pid && x.ref_table === 'fitness_attempts' && x.ref_id !== aid && x.active)) upd('skill_evidence', old.id, { active: false });
      for (const e of sc.evidence) {
        const id = evidenceId('assessment', aid, e.skill_id);
        if (get('skill_evidence', id)) continue;
        ins('skill_evidence', {
          id, person_id: pid, skill_id: e.skill_id, kind: 'assessment', ref_table: 'fitness_attempts', ref_id: aid, level: e.level, basis: 'evidenced', status: 'current',
          observed_on: today, note: `AI and digital fitness check ${a.period}`, recorded_by: pid, active: true, created_at: nowTs(),
        });
      }
      await applySkills(b, pid, today);
      const done = get('fitness_attempts', aid)!;
      return h.done<R>('ai.fitness.complete', 'fitness_attempts', aid, `${sc.score} ${sc.band}`, role, 'kafaa.ai.fitness_check', `AI and digital fitness check ${a.period}: ${sc.band}`,
        'Fitness check complete', { attempt_id: aid, done: true, answered: responses.length, max: MAX_ITEMS, item: null, result: resultOf(done) },
        ['fitness_attempts', 'skill_evidence', 'person_skills']);
    },

    async fitnessContext() {
      await b.whenReady();
      const pid = me();
      if (!pid || !ctx().has('ai_literacy', ['Own'])) return null;
      const period = quarterOfDate(todayIso());
      const mine = raw('fitness_attempts').filter((a) => a.person_id === pid);
      const open = mine.filter((a) => a.status === 'in_progress').sort((x, y) => (String(x.started_at) < String(y.started_at) ? 1 : -1))[0];
      const doneNow = mine.some((a) => a.status === 'completed' && a.period === period);
      const family = get('people', pid)?.job_family_id ?? null;
      const t = targetOf(family);
      const s = stats();
      const out: FitnessContext = {
        period, family_id: family, can_start: !doneNow || !!open, in_progress: open?.id ?? null, next_on: doneNow && !open ? nextQuarterStart(period) : null,
        role_target: t ? Number(t.fitness_target) : null, enec_avg: s.avg_score, enec_n: s.avg_score == null ? null : s.tested,
      };
      return out;
    },

    async fitnessStats() {
      await b.whenReady();
      if (!me() || !ctx().has('ai_literacy', ['Agg'])) return null;
      return stats();
    },

    async saveFitnessItem(input: ItemInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string };
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('ai.fitness.item', 'fitness_items', given, code, msg, role);
      if (!me()) return refuse('not_signed_in', FIT_MSG.not_signed_in);
      if (!ctx().has('ai_literacy', ['W'])) return refuse('forbidden', FIT_MSG.forbidden_item);
      const role = ctx().actingRole('ai_literacy', ['W']);
      const cur = given ? get('fitness_items', given) : undefined;
      if (given && !cur) return refuse('not_found', FIT_MSG.item_not_found, role);
      const problem = itemProblem(input, areas().map((a) => a.id));
      if (problem) return refuse('invalid', FIT_MSG.item_invalid + ITEM_PROBLEM_TEXT[problem], role);
      const status = input.status === 'retired' ? 'retired' : 'active';
      if (cur && cur.status === 'active' && (status === 'retired' || cur.area_id !== input.area_id || Number(cur.difficulty) !== input.difficulty)) {
        const left = items().filter((i) => i.status === 'active' && i.id !== cur.id && i.area_id === cur.area_id && Number(i.difficulty) === Number(cur.difficulty)).length;
        if (left < MIN_ITEMS_PER_CELL) return refuse('conflict', FIT_MSG.item_conflict, role);
      }
      const s = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
      const patch = {
        area_id: input.area_id, difficulty: input.difficulty, stem_en: s(input.stem_en), stem_ar: s(input.stem_ar), options_en: input.options_en.map(s), options_ar: input.options_ar.map(s),
        correct: input.correct, explain_en: s(input.explain_en), explain_ar: s(input.explain_ar), status, updated_by: me(), updated_at: nowTs(),
      };
      let id: string;
      let version: number;
      if (cur) {
        id = cur.id;
        version = Number(cur.version) + 1;
        upd('fitness_items', id, { ...patch, version });
      } else {
        id = `fi-${input.area_id.replace(/^fa-/, '')}-${hex(4)}`;
        version = 1;
        const sort = items().filter((i) => i.area_id === input.area_id && Number(i.difficulty) === input.difficulty).reduce((m, i) => Math.max(m, Number(i.sort)), 0) + 1;
        ins('fitness_items', { id, ...patch, version, sort });
      }
      return h.done<R>('ai.fitness.item', 'fitness_items', id, `v${version} ${status}`, role, null, '', cur ? 'Item saved' : 'Item added', { id, version, status }, ['fitness_items']);
    },
  };
}
