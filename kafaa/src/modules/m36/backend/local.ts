// M36 LocalBackend RPC implementations (owners: wave G E3 (FS64, FS65) and wave I E4 (FS82, FS83)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261010273001_kafaa_fs73_regional_pledges.sql: the same checks in the same order, the same refusal
// codes and messages (RG_MSG, PL_MSG), one audit row for every refusal and every call, ledger rows on a demand release, on every
// commitment change and on every pledge registration. Rules: src/modules/m36/{regional,pledges}.ts. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { publicTextIsClean } from '../../../domain/future';
import {
  commitmentProblem, commitmentView, deliveryProblem, demandRows, lockedTerms, type CommitCtx, type CommitmentInput, type DeliveryInput, type PlanEntry,
} from '../regional';
import { ENEC_ENTITIES, pledgeLedger, pledgeProblem, pledgeStatus, progressProblem, latestProgress, type Ledger, type PledgeInput, type ProgressInput } from '../pledges';
import type { M36Rpc, ReleaseDemandInput, ReviewCommitmentInput } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** User-facing refusal messages (identical in SQL). */
export const RG_MSG = {
  not_signed_in: 'Sign in to use the regional skills plan',
  forbidden_release: 'Only the HR director releases regional demand to providers',
  forecast_not_found: 'Skill forecast not found',
  forecast_not_released: 'Only a released skill forecast can be shared with providers',
  note: 'Write a note of 10 to 400 characters in English and in Arabic',
  not_clean: 'Release text may not state headcounts or site information (M11 rule)',
  already_current: 'This forecast is already the current regional release',
  empty: 'This forecast has no skill area that can be released',
  forbidden_commit: 'Only a partner or university administrator commits provision for their own organisation',
  action: 'Choose create, revise or withdraw',
  no_release: 'No regional demand has been released yet',
  not_found: 'Commitment not found',
  withdrawn: 'A withdrawn commitment cannot change',
  reason: 'Give a reason of 5 to 300 characters',
  invalid: 'Check the commitment: ',
  forbidden_delivery: 'Only the provider\'s administrator reports delivery',
  invalid_delivery: 'Check the delivery report: ',
  forbidden_review: 'Only HR reviews provider commitments',
  decision: 'Choose acknowledged or queried; a query needs a note of 5 to 400 characters',
} as const;
export const COMMIT_PROBLEM_TEXT: Record<string, string> = {
  area: 'choose a skill area of the current regional release',
  kind: 'choose cohort, course change, new course or apprenticeship',
  title: 'a title of 5 to 160 characters in English and in Arabic',
  summary: 'a summary of 10 to 600 characters in English and in Arabic',
  skills: 'up to eight distinct catalogue skills that are current and not security skills',
  level: 'a target level from 1 to 4',
  plan: 'one to eight academic terms in order, from the current term to 2030S2, each with 1 to 500 seats',
  locked: 'terms that have started keep their planned seats',
};
export const DELIVERY_PROBLEM_TEXT: Record<string, string> = {
  term: 'choose a term of the plan',
  future: 'a term that has not started cannot be reported',
  numbers: 'enrolled from 0 to 1000 and completed from 0 to the number enrolled',
};
export const PL_MSG = {
  not_signed_in: 'Sign in to use the skills pledges ledger',
  forbidden_read: 'The pledges ledger is for ENEC staff, partners, universities, HR and auditors',
  forbidden: 'Only a partner or university administrator (own organisation) or HR (ENEC entities) registers pledges',
  org: 'HR registers pledges for ENEC entities only; partners and universities register for their own organisation',
  invalid: 'Check the pledge: ',
  not_found: 'Pledge not found',
  withdrawn: 'A withdrawn pledge takes no progress',
  invalid_progress: 'Check the progress: ',
} as const;
export const PLEDGE_PROBLEM_TEXT: Record<string, string> = {
  area: 'choose a skill area',
  people: 'a whole number of people from 1 to 5000',
  date: 'a target date at least 30 days ahead and no later than 31 Dec 2035',
  title: 'a title of 5 to 160 characters in English and in Arabic',
  department: 'a department name in English and in Arabic (up to 120 characters), or neither',
};
export const PROGRESS_PROBLEM_TEXT: Record<string, string> = {
  date: 'a date between the pledge date and today',
  numbers: 'whole numbers, completed never above started',
  order: 'a date later than the last snapshot',
  decrease: 'started and completed never go down',
};

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function makeLocalM36(b: LocalBackend, h: LocalRpcHelpers): M36Rpc {
  const me = () => b.identity().personId;
  const myOrg = () => b.identity().orgId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const commitCtx = (today: string): CommitCtx => ({
    areas: [...new Set(raw('regional_demand').filter((d) => d.status === 'current').map((d) => String(d.area)))],
    skills: Object.fromEntries(raw('skills').map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }])),
    today,
  });
  const nextId = (t: string, prefix: string, org: string) => {
    let n = raw(t).filter((r) => r.org_id === org).length + 1;
    while (get(t, `${prefix}-${org}-${n}`)) n++;
    return `${prefix}-${org}-${n}`;
  };

  return {
    // ───────────── FS64
    async releaseRegionalDemand(input: ReleaseDemandInput) {
      await b.whenReady();
      type R = { release_id: string; rows: number; superseded: string | null };
      const fid = str(input?.forecast_id);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('regional.release', 'regional_demand', fid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', RG_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['A']) || !ctx().has('ecosystem', ['W', 'A'])) return refuse('forbidden', RG_MSG.forbidden_release);
      const role = ctx().actingRole('workforce_strategy', ['A']);
      const f = get('skill_forecasts', fid);
      if (!f) return refuse('not_found', RG_MSG.forecast_not_found, role);
      if (f.status !== 'released') return refuse('not_released', RG_MSG.forecast_not_released, role);
      const en = txt(input?.note_en), ar = txt(input?.note_ar);
      if (en.length < 10 || en.length > 400 || ar.length < 10 || ar.length > 400) return refuse('invalid', RG_MSG.note, role);
      if (!publicTextIsClean([en, ar])) return refuse('not_clean', RG_MSG.not_clean, role);
      const cur = raw('regional_demand').filter((d) => d.status === 'current');
      if (cur.some((d) => d.forecast_id === fid)) return refuse('already_current', RG_MSG.already_current, role);
      const rows = demandRows(f.results, f.scenario, Object.fromEntries(raw('skills').map((s) => [s.id, s.area])));
      if (!rows.length) return refuse('empty', RG_MSG.empty, role);
      const cycle = Number(f.cycle);
      const n = new Set(raw('regional_demand').filter((d) => Number(d.cycle) === cycle).map((d) => d.release_id)).size + 1;
      const rid = `rdr-${cycle}-${n}`;
      const prev = [...new Set(cur.map((d) => String(d.release_id)))].sort();
      for (const d of cur) upd('regional_demand', d.id, { status: 'superseded' });
      const ts = nowTs();
      for (const r of rows) {
        ins('regional_demand', {
          id: `${rid}-${r.area}-${r.year}`, release_id: rid, forecast_id: fid, forecast_name: f.name, cycle, region: 'al_dhafra', scenario: f.scenario, area: r.area, year: r.year,
          demand_low: r.demand_low, demand_high: r.demand_high, gap_low: r.gap_low, gap_high: r.gap_high, gap_plan: r.gap_plan, skills_n: r.skills_n, withheld_n: r.withheld_n,
          skill_ids: r.skill_ids, suppressed: r.suppressed, note_en: en, note_ar: ar, status: 'current', released: true, released_by: pid, released_at: ts, simulated: true,
        });
      }
      const superseded = prev.length ? prev.join(',') : null;
      return h.done<R>('regional.release', 'regional_demand', rid, `${fid} ${rows.length} rows${superseded ? ` supersedes ${superseded}` : ''}`, role, 'kafaa.ecosystem.demand_release',
        `Regional skill demand released to providers: ${f.name}`, 'Regional demand released to providers', { release_id: rid, rows: rows.length, superseded }, ['regional_demand']);
    },

    async commitProvision(input: CommitmentInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string };
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('commitment.commit', 'provider_commitments', given, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', RG_MSG.not_signed_in);
      const org = myOrg();
      if (!org || !ctx().has('ecosystem', ['OrgW'])) return refuse('forbidden', RG_MSG.forbidden_commit);
      const role = ctx().actingRole('ecosystem', ['OrgW']);
      const action = input?.action ?? (given ? 'revise' : 'create');
      if (!['create', 'revise', 'withdraw'].includes(action) || (action === 'create') !== (given === null)) return refuse('invalid', RG_MSG.action, role);
      const today = todayIso();
      const ts = nowTs();
      if (action === 'create') {
        const c = commitCtx(today);
        if (!c.areas.length) return refuse('no_release', RG_MSG.no_release, role);
        const problem = commitmentProblem(input, c);
        if (problem) return refuse('invalid', RG_MSG.invalid + COMMIT_PROBLEM_TEXT[problem], role);
        const o = get('organisations', org);
        const id = nextId('provider_commitments', 'pc', org);
        const release = raw('regional_demand').find((d) => d.status === 'current')!.release_id;
        const plan = input.plan.map((p) => ({ term: p.term, seats: p.seats }));
        ins('provider_commitments', {
          id, org_id: org, org_name_en: o?.name_en ?? org, org_name_ar: o?.name_ar ?? org, org_kind: o?.kind ?? 'partner', release_id: release, area: input.area, kind: input.kind,
          title_en: txt(input.title_en), title_ar: txt(input.title_ar), summary_en: txt(input.summary_en), summary_ar: txt(input.summary_ar), skill_ids: [...input.skill_ids], level: input.level,
          plan, delivery: [], status: 'active', withdrawn_reason: null, hr_status: 'pending', hr_note: null, hr_by: null, hr_at: null, version: 1,
          history: [{ action: 'create', version: 1, at: ts, by: pid, plan }], created_by: pid, created_at: ts, updated_by: pid, updated_at: ts, open_read: false, sample: false,
        });
        return h.done<R>('commitment.commit', 'provider_commitments', id, `create ${input.area} ${input.kind}`, role, 'kafaa.ecosystem.commitment', `Provider commitment created: ${txt(input.title_en)}`,
          'Commitment recorded', { id, version: 1, status: 'active' }, ['provider_commitments']);
      }
      const cur = get('provider_commitments', given);
      if (!cur || cur.org_id !== org) return refuse('not_found', RG_MSG.not_found, role);
      if (cur.status !== 'active') return refuse('withdrawn', RG_MSG.withdrawn, role);
      const history = (cur.history ?? []) as Row[];
      if (action === 'withdraw') {
        const reason = txt(input?.reason);
        if (reason.length < 5 || reason.length > 300) return refuse('invalid', RG_MSG.reason, role);
        upd('provider_commitments', cur.id, { status: 'withdrawn', withdrawn_reason: reason, history: [...history, { action: 'withdraw', version: Number(cur.version), at: ts, by: pid, reason }], updated_by: pid, updated_at: ts });
        return h.done<R>('commitment.commit', 'provider_commitments', cur.id, `withdraw: ${reason}`, role, 'kafaa.ecosystem.commitment', `Provider commitment withdrawn: ${cur.title_en}`,
          'Commitment withdrawn', { id: cur.id, version: Number(cur.version), status: 'withdrawn' }, ['provider_commitments']);
      }
      const c = commitCtx(today);
      if (!c.areas.includes(cur.area)) c.areas.push(cur.area);
      const problem = commitmentProblem(input, c, lockedTerms(cur.plan as PlanEntry[], today));
      if (problem) return refuse('invalid', RG_MSG.invalid + COMMIT_PROBLEM_TEXT[problem], role);
      const version = Number(cur.version) + 1;
      const plan = input.plan.map((p) => ({ term: p.term, seats: p.seats }));
      upd('provider_commitments', cur.id, {
        area: input.area, kind: input.kind, title_en: txt(input.title_en), title_ar: txt(input.title_ar), summary_en: txt(input.summary_en), summary_ar: txt(input.summary_ar),
        skill_ids: [...input.skill_ids], level: input.level, plan, delivery: ((cur.delivery ?? []) as Row[]).filter((d) => plan.some((p) => p.term === d.term)),
        hr_status: 'pending', version, history: [...history, { action: 'revise', version, at: ts, by: pid, plan }], updated_by: pid, updated_at: ts,
      });
      return h.done<R>('commitment.commit', 'provider_commitments', cur.id, `revise v${version}`, role, 'kafaa.ecosystem.commitment', `Provider commitment revised: ${txt(input.title_en)}`,
        'Commitment revised', { id: cur.id, version, status: 'active' }, ['provider_commitments']);
    },

    async reportCommitmentDelivery(input: DeliveryInput) {
      await b.whenReady();
      type R = { id: string; term: string; status: string };
      const cid = str(input?.commitment_id);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('commitment.delivery', 'provider_commitments', cid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', RG_MSG.not_signed_in);
      const org = myOrg();
      if (!org || !ctx().has('ecosystem', ['OrgW'])) return refuse('forbidden', RG_MSG.forbidden_delivery);
      const role = ctx().actingRole('ecosystem', ['OrgW']);
      const cur = get('provider_commitments', cid);
      if (!cur || cur.org_id !== org) return refuse('not_found', RG_MSG.not_found, role);
      if (cur.status !== 'active') return refuse('withdrawn', RG_MSG.withdrawn, role);
      const today = todayIso();
      const plan = (cur.plan ?? []) as PlanEntry[];
      const problem = deliveryProblem(input, plan, today);
      if (problem) return refuse('invalid', RG_MSG.invalid_delivery + DELIVERY_PROBLEM_TEXT[problem], role);
      const note = txt(input.note).slice(0, 300);
      const entry = { term: input.term, enrolled: input.enrolled, completed: input.completed, note: note || null, reported_by: pid, reported_at: nowTs() };
      const old = (cur.delivery ?? []) as Row[];
      const delivery = plan.map((p) => (p.term === input.term ? entry : old.find((d) => d.term === p.term))).filter(Boolean) as Row[];
      upd('provider_commitments', cur.id, { delivery, updated_by: pid, updated_at: nowTs() });
      const status = commitmentView({ ...cur, delivery }, today).status;
      return h.done<R>('commitment.delivery', 'provider_commitments', cur.id, `${input.term} enrolled ${input.enrolled} completed ${input.completed}`, role, null, '',
        'Delivery reported', { id: cur.id, term: input.term, status }, ['provider_commitments']);
    },

    async reviewCommitment(input: ReviewCommitmentInput) {
      await b.whenReady();
      type R = { id: string; hr_status: string };
      const cid = str(input?.commitment_id);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('commitment.review', 'provider_commitments', cid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', RG_MSG.not_signed_in);
      if (!ctx().has('ecosystem', ['W', 'A'])) return refuse('forbidden', RG_MSG.forbidden_review);
      const role = ctx().actingRole('ecosystem', ['W', 'A']);
      const cur = get('provider_commitments', cid);
      if (!cur) return refuse('not_found', RG_MSG.not_found, role);
      if (cur.status !== 'active') return refuse('withdrawn', RG_MSG.withdrawn, role);
      const note = txt(input?.note);
      const dec = input?.decision;
      if ((dec !== 'acknowledged' && dec !== 'queried') || note.length > 400 || (dec === 'queried' && note.length < 5)) return refuse('invalid', RG_MSG.decision, role);
      upd('provider_commitments', cur.id, { hr_status: dec, hr_note: note || null, hr_by: pid, hr_at: nowTs() });
      return h.done<R>('commitment.review', 'provider_commitments', cur.id, `${dec}${note ? `: ${note}` : ''}`, role, null, '', dec === 'acknowledged' ? 'Commitment acknowledged' : 'Query sent to the provider',
        { id: cur.id, hr_status: dec }, ['provider_commitments']);
    },

    // ───────────── FS65
    async registerPledge(input: PledgeInput) {
      await b.whenReady();
      type R = { id: string };
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('pledge.register', 'pledges', null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', PL_MSG.not_signed_in);
      const mine = myOrg();
      const given = typeof input?.org_id === 'string' && input.org_id ? input.org_id : null;
      let org: string;
      let role: string | null;
      if (mine && ctx().has('ecosystem', ['OrgW'])) {
        role = ctx().actingRole('ecosystem', ['OrgW']);
        if (given && given !== mine) return refuse('org', PL_MSG.org, role);
        org = mine;
      } else if (ctx().has('ecosystem', ['W'])) {
        role = ctx().actingRole('ecosystem', ['W']);
        if (!given || !(ENEC_ENTITIES as readonly string[]).includes(given) || get('organisations', given)?.kind !== 'group_entity') return refuse('org', PL_MSG.org, role);
        org = given;
      } else return refuse('forbidden', PL_MSG.forbidden);
      const today = todayIso();
      const problem = pledgeProblem(input, today);
      if (problem) return refuse('invalid', PL_MSG.invalid + PLEDGE_PROBLEM_TEXT[problem], role);
      const o = get('organisations', org);
      const id = nextId('pledges', 'pl', org);
      const ts = nowTs();
      const de = txt(input.department_en), da = txt(input.department_ar);
      ins('pledges', {
        id, org_id: org, org_name_en: o?.name_en ?? org, org_name_ar: o?.name_ar ?? org, org_kind: o?.kind ?? 'partner', area: input.area, people: input.people,
        target_date: input.target_date, pledged_on: today, title_en: txt(input.title_en), title_ar: txt(input.title_ar), department_en: de || null, department_ar: da || null,
        status: 'active', created_by: pid, created_at: ts, updated_at: ts, open_read: false, sample: false,
      });
      return h.done<R>('pledge.register', 'pledges', id, `${org} ${input.area} ${input.people} by ${input.target_date}`, role, 'kafaa.ecosystem.pledge', `Skills pledge registered: ${txt(input.title_en)}`,
        'Pledge registered', { id }, ['pledges']);
    },

    async recordPledgeProgress(input: ProgressInput) {
      await b.whenReady();
      type R = { id: string; status: string };
      const plid = str(input?.pledge_id);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('pledge.progress', 'pledge_progress', plid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', PL_MSG.not_signed_in);
      const mine = myOrg();
      const orgw = !!mine && ctx().has('ecosystem', ['OrgW']);
      const hr = ctx().has('ecosystem', ['W']);
      if (!orgw && !hr) return refuse('forbidden', PL_MSG.forbidden);
      const role = orgw ? ctx().actingRole('ecosystem', ['OrgW']) : ctx().actingRole('ecosystem', ['W']);
      const p = get('pledges', plid);
      if (!p || !((orgw && p.org_id === mine) || (!orgw && hr && (ENEC_ENTITIES as readonly string[]).includes(p.org_id)))) return refuse('not_found', PL_MSG.not_found, role);
      if (p.status !== 'active') return refuse('withdrawn', PL_MSG.withdrawn, role);
      const today = todayIso();
      const prev = raw('pledge_progress').filter((x) => x.pledge_id === plid).sort((a, c) => (String(a.as_of) < String(c.as_of) ? 1 : -1))[0] ?? null;
      const problem = progressProblem(input, { pledged_on: String(p.pledged_on) }, prev ? { as_of: String(prev.as_of), started: Number(prev.started), completed: Number(prev.completed) } : null, today);
      if (problem) return refuse('invalid', PL_MSG.invalid_progress + PROGRESS_PROBLEM_TEXT[problem], role);
      const id = `pp-${plid}-${input.as_of}`;
      const ne = txt(input.note_en).slice(0, 300), na = txt(input.note_ar).slice(0, 300);
      ins('pledge_progress', { id, pledge_id: plid, org_id: p.org_id, as_of: input.as_of, started: input.started, completed: input.completed, note_en: ne || null, note_ar: na || null, reported_by: pid, reported_at: nowTs(), open_read: false });
      const status = pledgeStatus(p, latestProgress(raw('pledge_progress'), plid, today), today);
      return h.done<R>('pledge.progress', 'pledge_progress', id, `${input.as_of} started ${input.started} completed ${input.completed}`, role, null, '', 'Progress recorded', { id, status }, ['pledge_progress']);
    },

    async pledgeLedger() {
      await b.whenReady();
      if (!me()) return h.refuse<Ledger>('pledge.ledger', 'pledges', null, 'not_signed_in', PL_MSG.not_signed_in);
      if (!ctx().has('ecosystem', ['R', 'Agg', 'W', 'A', 'OwnOrg'])) return h.refuse<Ledger>('pledge.ledger', 'pledges', null, 'forbidden', PL_MSG.forbidden_read);
      const pl = raw('pledges');
      const data = pledgeLedger({ pledges: pl, progress: raw('pledge_progress'), orgs: Object.fromEntries(pl.map((p) => [p.org_id, p.org_kind])) }, todayIso());
      return { ok: true, code: 'ok', message: 'Skills pledges ledger', data } as Result<Ledger>;
    },
  };
}
