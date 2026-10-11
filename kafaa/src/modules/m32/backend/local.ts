// M32 LocalBackend RPC implementations (owners: wave E E2 (FS41, FS42, FS43)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// FS41: 1:1 mirror of kafaa_cec_mine / kafaa_cec_stats in supabase/migrations/20261010252001_kafaa_fs52_energy_transition.sql (same
// rules in src/modules/m32/cec.ts; reads only, never audited, never ledgered). Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { cecProfile, cecStats, type CecRow, type CecTargetRow, type SkillName, type StateLite } from '../cec';
import type { M32Rpc } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function makeLocalM32(b: LocalBackend, h: LocalRpcHelpers): M32Rpc {
  void h;
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const comps = () => raw('cec_competences') as unknown as CecRow[];
  const targets = () => raw('cec_role_targets') as unknown as CecTargetRow[];
  return {
    async cecMine() {
      await b.whenReady();
      const pid = b.identity().personId;
      if (!pid || !b.access().has('skills_profile', ['Own'])) return null;
      const person = b.rawGet('people' as never, pid) as unknown as Row | undefined;
      const names = new Map<string, SkillName>(raw('skills').map((s) => [s.id, { id: s.id, name_en: s.name_en, name_ar: s.name_ar }]));
      const states = raw('person_skills').filter((s) => s.person_id === pid && s.active) as unknown as StateLite[];
      return cecProfile(pid, person?.job_family_id ?? null, comps(), targets(), states, names);
    },
    async cecStats() {
      await b.whenReady();
      if (!b.identity().personId || !b.access().has('skills_profile', ['Agg'])) return null;
      const by = new Map<string, StateLite[]>();
      for (const s of raw('person_skills')) if (s.active) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)!).push(s as StateLite);
      return cecStats(raw('people') as never, comps(), targets(), by, MIN_GROUP_SIZE);
    },
  };
}
