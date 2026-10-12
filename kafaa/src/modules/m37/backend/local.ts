// M37 LocalBackend RPC implementations (owners: wave G E2 (FS62, FS63) and wave H E2 (FS73, FS74)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261010272001_kafaa_fs72_national_alignment.sql: the same checks in the same order, the same refusal
// codes and messages (NA_MSG, RO_MSG), one audit row for every refusal and every write, ledger rows when a tag is added or retired and
// when a MoHRE code is verified or cleared. Rules: src/modules/m37/{national,occupations}.ts. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { linkProblem, nationalReport, sourceTier, tagProblem, targetView, worldFrom, type LinkInput, type TagInput, type TagRow } from '../national';
import { codeProblem, occupationProblem, occupationTrend, type CodeInput, type OccupationInput } from '../occupations';
import { emiratiPipeline, pipelineAllowed, pipelineWorldFrom } from '../pipeline';
import { inPlan, planEntries, planFor, targetProblem, targetViewOf, walletCounter, walletStatus, walletWorld, isoZ, WALLET_METRIC, WALLET_TARGET_ID, type TargetInput } from '../wallet';
import type { M37Rpc } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** User-facing refusal messages (identical in SQL). */
export const NA_MSG = {
  not_signed_in: 'Sign in to maintain national alignment',
  forbidden: 'Only the HR director and platform admins maintain national tags',
  not_found: 'National tag not found',
  conflict: 'This strategy already has its strategy-level tag',
  code_taken: 'This tag code is already used',
  invalid: 'Check the tag: ',
  link_not_found: 'Link not found',
  link_invalid: 'Check the link: ',
} as const;
export const TAG_PROBLEM_TEXT: Record<string, string> = {
  strategy: 'choose one of the six national strategies (the strategy and kind of a saved tag do not change)',
  kind: 'choose strategy, pillar, goal or group',
  parent: 'a pillar, goal or group sits under the active strategy-level tag of the same strategy',
  code: 'a code of 2 to 24 capital letters, digits or hyphens',
  name: 'a name of 2 to 120 characters in English and in Arabic',
  summary: 'a summary of 20 to 600 characters in English and in Arabic',
  clean: 'tag text may not state headcounts or site information',
  typed_total: 'tag text may name years but no typed number: reports compute every total from the data',
  sources: 'one to five sources, each with a label, an https link and an as-of date that is not in the future',
  horizon: 'a horizon year from 2022 to 2100',
  scope: 'the source scope is direct or indirect',
  status: 'choose active or retired',
  children: 'retire its pillars, goals or groups first',
};
export const LINK_PROBLEM_TEXT: Record<string, string> = {
  tag: 'choose an active tag',
  table: 'choose a skill, competence, programme, pathway, credential or target',
  target: 'the linked row was not found',
  derived: 'this link is derived from the data (Jahiz group or Net Zero competence); change the data, not the tag',
  security: 'security skills stay at career-path level and are not tagged',
  note: 'a note of 10 to 300 characters in English and in Arabic',
  clean: 'link notes may not state headcounts or site information',
  typed_total: 'link notes may name years but no typed number',
};
export const RO_MSG = {
  not_signed_in: 'Sign in to maintain occupation mappings',
  forbidden: 'Only the HR director and platform admins edit occupation mappings',
  forbidden_verify: 'Only a platform admin records or clears a verified MoHRE code',
  not_found: 'Role mapping not found',
  invalid: 'Check the mapping: ',
  code_invalid: 'Check the code: ',
  maker_checker: 'The person who last edited this mapping cannot verify its code',
  not_verified: 'This mapping has no verified code',
  reason: 'Give a reason of 10 to 300 characters',
} as const;
export const RO_PROBLEM_TEXT: Record<string, string> = {
  role: 'choose a current job role',
  concept: 'concept roles get no occupation code or level',
  label: 'an occupation label of 3 to 120 characters in English and in Arabic',
  clean: 'labels and rationales may not state numbers, headcounts or site information',
  level: 'a skill level from 1 to 5',
  basis: 'use the education-rule level, or choose "reviewed" with a rationale',
  rationale: 'a reviewed level needs a rationale of 10 to 400 characters in English and in Arabic',
};
export const CODE_PROBLEM_TEXT: Record<string, string> = {
  code: 'a code of 2 to 16 capital letters, digits, dots or hyphens, copied from the source',
  source: 'a source label and an https link',
  host: 'the source must be an official UAE government page (u.ae or a gov.ae domain)',
  date: 'the date the source was read, not in the future',
};

