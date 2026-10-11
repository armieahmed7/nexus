// FS wave A integration (QA lead): cross-feature hand-offs between FS02 (catalogue), FS04 (keyspace), FS05 (role profiles) and
// FS06 (task layer). Runs as a FINALIZE_LAST finalizer after fs02 (which appends the FS02 skills) and fs03 (final skill states):
//  1. FS05 -> FS02: 2030/2035 requirements that name an F01 skill with an FS02 future equivalent (FUTURE_SKILL_EQUIVALENT) now
//     name the FS02 skill; "now" versions keep today's skill. Every version is re-checked with FS05's checkVersion.
//  2. FS06 -> FS02: task links of kind "future" point at the FS02 equivalent (id jts:<task>:<skill>).
//  3. FS04 -> FS02: keyspace rows for the FS02 advanced-reactor, AI and digital-plant skills (FS_QA_KEYSPACE_ROWS); radar
//     readiness is unchanged (credit is the best row, and nobody holds the new skills yet); adv_skills.sk_ids follow the map.
// The live database gets the same rows from supabase/migrations/20261010219001_kafaa_fs1qa_integration.sql (guarded DML).
import { FUTURE_SKILL_EQUIVALENT, FS_QA_KEYSPACE_ROWS } from '../../../src/domain/taxonomy.ts';
import { normaliseReqs, checkVersion } from '../../../src/modules/m01/roleProfiles.ts';
import { mapId, rowsOf } from '../../../src/modules/m11/keyspace.ts';

export const FINALIZE_LAST = true;
const EQ = FUTURE_SKILL_EQUIVALENT;

export function remapRequirements(reqs) {
  const by = new Map();
  for (const r of reqs) {
    const ref = r.kind === 'skill' ? EQ[r.ref_id] ?? r.ref_id : r.ref_id;
    const k = `${r.kind}:${ref}`;
    const cur = by.get(k);
    if (!cur || r.level > cur.level) by.set(k, { ...r, ref_id: ref });
  }
  return normaliseReqs([...by.values()]);
}

export default function build() {}

export function finalize(T, ctx) {
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  for (const [a, b] of Object.entries(EQ)) if (!skills.has(a) || !skills.has(b) || skills.get(b).lifecycle === 'obsolete') throw new Error(`fsqa1: bad equivalence ${a} -> ${b}`);
  // 1. FS05
  const comps = new Map(T.competencies.map((c) => [c.id, c.domain]));
  const areas = new Map(T.skills.map((s) => [s.id, s.area]));
  const roles = new Map(T.job_roles.map((r) => [r.id, r]));
  let nReq = 0;
  for (const v of T.role_profile_versions ?? []) {
    if (v.horizon === 'now' || !(v.requirements ?? []).some((r) => r.kind === 'skill' && EQ[r.ref_id])) continue;
    v.requirements = remapRequirements(v.requirements);
    const role = roles.get(v.role_id);
    const input = { role_id: v.role_id, horizon: v.horizon, requirements: v.requirements, drivers: v.drivers, rationale_en: v.rationale_en, rationale_ar: v.rationale_ar, sources: v.sources, publish: v.status !== 'draft' };
    const code = checkVersion(input, { role: { id: role.id, lifecycle: role.lifecycle, security_sensitive: !!role.security_sensitive }, competencies: comps, skills: areas });
    if (code !== 'ok') throw new Error(`fsqa1: ${v.id} fails checkVersion after the FS02 remap (${code})`);
    nReq++;
  }
  // 2. FS06
  let nLink = 0;
  const ids = new Set((T.jta_task_skills ?? []).map((l) => l.id));
  for (const l of T.jta_task_skills ?? []) {
    const to = l.kind === 'future' ? EQ[l.skill_id] : null;
    if (!to) continue;
    const id = `jts:${l.task_id}:${to}`;
    if (ids.has(id)) throw new Error(`fsqa1: duplicate link ${id}`);
    ids.delete(l.id); ids.add(id);
    Object.assign(l, { id, skill_id: to });
    nLink++;
  }
  T.jta_task_skills?.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // 3. FS04
  const map = T.future_skill_map ?? [];
  let nMap = 0;
  for (const [key, key_kind, sk_id, relation, need_level, note_en, note_ar] of FS_QA_KEYSPACE_ROWS) {
    if (!skills.has(sk_id) || skills.get(sk_id).area === 'security') throw new Error(`fsqa1: bad keyspace skill ${sk_id}`);
    if (!map.some((m) => m.key === key && m.key_kind === key_kind)) throw new Error(`fsqa1: unknown keyspace key ${key}`);
    const id = mapId(key, sk_id);
    if (map.some((m) => m.id === id)) continue;
    map.push({ id, key, key_kind, sk_id, relation, need_level, primary_sk: false, active: true, note_en, note_ar, sort: map.filter((m) => m.key === key).length + 1, updated_by: null, updated_at: `${ctx.DEMO_TODAY}T00:00:00Z` });
    nMap++;
  }
  for (const a of T.adv_skills ?? []) a.sk_ids = rowsOf(map, a.id).map((m) => m.sk_id);
  console.log(`fsqa1: ${nReq} role-profile versions re-pointed to FS02 skills, ${nLink} future task links re-pointed, ${nMap} keyspace rows added`);
}
