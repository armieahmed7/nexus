// M31 LocalBackend RPC implementations (owners: wave E E1 (FS38, FS39, FS40)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261010251001_kafaa_fs51_next_gen.sql: the same checks in the same order, the same refusal codes and
// messages (NG_MSG, PV_MSG, TW_MSG), the same audit rows, ledger rows, notifications and F01 evidence rows. Pages never import this file.
// Shared writes (like the SQL SECURITY DEFINER functions): F01 skill_evidence `se:ojt:<visit>:<skill>` (kind ojt, basis validated,
// ref_table plant_visits) and `se:assessment:<attempt>:<skill>` (kind assessment, basis evidenced, ref_table twin_attempts), both <= L2,
// then applySkills; M14 notifications (kind `plant_visit`, ids `nt-pv-<visit>-...`).
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { evidenceId } from '../../../domain/skills';
import { applySkills } from '../../../data/local/rpc.w0';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { deltaProblem, matrixStats, READY_PCT, PATH_ONLY_FAMILIES, type DeltaInput, type DeltaRow, type ProfileReq, type StateLite } from '../nextgen';
import { HOST_ROLES, VISIT_SKILL, eligibleHosts, visitLevel, visitProblem, type VisitInput } from '../literacy';
import { TWIN_SKILLS, scoreTwinDrill, twinProblem, twinStats, twinSubProblem, type TwinInput, type TwinKey } from '../twin';
import type { M31Rpc, NextGenMatrix, PlantHost, TwinResult } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, '0')).join('');

/** User-facing refusal messages (identical in SQL). */
export const NG_MSG = {
  not_signed_in: 'Sign in to edit SMR deltas',
  forbidden: 'Only framework owners (instructors, the training manager and admins) edit SMR deltas',
  role: 'Role not found: deltas cover the current Barakah roles only',
  tech: 'Technology family not found',
  invalid: 'Check the delta: ',
} as const;
export const DELTA_PROBLEM_TEXT: Record<string, string> = {
  rank: 'a relevance rank from 1 to 6', status: 'choose draft, published or retired',
  security: 'security, safeguards and cyber roles stay at career-path level: path only, no skills',
  dims: 'one to seven distinct dimensions, each adapts or new, with English and Arabic text (up to 400 characters)',
  texts: 'what changes and what stays, in English and Arabic (up to 600 characters each)',
  skills: 'up to 8 distinct catalogue skills (not obsolete) at level 1 to 3', training: 'up to 8 distinct links to existing micro-credentials, courses, pathways or horizon lanes',
  sources: 'https sources with labels (at least two to publish)', unclean: 'no headcount, site or deployment claims; no deployment decision is implied',
};
export const PV_MSG = {
  not_signed_in: 'Sign in to log a plant visit',
  forbidden: 'The plant visit log is for ENEC staff',
  invalid: 'Check the visit: ',
  self_host: 'You cannot host your own visit; name a host who was there',
  host: 'Check the visit: the host must be an ENEC instructor, training manager or line manager',
  not_found: 'Visit not found',
  self_confirm: 'You cannot confirm your own visit',
  not_host: 'Only the named host confirms this visit',
  decided: 'This visit is already decided',
  decision: 'Choose confirm or decline',
  reason: 'Give a reason (5 to 300 characters) when you decline',
  not_yours: 'Only the visitor withdraws a visit',
} as const;
export const VISIT_PROBLEM_TEXT: Record<string, string> = {
  kind: 'choose a reference-plant visit, a simulator observation or a partner reference plant', host: 'name the host', date: 'a date in the last 365 days, not in the future',
  hours: '0.5 to 12 hours in half-hour steps', note: 'a note of up to 300 characters without contact details',
};
export const TW_MSG = {
  not_signed_in: 'Sign in to take a digital-twin drill',
  forbidden: 'Digital-twin drills are for ENEC staff',
  forbidden_edit: 'Only the training manager edits digital-twin drills',
  not_found: 'Drill not found',
  closed: 'This drill is not open',
  invalid: 'Check your answers: ',
  invalid_drill: 'Check the drill: ',
  conflict: 'Another drill already uses this code',
} as const;
export const TW_SUB_TEXT: Record<string, string> = {
  shape: 'checks and rationales are required', checks: 'choose checks from the list, each once', too_many: 'you can run only the number of checks shown',
  component: 'name the degrading component', mode: 'name the failure mode', action: 'choose an action', rationales: 'pick one to three rationales',
};
export const TW_PROBLEM_TEXT: Record<string, string> = {
  texts: 'title, summary, scenario and system name in English and Arabic', synthetic: 'drills must be synthetic (code SYN-TW-000)', difficulty: 'difficulty must be 1, 2 or 3',
  level: 'the evidence level must be 1 or 2', skill: 'one to three twin or plant-data skills', status: 'choose draft, published or retired', minutes: 'an estimate from 5 to 40 minutes',
  series: '2 to 6 signals with 6 to 48 points each and an expected band', components: '3 to 6 components in both languages', modes: '2 to 5 failure modes in both languages',
  checks: '3 to 8 checks with time and a result in both languages', max_checks: 'a check budget from 1 to the number of checks', actions: '3 to 5 actions in both languages',
  rationales: '3 to 6 rationales in both languages', key: 'a key naming the component, mode, useful checks, conservative actions (best among them) and sound rationales',
  pass: 'a pass mark from 50 to 95', restricted: 'drills never touch plant security',
};