/** FS73/FS74 refusal messages (identical in SQL). */
export const FW_MSG = {
  not_signed_in: 'Sign in to see your Future Skills Wallet',
  forbidden_target: 'Only the HR director sets the Future Skills Wallet target',
  invalid: 'Check the target: ',
  unchanged: 'This is already the target: change the value or the date',
  forbidden_plan: 'Only staff with a development plan can do this',
  complete: 'Your wallet is complete: there is nothing to add',
  no_plan: 'Start a development plan first (My plan)',
} as const;
export const FW_PROBLEM_TEXT: Record<string, string> = {
  pct: 'a whole percentage from 1 to 100',
  due: 'a target date after today and no later than 2035-12-31',
  note: 'a note of 10 to 300 characters in English and in Arabic',
  clean: 'the note may not state headcounts or site information',
};

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const str = (v: unknown) => (typeof v === 'string' ? v : '');

const tv = (targets: Row[], people: Row[]) => targetViewOf(targets, people);

export function makeLocalM37(b: LocalBackend, h: LocalRpcHelpers): M37Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);

  return {
    // ───────────── FS62
    async nationalReport(filter) {
      await b.whenReady();
      if (!me() || !ctx().has('national_alignment', ['R', 'Agg', 'W', 'A'])) return null;
      return nationalReport(worldFrom(raw), filter ?? null, ctx().has('national_alignment', ['Agg', 'W', 'A']));
    },

    async saveNationalTag(input: TagInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string };
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const code = str(input?.code);
      const id = given ?? (code ? `nt-${code.toLowerCase()}` : '');
      const entity = id || null;
      const refuse = (c: string, msg: string, r: string | null = null) => h.refuse<R>('national.tag.save', 'national_tags', entity, c, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', NA_MSG.not_signed_in);
      if (!ctx().has('national_alignment', ['W', 'A'])) return refuse('forbidden', NA_MSG.forbidden);
      const role = ctx().actingRole('national_alignment', ['W', 'A']);
      const cur = get('national_tags', id);
      if (given && !cur) return refuse('not_found', NA_MSG.not_found, role);
      if (!given && cur) return refuse('code_taken', NA_MSG.code_taken, role);
      const tags = raw('national_tags') as TagRow[];
      const today = todayIso();
      const problem = tagProblem(input, { tags, today });
      if (problem) return refuse('invalid', NA_MSG.invalid + TAG_PROBLEM_TEXT[problem], role);
      if (cur && (cur.strategy !== input.strategy || cur.kind !== input.kind)) return refuse('invalid', NA_MSG.invalid + TAG_PROBLEM_TEXT.strategy, role);
      const status = input.status ?? 'active';
      if (input.kind === 'strategy' && status === 'active' && tags.some((t) => t.id !== id && t.kind === 'strategy' && t.strategy === input.strategy && t.status === 'active')) return refuse('conflict', NA_MSG.conflict, role);
      if (tags.some((t) => t.id !== id && t.code === code)) return refuse('code_taken', NA_MSG.code_taken, role);
      if (cur && status === 'retired' && cur.kind === 'strategy' && tags.some((t) => t.parent_id === id && t.status === 'active')) return refuse('invalid', NA_MSG.invalid + TAG_PROBLEM_TEXT.children, role);
      const version = cur ? Number(cur.version) + 1 : 1;
      const patch = {
        parent_id: txt(input.parent_id) || null, code, name_en: txt(input.name_en), name_ar: txt(input.name_ar), summary_en: txt(input.summary_en), summary_ar: txt(input.summary_ar),
        horizon_year: input.horizon_year ?? null, owner_en: txt(input.owner_en) || null, owner_ar: txt(input.owner_ar) || null,
        sources: input.sources.map((s) => ({ label: txt(s.label), url: s.url, as_of: s.as_of, tier: sourceTier(s.url) })),
        source_scope: input.source_scope ?? 'direct', source_note_en: txt(input.source_note_en) || null, source_note_ar: txt(input.source_note_ar) || null,
        status, version, updated_by: pid, updated_at: nowTs(),
      };
      if (cur) upd('national_tags', id, patch);
      else ins('national_tags', {
        id, strategy: input.strategy, kind: input.kind, ...patch, derive: null, future_group: null,
        sort: tags.filter((t) => (t.parent_id ?? null) === patch.parent_id).reduce((m, t) => Math.max(m, Number(t.sort ?? 0)), 0) + 1,
        benchmark_ids: [], created_by: pid, created_at: nowTs(),
      });
      const added = !cur;
      const retired = status === 'retired' && (!cur || cur.status !== 'retired');
      const ledger = added ? 'kafaa.national.tag_add' : retired ? 'kafaa.national.tag_retire' : null;
      return h.done<R>('national.tag.save', 'national_tags', id, `v${version} ${status} ${code}`, role, ledger,
        `National tag ${added ? 'added' : 'retired'}: ${code}`, cur ? 'National tag saved' : 'National tag added', { id, version, status }, ['national_tags']);
    },

    async setTagLink(input: LinkInput) {
      await b.whenReady();
      type R = { id: string; active: boolean };
      const tagId = str(input?.tag_id); const table = str(input?.target_table); const target = str(input?.target_id);
      const id = `tl:${tagId}:${table}:${target}`;
      const refuse = (c: string, msg: string, r: string | null = null) => h.refuse<R>('national.link.set', 'tag_links', id, c, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', NA_MSG.not_signed_in);
      if (!ctx().has('national_alignment', ['W', 'A'])) return refuse('forbidden', NA_MSG.forbidden);
      const role = ctx().actingRole('national_alignment', ['W', 'A']);
      const active = input?.active !== false;
      const tag = get('national_tags', tagId) as TagRow | undefined;
      const view = targetView(worldFrom(raw), table, target);
      const problem = linkProblem({ ...input, active }, tag, { exists: view.exists, area: view.area });
      if (problem) return refuse('invalid', NA_MSG.link_invalid + LINK_PROBLEM_TEXT[problem], role);
      const cur = get('tag_links', id);
      if (!cur && !active) return refuse('not_found', NA_MSG.link_not_found, role);
      const notes = active ? { note_en: txt(input.note_en), note_ar: txt(input.note_ar) } : {};
      if (cur) upd('tag_links', id, { ...notes, active, updated_by: pid, updated_at: nowTs() });
      else ins('tag_links', { id, tag_id: tagId, target_table: table, target_id: target, ...notes, active, created_by: pid, created_at: nowTs(), updated_by: pid, updated_at: nowTs() });
      return h.done<R>('national.link.set', 'tag_links', id, `${active ? 'link' : 'unlink'} ${table}:${target}`, role, null, '',
        active ? 'Link saved' : 'Link deactivated', { id, active }, ['tag_links']);
    },

    // ───────────── FS63
    async saveRoleOccupation(input: OccupationInput) {
      await b.whenReady();
      type R = { id: string; version: number };
      const roleId = str(input?.role_id);
      const id = `ro-${roleId}`;
      const refuse = (c: string, msg: string, r: string | null = null) => h.refuse<R>('national.occupation.save', 'role_occupations', id, c, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', RO_MSG.not_signed_in);
      if (!ctx().has('national_alignment', ['W', 'A'])) return refuse('forbidden', RO_MSG.forbidden);
      const role = ctx().actingRole('national_alignment', ['W', 'A']);
      const jr = get('job_roles', roleId);
      const problem = occupationProblem(input, jr as never);
      if (problem) return refuse('invalid', RO_MSG.invalid + RO_PROBLEM_TEXT[problem], role);
      const cur = get('role_occupations', id);
      const today = todayIso();
      const version = cur ? Number(cur.version) + 1 : 1;
      const reviewed = input.level_basis === 'reviewed';
      const entry = { version, on: today, by: pid, change: 'save', label_en: txt(input.label_en), skill_level: input.skill_level, level_basis: input.level_basis };
      const patch = {
        label_en: txt(input.label_en), label_ar: txt(input.label_ar), skill_level: input.skill_level, level_basis: input.level_basis, education_basis: jr?.education ?? null,
        rationale_en: reviewed ? txt(input.rationale_en) : null, rationale_ar: reviewed ? txt(input.rationale_ar) : null,
        history: [...((cur?.history ?? []) as Row[]), entry], version, updated_by: pid, updated_at: nowTs(),
      };
      if (cur) upd('role_occupations', id, patch);
      else ins('role_occupations', { id, role_id: roleId, mohre_code: null, code_status: 'pending_review', code_source: null, verified_by: null, verified_on: null, ...patch });
      return h.done<R>('national.occupation.save', 'role_occupations', id, `v${version} level ${input.skill_level} ${input.level_basis}`, role, null, '',
        'Occupation mapping saved', { id, version }, ['role_occupations']);
    },

    async verifyOccupationCode(input: CodeInput) {
      await b.whenReady();
      type R = { id: string; code: string };
      const roleId = str(input?.role_id);
      const id = `ro-${roleId}`;
      const refuse = (c: string, msg: string, r: string | null = null) => h.refuse<R>('national.occupation.verify', 'role_occupations', id, c, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', RO_MSG.not_signed_in);
      if (!ctx().has('national_alignment', ['A'])) return refuse('forbidden', RO_MSG.forbidden_verify);
      const role = ctx().actingRole('national_alignment', ['A']);
      const cur = get('role_occupations', id);
      if (!cur) return refuse('not_found', RO_MSG.not_found, role);
      if (cur.updated_by === pid) return refuse('maker_checker', RO_MSG.maker_checker, role);
      const today = todayIso();
      const problem = codeProblem(input, today);
      if (problem) return refuse('invalid', RO_MSG.code_invalid + CODE_PROBLEM_TEXT[problem], role);
      const version = Number(cur.version) + 1;
      upd('role_occupations', id, {
        mohre_code: input.code, code_status: 'verified', code_source: { label: txt(input.source_label), url: input.source_url, as_of: input.source_as_of },
        verified_by: pid, verified_on: today, version, history: [...((cur.history ?? []) as Row[]), { version, on: today, by: pid, change: 'verify', code: input.code }],
      });
      return h.done<R>('national.occupation.verify', 'role_occupations', id, `code ${input.code}`, role, 'kafaa.national.occupation_code_verify',
        `MoHRE code verified for ${roleId}: ${input.code}`, 'MoHRE code recorded as verified', { id, code: input.code }, ['role_occupations']);
    },

    async clearOccupationCode(roleId: string, reason: string) {
      await b.whenReady();
      type R = { id: string };
      const id = `ro-${str(roleId)}`;
      const refuse = (c: string, msg: string, r: string | null = null) => h.refuse<R>('national.occupation.clear', 'role_occupations', id, c, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', RO_MSG.not_signed_in);
      if (!ctx().has('national_alignment', ['A'])) return refuse('forbidden', RO_MSG.forbidden_verify);
      const role = ctx().actingRole('national_alignment', ['A']);
      const cur = get('role_occupations', id);
      if (!cur) return refuse('not_found', RO_MSG.not_found, role);
      if (cur.code_status !== 'verified') return refuse('not_verified', RO_MSG.not_verified, role);
      const why = txt(reason);
      if ([...why].length < 10 || [...why].length > 300) return refuse('invalid', RO_MSG.reason, role);
      const version = Number(cur.version) + 1;
      upd('role_occupations', id, {
        mohre_code: null, code_status: 'pending_review', code_source: null, verified_by: null, verified_on: null, version,
        history: [...((cur.history ?? []) as Row[]), { version, on: todayIso(), by: pid, change: 'clear', reason: why }],
      });
      return h.done<R>('national.occupation.clear', 'role_occupations', id, `cleared: ${why}`, role, 'kafaa.national.occupation_code_clear',
        `MoHRE code cleared for ${str(roleId)}`, 'Code returned to pending review', { id }, ['role_occupations']);
    },

    async occupationTrend() {
      await b.whenReady();
      if (!me() || !ctx().has('national_alignment', ['Agg', 'W', 'A'])) return null;
      return occupationTrend(raw('people') as never, raw('role_occupations') as never, todayIso());
    },

    // ───────────── FS73 (wave H · E2)
    async emiratiPipeline(scope) {
      await b.whenReady();
      if (!me() || !pipelineAllowed(ctx().roles)) return null;
      return emiratiPipeline(pipelineWorldFrom(raw), scope ?? 'all', todayIso());
    },

    // ───────────── FS74 (wave H · E2)
    async myFutureWallet() {
      await b.whenReady();
      const pid = me();
      if (!pid || !ctx().has('skills_profile', ['Own'])) return null;
      const today = todayIso();
      const w = walletWorld(raw);
      const person = get('people', pid);
      const plan = planFor(raw('dev_plans'), pid);
      return {
        person_id: pid, family_id: person?.job_family_id ?? null, as_of: today, status: walletStatus(pid, w.inputsFor(pid), today),
        plan: plan ? { id: plan.id, status: plan.status } : null, in_plan: inPlan(raw('plan_activities'), pid), target: tv(w.targets, w.people),
      };
    },

    async futureWalletCounter() {
      await b.whenReady();
      if (!me() || !ctx().has('national_alignment', ['Agg', 'W', 'A'])) return null;
      return walletCounter(walletWorld(raw), todayIso());
    },

    async setWalletTarget(input: TargetInput) {
      await b.whenReady();
      type R = { id: string; version: number };
      const id = WALLET_TARGET_ID;
      const refuse = (c: string, msg: string, r: string | null = null) => h.refuse<R>('national.wallet_target.set', 'wallet_targets', id, c, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', FW_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['A'])) return refuse('forbidden', FW_MSG.forbidden_target);
      const role = ctx().actingRole('workforce_strategy', ['A']);
      const today = todayIso();
      const problem = targetProblem(input, today);
      if (problem) return refuse('invalid', FW_MSG.invalid + FW_PROBLEM_TEXT[problem], role);
      const cur = get('wallet_targets', id);
      if (cur && Number(cur.pct) === input.pct && String(cur.due_on).slice(0, 10) === input.due_on) return refuse('unchanged', FW_MSG.unchanged, role);
      const version = cur ? Number(cur.version) + 1 : 1;
      const at = nowTs();
      const patch = { pct: input.pct, due_on: input.due_on, note_en: txt(input.note_en), note_ar: txt(input.note_ar), set_by: pid, set_by_role: role ?? 'hr_director', set_at: at, status: 'active', version };
      if (cur) {
        const prev = { version: Number(cur.version), pct: Number(cur.pct), due_on: String(cur.due_on).slice(0, 10), set_by: cur.set_by, set_by_role: cur.set_by_role, set_at: isoZ(cur.set_at), note_en: cur.note_en, note_ar: cur.note_ar };
        upd('wallet_targets', id, { ...patch, history: [...((cur.history ?? []) as Row[]), prev] });
      } else ins('wallet_targets', { id, metric: WALLET_METRIC, ...patch, history: [], benchmark_ids: [], sources: [] });
      return h.done<R>('national.wallet_target.set', 'wallet_targets', id, `v${version} ${input.pct}% by ${input.due_on}`, role, 'kafaa.national.wallet_target',
        `Future Skills Wallet target set: ${input.pct}% of staff by ${input.due_on} (v${version})`, 'Target saved', { id, version }, ['wallet_targets']);
    },

    async addWalletToPlan() {
      await b.whenReady();
      type R = { plan_id: string; plan_created: boolean; created: number; existing: number };
      const pid = me();
      const refuse = (c: string, msg: string, r: string | null = null) => h.refuse<R>('national.wallet.to_plan', 'plan_activities', pid ?? null, c, msg, r);
      if (!pid) return refuse('not_signed_in', FW_MSG.not_signed_in);
      const role = ctx().actingRole('dev_plans', ['Own', 'Scope']);
      if (!role || !ctx().has('skills_profile', ['Own'])) return refuse('forbidden', FW_MSG.forbidden_plan);
      const today = todayIso();
      const w = walletWorld(raw);
      const status = walletStatus(pid, w.inputsFor(pid), today);
      if (status.complete) return refuse('complete', FW_MSG.complete, role);
      let plan = planFor(raw('dev_plans'), pid);
      let created = false;
      if (!plan) {
        const person = get('people', pid);
        if (!person?.job_role_id || get('dev_plans', `dp-fs74-${pid}`)) return refuse('no_plan', FW_MSG.no_plan, role);
        plan = { id: `dp-fs74-${pid}`, person_id: pid, target_role_id: person.job_role_id, status: 'draft', created_at: nowTs(), note: 'Created from the Future Skills Wallet' };
        ins('dev_plans', plan);
        created = true;
      }
      const target = targetViewOf(w.targets, w.people);
      const { add, existing } = planEntries(status, pid, plan.id, raw('plan_activities').filter((a) => a.person_id === pid), target?.due_on ?? null);
      for (const a of add) ins('plan_activities', a);
      return h.done<R>('national.wallet.to_plan', 'plan_activities', plan.id, `${add.length} added, ${existing.length} already in plan ${plan.id}`, role, null, '',
        add.length ? 'Added to your development plan' : 'Already in your development plan', { plan_id: plan.id, plan_created: created, created: add.length, existing: existing.length }, ['dev_plans', 'plan_activities']);
    },
  };
}
