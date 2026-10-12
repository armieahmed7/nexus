// M35 LocalBackend RPC implementations for FS wave G · E1 (FS60 ISO 30414 disclosure pack, FS61 skills pilots registry). Spread into
// makeLocalM35 (backend/local.ts). 1:1 mirror of supabase/migrations/20261010271001_kafaa_fs71_disclosure_pilots.sql: the same checks in
// the same order, the same refusal codes and messages (HC_MSG, SP_MSG), one audit row for every refusal and every write, ledger rows on
// disclosure approvals, pilot sign-offs and pilot closures. Rules: src/modules/m35/{disclosure,pilots}.ts. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { disclosureFromTables } from '../disclosureData';
import {
  approveProblem, lineProblem, materialityOk, periodBounds, periodClosed, periodComputable,
  type DisclosureValues, type LineInput, type MetricValue, type Narrative,
} from '../disclosure';
import { adoptionRate, closeProblem, pilotProblem, referenceOf, signoffProblem, type Adoption, type PilotInput, type SignoffInput } from '../pilots';
import type { M35Rpc, PilotStats, SaveDisclosureInput } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** User-facing refusal messages (identical in SQL). */
export const HC_MSG = {
  not_signed_in: 'Sign in to use the disclosure pack',
  forbidden: 'The disclosure pack is for the HR director, HR analysts, admins and auditors',
  invalid_period: 'Choose a quarter from 2025-Q1 to the current quarter',
  forbidden_save: 'Only HR analysts and the HR director prepare a disclosure',
  period_open: 'A disclosure is prepared only after the quarter has ended',
  published: 'This disclosure is published and can no longer change',
  invalid: 'Check the disclosure: ',
  locked: 'An approved line cannot change',
  forbidden_approve: 'Only the HR director approves disclosure lines',
  not_found: 'Disclosure not found',
  no_materiality: 'Write the materiality statement (40 to 1500 characters in English and in Arabic) before approving',
  already_approved: 'This line is already approved',
  no_narrative: 'A metric publishes only with its narrative and variance explanation in English and in Arabic',
  maker_checker: 'A second person must approve: you wrote this narrative',
  stale: 'The data changed since the values were computed; save the disclosure again to refresh them',
} as const;
export const HC_PROBLEM_TEXT: Record<string, string> = {
  lines: 'send the lines as a list with one line per metric',
  metric: 'choose a metric from the library',
  narrative: 'an owner narrative of 20 to 1200 characters in English and in Arabic',
  variance: 'a variance explanation of 10 to 600 characters in English and in Arabic',
  materiality: 'a materiality statement of 40 to 1500 characters in English and in Arabic',
  metrics: 'choose one or more metric lines of this disclosure',
};
export const SP_MSG = {
  not_signed_in: 'Sign in to see skills pilots',
  forbidden_read: 'Pilot results are for staff; the full registry is for HR, the training manager, admins and auditors',
  forbidden: 'Only HR analysts and the HR director register or close pilots',
  not_found: 'Pilot not found',
  invalid: 'Check the pilot: ',
  locked: 'A pilot under evaluation or closed cannot be edited',
  not_evaluator: 'Only the named evaluator signs off this pilot',
  not_running: 'Only a running pilot is signed off',
  invalid_signoff: 'Check the sign-off: ',
  closed: 'This pilot is already closed',
  no_signoff: 'A pilot cannot close without the evaluator\'s sign-off',
  maker_checker: 'The evaluator cannot close their own evaluation',
  invalid_close: 'Choose an adoption decision that fits the result (a failed pilot is not adopted or is funded for a redesign)',
} as const;
export const SP_PROBLEM_TEXT: Record<string, string> = {
  id: 'an id like sp-short-name (lowercase letters, digits and hyphens)',
  title: 'a title of 5 to 140 characters in English and in Arabic',
  hypothesis: 'a hypothesis of 20 to 800 characters in English and in Arabic',
  comparison: 'a comparison group of 10 to 600 characters in English and in Arabic',
  people: 'an owner and an evaluator who are active staff role cards',
  independence: 'an independent evaluator: not the pilot owner and not the person who registered it',
  metrics: 'one to five metrics, each with a key, labels in English and Arabic, a unit, a baseline and a target',
  skills: 'up to six catalogue skills',
  dates: 'start and end dates from 2024 to 2030, the start on or before the end',
  groups: 'group sizes as whole numbers from 0 to 100000',
  status: 'choose draft or running (a running pilot stays running)',
};
export const SIGNOFF_PROBLEM_TEXT: Record<string, string> = {
  result: 'choose success, mixed or failed',
  recommendation: 'recommend adopted, expanded, further funded or not adopted (a failed pilot is not adopted or is funded for a redesign)',
  summary: 'a result summary of 20 to 1200 characters in English and in Arabic',
  lessons: 'lessons of 10 to 1200 characters in English and in Arabic',
  metrics: 'a measured pilot value (and an optional comparison value) for every metric',
};

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const sameValue = (a: MetricValue | undefined, b: MetricValue | undefined) => !!a && !!b && a.value === b.value && a.num === b.num && a.den === b.den;