/** Latest published FS05 2035 profile of each role (requirements only). */
export function profiles2035(versions: Row[]): Map<string, ProfileReq[]> {
  const best = new Map<string, Row>();
  for (const v of versions) {
    if (v.horizon !== '2035' || v.status !== 'published') continue;
    const cur = best.get(v.role_id);
    if (!cur || Number(v.version) > Number(cur.version)) best.set(v.role_id, v);
  }
  return new Map([...best.entries()].map(([k, v]) => [k, (v.requirements ?? []) as ProfileReq[]]));
}

export function makeLocalM31(b: LocalBackend, h: LocalRpcHelpers): M31Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const notify = (id: string, pid: string | null | undefined, en: string, ar: string, link: string, severity = 'info') => {
    if (!pid || !get('people', pid) || get('notifications', id)) return;
    ins('notifications', { id, person_id: pid, kind: 'plant_visit', title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
  };
  const hostIds = (visitor: string | null) => eligibleHosts(raw('people') as never, raw('role_assignments') as never, visitor);

  return {
    // ───────────── FS38
    async saveSmrDelta(input: DeltaInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string };
      const role = typeof input?.role_id === 'string' ? input.role_id : '';
      const tech = typeof input?.tech_id === 'string' ? input.tech_id : '';
      const entity = role && tech ? `smrd:${role}:${tech}` : null;
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('smr.delta.save', 'smr_deltas', entity, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', NG_MSG.not_signed_in);
      if (!ctx().has('frameworks', ['W', 'A'])) return refuse('forbidden', NG_MSG.forbidden);
      const actor = ctx().actingRole('frameworks', ['W', 'A']);
      const jr = get('job_roles', role);
      if (!jr || (jr.lifecycle ?? 'current') !== 'current') return refuse('not_found', NG_MSG.role, actor);
      if (!get('adv_technologies', tech)) return refuse('not_found', NG_MSG.tech, actor);
      const skills = Object.fromEntries(raw('skills').map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }]));
      const refs = {
        microcred: raw('microcred_defs').filter((m) => m.status === 'current').map((m) => m.code as string), course: raw('courses').map((c) => c.id as string),
        pathway: raw('pathways').filter((p) => p.status === 'published').map((p) => p.id as string), lane: raw('horizon_lanes').map((l) => l.id as string),
      };
      const problem = deltaProblem(input, { family: jr.family_id ?? null, skills, refs });
      if (problem) return refuse('invalid', NG_MSG.invalid + DELTA_PROBLEM_TEXT[problem], actor);
      const id = `smrd:${role}:${tech}`;
      const cur = get('smr_deltas', id);
      const version = cur ? Number(cur.version) + 1 : 1;
      const t = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
      const patch = {
        rank: input.rank, path_only: PATH_ONLY_FAMILIES.includes(jr.family_id), dims: input.dims.map((d) => ({ dim: d.dim, change: d.change, text_en: t(d.text_en), text_ar: t(d.text_ar) })),
        changes_en: t(input.changes_en), changes_ar: t(input.changes_ar), stays_en: t(input.stays_en), stays_ar: t(input.stays_ar),
        skills: input.skills.map((s) => ({ skill_id: s.skill_id, level: s.level })), training: input.training.map((x) => ({ kind: x.kind, ref: x.ref })),
        sources: input.sources.map((s) => ({ label: t(s.label), url: s.url, as_of: typeof s.as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.as_of) ? s.as_of : todayIso() })),
        status: input.status, listed: input.status === 'published', version, as_of: todayIso(), updated_by: pid, updated_at: nowTs(),
      };
      if (cur) upd('smr_deltas', id, patch);
      else ins('smr_deltas', { id, role_id: role, tech_id: tech, ...patch, concept_role_ids: [], benchmark_ids: ['SMR-WF', 'IAEA-WFP'], sort: raw('smr_deltas').reduce((m, d) => Math.max(m, Number(d.sort)), 0) + 1 });
      const pub = input.status === 'published';
      return h.done<R>('smr.delta.save', 'smr_deltas', id, `v${version} ${input.status}`, actor, pub ? 'kafaa.nextgen.delta_publish' : null, `SMR delta ${role} x ${tech} v${version} published`,
        cur ? 'SMR delta saved' : 'SMR delta added', { id, version, status: input.status }, ['smr_deltas']);
    },

    async nextGenMatrix() {
      await b.whenReady();
      if (!me()) return null;
      if (!ctx().has('workforce_strategy', ['Agg', 'R'])) return null;
      const by = new Map<string, StateLite[]>();
      for (const s of raw('person_skills')) if (s.active) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)!).push(s as StateLite);
      const m = matrixStats(raw('smr_deltas') as unknown as DeltaRow[], raw('people') as never, by, profiles2035(raw('role_profile_versions')), raw('adv_technologies').map((x) => x.id as string), MIN_GROUP_SIZE);
      const out: NextGenMatrix = { ...m, as_of: todayIso(), ready_pct_line: READY_PCT };
      return out;
    },

    // ───────────── FS39
    async plantHosts() {
      await b.whenReady();
      const pid = me();
      if (!pid || !ctx().has('skills_profile', ['Own'])) return [];
      const roles = raw('role_assignments').filter((r) => r.status === 'active' && HOST_ROLES.includes(r.role));
      return hostIds(pid).map((id): PlantHost => {
        const p = get('people', id)!;
        const held = roles.filter((r) => r.person_id === id).map((r) => r.role as string);
        return { person_id: id, name_en: p.display_name, name_ar: p.display_name_ar ?? p.display_name, role: HOST_ROLES.find((x) => held.includes(x)) ?? 'manager' };
      });
    },

    async logVisit(input: VisitInput) {
      await b.whenReady();
      type R = { id: string; status: string };
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('plant.visit.log', 'plant_visits', null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', PV_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', PV_MSG.forbidden);
      const actor = ctx().actingRole('skills_profile', ['Own']);
      const problem = visitProblem(input, todayIso());
      if (problem) return refuse('invalid', PV_MSG.invalid + VISIT_PROBLEM_TEXT[problem], actor);
      if (input.host_person_id === pid) return refuse('maker_checker', PV_MSG.self_host, actor);
      if (!hostIds(pid).includes(input.host_person_id)) return refuse('invalid', PV_MSG.host, actor);
      const id = `pv-${hex(8)}`;
      ins('plant_visits', {
        id, person_id: pid, kind: input.kind, host_person_id: input.host_person_id, visit_on: input.visit_on, hours: input.hours, note: (input.note ?? '').trim(), status: 'logged',
        decided_by: null, decided_at: null, decline_reason: null, level: 0, evidence: [], created_at: nowTs(),
      });
      notify(`nt-pv-${id}-host`, input.host_person_id, 'A plant visit to confirm as host', 'زيارة للمحطة بانتظار تأكيدك بصفتك المضيف', '/my/plant-log?tab=host');
      return h.done<R>('plant.visit.log', 'plant_visits', id, `${input.kind} ${input.hours}h host ${input.host_person_id}`, actor, null, '', 'Visit logged; your host will confirm it', { id, status: 'logged' },
        ['plant_visits', 'notifications']);
    },

    async confirmVisit(input) {
      await b.whenReady();
      type R = { id: string; status: string; level: number };
      const vid = typeof input?.visit_id === 'string' ? input.visit_id : '';
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('plant.visit.decide', 'plant_visits', vid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', PV_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', PV_MSG.forbidden);
      const actor = ctx().actingRole('skills_profile', ['Own']);
      const v = get('plant_visits', vid);
      if (!v) return refuse('not_found', PV_MSG.not_found, actor);
      if (v.person_id === pid) return refuse('maker_checker', PV_MSG.self_confirm, actor);
      if (v.host_person_id !== pid) return refuse('forbidden', PV_MSG.not_host, actor);
      if (v.status !== 'logged') return refuse('invalid', PV_MSG.decided, actor);
      const decision = input?.decision;
      if (decision !== 'confirm' && decision !== 'decline') return refuse('invalid', PV_MSG.decision, actor);
      if (decision === 'decline') {
        const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
        if (reason.length < 5 || reason.length > 300) return refuse('invalid', PV_MSG.reason, actor);
        upd('plant_visits', vid, { status: 'declined', decided_by: pid, decided_at: nowTs(), decline_reason: reason });
        notify(`nt-pv-${vid}-declined`, v.person_id, 'Your plant visit was not confirmed', 'لم يُؤكَّد سجل زيارتك للمحطة', '/my/plant-log', 'warn');
        return h.done<R>('plant.visit.decide', 'plant_visits', vid, 'declined', actor, null, '', 'Visit declined', { id: vid, status: 'declined', level: 0 }, ['plant_visits', 'notifications']);
      }
      const before = raw('plant_visits').filter((x) => x.person_id === v.person_id && x.status === 'confirmed' && x.id !== vid).map((x) => ({ id: x.id, kind: x.kind, hours: Number(x.hours) }));
      const level = visitLevel(before, { kind: v.kind, hours: Number(v.hours) });
      const ev = [{ skill_id: VISIT_SKILL, level }];
      upd('plant_visits', vid, { status: 'confirmed', decided_by: pid, decided_at: nowTs(), level, evidence: ev });
      ins('skill_evidence', {
        id: evidenceId('ojt', vid, VISIT_SKILL), person_id: v.person_id, skill_id: VISIT_SKILL, kind: 'ojt', ref_table: 'plant_visits', ref_id: vid, level, basis: 'validated', status: 'current',
        observed_on: String(v.visit_on).slice(0, 10), note: `Plant visit ${v.kind} confirmed by host`, recorded_by: pid, active: true, created_at: nowTs(),
      });
      await applySkills(b, v.person_id, todayIso());
      notify(`nt-pv-${vid}-confirmed`, v.person_id, 'Your plant visit was confirmed', 'تم تأكيد زيارتك للمحطة', '/my/plant-log', 'ok');
      return h.done<R>('plant.visit.decide', 'plant_visits', vid, `confirmed L${level}`, actor, 'kafaa.plant.visit_confirm', `Plant visit ${vid} confirmed by the host (level ${level})`, 'Visit confirmed',
        { id: vid, status: 'confirmed', level }, ['plant_visits', 'skill_evidence', 'person_skills', 'notifications']);
    },

    async withdrawVisit(visitId: string) {
      await b.whenReady();
      type R = { id: string; status: string };
      const vid = typeof visitId === 'string' ? visitId : '';
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('plant.visit.withdraw', 'plant_visits', vid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', PV_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', PV_MSG.forbidden);
      const actor = ctx().actingRole('skills_profile', ['Own']);
      const v = get('plant_visits', vid);
      if (!v) return refuse('not_found', PV_MSG.not_found, actor);
      if (v.person_id !== pid) return refuse('forbidden', PV_MSG.not_yours, actor);
      if (v.status !== 'logged') return refuse('invalid', PV_MSG.decided, actor);
      upd('plant_visits', vid, { status: 'withdrawn' });
      return h.done<R>('plant.visit.withdraw', 'plant_visits', vid, 'withdrawn', actor, null, '', 'Visit withdrawn', { id: vid, status: 'withdrawn' }, ['plant_visits']);
    },

    // ───────────── FS40
    async submitTwinDrill(input) {
      await b.whenReady();
      type R = TwinResult;
      const sid = typeof input?.scenario_id === 'string' ? input.scenario_id : '';
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('twin.drill.submit', 'twin_attempts', sid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', TW_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', TW_MSG.forbidden);
      const actor = ctx().actingRole('skills_profile', ['Own']);
      const sc = get('twin_scenarios', sid);
      const key = raw('twin_keys').find((k) => k.scenario_id === sid);
      if (!sc || !key) return refuse('not_found', TW_MSG.not_found, actor);
      if (sc.status !== 'published') return refuse('invalid', TW_MSG.closed, actor);
      const sub = { checks: input?.checks, component_id: input?.component_id, mode_id: input?.mode_id, action_id: input?.action_id, rationale_ids: input?.rationale_ids } as never;
      const problem = twinSubProblem({ components: sc.components, modes: sc.modes, checks: sc.checks, actions: sc.actions, rationales: sc.rationales, max_checks: Number(sc.max_checks) }, sub);
      if (problem) return refuse('invalid', TW_MSG.invalid + TW_SUB_TEXT[problem], actor);
      const k: TwinKey = { component_id: key.component_id, mode_id: key.mode_id, useful_checks: key.useful_checks, unsafe_checks: key.unsafe_checks, conservative_actions: key.conservative_actions,
        best_action: key.best_action, unsafe_actions: key.unsafe_actions, sound_rationales: key.sound_rationales, pass_pct: Number(key.pass_pct) };
      const s = scoreTwinDrill(k, sub, Number(sc.level));
      const today = todayIso();
      const mine = raw('twin_attempts').filter((a) => a.person_id === pid && a.scenario_id === sid);
      const aid = `ta-${hex(8)}`;
      const evidence = s.passed ? (sc.skill_ids as string[]).map((x) => ({ skill_id: x, level: s.level })) : [];
      const earlier = new Set(mine.map((a) => a.id));
      // The latest attempt on a drill replaces earlier evidence from the same drill (kept, inactive).
      for (const old of raw('skill_evidence').filter((x) => x.person_id === pid && x.ref_table === 'twin_attempts' && x.active && earlier.has(x.ref_id))) upd('skill_evidence', old.id, { active: false });
      const { reasons, ...rest } = s;
      const sb = sub as unknown as Row;
      ins('twin_attempts', {
        id: aid, person_id: pid, scenario_id: sid, scenario_version: Number(sc.version), attempt_no: mine.length + 1, checks: [...new Set(sb.checks as string[])], component_id: sb.component_id,
        mode_id: sb.mode_id, action_id: sb.action_id, rationale_ids: [...new Set(sb.rationale_ids as string[])], points: s.points, max_points: s.max, pct: s.pct, critical_ok: s.critical_ok,
        passed: s.passed, level: s.level, feedback: s.feedback, reasons, evidence, submitted_at: nowTs(),
      });
      for (const e of evidence) {
        ins('skill_evidence', {
          id: evidenceId('assessment', aid, e.skill_id), person_id: pid, skill_id: e.skill_id, kind: 'assessment', ref_table: 'twin_attempts', ref_id: aid, level: e.level, basis: 'evidenced', status: 'current',
          observed_on: today, note: `Digital-twin drill ${sid}`, recorded_by: pid, active: true, created_at: nowTs(),
        });
      }
      await applySkills(b, pid, today);
      const data: R = { ...rest, reasons, attempt_id: aid, scenario_id: sid, attempt_no: mine.length + 1, pass_pct: Number(key.pass_pct), explain: key.explain ?? {}, evidence };
      return h.done<R>('twin.drill.submit', 'twin_attempts', aid, `${sid} ${s.pct}% ${s.passed ? `pass L${s.level}` : 'not yet'}`, actor, s.passed ? 'kafaa.twin.drill' : null,
        `Digital-twin drill ${sid}: passed at level ${s.level}`, s.passed ? 'Drill passed' : 'Drill submitted', data, ['twin_attempts', 'skill_evidence', 'person_skills']);
    },

    async twinStats() {
      await b.whenReady();
      if (!me()) return null;
      const a = ctx();
      if (!(a.has('secure_items', ['W', 'A']) || a.has('skills_profile', ['Agg']))) return null;
      return twinStats(raw('twin_attempts') as never, raw('twin_keys').map((k) => ({ scenario_id: k.scenario_id, component_id: k.component_id })),
        raw('twin_scenarios').filter((s) => s.status !== 'retired').map((s) => s.id as string), MIN_GROUP_SIZE);
    },

    async saveTwinScenario(input: TwinInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string };
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('twin.drill.save', 'twin_scenarios', given, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', TW_MSG.not_signed_in);
      if (!ctx().has('secure_items', ['A'])) return refuse('forbidden', TW_MSG.forbidden_edit);
      const actor = ctx().actingRole('secure_items', ['A']);
      const cur = given ? get('twin_scenarios', given) : undefined;
      if (given && !cur) return refuse('not_found', TW_MSG.not_found, actor);
      const problem = twinProblem(input, TWIN_SKILLS);
      if (problem) return refuse('invalid', TW_MSG.invalid_drill + TW_PROBLEM_TEXT[problem], actor);
      if (raw('twin_scenarios').some((s) => s.code === input.code && s.id !== cur?.id)) return refuse('conflict', TW_MSG.conflict, actor);
      const t = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
      const id = cur ? cur.id : `tw-${hex(4)}`;
      const version = cur ? Number(cur.version) + 1 : 1;
      const patch = {
        code: input.code, title_en: t(input.title_en), title_ar: t(input.title_ar), summary_en: t(input.summary_en), summary_ar: t(input.summary_ar), scenario_en: t(input.scenario_en), scenario_ar: t(input.scenario_ar),
        system_en: t(input.system_en), system_ar: t(input.system_ar), difficulty: input.difficulty, level: input.level, skill_ids: [...input.skill_ids], series: input.series, components: input.components,
        modes: input.modes, checks: input.checks, actions: input.actions, rationales: input.rationales, max_checks: input.max_checks, est_minutes: input.est_minutes, synthetic: true,
        status: input.status, listed: input.status === 'published', version, updated_by: pid, updated_at: nowTs(),
      };
      if (cur) upd('twin_scenarios', id, patch);
      else ins('twin_scenarios', { id, ...patch, sources: [], sort: raw('twin_scenarios').reduce((m, s) => Math.max(m, Number(s.sort)), 0) + 1 });
      const kid = `twk-${id}`;
      const k = input.key;
      const krow = { component_id: k.component_id, mode_id: k.mode_id, useful_checks: [...k.useful_checks], unsafe_checks: [...k.unsafe_checks], conservative_actions: [...k.conservative_actions],
        best_action: k.best_action, unsafe_actions: [...k.unsafe_actions], sound_rationales: [...k.sound_rationales], explain: k.explain ?? {}, pass_pct: k.pass_pct };
      if (get('twin_keys', kid)) upd('twin_keys', kid, krow); else ins('twin_keys', { id: kid, scenario_id: id, ...krow });
      return h.done<R>('twin.drill.save', 'twin_scenarios', id, `v${version} ${input.status}`, actor, null, '', cur ? 'Drill saved' : 'Drill added', { id, version, status: input.status }, ['twin_scenarios', 'twin_keys']);
    },
  };
}
