/**
 * FS13 Future Me readiness, rule v2: readiness that learning can actually move (SIMULATED, 0-100; ENEC is evaluating these
 * technologies, no deployment decision is implied). Import-free: the seed builder and the PGlite validator load it in node.
 * SQL mirror: kafaa_fm_readiness_of(person) in supabase/migrations/20261010224001_kafaa_fs24_future_readiness.sql. Change both together.
 *
 * Every ADVANCE skill (as-*) is resolved through the FS04 keyspace (kafaa_future_skill_map, active rows, never a security skill):
 *   carry   today's skills on the key (relation transfers or adapts, an established catalogue skill): c6 = 2 x level (transfers) or
 *           1 x level (adapts), level capped at 3, best row; the part of the ADVANCE skill that carries over from APR-1400 work
 *   direct  the new capability itself (relation new, or any FS02 future skill on the key): d3 = level capped at 3, best row;
 *           an SMR-family skill from FS02 counts directly
 *   learn   recorded learning on a source-linked resource that covers the ADVANCE skill (kafaa_future_resources.adv_skill_ids):
 *           a completed catalogue course gives its level (1 or 2), a completed ADVANCE track gives level 1; l3 = best
 *   credit  1 - (1 - c6/6) x (1 - d3/3) x (1 - l3/3): each kind of evidence closes part of the gap that is left
 *           bp = round(10000 x (54 - (6 - c6)(3 - d3)(3 - l3)) / 54)   (integer basis points, no rounding ties)
 *   family  index = round(sum bp / (10 n)) / 10, n = ADVANCE skills in the family
 *   overall mean of the family indices: round(sum(index x 10) / families) / 10
 * Ceilings per family: carry_ceiling (today's skills at level 3 on every key, no learning), learn_ceiling (plus every catalogue
 * course and track that covers the key). 100 is reachable through evidence alone: every key has a transferring skill or a
 * direct (new-capability) skill, and level 3 on it closes the gap.
 */

export const RV2_VERSION = 2;
export const COURSE_MAX_LEVEL = 2;
export const TRACK_LEVEL = 1;

export interface RV2AdvSkill { id: string; tech_id: string; relation: string; sort?: number | null }
export interface RV2Tech { id: string; sort?: number | null }
export interface RV2MapRow { key: string; sk_id: string; relation: string; active?: boolean | null }
export interface RV2Skill { id: string; area: string; fs_area?: string | null }
export interface RV2State { skill_id: string; level: number; active?: boolean | null }
export interface RV2Resource { id: string; kind: string; course_id?: string | null; track_id?: string | null; adv_skill_ids: string[]; level: number }
export interface RV2Input {
  techs: RV2Tech[];
  advSkills: RV2AdvSkill[];
  map: RV2MapRow[];
  skills: RV2Skill[];
  states: RV2State[];
  resources: RV2Resource[];
  completedCourses: string[];
  completedTracks: string[];
}

/** A today's skill that carries part of an ADVANCE skill: f = 2 (transfers) or 1 (adapts). */
export interface CarryOpt { sk_id: string; f: number }
/** A resource that would record learning on an ADVANCE skill: course_level 1-2 when it is a catalogue course, track_id when an ADVANCE track. */
export interface LearnOpt { resource_id: string; course_id: string | null; course_level: number | null; track_id: string | null }
export interface RV2Item {
  adv_skill_id: string;
  relation: string;
  c6: number; carry_level: number; carry_via: string | null;
  d3: number; direct_level: number; direct_via: string | null;
  l3: number; learn_level: number; learn_via: string | null;
  bp: number;
  c6max: number; l3max: number;
  carry_opts: CarryOpt[];
  direct_opts: string[];
  learn_opts: LearnOpt[];
}
export interface RV2Family { tech_id: string; n: number; index: number; carry_ceiling: number; learn_ceiling: number; items: RV2Item[] }
export interface RV2 { version: number; overall: number; carry_ceiling: number; learn_ceiling: number; completed_courses: string[]; completed_tracks: string[]; families: RV2Family[] }

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const bySortId = <X extends { id: string; sort?: number | null }>(a: X, b: X) => (Number(a.sort ?? 0) - Number(b.sort ?? 0)) || cmp(a.id, b.id);
const cap = (x: number, hi: number) => Math.max(0, Math.min(hi, Math.floor(Number(x) || 0)));

