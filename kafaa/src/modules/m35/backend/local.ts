// M35 LocalBackend RPC implementations (owners: wave F E1 (FS50, FS51) and wave G E1 (FS60, FS61)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261010261001_kafaa_fs61_strategy_forecasts.sql: the same checks in the same order, the same refusal
// codes and messages (CS_MSG, FC_MSG), one audit row for every refusal and every write, ledger rows on adoption, retirement, every
// quarterly review and every release. Rules: src/modules/m35/{critical,forecast}.ts. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { publicTextIsClean } from '../../../domain/future';
import {
  boardInputFromTables, criticalBoard, criticalProblem, quarterOfIso, reviewProblem,
  type Board, type CriticalCtx, type CriticalInput, type Progress,
} from '../critical';
import { SCENARIOS, forecastFor, forecastInputFromTables, simulatedName, type ForecastResult } from '../forecast';
import type { CriticalReviewInput, M35Rpc, SaveForecastInput } from './rpc';
import { makeLocalFs60 } from './local.fs60'; // FS wave G · E1 (FS60, FS61)

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** User-facing refusal messages (identical in SQL). */
export const CS_MSG = {
  not_signed_in: 'Sign in to use the critical skills register',
  forbidden_read: 'The critical skills register is for HR, the training manager, admins and auditors',
  forbidden: 'Only HR analysts and the HR director edit the critical skills register',
  forbidden_adopt: 'Only the HR director adopts, edits an adopted row or retires a critical skill',
  conflict: 'This skill is already on the register',
  not_found: 'Register row not found',
  invalid: 'Check the register row: ',
  forbidden_review: 'Only the HR director records the quarterly review',
  not_active: 'Only an adopted critical skill is reviewed',
  already_reviewed: 'This quarter\'s review is already recorded',
  invalid_review: 'Check the review: ',
} as const;
export const CS_PROBLEM_TEXT: Record<string, string> = {
  skill: 'choose a catalogue skill that is not obsolete and not a security skill',
  owner: 'name an owning function and an active staff role card as owner',
  level: 'a target level from 1 to 4',
  targets: 'one to six targets, years 2026 to 2035 in rising order, whole people-equivalents from 0 to 5000',
  kpis: 'one to four distinct KPIs with whole-number targets in range',
  decision: 'choose build, buy, borrow or bot',
  rationale: 'a decision rationale of 20 to 600 characters in English and in Arabic',
  plans: 'up to five FS04 gap plans for the same skill',
  status: 'choose draft, active or retired',
};
export const REVIEW_PROBLEM_TEXT: Record<string, string> = {
  rating: 'choose met, on track, at risk or off track',
  notes: 'a note of 10 to 600 characters in English and in Arabic',
  decision: 'choose build, buy, borrow or bot',
  rationale: 'a new decision needs a rationale of 20 to 600 characters in English and in Arabic',
};
export const FC_MSG = {
  not_signed_in: 'Sign in to see skill forecasts',
  forbidden: 'Skill forecasts are for HR, the training manager, admins and auditors',
  invalid: 'An assumption is outside its range',
  not_found: 'Staffing scenario not found',
  forbidden_save: 'Only HR analysts and the HR director save forecast versions',
  name: 'A forecast version needs a name of 3 to 120 characters',
  scenario: 'Choose the scenario to plan against: baseline, ADVANCE or accelerated',
  not_yours: 'Forecast version not found',
  released: 'A released version cannot be changed; save a new version',
  forbidden_release: 'Only the HR director releases a skill forecast',
  version_not_found: 'Forecast version not found',
  already_released: 'This version is already released',
  superseded: 'A superseded version cannot be released again',
  summary: 'Write a summary of 10 to 600 characters in English and in Arabic',
  not_clean: 'Release text may not state headcounts or site information (M11 rule)',
} as const;

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function makeLocalM35(b: LocalBackend, h: LocalRpcHelpers): M35Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const board = (): Board => criticalBoard(boardInputFromTables(raw), todayIso());
  const criticalCtx = (): CriticalCtx => ({
    skills: Object.fromEntries(raw('skills').map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }])),
    owners: raw('people').filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id as string),
    plans: Object.fromEntries(raw('skill_gap_plans').map((g) => [g.id, { sk_id: g.sk_id ?? null }])),
  });

  return {
    ...makeLocalFs60(b, h), // FS wave G · E1: FS60 disclosure pack, FS61 skills pilots
    // ───────────── FS50
    async criticalSkillBoard() {
      await b.whenReady();
      if (!me()) return h.refuse<Board>('critical.board', 'critical_skills', null, 'not_signed_in', CS_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['Agg', 'R', 'W', 'A'])) return h.refuse<Board>('critical.board', 'critical_skills', null, 'forbidden', CS_MSG.forbidden_read);
      return { ok: true, code: 'ok', message: 'Critical skills register', data: board() } as Result<Board>;
    },

    async saveCriticalSkill(input: CriticalInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string };
      const skill = typeof input?.skill_id === 'string' ? input.skill_id : '';
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const entity = given ?? (skill ? `cs-${skill}` : null);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('critical.save', 'critical_skills', entity, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', CS_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['W', 'A'])) return refuse('forbidden', CS_MSG.forbidden);
      let role = ctx().actingRole('workforce_strategy', ['W', 'A']);
      const id = given ?? `cs-${skill}`;
      const cur = get('critical_skills', id);
      if (given && (!cur || cur.skill_id !== skill)) return refuse('not_found', CS_MSG.not_found, role);
      if (!given && cur) return refuse('conflict', CS_MSG.conflict, role);
      const problem = criticalProblem(input, criticalCtx());
      if (problem) return refuse('invalid', CS_MSG.invalid + CS_PROBLEM_TEXT[problem], role);
      if (input.status !== 'draft' || (cur && cur.status !== 'draft')) {
        if (!ctx().has('workforce_strategy', ['A'])) return refuse('forbidden', CS_MSG.forbidden_adopt, role);
        role = ctx().actingRole('workforce_strategy', ['A']);
      }
      const today = todayIso();
      const version = cur ? Number(cur.version) + 1 : 1;
      const becameActive = input.status === 'active' && (!cur || cur.status !== 'active');
      const becameRetired = input.status === 'retired' && (!cur || cur.status !== 'retired');
      const history = (cur?.decision_history ?? []) as Row[];
      const patch = {
        owner_function: input.owner_function, owner_person_id: input.owner_person_id, target_level: input.target_level,
        targets: input.targets.map((t) => ({ year: t.year, pe: t.pe })), kpis: input.kpis.map((k) => ({ kind: k.kind, target: k.target })),
        decision: input.decision, rationale_en: txt(input.rationale_en), rationale_ar: txt(input.rationale_ar),
        decision_history: cur && cur.decision !== input.decision ? [...history, { decision: cur.decision, rationale_en: cur.rationale_en, rationale_ar: cur.rationale_ar, until: today, by: pid }] : history,
        gap_plan_ids: [...input.gap_plan_ids], status: input.status, adopted_on: becameActive ? today : cur?.adopted_on ?? null,
        version, updated_by: pid, updated_at: nowTs(),
      };
      if (cur) upd('critical_skills', id, patch);
      else ins('critical_skills', { id, skill_id: skill, ...patch, sort: raw('critical_skills').reduce((m, r) => Math.max(m, Number(r.sort ?? 0)), 0) + 1, benchmark_ids: ['IAEA-WFP', 'ISO30414', 'FORECAST'], created_by: pid, created_at: nowTs() });
      const ledger = becameActive ? 'kafaa.workforce.critical_skill_adopt' : becameRetired ? 'kafaa.workforce.critical_skill_retire' : null;
      return h.done<R>('critical.save', 'critical_skills', id, `v${version} ${input.status} ${input.decision}`, role, ledger,
        `Critical skill ${becameActive ? 'adopted' : 'retired'}: ${skill}`, cur ? 'Register row saved' : 'Critical skill added to the register', { id, version, status: input.status }, ['critical_skills']);
    },

    async reviewCriticalSkill(input: CriticalReviewInput) {
      await b.whenReady();
      type R = { id: string; quarter: string; progress: Progress };
      const cid = typeof input?.critical_skill_id === 'string' ? input.critical_skill_id : '';
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('critical.review', 'critical_skill_reviews', cid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', CS_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['A'])) return refuse('forbidden', CS_MSG.forbidden_review);
      const role = ctx().actingRole('workforce_strategy', ['A']);
      const cur = get('critical_skills', cid);
      if (!cur) return refuse('not_found', CS_MSG.not_found, role);
      if (cur.status !== 'active') return refuse('not_active', CS_MSG.not_active, role);
      const problem = reviewProblem(input, cur.decision);
      if (problem) return refuse('invalid', CS_MSG.invalid_review + REVIEW_PROBLEM_TEXT[problem], role);
      const today = todayIso();
      const q = quarterOfIso(today);
      const rid = `csr-${cid}-${q}`;
      if (get('critical_skill_reviews', rid)) return refuse('already_reviewed', CS_MSG.already_reviewed, role);
      const progress = board().rows.find((r) => r.id === cid)!.progress;
      const after = input.decision && input.decision !== '' ? input.decision : cur.decision;
      ins('critical_skill_reviews', {
        id: rid, critical_skill_id: cid, quarter: q, rating: input.rating, progress, note_en: txt(input.note_en), note_ar: txt(input.note_ar),
        decision_before: cur.decision, decision_after: after, reviewed_by: pid, reviewed_at: nowTs(),
      });
      if (after !== cur.decision) {
        upd('critical_skills', cid, {
          decision: after, rationale_en: txt(input.rationale_en), rationale_ar: txt(input.rationale_ar),
          decision_history: [...((cur.decision_history ?? []) as Row[]), { decision: cur.decision, rationale_en: cur.rationale_en, rationale_ar: cur.rationale_ar, until: today, by: pid }],
          version: Number(cur.version) + 1, updated_by: pid, updated_at: nowTs(),
        });
      }
      return h.done<R>('critical.review', 'critical_skill_reviews', rid, `${q} ${input.rating}${after !== cur.decision ? ` decision ${cur.decision}->${after}` : ''}`, role,
        'kafaa.workforce.critical_skill_review', `Critical skill review ${q}: ${cur.skill_id} ${input.rating}`, 'Quarterly review recorded', { id: rid, quarter: q, progress },
        ['critical_skill_reviews', 'critical_skills']);
    },

    // ───────────── FS51
    async computeSkillForecast(params) {
      await b.whenReady();
      type R = ForecastResult;
      if (!me()) return h.refuse<R>('forecast.compute', 'skill_forecasts', null, 'not_signed_in', FC_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['Agg', 'R', 'W', 'A'])) return h.refuse<R>('forecast.compute', 'skill_forecasts', null, 'forbidden', FC_MSG.forbidden);
      const role = ctx().actingRole('workforce_strategy', ['Agg', 'R', 'W', 'A']);
      const r = forecastFor(forecastInputFromTables(raw), params ?? {});
      if (r.code !== 'ok') return r.code === 'invalid' ? h.refuse<R>('forecast.compute', 'skill_forecasts', null, 'invalid', FC_MSG.invalid, role)
        : h.refuse<R>('forecast.compute', 'skill_forecasts', (params as Row)?.scenario_id ?? null, 'not_found', FC_MSG.not_found, role);
      return { ok: true, code: 'ok', message: 'Skill forecast (SIMULATED)', data: r.result } as Result<R>;
    },

    async saveSkillForecast(input: SaveForecastInput) {
      await b.whenReady();
      type R = { id: string; cycle: number; version: number; name: string };
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('forecast.save', 'skill_forecasts', given, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', FC_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['W', 'A'])) return refuse('forbidden', FC_MSG.forbidden_save);
      const role = ctx().actingRole('workforce_strategy', ['W', 'A']);
      const nm = txt(input?.name);
      if (nm.length < 3 || nm.length > 120) return refuse('invalid', FC_MSG.name, role);
      if (!(SCENARIOS as readonly string[]).includes(input?.scenario as string)) return refuse('invalid', FC_MSG.scenario, role);
      const r = forecastFor(forecastInputFromTables(raw), input?.params ?? {});
      if (r.code !== 'ok') return r.code === 'invalid' ? refuse('invalid', FC_MSG.invalid, role) : refuse('not_found', FC_MSG.not_found, role);
      const name = simulatedName(nm);
      const ts = nowTs();
      if (given) {
        const cur = get('skill_forecasts', given);
        if (!cur || cur.created_by !== pid) return refuse('not_found', FC_MSG.not_yours, role);
        if (cur.status !== 'draft') return refuse('released', FC_MSG.released, role);
        upd('skill_forecasts', given, { name, scenario: input.scenario, params: r.result.params, results: r.result, basis: r.result.basis, method: r.result.method, updated_at: ts });
        return h.done<R>('forecast.save', 'skill_forecasts', given, name, role, null, '', 'Forecast version saved', { id: given, cycle: Number(cur.cycle), version: Number(cur.version), name }, ['skill_forecasts']);
      }
      const cycle = Number(todayIso().slice(0, 4));
      const version = raw('skill_forecasts').filter((f) => Number(f.cycle) === cycle).reduce((m, f) => Math.max(m, Number(f.version)), 0) + 1;
      const id = `sf-${cycle}-v${version}`;
      ins('skill_forecasts', {
        id, cycle, version, name, scenario: input.scenario, params: r.result.params, results: r.result, basis: r.result.basis, method: r.result.method, status: 'draft',
        summary_en: '', summary_ar: '', created_by: pid, created_at: ts, updated_at: ts, released_by: null, released_at: null, superseded_by: null, simulated: true,
      });
      return h.done<R>('forecast.save', 'skill_forecasts', id, name, role, null, '', 'Forecast version saved', { id, cycle, version, name }, ['skill_forecasts']);
    },

    async releaseSkillForecast(id, summaryEn, summaryAr) {
      await b.whenReady();
      type R = { id: string; superseded: string | null };
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('forecast.release', 'skill_forecasts', id ?? null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', FC_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['A'])) return refuse('forbidden', FC_MSG.forbidden_release);
      const role = ctx().actingRole('workforce_strategy', ['A']);
      const cur = get('skill_forecasts', id);
      if (!cur) return refuse('not_found', FC_MSG.version_not_found, role);
      if (cur.status === 'released') return refuse('already_released', FC_MSG.already_released, role);
      if (cur.status === 'superseded') return refuse('superseded', FC_MSG.superseded, role);
      const en = txt(summaryEn), ar = txt(summaryAr);
      if (en.length < 10 || en.length > 600 || ar.length < 10 || ar.length > 600) return refuse('invalid', FC_MSG.summary, role);
      if (!publicTextIsClean([cur.name, en, ar])) return refuse('not_clean', FC_MSG.not_clean, role);
      const r = forecastFor(forecastInputFromTables(raw), cur.params ?? {});
      if (r.code !== 'ok') return r.code === 'invalid' ? refuse('invalid', FC_MSG.invalid, role) : refuse('not_found', FC_MSG.not_found, role);
      const prev = raw('skill_forecasts').filter((f) => f.status === 'released' && Number(f.cycle) === Number(cur.cycle) && f.id !== id).map((f) => f.id as string).sort();
      const ts = nowTs();
      for (const p of prev) upd('skill_forecasts', p, { status: 'superseded', superseded_by: id, updated_at: ts });
      upd('skill_forecasts', id, { status: 'released', summary_en: en, summary_ar: ar, results: r.result, basis: r.result.basis, method: r.result.method, released_by: pid, released_at: ts, updated_at: ts });
      const superseded = prev.length ? prev.join(',') : null;
      return h.done<R>('forecast.release', 'skill_forecasts', id, `${cur.name}${superseded ? ` supersedes ${superseded}` : ''}`, role, 'kafaa.workforce.forecast_release', `Skill forecast released: ${cur.name}`,
        'Forecast released', { id, superseded }, ['skill_forecasts']);
    },
  };
}
