// M21 LocalBackend RPC implementations (owner: W1 · E5, F09 Future Me). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261009115001_kafaa_w1e5_future.sql (kafaa_set_future_goal, kafaa_future_demand):
// same checks, refusal codes and audit rows. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { GOAL_KINDS, GOAL_TARGET_LEVEL, MAX_ACTIVE_GOALS, goalId, goalTarget, type GoalData } from '../future';
import type { FutureDemandRow, FutureGoalResult, FutureReadiness, M21Rpc, TrackStepResult } from './rpc';
import { inputFor, normSteps, readinessV2, trackProgressId, type RV2Tables } from '../readiness';

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
    // ───────────── FS13 readiness v2 (mirror of kafaa_future_readiness / kafaa_fm_readiness_of)
    async futureReadiness() {
      await b.whenReady();
      const me = b.identity().personId;
      if (!me || !b.access().has('skills_profile', ['Own'])) throw new Error("Kafa'a · Future Me readiness is for staff with a skills profile");
      const t = {
        techs: b.raw('adv_technologies'), advSkills: b.raw('adv_skills'), map: b.raw('future_skill_map'), skills: b.raw('skills'), resources: b.raw('future_resources'),
        states: b.raw('person_skills'), enrolments: b.raw('enrolments'), trainingRecords: b.raw('training_records'), trackProgress: b.raw('future_track_progress'),
      } as unknown as RV2Tables;
      return { person_id: me, ...readinessV2(inputFor(me, t)) } as FutureReadiness;
    },
    async recordTrackStep(trackId, step, done = true) {
      await b.whenReady();
      type R = TrackStepResult;
      const me = b.identity().personId;
      const entity = `${trackId ?? ''}:${step ?? ''}`;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('future.track', 'future_track_progress', entity, code, msg, role);
      if (!me) return refuse('not_signed_in', 'Sign in to record your learning');
      const role = b.access().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', 'ADVANCE tracks count for staff with a skills profile');
      const track = trackId ? b.rawGet('adv_tracks', trackId) : undefined;
      if (!track) return refuse('not_found', 'Unknown learning track', role);
      const total = Array.isArray(track.modules) ? (track.modules as unknown[]).length : 0;
      if (!Number.isInteger(step) || step < 0 || step >= total) return refuse('invalid', 'That step is not part of this track', role);
      const id = trackProgressId(me, track.id);
      const cur = b.rawGet('future_track_progress', id);
      const ts = nowTs();
      const before = normSteps(cur?.steps_done, total);
      const steps = done === false ? before.filter((x) => x !== step) : normSteps([...before, step], total);
      const complete = steps.length === total;
      const completed_at = complete ? (cur?.status === 'completed' && cur.completed_at ? String(cur.completed_at) : ts) : null;
      const row = { steps_done: steps, status: complete ? 'completed' as const : 'in_progress' as const, completed_at, updated_at: ts };
      if (cur) b.rawUpdate('future_track_progress', id, row);
      else b.rawInsert('future_track_progress', { id, person_id: me, track_id: track.id, started_at: ts, ...row });
      const msg = complete ? 'Track completed: it now counts as learning evidence' : 'Progress saved';
      return h.done<R>('future.track', 'future_track_progress', id, `${track.id} step ${step + 1} ${done === false ? 'undone' : 'done'} (${steps.length}/${total})`, role, null, '', msg,
        { id, track_id: track.id, status: row.status, steps_done: steps, steps: total, completed_at }, ['future_track_progress']);
    },
  };
}
