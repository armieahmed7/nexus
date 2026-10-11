// FS wave D · E3 (M17) LocalBackend RPCs: FS31 strategic tier and unlocks, FS32 learner record shares, FS33 skill goals. Spread into
// makeLocalM17 (backend/local.ts). 1:1 mirror of the SQL in supabase/migrations/20261010243001_kafaa_fs43_credentials_record_goals.sql:
// same checks in the same order, the same refusal codes and messages (FC_MSG, LR_MSG, SG_MSG), the same audit and ledger rows.
// Shared writes, only through these RPCs (like the SQL SECURITY DEFINER functions):
//   M28 skill_goals   FS07's goal row (id sg:<person>:<skill>, status active | removed), which the Coach reads; FS33 writes it through
//                     saveSkillGoal / withdrawSkillGoal next to its own plan row.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { RowOf } from '../../../data/types';
import type { Fs4Rpc, StrategicReport } from './rpc';
import { todayIso } from '../../../domain/rules';
import { nowTs } from '../../../data/audit';
import type { AwardRow, DefRow } from '../microcred';
import { FC_MSG, strategicReport, targetCheck, unlockId, unlockProblem, unlocksFor, type UnlockRow, type UnlockWorld } from '../futureCreds';
import { LR_MSG, SHARE_RULES, buildBundle, recordItems, shareProblem, shareView, type RecordWorld, type VerifyResult } from '../learnerRecord';
import { GOAL_RULES, SG_MSG, goalId, goalProblem, planRow } from '../skillGoals';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(Math.ceil(n / 2))), (x) => x.toString(16).padStart(2, '0')).join('').slice(0, n);
const trim = (x: unknown) => String(x ?? '').trim();