/** Credit of one ADVANCE skill in basis points (0-10000) from the three evidence parts. */
export function creditBp(c6: number, d3: number, l3: number): number {
  return Math.round((10000 * (54 - (6 - c6) * (3 - d3) * (3 - l3))) / 54);
}
/** Index x 10 (an integer) from the credits of n ADVANCE skills. */
export const index10 = (bps: number[]) => (bps.length ? Math.round(bps.reduce((s, x) => s + x, 0) / (10 * bps.length)) : 0);
const mean10 = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);

/** The learning level a resource records for one person: a completed course gives its level (1-2), a completed track gives 1. */
export function learnLevelOf(o: LearnOpt, courses: Set<string>, tracks: Set<string>): number {
  let l = 0;
  if (o.course_id && o.course_level != null && courses.has(o.course_id)) l = Math.max(l, o.course_level);
  if (o.track_id && tracks.has(o.track_id)) l = Math.max(l, TRACK_LEVEL);
  return l;
}

/** The evidence options of every ADVANCE skill (who can raise it), independent of the person. */
export function evidenceOptions(input: Pick<RV2Input, 'advSkills' | 'map' | 'skills' | 'resources'>): Map<string, { carry: CarryOpt[]; direct: string[]; learn: LearnOpt[]; c6max: number; l3max: number }> {
  const skill = new Map(input.skills.map((s) => [s.id, s]));
  const out = new Map<string, { carry: CarryOpt[]; direct: string[]; learn: LearnOpt[]; c6max: number; l3max: number }>();
  for (const a of input.advSkills) {
    const carry = new Map<string, number>();
    const direct = new Set<string>();
    for (const m of input.map) {
      if (m.key !== a.id || m.active === false) continue;
      const s = skill.get(m.sk_id);
      if (!s || s.area === 'security') continue;
      if (m.relation === 'new' || s.fs_area) direct.add(s.id);
      else if (m.relation === 'transfers' || m.relation === 'adapts') carry.set(s.id, Math.max(carry.get(s.id) ?? 0, m.relation === 'transfers' ? 2 : 1));
    }
    const learn: LearnOpt[] = input.resources
      .filter((r) => (r.adv_skill_ids ?? []).includes(a.id) && ((r.kind === 'course' && r.course_id) || r.track_id))
      .map((r) => ({ resource_id: r.id, course_id: r.kind === 'course' && r.course_id ? r.course_id : null, course_level: r.kind === 'course' && r.course_id ? Math.max(1, Math.min(COURSE_MAX_LEVEL, Number(r.level) || 1)) : null, track_id: r.track_id ?? null }))
      .sort((x, y) => cmp(x.resource_id, y.resource_id));
    const carryOpts = [...carry.entries()].map(([sk_id, f]) => ({ sk_id, f })).sort((x, y) => cmp(x.sk_id, y.sk_id));
    out.set(a.id, {
      carry: carryOpts,
      direct: [...direct].sort(cmp),
      learn,
      c6max: carryOpts.reduce((m, o) => Math.max(m, 3 * o.f), 0),
      l3max: learn.reduce((m, o) => Math.max(m, o.course_level ?? 0, o.track_id ? TRACK_LEVEL : 0), 0),
    });
  }
  return out;
}

/** Recompute one item from its options and the person's evidence (levels per skill, completed courses and tracks). */
export function scoreItem(base: Omit<RV2Item, 'c6' | 'carry_level' | 'carry_via' | 'd3' | 'direct_level' | 'direct_via' | 'l3' | 'learn_level' | 'learn_via' | 'bp'>, level: (sk: string) => number, courses: Set<string>, tracks: Set<string>): RV2Item {
  let c6 = 0, carry_level = 0, carry_via: string | null = null;
  for (const o of base.carry_opts) {
    const L = level(o.sk_id);
    const c = o.f * Math.min(L, 3);
    if (L > 0 && c > c6) { c6 = c; carry_level = L; carry_via = o.sk_id; }
  }
  let direct_level = 0, direct_via: string | null = null;
  for (const sk of base.direct_opts) {
    const L = level(sk);
    if (L > direct_level) { direct_level = L; direct_via = sk; }
  }
  let learn_level = 0, learn_via: string | null = null;
  for (const o of base.learn_opts) {
    const L = learnLevelOf(o, courses, tracks);
    if (L > learn_level) { learn_level = L; learn_via = o.resource_id; }
  }
  const d3 = Math.min(direct_level, 3);
  const l3 = Math.min(learn_level, 3);
  return { ...base, c6, carry_level, carry_via, d3, direct_level, direct_via, l3, learn_level, learn_via, bp: creditBp(c6, d3, l3) };
}

