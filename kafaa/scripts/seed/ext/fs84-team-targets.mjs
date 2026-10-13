// FS84 Team 2030 capability targets and an organisation skills inventory (future-skills wave I · E5, M17 Skills Passport).
// finalize() (FINALIZE_LAST; runs before the fsqa* integration builders, so the FS05 -> FS02 requirement remap that fsqa1 applies to the
// 2030/2035 profiles afterwards is applied here first, with fsqa1's own remapRequirements):
//   team_skill_targets   three adopted future-target sets (horizon 2028 / 2030, ids tst:<horizon>:<group>:<skill>), each derived with
//                        futureTargets() from the FS05 role profiles published on its adoption date, with the profile versions recorded:
//                        - team:ops-crew-b, 2030, adopted by the crew B shift manager on 2026-09-01 from the profiles of that day: the
//                          reactor-operator 2030 profile has since been republished (v2, 2026-09-20), so the page flags targets that no
//                          longer match and offers to adopt again (honest, not tuned)
//                        - family:operations, 2028, adopted by the operations CEO role card on 2026-10-09 (up to date)
//                        - team:rp, 2030, adopted by the RP lead on 2026-10-09 (up to date)
//                        Existing F11 rows get horizon 'current' (the column default; live rows take it from the ALTER, no UPDATE).
// The inventory and data-quality panel are computed from the existing states (no rows of their own). Synthetic data only; the builder
// fails on any broken rule (an adopted set that does not reproduce, a target outside the group or a security skill).
import { FUTURE_SKILL_EQUIVALENT } from '../../../src/domain/taxonomy.ts';
import { remapRequirements } from './fsqa1-integration.mjs';
import { futureTargets, futureTargetId, ttCtx, TARGET_HORIZONS } from '../../../src/modules/m17/teamTargets.ts';

export const FINALIZE_LAST = true;
const ADOPT = [
  { group: 'team:ops-crew-b', horizon: '2030', by: 'p-sro', at: '2026-09-01T09:00:00Z', asOf: '2026-09-01', note: 'Adopted at the September crew review; revisit after the 2030 profiles are republished.' },
  { group: 'family:operations', horizon: '2028', by: 'p-ops-ceo', at: '2026-10-09T09:00:00Z', asOf: null, note: null },
  { group: 'team:rp', horizon: '2030', by: 'p-rp-lead', at: '2026-10-09T10:00:00Z', asOf: null, note: null },
];

/** Profiles as fsqa1 leaves them (2030/2035 skill requirements renamed to their FS02 equivalents). */
function finalVersions(versions) {
  return versions.map((v) => (v.horizon === 'now' || !(v.requirements ?? []).some((r) => r.kind === 'skill' && FUTURE_SKILL_EQUIVALENT[r.ref_id])
    ? v : { ...v, requirements: remapRequirements(v.requirements) }));
}
/** The profiles that were published on a date: published or since superseded, published on or before it (the latest version wins). */
export function versionsAsOf(versions, asOf) {
  if (!asOf) return versions;
  return versions.filter((v) => ['published', 'superseded'].includes(v.status) && String(v.published_at ?? '').slice(0, 10) <= asOf).map((v) => ({ ...v, status: 'published' }));
}
export const ADOPTIONS = ADOPT;

export default function build() {}

export function finalize(T) {
  const inGroup = (p, key) => key === `team:${p.team_id}` || key === `family:${p.job_family_id}`;
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active');
  for (const t of T.team_skill_targets) { t.horizon ??= 'current'; t.profile_version_ids ??= []; }
  const base = finalVersions(T.role_profile_versions);
  const secComps = new Set(T.competencies.filter((c) => c.domain === 'security').map((c) => c.id));
  const skill = new Map(T.skills.map((s) => [s.id, s]));
  let rows = 0;
  for (const a of ADOPT) {
    const ctx = ttCtx({ skills: T.skills, competencies: T.competencies, role_profile_versions: versionsAsOf(base, a.asOf) });
    const mem = staff.filter((p) => inGroup(p, a.group)).map((p) => ({ id: p.id, job_role_id: p.job_role_id ?? null }));
    if (!mem.length || !staff.some((p) => p.id === a.by)) throw new Error(`fs84: ${a.group} has no staff or ${a.by} is unknown`);
    const ft = futureTargets({ ctx, horizon: a.horizon, group: a.group, members: mem, states: [], stored: [], people: true });
    if (!ft.targets.length) throw new Error(`fs84: no derived targets for ${a.group} ${a.horizon}`);
    for (const t of ft.targets) {
      const s = skill.get(t.skill_id);
      if (!s || s.area === 'security' || secComps.has(s.competency_id)) throw new Error(`fs84: ${t.skill_id} is unknown or a security skill`);
      const id = futureTargetId(a.horizon, a.group, t.skill_id);
      if (T.team_skill_targets.some((x) => x.id === id)) throw new Error(`fs84: duplicate ${id}`);
      T.team_skill_targets.push({ id, team_id: a.group, skill_id: t.skill_id, min_people: t.min_people, min_level: t.min_level, note: a.note, active: true, set_by: a.by, updated_at: a.at,
        horizon: a.horizon, profile_version_ids: t.versions });
      rows++;
    }
  }
  if (!T.team_skill_targets.every((t) => TARGET_HORIZONS.includes(t.horizon))) throw new Error('fs84: a target with an unknown horizon');
  console.log(`  fs84: ${rows} adopted future targets (${ADOPT.map((a) => `${a.group} ${a.horizon}`).join(', ')}); ${T.team_skill_targets.filter((t) => t.horizon === 'current').length} F11 targets stay current`);
}
