// M33 LocalBackend RPC implementations (owners: wave C E5 (FS25, FS26) and wave F E5 (FS58, FS59)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// FS25/FS26: 1:1 mirror of supabase/migrations/20261010235001_kafaa_fs35_core_skills.sql: same checks in the same order, the same refusal
// codes and messages (SJT_MSG), the same audit rows. Practice never writes skill evidence and never reaches the ledger (development only).
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { coreProfile, coreStats, type CoreSkillRow, type PracticeAttemptLite, type SkillName, type StateLite, type TargetRow } from '../coreSkills';
import {
  MIN_ACTIVE_PER_SKILL, feedbackOf, itemView, personSeed, pickSet, quarterOf, scoreSjt, sjtItemProblem, sjtStats,
  type CoreName, type SjtItem, type SjtItemInput, type SjtResponse,
} from '../sjt';
import type { M33Rpc, SjtContext, SjtResult, SjtStep } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, '0')).join('');

/** User-facing refusal messages (identical in SQL). */
export const SJT_MSG = {
  not_signed_in: 'Sign in to practise situational judgement',
  forbidden: 'Situational judgement practice is for ENEC staff',
  forbidden_item: 'Only the training manager edits the practice item bank',
  unknown_skill: 'Unknown core skill',
  unavailable: 'No active practice items for this choice; ask the training manager',
  not_found: 'Practice set not found',
  done_already: 'This practice set is already complete',
  not_current: 'Answer the item on screen first',
  bad_choice: 'Choose one of the responses',
  item_not_found: 'Item not found',
  item_invalid: 'Check the item: ',
  item_conflict: 'Each core skill needs at least two active practice items',
} as const;
export const SJT_PROBLEM_TEXT: Record<string, string> = {
  core_skill: 'unknown core skill', theme: 'unknown theme', stem: 'a scenario in English and Arabic (up to 700 characters) is required',
  options: 'four responses in both languages (up to 240 characters each)', key: 'rate every response 0-3 with exactly one best response (3)',
  notes: 'a why for every response in both languages (up to 300 characters each)', rationale: 'the expert rationale in English and Arabic is required',
  restricted: 'items never touch plant security',
};