function assemble(techs: RV2Tech[], advSkills: RV2AdvSkill[], itemOf: (a: RV2AdvSkill) => RV2Item, courses: Set<string>, tracks: Set<string>): RV2 {
  const adv = [...advSkills].sort(bySortId);
  const families: RV2Family[] = [...techs].sort(bySortId).map((t) => {
    const items = adv.filter((a) => a.tech_id === t.id).map(itemOf);
    return {
      tech_id: t.id, n: items.length,
      index: index10(items.map((i) => i.bp)) / 10,
      carry_ceiling: index10(items.map((i) => creditBp(i.c6max, 0, 0))) / 10,
      learn_ceiling: index10(items.map((i) => creditBp(i.c6max, 0, i.l3max))) / 10,
      items,
    };
  });
  return {
    version: 2,
    overall: mean10(families.map((f) => Math.round(f.index * 10))) / 10,
    carry_ceiling: mean10(families.map((f) => Math.round(f.carry_ceiling * 10))) / 10,
    learn_ceiling: mean10(families.map((f) => Math.round(f.learn_ceiling * 10))) / 10,
    completed_courses: [...courses].sort(cmp),
    completed_tracks: [...tracks].sort(cmp),
    families,
  };
}

/** Readiness v2 for one person (see the rule at the top of this file). Deterministic; the same numbers as kafaa_fm_readiness_of. */
export function readinessV2(input: RV2Input): RV2 {
  const opts = evidenceOptions(input);
  const skill = new Map(input.skills.map((s) => [s.id, s]));
  const lv = new Map<string, number>();
  for (const s of input.states) {
    if (s.active === false || !(Number(s.level) > 0) || skill.get(s.skill_id)?.area === 'security') continue;
    lv.set(s.skill_id, Math.max(lv.get(s.skill_id) ?? 0, cap(s.level, 4)));
  }
  const courses = new Set(input.completedCourses);
  const tracks = new Set(input.completedTracks);
  return assemble(input.techs, input.advSkills, (a) => {
    const o = opts.get(a.id)!;
    return scoreItem({ adv_skill_id: a.id, relation: a.relation, c6max: o.c6max, l3max: o.l3max, carry_opts: o.carry, direct_opts: o.direct, learn_opts: o.learn }, (sk) => lv.get(sk) ?? 0, courses, tracks);
  }, courses, tracks);
}

/** What would change: completed courses, completed tracks and new skill levels (the levels only ever go up). */
export interface EvidenceChange { courses?: string[]; tracks?: string[]; skills?: { skill_id: string; level: number }[] }

/**
 * Before/after preview on a readiness result (from the RPC or readinessV2): recompute every item with the extra evidence.
 * Pure arithmetic on the items, so the preview equals what the server returns once the evidence is recorded.
 */
export function previewEvidence(r: RV2, change: EvidenceChange): RV2 {
  const courses = new Set([...(r.completed_courses ?? []), ...(change.courses ?? [])]);
  const tracks = new Set([...(r.completed_tracks ?? []), ...(change.tracks ?? [])]);
  const extra = new Map<string, number>();
  for (const s of change.skills ?? []) extra.set(s.skill_id, Math.max(extra.get(s.skill_id) ?? 0, cap(s.level, 4)));
  const techs = r.families.map((f, i) => ({ id: f.tech_id, sort: i }));
  const advSkills = r.families.flatMap((f) => f.items.map((it, i) => ({ id: it.adv_skill_id, tech_id: f.tech_id, relation: it.relation, sort: i })));
  const byId = new Map(r.families.flatMap((f) => f.items.map((it) => [it.adv_skill_id, it] as const)));
  return assemble(techs, advSkills, (a) => {
    const it = byId.get(a.id)!;
    // the best skills an item already counts (by construction the first maximum in id order), raised by the change
    const known = new Map<string, number>();
    if (it.carry_via) known.set(it.carry_via, it.carry_level);
    if (it.direct_via) known.set(it.direct_via, Math.max(known.get(it.direct_via) ?? 0, it.direct_level));
    return scoreItem(it, (sk) => Math.max(known.get(sk) ?? 0, extra.get(sk) ?? 0), courses, tracks);
  }, courses, tracks);
}

