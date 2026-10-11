// M11 LocalBackend RPC implementations (owner: FS wave A · E3, FS04). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261010213001_kafaa_fs13_keyspace.sql (kafaa_future_radar, kafaa_save_future_skill_map,
// kafaa_save_skill_gap_plan as redefined by FS04): same checks, refusal codes and audit rows. Pages never import this file.
// saveSkillGapPlan replaces the G4 local method (ext RPCs are assigned after the class fields), keeping its checks and adding sk_id.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { GapPlanInput, Result, Rpc, RowOf } from '../../../data/types';
import { newId } from '../../../data/local/store';
import { nowTs } from '../../../data/audit';
import { validGapPlan } from '../../../domain/future';
import { futureRadar, mapId, mapProblems, rowsOf, resolveSk, type MapRow } from '../keyspace';
import type { M11Rpc } from './rpc';

export function makeLocalM11(b: LocalBackend, h: LocalRpcHelpers): M11Rpc & Pick<Rpc, 'saveSkillGapPlan'> {
  const roles = () => b.identity().roles as string[];
  const map = () => b.raw('future_skill_map') as unknown as MapRow[];
  /** Re-sync adv_skills.sk_ids and future_skills.sk_id for one key from the active map rows (SQL kafaa_fk_sync). */
  const sync = (key: string) => {
    const rows = rowsOf(map(), key);
    const adv = b.rawGet('adv_skills', key);
    if (adv) b.rawUpdate('adv_skills', key, { sk_ids: rows.map((m) => m.sk_id) } as Partial<RowOf<'adv_skills'>>);
    for (const f of b.raw('future_skills').filter((x) => x.skill_key === key)) b.rawUpdate('future_skills', f.id, { sk_id: rows[0]?.sk_id ?? null } as Partial<RowOf<'future_skills'>>);
  };
  return {
    async futureRadar(scenario) {
      await b.whenReady();
      const ok = roles().includes('hr_analyst') || roles().includes('hr_director') || b.access().has('workforce_analytics', ['R']);
      if (!ok) throw new Error("Kafa'a · the future-skills radar is for HR and auditors only");
      const people = b.raw('people');
      return futureRadar({ futureSkills: b.raw('future_skills') as never, map: map(), people: people as never, states: b.raw('person_skills') as never }, String(scenario ?? ''));
    },

    async saveFutureSkillMap(input) {
      await b.whenReady();
      type R = { id: string };
      const role = b.access().has('frameworks', ['A']) ? 'admin' : null;
      const key = String(input?.key ?? '');
      if (!role) return h.refuse<R>('future.map', 'future_skill_map', null, 'forbidden', 'Only a platform admin may change the future-skill keyspace');
      const problems = mapProblems(input ?? {});
      if (problems.length) return h.refuse<R>('future.map', 'future_skill_map', null, 'invalid', `Check: ${problems.join(', ')}`, role);
      const known = input.key_kind === 'adv_skill' ? !!b.rawGet('adv_skills', key)
        : input.key_kind === 'radar' ? b.raw('future_skills').some((f) => f.skill_key === key)
        : b.raw('skill_gap_plans').some((p) => p.skill_key === key) || b.raw('future_skills').some((f) => f.skill_key === key);
      const sk = b.rawGet('skills', input.sk_id);
      if (!known || !sk) return h.refuse<R>('future.map', 'future_skill_map', null, 'not_found', !known ? 'Unknown key' : 'Unknown catalogue skill', role);
      if (sk.area === 'security') return h.refuse<R>('future.map', 'future_skill_map', null, 'security_restricted', 'Security skills stay off the future-skill map (career-path level only)', role);
      const id = mapId(key, input.sk_id);
      const active = input.active !== false;
      const others = rowsOf(map(), key).filter((m) => m.id !== id);
      if (!active && others.length === 0) return h.refuse<R>('future.map', 'future_skill_map', id, 'conflict', 'Every key must keep at least one active catalogue skill', role);
      const primary = !!input.primary_sk && active;
      if (primary) for (const m of others.filter((x) => x.primary_sk)) b.rawUpdate('future_skill_map', m.id, { primary_sk: false, updated_by: b.identity().personId, updated_at: nowTs() } as Partial<RowOf<'future_skill_map'>>);
      const row = {
        key, key_kind: input.key_kind, sk_id: input.sk_id, relation: input.relation, need_level: Number(input.need_level), primary_sk: primary, active,
        note_en: String(input.note_en ?? '').slice(0, 300), note_ar: String(input.note_ar ?? '').slice(0, 300), updated_by: b.identity().personId, updated_at: nowTs(),
      } as Partial<RowOf<'future_skill_map'>>;
      if (b.rawGet('future_skill_map', id)) b.rawUpdate('future_skill_map', id, row);
      else b.rawInsert('future_skill_map', { id, ...row, sort: 900 + map().filter((m) => m.key === key).length } as Partial<RowOf<'future_skill_map'>>);
      // a key with no primary row left gets its first active row as primary (stable resolution)
      if (!rowsOf(map(), key).some((m) => m.primary_sk)) { const first = rowsOf(map(), key)[0]; if (first) b.rawUpdate('future_skill_map', first.id, { primary_sk: true } as Partial<RowOf<'future_skill_map'>>); }
      sync(key);
      return h.done<R>('future.map', 'future_skill_map', id, `${key} -> ${input.sk_id} (${input.relation}, level ${input.need_level}${active ? '' : ', inactive'})`, role, null, '', 'Keyspace updated', { id }, ['future_skill_map', 'adv_skills', 'future_skills']);
    },

    async saveSkillGapPlan(plan: GapPlanInput): Promise<Result<{ id: string }>> {
      await b.whenReady();
      type R = { id: string };
      const role = (['hr_director', 'hr_analyst'] as const).find((r) => roles().includes(r)) ?? null;
      if (!role) return h.refuse<R>('future.gap_plan', 'skill_gap_plans', plan?.id ?? null, 'forbidden', 'Only HR (analyst or CHCO office) may plan skills gaps');
      const problems = validGapPlan(plan);
      if (problems.length) return h.refuse<R>('future.gap_plan', 'skill_gap_plans', plan?.id ?? null, 'invalid', `Check: ${problems.join(', ')}`, role);
      const key = plan.skill_key;
      const skId = key.startsWith('sk-') ? (b.rawGet('skills', key) && b.rawGet('skills', key)!.area !== 'security' ? key : null)
        : b.raw('future_skills').some((f) => f.skill_key === key) ? resolveSk(map(), key) : null;
      if (!skId) return h.refuse<R>('future.gap_plan', 'skill_gap_plans', null, 'not_found', 'Unknown skill', role);
      const status = plan.status ?? 'draft';
      if (!['draft', 'active', 'done'].includes(status)) return h.refuse<R>('future.gap_plan', 'skill_gap_plans', null, 'invalid', 'Unknown status', role);
      const row = { skill_key: key, sk_id: skId, scenario: plan.scenario, action: plan.action, owner_role: plan.owner_role.trim(), target_quarter: plan.target_quarter, status, note: String(plan.note ?? '').slice(0, 500) };
      let id = plan.id ?? null;
      if (id && b.rawGet('skill_gap_plans', id)) b.rawUpdate('skill_gap_plans', id, { ...row, updated_at: nowTs() } as Partial<RowOf<'skill_gap_plans'>>);
      else {
        id = newId('gp');
        b.rawInsert('skill_gap_plans', { id, ...row, created_by: b.identity().personId } as Partial<RowOf<'skill_gap_plans'>>);
      }
      return h.done<R>('future.gap_plan', 'skill_gap_plans', id, `${key} ${plan.action} ${plan.target_quarter} (${status}; SIMULATED scenario)`, role, null, '', 'Plan saved', { id }, ['skill_gap_plans']);
    },
  };
}