export function makeLocalM17Fs4(b: LocalBackend, h: LocalRpcHelpers): Fs4Rpc {
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[] | undefined) ?? []); // empty until the store has loaded (a persona switch can emit first)
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const unlockWorld = (today: string): UnlockWorld => ({
    today, defs: raw('microcred_defs') as unknown as DefRow[], awards: raw('microcred_awards') as unknown as AwardRow[], unlocks: raw('microcred_unlocks') as unknown as UnlockRow[],
    opportunities: raw('opportunities'), rotation_templates: raw('rotation_templates'),
  });
  const recordWorld = (person: string, today: string): RecordWorld => ({
    today, person, initials: String(get('people', person)?.initials || '—'), microcred_awards: raw('microcred_awards'), microcred_defs: raw('microcred_defs'), badges: raw('badges'),
    certificates: raw('certificates'), qual_records: raw('qual_records'), qual_standards: raw('qual_standards'), person_skills: raw('person_skills'), skills: raw('skills'), competencies: raw('competencies'),
  });
  const secComps = () => new Set(raw('competencies').filter((c) => c.domain === 'security').map((c) => String(c.id)));
  // FS07's setSkillGoal (M28) can remove a goal or change its level from a skill page: keep the plan in step, like the SQL trigger
  // kafaa_sg_sync_plan on kafaa_skill_goals (a removed goal is unshared, so no stale share remains).
  const syncPlans = () => {
    let n = 0;
    for (const p of raw('skill_goal_plans')) {
      const g = get('skill_goals', p.id);
      if (!g) continue;
      if (g.status === 'removed' && p.status === 'active') { upd('skill_goal_plans', p.id, { status: 'removed', shared: false, share_person: null, updated_at: nowTs(), removed_at: p.removed_at ?? nowTs() }); n++; }
      else if (g.status === 'active' && Number(g.target_level) !== Number(p.target_level)) { upd('skill_goal_plans', p.id, { target_level: Number(g.target_level), updated_at: nowTs() }); n++; }
    }
    if (n) b.changed(['skill_goal_plans' as never]);
  };
  b.subscribe((tables) => { if ((tables as string[]).includes('skill_goals')) syncPlans(); });

  return {
    // ───────────── FS31
    async setMicrocredStrategic(codeIn, strategic, note) {
      await b.whenReady();
      type R = { code: string; strategic: boolean };
      const A = 'microcred.strategic';
      const code = trim(codeIn);
      if (!me()) return h.refuse<R>(A, 'microcred_defs', code || null, 'not_signed_in', FC_MSG.not_signed_in);
      const role = ctx().actingRole('frameworks', ['W', 'A']);
      if (!role) return h.refuse<R>(A, 'microcred_defs', code || null, 'forbidden', FC_MSG.forbidden);
      const def = (raw('microcred_defs') as unknown as DefRow[]).filter((d) => d.code === code && d.status === 'current').sort((x, y) => (x.id < y.id ? -1 : 1))[0];
      if (!def) return h.refuse<R>(A, 'microcred_defs', code || null, 'not_found', FC_MSG.not_found_def, role);
      const why = trim(note);
      if (why.length < 3 || why.length > 300) return h.refuse<R>(A, 'microcred_defs', code, 'invalid', FC_MSG.note_required, role);
      const want = strategic === true;
      if ((def.strategic === true) === want) return h.refuse<R>(A, 'microcred_defs', code, 'no_change', FC_MSG.no_change, role);
      upd('microcred_defs', def.id, { strategic: want, strategic_note: why, strategic_since: want ? todayIso() : null, updated_by: me(), updated_at: nowTs() });
      return h.done<R>(A, 'microcred_defs', def.id, `${code} ${want ? 'strategic' : 'standard'}: ${why}`, role, 'kafaa.microcred.strategic', `Micro-credential ${code} ${want ? 'joins' : 'leaves'} the strategic tier`, FC_MSG.tier_set, { code, strategic: want }, ['microcred_defs']);
    },

    async setCredentialUnlock(input) {
      await b.whenReady();
      type R = { id: string; active: boolean };
      const A = 'microcred.unlock';
      const code = trim(input?.def_code);
      if (!me()) return h.refuse<R>(A, 'microcred_unlocks', code || null, 'not_signed_in', FC_MSG.not_signed_in);
      const role = ctx().actingRole('frameworks', ['W', 'A']);
      if (!role) return h.refuse<R>(A, 'microcred_unlocks', code || null, 'forbidden', FC_MSG.forbidden);
      const w = unlockWorld(todayIso());
      const chk = unlockProblem(input, w);
      if (chk !== 'ok') return h.refuse<R>(A, 'microcred_unlocks', code || null, chk, chk === 'security_restricted' ? FC_MSG.security_restricted : chk === 'too_many' ? FC_MSG.too_many : FC_MSG.invalid_unlock, role);
      const id = unlockId(code, input.target_kind as 'opportunity' | 'rotation', input.target_id);
      const active = input.active !== false;
      const row = { def_code: code, target_kind: input.target_kind, target_id: input.target_id, note_en: trim(input.note_en), note_ar: trim(input.note_ar), active, set_by: me(), set_at: nowTs() };
      if (get('microcred_unlocks', id)) upd('microcred_unlocks', id, row);
      else ins('microcred_unlocks', { id, ...row });
      return h.done<R>(A, 'microcred_unlocks', id, `${code} -> ${input.target_kind} ${input.target_id} ${active ? 'on' : 'off'}`, role, null, '', FC_MSG.unlock_saved, { id, active }, ['microcred_unlocks']);
    },

    async credentialUnlocks(personId = null) {
      await b.whenReady();
      const caller = me();
      if (!caller) return { allowed: false, person_id: null, items: [] };
      const pid = personId || caller;
      const c = ctx();
      const ok = pid === caller ? c.has('skills_profile', ['Own', 'Scope', 'A']) : c.has('skills_profile', ['A']) || (c.has('skills_profile', ['Scope']) && c.inScope('skills_profile', pid));
      if (!ok || !get('people', pid)) return { allowed: false, person_id: null, items: [] };
      return { allowed: true, person_id: pid, items: unlocksFor(pid, unlockWorld(todayIso())) };
    },

    async credentialTargetCheck(kind, targetId) {
      await b.whenReady();
      const caller = me();
      const w = unlockWorld(todayIso());
      const r = targetCheck(caller ?? '', kind, String(targetId ?? ''), w);
      return caller ? r : { ...r, unlocked: false, held: [] };
    },

    async strategicReport() {
      await b.whenReady();
      const c = ctx();
      const empty: StrategicReport = { allowed: false, rows: [], baseline: { people: null, moved: null, rate: null, suppressed: true }, window_days: 365 };
      if (!(c.has('skills_profile', ['A', 'Agg']) || c.has('audit_log', ['R']))) return empty;
      const today = todayIso();
      const r = strategicReport({ today, defs: raw('microcred_defs') as unknown as DefRow[], awards: raw('microcred_awards') as unknown as AwardRow[], people: raw('people'),
        opportunity_applications: raw('opportunity_applications'), rotation_placements: raw('rotation_placements') });
      return { allowed: true, ...r };
    },

    // ───────────── FS32
    async learnerRecord(refs = null) {
      await b.whenReady();
      const caller = me();
      if (!caller || !ctx().has('skills_profile', ['Own'])) return { allowed: false, items: [], bundle: null };
      const today = todayIso();
      const w = recordWorld(caller, today);
      const items = recordItems(w);
      const chosen = refs == null ? items.map((i) => i.ref) : refs;
      return { allowed: true, items, bundle: buildBundle(w, chosen, { id: `preview:${caller}`, issued_on: today, valid_until: null }) };
    },

    async createRecordShare(input) {
      await b.whenReady();
      type R = { id: string; token: string; expires_on: string };
      const A = 'record.share';
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'record_shares', null, 'not_signed_in', LR_MSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      if (!role) return h.refuse<R>(A, 'record_shares', null, 'forbidden', LR_MSG.forbidden);
      const today = todayIso();
      const w = recordWorld(caller, today);
      const chk = shareProblem(input, recordItems(w), today);
      if (chk !== 'ok') return h.refuse<R>(A, 'record_shares', null, chk, LR_MSG[chk], role);
      if (raw('record_shares').filter((s) => s.person_id === caller && shareView(s as never, today) === 'active').length >= SHARE_RULES.maxActive) return h.refuse<R>(A, 'record_shares', null, 'too_many', LR_MSG.too_many, role);
      const id = `rs-${hex(16)}`;
      const token = hex(32);
      const at = nowTs();
      ins('record_shares', {
        id, person_id: caller, token, label: trim(input.label), items: [...input.items], holder_initials: w.initials, consents: { items: true, preview: true, share: true, at },
        expires_on: input.expires_on, revoked_at: null, revoke_reason: null, views: 0, last_viewed_at: null, created_at: at,
      });
      return h.done<R>(A, 'record_shares', id, `${input.items.length} items until ${input.expires_on}`, role, 'kafaa.record.share', `Learner record share ${id} (${input.items.length} items, until ${input.expires_on})`, LR_MSG.created, { id, token, expires_on: input.expires_on }, ['record_shares']);
    },

    async revokeRecordShare(id, reason = null) {
      await b.whenReady();
      type R = { id: string };
      const A = 'record.revoke';
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'record_shares', id || null, 'not_signed_in', LR_MSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const s = get('record_shares', id);
      if (!role || !s || s.person_id !== caller) return h.refuse<R>(A, 'record_shares', id || null, 'not_found', LR_MSG.not_found, role);
      if (shareView(s as never, todayIso()) !== 'active') return h.refuse<R>(A, 'record_shares', id, 'already_closed', LR_MSG.already_closed, role);
      const why = trim(reason).slice(0, SHARE_RULES.reasonMax);
      upd('record_shares', id, { revoked_at: nowTs(), revoke_reason: why || null });
      return h.done<R>(A, 'record_shares', id, why || 'revoked by the holder', role, 'kafaa.record.revoke', `Learner record share ${id} revoked`, LR_MSG.revoked, { id }, ['record_shares']);
    },

    async verifyRecordShare(tokenIn) {
      await b.whenReady();
      const A = 'record.verify';
      const token = trim(tokenIn).slice(0, 64);
      const since = new Date(Date.now() - 60_000).toISOString();
      const recent = (b.raw('audit_events') as RowOf<'audit_events'>[]).filter((a) => a.action === A && String(a.ts) > since);
      const s = token ? raw('record_shares').find((x) => x.token === token) : undefined;
      if ((s && recent.filter((a) => a.entity_id === s.id).length >= SHARE_RULES.verifyPerTokenPerMin) || recent.length >= SHARE_RULES.verifyPerMin)
        return h.refuse<VerifyResult>(A, 'record_shares', s?.id ?? null, 'rate_limited', LR_MSG.rate_limited);
      if (!s) return h.refuse<VerifyResult>(A, 'record_shares', null, 'not_found', LR_MSG.verify_not_found);
      const today = todayIso();
      const status = shareView(s as never, today);
      if (status !== 'active') return h.done<VerifyResult>(A, 'record_shares', s.id, status, null, null, '', LR_MSG.closed, { found: true, status, checked_on: today, notice: LR_MSG.closed }, ['audit_events']);
      upd('record_shares', s.id, { views: (Number(s.views) || 0) + 1, last_viewed_at: nowTs() });
      const w = recordWorld(String(s.person_id), today);
      const clr = buildBundle(w, s.items ?? [], { id: s.id, issued_on: today, valid_until: String(s.expires_on).slice(0, 10) });
      const data: VerifyResult = { found: true, status, checked_on: today, expires_on: String(s.expires_on).slice(0, 10), holder_initials: w.initials, item_count: (clr.kafaaItems ?? []).length, clr, notice: LR_MSG.found };
      return h.done<VerifyResult>(A, 'record_shares', s.id, status, null, null, '', LR_MSG.found, data, ['audit_events']);
    },

    // ───────────── FS33
    async saveSkillGoal(input) {
      await b.whenReady();
      type R = { id: string; status: string; shared: boolean };
      const A = 'skill_goal.save';
      const sid = trim(input?.skill_id);
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'skill_goal_plans', sid || null, 'not_signed_in', SG_MSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      if (!role) return h.refuse<R>(A, 'skill_goal_plans', sid || null, 'forbidden', SG_MSG.forbidden);
      const today = todayIso();
      const chk = goalProblem(input, get('skills', sid) ?? null, today, secComps());
      if (chk !== 'ok') return h.refuse<R>(A, 'skill_goal_plans', sid || null, chk, SG_MSG[chk], role);
      const gid = goalId(caller, sid);
      const goal = get('skill_goals', gid);
      if (raw('skill_goals').filter((g) => g.person_id === caller && g.status === 'active' && g.id !== gid).length >= GOAL_RULES.maxActive) return h.refuse<R>(A, 'skill_goal_plans', sid, 'limit', SG_MSG.limit, role);
      const at = nowTs();
      if (goal) upd('skill_goals', gid, { target_level: input.target_level, status: 'active', updated_at: at });
      else ins('skill_goals', { id: gid, person_id: caller, skill_id: sid, target_level: input.target_level, status: 'active', source: 'fs33', created_at: at, updated_at: at });
      const prev = get('skill_goal_plans', gid);
      const shared = input.shared === true;
      const note = input.note == null || trim(input.note) === '' ? null : trim(input.note);
      const row = planRow(caller, sid, { target_level: input.target_level, target_date: input.target_date, note, shared, status: 'active' }, at, prev);
      if (prev) upd('skill_goal_plans', gid, row); else ins('skill_goal_plans', row);
      return h.done<R>(A, 'skill_goal_plans', gid, `active ${sid} L${input.target_level} by ${input.target_date}${shared ? ' shared' : ''}`, role, null, '', SG_MSG.saved, { id: gid, status: 'active', shared }, ['skill_goals', 'skill_goal_plans']);
    },

    async withdrawSkillGoal(skillId) {
      await b.whenReady();
      type R = { id: string };
      const A = 'skill_goal.withdraw';
      const sid = trim(skillId);
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'skill_goal_plans', sid || null, 'not_signed_in', SG_MSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      if (!role) return h.refuse<R>(A, 'skill_goal_plans', sid || null, 'forbidden', SG_MSG.forbidden);
      const gid = goalId(caller, sid);
      const goal = get('skill_goals', gid);
      if (!goal || goal.status !== 'active') return h.refuse<R>(A, 'skill_goal_plans', sid || null, 'no_goal', SG_MSG.no_goal, role);
      const at = nowTs();
      upd('skill_goals', gid, { status: 'removed', updated_at: at });
      const plan = get('skill_goal_plans', gid);
      if (plan) upd('skill_goal_plans', gid, { status: 'removed', shared: false, share_person: null, updated_at: at, removed_at: at });
      return h.done<R>(A, 'skill_goal_plans', gid, `removed ${sid}`, role, null, '', SG_MSG.withdrawn, { id: gid }, ['skill_goals', 'skill_goal_plans']);
    },

    async shareSkillGoal(skillId, shared) {
      await b.whenReady();
      type R = { id: string; shared: boolean };
      const A = 'skill_goal.share';
      const sid = trim(skillId);
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'skill_goal_plans', sid || null, 'not_signed_in', SG_MSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      if (!role) return h.refuse<R>(A, 'skill_goal_plans', sid || null, 'forbidden', SG_MSG.forbidden);
      const gid = goalId(caller, sid);
      const goal = get('skill_goals', gid);
      if (!goal || goal.status !== 'active') return h.refuse<R>(A, 'skill_goal_plans', sid || null, 'no_goal', SG_MSG.no_goal, role);
      const plan = get('skill_goal_plans', gid);
      if (!plan || plan.status !== 'active') return h.refuse<R>(A, 'skill_goal_plans', sid, 'no_plan', SG_MSG.no_plan, role);
      const want = shared === true;
      if ((plan.shared === true) === want) return h.refuse<R>(A, 'skill_goal_plans', sid, 'no_change', SG_MSG.no_change, role);
      upd('skill_goal_plans', gid, { shared: want, share_person: want ? caller : null, updated_at: nowTs() });
      return h.done<R>(A, 'skill_goal_plans', gid, `${want ? 'shared' : 'private'} ${sid}`, role, null, '', want ? SG_MSG.shared : SG_MSG.unshared, { id: gid, shared: want }, ['skill_goal_plans']);
    },
  };
}
