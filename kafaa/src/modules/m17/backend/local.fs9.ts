// M17 FS84 LocalBackend RPCs (owner: FS wave I · E5): team 2030 capability targets and the organisation skills inventory. Installed through
// makeLocalM17 (backend/local.ts). 1:1 mirror of kafaa_team_future_targets / kafaa_adopt_future_targets / kafaa_org_skill_inventory in
// supabase/migrations/20261010295001_kafaa_fs95_team_targets_inventory.sql: same scope, checks in the same order, codes, messages and
// audit rows. Rules: ../teamTargets.ts. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M17Rpc } from './rpc';
import { todayIso } from '../../../domain/rules';
import { nowTs } from '../../../data/audit';
import { defaultGroup, groupsOf, inGroup, isActiveStaff, validGroupKey, type PersonRow } from '../checkins';
import {
  NOTE_MAX, TT_MSG, adoptPlan, dataQuality, futureTargetId, futureTargets, isFtHorizon, orgInventory, ttCtx,
  type InvDim, type StoredTarget,
} from '../teamTargets';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function makeLocalM17Fs9(b: LocalBackend, h: LocalRpcHelpers): Pick<M17Rpc, 'teamFutureTargets' | 'adoptFutureTargets' | 'orgSkillInventory'> {
  const people = () => b.raw('people') as unknown as PersonRow[];
  const ctx = () => ttCtx({ skills: b.raw('skills') as Row[], competencies: b.raw('competencies') as Row[], role_profile_versions: b.raw('role_profile_versions') as Row[] });
  /** Same pool as rpc.teamCoverage (kafaa_sc_pool): people mode = the active staff whose skills I may read; Agg = every active staff member. */
  const scope = () => {
    const c = b.access();
    const me = b.identity().personId;
    const peopleMode = c.has('skills_profile', ['Scope', 'R', 'W', 'A']);
    const agg = c.has('skills_profile', ['Agg']);
    const staff = people().filter(isActiveStaff);
    const pool = peopleMode ? staff.filter((p) => c.ruleRead('skills_profile', p.id, null, true)) : staff;
    return { me, peopleMode, agg, pool, groups: groupsOf(pool), mePerson: people().find((p) => p.id === me) };
  };
  const derive = (pool: PersonRow[], key: string | null, horizon: '2028' | '2030', peopleMode: boolean) => {
    const mem = key ? pool.filter((p) => inGroup(p, key)).sort((x, y) => cmp(x.id, y.id)) : [];
    const ids = new Set(mem.map((p) => p.id));
    return {
      mem,
      ft: futureTargets({
        ctx: ctx(), horizon, group: key, people: peopleMode,
        members: mem.map((p) => ({ id: p.id, job_role_id: p.job_role_id ?? null })),
        states: (b.raw('person_skills') as Row[]).filter((s) => ids.has(s.person_id)),
        stored: b.raw('team_skill_targets') as unknown as StoredTarget[],
      }),
    };
  };

  return {
    async teamFutureTargets(groupKey, horizon) {
      await b.whenReady();
      const s = scope();
      if (!s.me || (!s.peopleMode && !s.agg)) throw new Error("Kafa'a · team capability is for managers in scope and HR aggregates");
      const hz = isFtHorizon(horizon) ? horizon : '2030';
      const key0 = groupKey ?? defaultGroup(s.groups, s.mePerson, s.peopleMode);
      const key = key0 && s.groups.some((g) => g.key === key0) ? key0 : null;
      const { mem, ft } = derive(s.pool, key, hz, s.peopleMode);
      return {
        ...ft, group: key ?? key0, mode: s.peopleMode ? 'people' as const : 'aggregate' as const, groups: s.groups,
        people: s.peopleMode ? mem.map((p) => ({ id: p.id, name_en: p.display_name ?? p.id, name_ar: p.display_name_ar || p.display_name || p.id, job_role_id: p.job_role_id ?? null })) : [],
      };
    },
    async adoptFutureTargets(input) {
      await b.whenReady();
      type R = { written: number; retired: number; kept: number };
      const me = b.identity().personId;
      const key = String(input?.team_id ?? '').trim();
      const hz = input?.horizon;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('skills.future_target.adopt', 'team_skill_targets', key || null, code, msg, role);
      if (!me) return refuse('not_signed_in', TT_MSG.not_signed_in);
      const c = b.access();
      const role = c.actingRole('skills_profile', ['A']) ?? c.actingRole('skills_profile', ['Scope']);
      if (!role) return refuse('forbidden', TT_MSG.forbidden);
      if (!validGroupKey(key)) return refuse('invalid', TT_MSG.invalid_group, role);
      if (!isFtHorizon(hz)) return refuse('invalid', TT_MSG.invalid_horizon, role);
      const staff = people().filter(isActiveStaff).filter((p) => inGroup(p, key));
      if (!staff.length) return refuse('not_found', TT_MSG.invalid_group, role);
      if (!c.has('skills_profile', ['A']) && !staff.some((p) => c.inScope('skills_profile', p.id))) return refuse('forbidden', TT_MSG.forbidden, role);
      const s = scope();
      const { ft } = derive(s.pool, key, hz, true);
      if (!ft.targets.length) return refuse('no_profile', TT_MSG.no_profile, role);
      const plan = adoptPlan(ft);
      if (!plan.write.length && !plan.retire.length) return refuse('unchanged', TT_MSG.unchanged, role);
      const note = String(input?.note ?? '').trim().slice(0, NOTE_MAX) || null;
      const at = nowTs();
      for (const t of plan.write) {
        const id = futureTargetId(hz, key, t.skill_id);
        const row = { team_id: key, skill_id: t.skill_id, min_people: t.min_people!, min_level: t.min_level, note, active: true, set_by: me, updated_at: at, horizon: hz, profile_version_ids: t.versions };
        if (b.rawGet('team_skill_targets', id)) b.rawUpdate('team_skill_targets', id, row as never);
        else b.rawInsert('team_skill_targets', { id, ...row } as never);
      }
      for (const sk of plan.retire) b.rawUpdate('team_skill_targets', futureTargetId(hz, key, sk), { active: false, set_by: me, updated_at: at } as never);
      return h.done<R>('skills.future_target.adopt', 'team_skill_targets', `${hz}:${key}`, `${plan.write.length} written, ${plan.retire.length} switched off, ${plan.kept} kept`, role, null, '',
        TT_MSG.adopted, { written: plan.write.length, retired: plan.retire.length, kept: plan.kept }, ['team_skill_targets']);
    },
    async orgSkillInventory(dim) {
      await b.whenReady();
      const c = b.access();
      if (!b.identity().personId || !c.has('skills_profile', ['Agg', 'A'])) return null;
      const d: InvDim = dim === 'family' ? 'family' : 'entity';
      const w = { ctx: ctx(), skills: b.raw('skills') as Row[], people: people(), states: b.raw('person_skills') as Row[], dim: d, today: todayIso() };
      return { inventory: orgInventory(w), quality: dataQuality(w) };
    },
  };
}