export function makeLocalM33(b: LocalBackend, h: LocalRpcHelpers): M33Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const cores = () => raw('core_skills') as unknown as CoreSkillRow[];
  const names = (): CoreName[] => cores().map((c) => ({ id: c.id, name_en: c.name_en, name_ar: c.name_ar, sort: Number(c.sort) }));
  const items = () => raw('sjt_items').map((i) => ({ ...i, sort: Number(i.sort) })) as unknown as SjtItem[];
  const statesBy = () => {
    const m = new Map<string, StateLite[]>();
    for (const s of raw('person_skills')) if (s.active) (m.get(s.person_id) ?? m.set(s.person_id, []).get(s.person_id)!).push(s as StateLite);
    return m;
  };
  const stats = () => sjtStats(raw('sjt_attempts') as never, raw('people') as never, names(), todayIso(), MIN_GROUP_SIZE);
  const total = (a: Row) => (a.item_ids ?? []).length;
  const resultOf = (a: Row): SjtResult => ({
    attempt_id: a.id, period: a.period, score: Number(a.score), by_skill: a.by_skill ?? {}, reasons: a.reasons ?? [], item_count: (a.responses ?? []).length,
  });

  return {
    async coreSkillsMine() {
      await b.whenReady();
      const pid = me();
      if (!pid || !ctx().has('skills_profile', ['Own'])) return null;
      const person = get('people', pid);
      const skillNames = new Map<string, SkillName>(raw('skills').map((s) => [s.id, { id: s.id, name_en: s.name_en, name_ar: s.name_ar }]));
      return coreProfile(pid, person?.job_family_id ?? null, cores(), raw('core_skill_targets') as unknown as TargetRow[], statesBy().get(pid) ?? [], skillNames,
        raw('sjt_attempts').filter((a) => a.person_id === pid) as unknown as PracticeAttemptLite[], todayIso());
    },

    async coreSkillsStats() {
      await b.whenReady();
      if (!me() || !ctx().has('skills_profile', ['Agg'])) return null;
      return coreStats(raw('people') as never, cores(), raw('core_skill_targets') as unknown as TargetRow[], statesBy(), MIN_GROUP_SIZE);
    },

    async startSjt(input) {
      await b.whenReady();
      type R = SjtStep;
      const pid = me();
      const cs = typeof input?.core_skill_id === 'string' && input.core_skill_id ? input.core_skill_id : null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sjt.start', 'sjt_attempts', null, code, msg, role);
      if (!pid) return refuse('not_signed_in', SJT_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', SJT_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const mine = raw('sjt_attempts').filter((a) => a.person_id === pid);
      const open = mine.filter((a) => a.status === 'in_progress').sort((x, y) => (String(x.started_at) < String(y.started_at) ? 1 : String(x.started_at) > String(y.started_at) ? -1 : 0))[0];
      if (open) {
        const it = get('sjt_items', (open.item_ids ?? [])[(open.responses ?? []).length]);
        return h.done<R>('sjt.start', 'sjt_attempts', open.id, 'resumed', role, null, '', 'Practice resumed',
          { attempt_id: open.id, done: false, answered: (open.responses ?? []).length, total: total(open), item: it ? itemView(it as SjtItem) : null, feedback: null, result: null, resumed: true }, ['sjt_attempts']);
      }
      if (cs && !cores().some((c) => c.id === cs && (c.status ?? 'active') === 'active')) return refuse('invalid', SJT_MSG.unknown_skill, role);
      const answered = new Map<string, number>();
      for (const a of mine) for (const r of a.responses ?? []) answered.set(r.item_id, (answered.get(r.item_id) ?? 0) + 1);
      const attemptNo = mine.length + 1;
      const set = pickSet(items(), answered, attemptNo, cs, personSeed(pid));
      if (!set.length) return refuse('unavailable', SJT_MSG.unavailable, role);
      const id = `sjt-a-${hex(8)}`;
      const period = quarterOf(todayIso());
      ins('sjt_attempts', {
        id, person_id: pid, period, attempt_no: attemptNo, core_skill_id: cs, status: 'in_progress', item_ids: set, responses: [], score: null, by_skill: {}, reasons: [],
        started_at: nowTs(), completed_at: null,
      });
      return h.done<R>('sjt.start', 'sjt_attempts', id, cs ?? 'mixed', role, null, '', 'Practice started',
        { attempt_id: id, done: false, answered: 0, total: set.length, item: itemView(get('sjt_items', set[0]) as SjtItem), feedback: null, result: null, resumed: false }, ['sjt_attempts']);
    },

    async submitSjt(input) {
      await b.whenReady();
      type R = SjtStep;
      const pid = me();
      const aid = typeof input?.attempt_id === 'string' ? input.attempt_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sjt.answer', 'sjt_attempts', aid || null, code, msg, role);
      if (!pid) return refuse('not_signed_in', SJT_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', SJT_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const a = get('sjt_attempts', aid);
      if (!a || a.person_id !== pid) return refuse('not_found', SJT_MSG.not_found, role);
      if (a.status !== 'in_progress') return refuse('invalid', SJT_MSG.done_already, role);
      const prev: SjtResponse[] = a.responses ?? [];
      const current = (a.item_ids ?? [])[prev.length];
      if (!input?.item_id || input.item_id !== current) return refuse('invalid', SJT_MSG.not_current, role);
      const item = get('sjt_items', current) as unknown as SjtItem | undefined;
      if (!item) return refuse('not_found', SJT_MSG.item_not_found, role);
      const choice = input?.choice;
      if (!Number.isInteger(choice) || choice < 0 || choice >= (item.options_en ?? []).length) return refuse('invalid', SJT_MSG.bad_choice, role);
      const fb = feedbackOf(item, choice);
      const responses: SjtResponse[] = [...prev, { item_id: item.id, core_skill_id: item.core_skill_id, choice, eff: fb.eff }];
      const next = (a.item_ids ?? [])[responses.length];
      if (next) {
        upd('sjt_attempts', aid, { responses });
        const nx = get('sjt_items', next) as SjtItem;
        return h.done<R>('sjt.answer', 'sjt_attempts', aid, `${responses.length}`, role, null, '', 'Answer recorded',
          { attempt_id: aid, done: false, answered: responses.length, total: total(a), item: nx ? itemView(nx) : null, feedback: fb, result: null }, ['sjt_attempts']);
      }
      const sc = scoreSjt(responses, names());
      upd('sjt_attempts', aid, { responses, status: 'completed', completed_at: nowTs(), score: sc.score, by_skill: sc.by_skill, reasons: sc.reasons });
      const done = get('sjt_attempts', aid)!;
      return h.done<R>('sjt.complete', 'sjt_attempts', aid, `${sc.score}`, role, null, '', 'Practice complete',
        { attempt_id: aid, done: true, answered: responses.length, total: total(a), item: null, feedback: fb, result: resultOf(done) }, ['sjt_attempts']);
    },

    async sjtContext() {
      await b.whenReady();
      const pid = me();
      if (!pid || !ctx().has('skills_profile', ['Own'])) return null;
      const mine = raw('sjt_attempts').filter((a) => a.person_id === pid);
      const open = mine.filter((a) => a.status === 'in_progress').sort((x, y) => (String(x.started_at) < String(y.started_at) ? 1 : String(x.started_at) > String(y.started_at) ? -1 : 0))[0];
      const act = items().filter((i) => i.status === 'active');
      const s = stats();
      const out: SjtContext = {
        period: quarterOf(todayIso()), in_progress: open?.id ?? null, completed: mine.filter((a) => a.status === 'completed').length,
        bank: [...cores()].sort((x, y) => Number(x.sort) - Number(y.sort) || (x.id < y.id ? -1 : 1)).map((c) => ({ core_skill_id: c.id, items: act.filter((i) => i.core_skill_id === c.id).length })),
        enec_avg: s.avg, enec_n: s.avg == null ? null : s.participants,
      };
      return out;
    },

    async sjtStats() {
      await b.whenReady();
      if (!me() || !ctx().has('skills_profile', ['Agg'])) return null;
      return stats();
    },

    async saveSjtItem(input: SjtItemInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string };
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sjt.item', 'sjt_items', given, code, msg, role);
      if (!me()) return refuse('not_signed_in', SJT_MSG.not_signed_in);
      if (!ctx().has('secure_items', ['A'])) return refuse('forbidden', SJT_MSG.forbidden_item);
      const role = ctx().actingRole('secure_items', ['A']);
      const cur = given ? get('sjt_items', given) : undefined;
      if (given && !cur) return refuse('not_found', SJT_MSG.item_not_found, role);
      const problem = sjtItemProblem(input, cores().filter((c) => (c.status ?? 'active') === 'active').map((c) => c.id));
      if (problem) return refuse('invalid', SJT_MSG.item_invalid + SJT_PROBLEM_TEXT[problem], role);
      const status = input.status === 'retired' ? 'retired' : 'active';
      if (cur && cur.status === 'active' && (status === 'retired' || cur.core_skill_id !== input.core_skill_id)) {
        const left = items().filter((i) => i.status === 'active' && i.id !== cur.id && i.core_skill_id === cur.core_skill_id).length;
        if (left < MIN_ACTIVE_PER_SKILL) return refuse('conflict', SJT_MSG.item_conflict, role);
      }
      const s = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
      const patch = {
        core_skill_id: input.core_skill_id, theme: input.theme, stem_en: s(input.stem_en), stem_ar: s(input.stem_ar), options_en: input.options_en.map(s), options_ar: input.options_ar.map(s),
        expert_key: input.expert_key.map(Number), notes_en: input.notes_en.map(s), notes_ar: input.notes_ar.map(s), rationale_en: s(input.rationale_en), rationale_ar: s(input.rationale_ar),
        status, updated_by: me(), updated_at: nowTs(),
      };
      let id: string;
      let version: number;
      if (cur) {
        id = cur.id;
        version = Number(cur.version) + 1;
        upd('sjt_items', id, { ...patch, version });
      } else {
        id = `sjt-${input.core_skill_id.replace(/^cs-/, '')}-${hex(4)}`;
        version = 1;
        const sort = items().reduce((m, i) => Math.max(m, Number(i.sort)), 0) + 1;
        ins('sjt_items', { id, ...patch, version, sort });
      }
      return h.done<R>('sjt.item', 'sjt_items', id, `v${version} ${status}`, role, null, '', cur ? 'Item saved' : 'Item added', { id, version, status }, ['sjt_items']);
    },
  };
}