/** Index points gained per family and overall (after - before, one decimal). */
export function deltaOf(before: RV2, after: RV2): { overall: number; families: { tech_id: string; before: number; after: number; delta: number }[] } {
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    overall: r1(after.overall - before.overall),
    families: before.families.map((f) => {
      const a = after.families.find((x) => x.tech_id === f.tech_id)!;
      return { tech_id: f.tech_id, before: f.index, after: a.index, delta: r1(a.index - f.index) };
    }),
  };
}

/** Every course id and track id that could still raise an index (not yet recorded), with the ADVANCE skills it covers. */
export function learningActions(r: RV2): { kind: 'course' | 'track'; ref: string; resource_ids: string[]; adv_skill_ids: string[] }[] {
  const acts = new Map<string, { kind: 'course' | 'track'; ref: string; resource_ids: Set<string>; adv_skill_ids: Set<string> }>();
  for (const f of r.families) for (const it of f.items) for (const o of it.learn_opts) {
    const add = (kind: 'course' | 'track', ref: string) => {
      const k = `${kind}:${ref}`;
      const cur = acts.get(k) ?? acts.set(k, { kind, ref, resource_ids: new Set(), adv_skill_ids: new Set() }).get(k)!;
      cur.resource_ids.add(o.resource_id);
      cur.adv_skill_ids.add(it.adv_skill_id);
    };
    if (o.course_id) add('course', o.course_id);
    if (o.track_id) add('track', o.track_id);
  }
  return [...acts.values()].map((a) => ({ kind: a.kind, ref: a.ref, resource_ids: [...a.resource_ids].sort(cmp), adv_skill_ids: [...a.adv_skill_ids].sort(cmp) })).sort((a, b) => cmp(`${a.kind}:${a.ref}`, `${b.kind}:${b.ref}`));
}

/** Proof that 100 is reachable through evidence alone: the evidence that would close every gap (level 3 on a transferring or direct skill). */
export function fullEvidence(r: RV2): EvidenceChange {
  const ids = new Set<string>();
  for (const f of r.families) for (const it of f.items) {
    const tr = it.carry_opts.find((o) => o.f === 2);
    if (tr) ids.add(tr.sk_id);
    else if (it.direct_opts[0]) ids.add(it.direct_opts[0]);
  }
  return { skills: [...ids].sort(cmp).map((skill_id) => ({ skill_id, level: 3 })) };
}

/** ADVANCE skills that no evidence can bring to full credit (neither a transferring nor a direct skill on the key). Empty on the seed. */
export function unreachableKeys(input: Pick<RV2Input, 'advSkills' | 'map' | 'skills' | 'resources'>): string[] {
  const opts = evidenceOptions(input);
  return input.advSkills.filter((a) => { const o = opts.get(a.id)!; return !o.carry.some((c) => c.f === 2) && o.direct.length === 0; }).map((a) => a.id).sort(cmp);
}

/** Raw tables (all rows) -> the readiness input of one person. Completed courses: enrolments with status completed and training
 * records with result passed or completed; completed tracks: future_track_progress rows with status completed. Same selection as kafaa_fm_readiness_of. */
export interface RV2Tables {
  techs: RV2Tech[]; advSkills: RV2AdvSkill[]; map: RV2MapRow[]; skills: RV2Skill[]; resources: RV2Resource[];
  states: (RV2State & { person_id: string })[];
  enrolments: { person_id: string; course_id: string; status: string }[];
  trainingRecords: { person_id: string; course_id: string; result?: string | null }[];
  trackProgress: { person_id: string; track_id: string; status: string }[];
}
export function inputFor(person: string, t: RV2Tables): RV2Input {
  const courses = new Set<string>();
  for (const e of t.enrolments) if (e.person_id === person && e.status === 'completed' && e.course_id) courses.add(e.course_id);
  for (const r of t.trainingRecords) if (r.person_id === person && (r.result === 'passed' || r.result === 'completed') && r.course_id) courses.add(r.course_id);
  return {
    techs: t.techs, advSkills: t.advSkills, map: t.map, skills: t.skills, resources: t.resources,
    states: t.states.filter((s) => s.person_id === person),
    completedCourses: [...courses].sort(cmp),
    completedTracks: t.trackProgress.filter((p) => p.person_id === person && p.status === 'completed').map((p) => p.track_id).sort(cmp),
  };
}
/** The steps of an ADVANCE track that are done, normalised (unique, in range, ascending). */
export function normSteps(steps: unknown, total: number): number[] {
  const xs = Array.isArray(steps) ? steps.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 0 && x < total) : [];
  return [...new Set(xs)].sort((a, b) => a - b);
}
export const trackProgressId = (person: string, track: string) => `ftp:${person}:${track}`;
