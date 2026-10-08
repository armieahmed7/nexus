// M21 LocalBackend RPC implementations (owner: W1 · E5, F09 Future Me). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261009115001_kafaa_w1e5_future.sql (kafaa_set_future_goal, kafaa_future_demand):
// same checks, refusal codes and audit rows. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { GOAL_KINDS, GOAL_TARGET_LEVEL, MAX_ACTIVE_GOALS, goalId, goalTarget, type GoalData } from '../future';
import type { FutureDemandRow, FutureGoalResult, M21Rpc } from './rpc';

export function makeLocalM21(b: LocalBackend, h: LocalRpcHelpers): M21Rpc {
  const data = (): GoalData => ({
    advSkills: b.raw('adv_skills'), skills: b.raw('skills'), bridges: b.raw('skill_bridges'), roles: b.raw('future_roles'),
    lanes: b.raw('horizon_lanes'), jobRoles: b.raw('job_roles'), techs: b.raw('adv_technologies'),
  });
  return {
    async setFutureGoal(kind, refId, active = true) {
      await b.whenReady();
      type R = FutureGoalResult;
      const me = b.identity().personId;
      const entity = `${kind ?? ''}:${refId ?? ''}`;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('future.goal', 'future_goals', entity, code, msg, role);
      if (!me) return refuse('not_signed_in', 'Sign in to set learning goals');
      const role = b.access().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', 'Future Me goals are for staff with a skills profile');
      if (!kind || !(GOAL_KINDS as readonly string[]).includes(kind) || !refId) return refuse('invalid', 'Unknown goal kind', role);
      const id = goalId(me, kind, refId);
      const cur = b.rawGet('future_goals', id);
      const ts = nowTs();
      if (active === false) {
        if (!cur || cur.status === 'removed') return refuse('not_found', 'This goal is not on your list', role);
        b.rawUpdate('future_goals', id, { status: 'removed', updated_at: ts });
        return h.done<R>('future.goal', 'future_goals', id, `removed ${kind} ${refId}`, role, null, '', 'Removed from your learning goals', { id, status: 'removed', skill_ids: cur.skill_ids }, ['future_goals']);
      }
      const tgt = goalTarget(kind, refId, data());
      if (!tgt) return refuse('not_found', 'Goal target not found', role);
      const n = b.raw('future_goals').filter((g) => g.person_id === me && g.status === 'active').length;
      if ((!cur || cur.status !== 'active') && n >= MAX_ACTIVE_GOALS) return refuse('limit', `You can keep up to ${MAX_ACTIVE_GOALS} Future Me goals; remove one first`, role);
      const row = { ...tgt, status: 'active' as const, target_level: GOAL_TARGET_LEVEL, updated_at: ts };
      if (cur) b.rawUpdate('future_goals', id, row);
      else b.rawInsert('future_goals', { id, person_id: me, kind, ref_id: refId, source: 'future_me', created_at: ts, ...row });
      return h.done<R>('future.goal', 'future_goals', id, `added ${kind} ${refId} (${tgt.skill_ids.length} skills)`, role, null, '', 'Added to your learning goals', { id, status: 'active', skill_ids: tgt.skill_ids }, ['future_goals']);
    },
    async futureDemand() {
      await b.whenReady();
      if (!b.access().has('skills_profile', ['Agg', 'R', 'A'])) throw new Error("Kafa'a · future demand is aggregate-only and restricted");
      const cells = new Map<string, Set<string>>();
      const add = (src: string, kind: string, target: string | null | undefined, person: string) => {
        if (!target) return;
        const k = `${src}|${kind}|${target}`;
        (cells.get(k) ?? cells.set(k, new Set()).get(k)!).add(person);
      };
      for (const i of b.raw('future_interest')) if (i.active) add('interest', i.target_kind, i.tech_id ?? i.lane_id, i.person_id);
      for (const g of b.raw('future_goals')) if (g.status === 'active') add('goal', g.lane_id ? 'lane' : 'tech', g.lane_id ?? g.tech_id, g.person_id);
      const cmp = (a: string, c: string) => (a < c ? -1 : a > c ? 1 : 0);
      return [...cells.entries()].sort(([a], [c]) => cmp(a, c)).map(([k, s]): FutureDemandRow => {
        const [source, target_kind, target_id] = k.split('|');
        const sup = s.size < MIN_GROUP_SIZE;
        return { source: source as FutureDemandRow['source'], target_kind: target_kind as FutureDemandRow['target_kind'], target_id, n: sup ? null : s.size, suppressed: sup };
      });
    },
  };
}