export function makeLocalFs60(b: LocalBackend, h: LocalRpcHelpers): Pick<M35Rpc, 'computeDisclosure' | 'saveDisclosure' | 'approveDisclosure' | 'pilotStats' | 'savePilot' | 'signoffPilot' | 'closePilot'> {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const activeMetricIds = () => raw('hc_metrics').filter((m) => m.status === 'active').sort((x, y) => Number(x.sort) - Number(y.sort) || (x.id < y.id ? -1 : 1)).map((m) => m.id as string);

  return {
    // ───────────── FS60
    async computeDisclosure(period) {
      await b.whenReady();
      type R = DisclosureValues;
      const p = typeof period === 'string' ? period : '';
      if (!me()) return h.refuse<R>('disclosure.compute', 'hc_disclosures', null, 'not_signed_in', HC_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['R', 'W', 'A'])) return h.refuse<R>('disclosure.compute', 'hc_disclosures', null, 'forbidden', HC_MSG.forbidden);
      const role = ctx().actingRole('workforce_strategy', ['R', 'W', 'A']);
      if (!periodComputable(p, todayIso())) return h.refuse<R>('disclosure.compute', 'hc_disclosures', null, 'invalid', HC_MSG.invalid_period, role);
      return { ok: true, code: 'ok', message: 'Disclosure values (SIMULATED)', data: disclosureFromTables(raw, p)! } as Result<R>;
    },

    async saveDisclosure(input: SaveDisclosureInput) {
      await b.whenReady();
      type R = { id: string; period: string; version: number; ready: number; approved: number };
      const period = typeof input?.period === 'string' ? input.period : '';
      const id = `hcd-${period}`;
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('disclosure.save', 'hc_disclosures', period ? id : null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', HC_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['W', 'A'])) return refuse('forbidden', HC_MSG.forbidden_save);
      const role = ctx().actingRole('workforce_strategy', ['W', 'A']);
      const today = todayIso();
      if (!periodComputable(period, today)) return refuse('invalid', HC_MSG.invalid_period, role);
      if (!periodClosed(period, today)) return refuse('period_open', HC_MSG.period_open, role);
      const cur = get('hc_disclosures', id);
      if (cur && cur.status === 'published') return refuse('published', HC_MSG.published, role);
      const metricIds = activeMetricIds();
      const lines = input?.lines ?? [];
      if (!Array.isArray(lines) || lines.length > metricIds.length) return refuse('invalid', HC_MSG.invalid + HC_PROBLEM_TEXT.lines, role);
      const seen = new Set<string>();
      for (const l of lines) {
        const pr = lineProblem(l, metricIds);
        if (pr) return refuse('invalid', HC_MSG.invalid + HC_PROBLEM_TEXT[pr], role);
        if (seen.has(l.metric_id)) return refuse('invalid', HC_MSG.invalid + HC_PROBLEM_TEXT.lines, role);
        seen.add(l.metric_id);
      }
      const hasMat = input && (input.materiality_en != null || input.materiality_ar != null);
      const matEn = hasMat ? txt(input.materiality_en) : txt(cur?.materiality_en);
      const matAr = hasMat ? txt(input.materiality_ar) : txt(cur?.materiality_ar);
      if (hasMat && (matEn || matAr) && !materialityOk(matEn, matAr)) return refuse('invalid', HC_MSG.invalid + HC_PROBLEM_TEXT.materiality, role);
      const approvals = { ...((cur?.approvals ?? {}) as Row) };
      const narratives = { ...((cur?.narratives ?? {}) as Record<string, Narrative>) };
      const ts = nowTs();
      for (const l of lines as LineInput[]) {
        const old = narratives[l.metric_id];
        const same = !!old && old.narrative_en === txt(l.narrative_en) && old.narrative_ar === txt(l.narrative_ar) && old.variance_en === txt(l.variance_en) && old.variance_ar === txt(l.variance_ar);
        if (approvals[l.metric_id]) { if (!same) return refuse('locked', HC_MSG.locked, role); continue; }
        if (!same) narratives[l.metric_id] = { narrative_en: txt(l.narrative_en), narrative_ar: txt(l.narrative_ar), variance_en: txt(l.variance_en), variance_ar: txt(l.variance_ar), by: pid, at: ts };
      }
      const fresh = disclosureFromTables(raw, period)!;
      const oldVals = ((cur?.metric_values?.metrics ?? []) as MetricValue[]);
      fresh.metrics = fresh.metrics.map((m) => (approvals[m.metric_id] ? oldVals.find((o) => o.metric_id === m.metric_id) ?? m : m));
      const bnd = periodBounds(period)!;
      const version = cur ? Number(cur.version) + 1 : 1;
      const patch = { status: 'draft', metric_values: fresh, narratives, approvals, materiality_en: matEn, materiality_ar: matAr, method: fresh.method, computed_on: today, updated_by: pid, updated_at: ts, version };
      if (cur) upd('hc_disclosures', id, patch);
      else ins('hc_disclosures', { id, period, period_start: bnd.start, period_end: bnd.end, ...patch, updated_by: null, prepared_by: pid, created_at: ts, published_by: null, published_at: null, simulated: true });
      const ready = metricIds.filter((m) => !approvals[m] && narratives[m] && lineProblem({ ...narratives[m], metric_id: m }, [m]) === null).length;
      const approved = metricIds.filter((m) => approvals[m]).length;
      return h.done<R>('disclosure.save', 'hc_disclosures', id, `${period} v${version} ready ${ready} approved ${approved}`, role, null, '', cur ? 'Disclosure saved' : 'Disclosure prepared',
        { id, period, version, ready, approved }, ['hc_disclosures']);
    },

    async approveDisclosure(id, metricIds) {
      await b.whenReady();
      type R = { id: string; approved: string[]; published: boolean };
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('disclosure.approve', 'hc_disclosures', typeof id === 'string' && id ? id : null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', HC_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['A'])) return refuse('forbidden', HC_MSG.forbidden_approve);
      const role = ctx().actingRole('workforce_strategy', ['A']);
      const cur = get('hc_disclosures', id);
      if (!cur) return refuse('not_found', HC_MSG.not_found, role);
      if (cur.status === 'published') return refuse('published', HC_MSG.published, role);
      const all = activeMetricIds();
      const ids = Array.isArray(metricIds) ? metricIds : [];
      if (!ids.length || ids.some((m) => typeof m !== 'string' || !all.includes(m)) || new Set(ids).size !== ids.length) return refuse('invalid', HC_MSG.invalid + HC_PROBLEM_TEXT.metrics, role);
      if (!materialityOk(cur.materiality_en, cur.materiality_ar)) return refuse('no_materiality', HC_MSG.no_materiality, role);
      for (const m of ids) {
        const pr = approveProblem(cur, m, pid);
        if (pr) return refuse(pr, HC_MSG[pr], role);
      }
      const fresh = disclosureFromTables(raw, cur.period)!;
      const stored = (cur.metric_values?.metrics ?? []) as MetricValue[];
      for (const m of ids) if (!sameValue(stored.find((x) => x.metric_id === m), fresh.metrics.find((x) => x.metric_id === m))) return refuse('stale', HC_MSG.stale, role);
      const ts = nowTs();
      const approvals = { ...((cur.approvals ?? {}) as Row) };
      for (const m of ids) approvals[m] = { by: pid, at: ts };
      const published = all.every((m) => !!approvals[m]);
      upd('hc_disclosures', id, { approvals, status: published ? 'published' : 'draft', published_by: published ? pid : null, published_at: published ? ts : null, updated_by: pid, updated_at: ts, version: Number(cur.version) + 1 });
      return h.done<R>('disclosure.approve', 'hc_disclosures', id, `${cur.period} approved ${ids.join(',')}${published ? ' published' : ''}`, role, 'kafaa.workforce.hc_disclosure_approve',
        `ISO 30414 disclosure ${cur.period}: ${ids.length} line(s) approved${published ? ', published' : ''}`, published ? 'Disclosure published' : 'Lines approved', { id, approved: ids, published }, ['hc_disclosures']);
    },

    // ───────────── FS61
    async pilotStats() {
      await b.whenReady();
      type R = PilotStats;
      if (!me()) return h.refuse<R>('pilot.stats', 'skill_pilots', null, 'not_signed_in', SP_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['Agg', 'R', 'W', 'A']) && !ctx().has('internal_content', ['R'])) return h.refuse<R>('pilot.stats', 'skill_pilots', null, 'forbidden', SP_MSG.forbidden_read);
      const stats = adoptionRate(raw('skill_pilots') as never);
      return { ok: true, code: 'ok', message: 'Skills pilots', data: { ...stats, reference: referenceOf(raw('benchmarks')) } } as Result<R>;
    },

    async savePilot(input: PilotInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string };
      const pidIn = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('pilot.save', 'skill_pilots', pidIn, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', SP_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['W', 'A'])) return refuse('forbidden', SP_MSG.forbidden);
      const role = ctx().actingRole('workforce_strategy', ['W', 'A']);
      const cur = get('skill_pilots', pidIn);
      if (cur && cur.status !== 'draft' && cur.status !== 'running') return refuse('locked', SP_MSG.locked, role);
      const pctx = {
        staff: raw('people').filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id as string),
        skills: raw('skills').map((s) => s.id as string),
        creator: cur ? (cur.created_by as string) : pid,
      };
      const pr = pilotProblem(input, pctx, !cur) ?? (cur && cur.status === 'running' && input.status === 'draft' ? 'status' : null);
      if (pr) return refuse('invalid', SP_MSG.invalid + SP_PROBLEM_TEXT[pr], role);
      const id = input.id as string;
      const ts = nowTs();
      const version = cur ? Number(cur.version) + 1 : 1;
      const patch = {
        title_en: txt(input.title_en), title_ar: txt(input.title_ar), hypothesis_en: txt(input.hypothesis_en), hypothesis_ar: txt(input.hypothesis_ar),
        comparison_en: txt(input.comparison_en), comparison_ar: txt(input.comparison_ar), pilot_n: input.pilot_n ?? null, comparison_n: input.comparison_n ?? null,
        owner_person_id: input.owner_person_id, evaluator_person_id: input.evaluator_person_id,
        metrics: input.metrics.map((m) => ({ key: m.key, label_en: txt(m.label_en), label_ar: txt(m.label_ar), unit: m.unit, baseline: m.baseline, target: m.target, pilot: null, comparison: null })),
        skill_ids: [...input.skill_ids], start_on: input.start_on, end_on: input.end_on, status: input.status, updated_by: pid, updated_at: ts, version,
      };
      if (cur) upd('skill_pilots', id, patch);
      else ins('skill_pilots', {
        id, ...patch, updated_by: null, result: null, recommendation: null, adoption: null, result_en: '', result_ar: '', lessons_en: '', lessons_ar: '', signoff_by: null, signoff_at: null,
        closed_by: null, closed_at: null, published: false, benchmark_ids: ['FSC'], created_by: pid, created_at: ts, sort: raw('skill_pilots').reduce((m, r) => Math.max(m, Number(r.sort ?? 0)), 0) + 1, simulated: true,
      });
      return h.done<R>('pilot.save', 'skill_pilots', id, `v${version} ${input.status}`, role, null, '', cur ? 'Pilot saved' : 'Pilot registered', { id, version, status: input.status }, ['skill_pilots']);
    },

    async signoffPilot(id, input: SignoffInput) {
      await b.whenReady();
      type R = { id: string; status: string };
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('pilot.signoff', 'skill_pilots', typeof id === 'string' && id ? id : null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', SP_MSG.not_signed_in);
      const role = ctx().actingRole('own_profile', ['Own']);
      const cur = get('skill_pilots', id);
      if (!cur) return refuse('not_found', SP_MSG.not_found, role);
      if (cur.evaluator_person_id !== pid) return refuse('not_evaluator', SP_MSG.not_evaluator, role);
      if (cur.status !== 'running') return refuse('not_running', SP_MSG.not_running, role);
      const keys = ((cur.metrics ?? []) as Row[]).map((m) => m.key as string);
      const pr = signoffProblem(input, keys);
      if (pr) return refuse('invalid', SP_MSG.invalid_signoff + SIGNOFF_PROBLEM_TEXT[pr], role);
      const ts = nowTs();
      const metrics = ((cur.metrics ?? []) as Row[]).map((m) => { const r = input.metric_results.find((x) => x.key === m.key)!; return { ...m, pilot: r.pilot, comparison: r.comparison ?? null }; });
      upd('skill_pilots', id, {
        status: 'evaluating', result: input.result, recommendation: input.recommendation, result_en: txt(input.result_en), result_ar: txt(input.result_ar),
        lessons_en: txt(input.lessons_en), lessons_ar: txt(input.lessons_ar), metrics, signoff_by: pid, signoff_at: ts, updated_by: pid, updated_at: ts, version: Number(cur.version) + 1,
      });
      return h.done<R>('pilot.signoff', 'skill_pilots', id, `${input.result} recommends ${input.recommendation}`, role, 'kafaa.workforce.pilot_signoff', `Skills pilot signed off by the evaluator: ${id} ${input.result}`,
        'Evaluation signed off', { id, status: 'evaluating' }, ['skill_pilots']);
    },

    async closePilot(id, adoption: Adoption) {
      await b.whenReady();
      type R = { id: string; adoption: Adoption; rate: number | null };
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('pilot.close', 'skill_pilots', typeof id === 'string' && id ? id : null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', SP_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['W', 'A'])) return refuse('forbidden', SP_MSG.forbidden);
      const role = ctx().actingRole('workforce_strategy', ['W', 'A']);
      const cur = get('skill_pilots', id);
      if (!cur) return refuse('not_found', SP_MSG.not_found, role);
      if (cur.status === 'closed') return refuse('closed', SP_MSG.closed, role);
      if (cur.status !== 'evaluating' || !cur.signoff_by || cur.signoff_by !== cur.evaluator_person_id) return refuse('no_signoff', SP_MSG.no_signoff, role);
      if (cur.evaluator_person_id === pid) return refuse('maker_checker', SP_MSG.maker_checker, role);
      if (closeProblem(adoption, cur.result)) return refuse('invalid', SP_MSG.invalid_close, role);
      const ts = nowTs();
      upd('skill_pilots', id, { status: 'closed', adoption, published: true, closed_by: pid, closed_at: ts, updated_by: pid, updated_at: ts, version: Number(cur.version) + 1 });
      const rate = adoptionRate(raw('skill_pilots') as never).rate;
      return h.done<R>('pilot.close', 'skill_pilots', id, `${cur.result} ${adoption}`, role, 'kafaa.workforce.pilot_close', `Skills pilot closed: ${id} ${cur.result}, ${adoption}`,
        'Pilot closed and published', { id, adoption, rate }, ['skill_pilots']);
    },
  };
}

