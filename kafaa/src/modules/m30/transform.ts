// FS11 My Role in 2030 (Role Transformation Maps) and FS12 Task exposure view (FS wave B · E3, M30): the pure rules shared by
// the pages, the LocalBackend RPCs, the seed builder and (mirrored in SQL) supabase/migrations/20261010223001_kafaa_fs23_role_transformation.sql.
// Import-free apart from the two pure rule files it builds on (FS05 profile text check, FS06 exposure rule) and types, so node
// seed and validator scripts load it directly. PGlite proves SQL = TS on the seed (scripts/validate/fs23-role-transformation.mjs).
//
// Benchmarks: Jobs Transformation Maps (Workforce Singapore, 2025): per role, the technology drivers, the tasks that change, the
// redesigned profile and a dated reskilling path; SkillsFuture Singapore (2025): AI potential per task shown as "what the tool will
// do, what you will still own", and three role archetypes (Mastery Builders, Analytical Specialists, Human Connectors); OECD AI
// Capability Indicators (2025): the capability reason behind every task band; corporate reskilling (AT&T Workforce 2020 and others):
// honest change signals plus a personal, dated path instead of a threat score.
//
// transformRole(input) builds one role's map from FS05 (published role profiles now / 2030 / 2035) and FS06 (rated JTA tasks):
//  - drivers: the map's editorial drivers, the drivers named by the profile requirements added for 2030/2035 and the task drivers;
//  - tasks: every rated, non-restricted task moves one way: human core -> "grows" (stays with people and grows in share),
//    AI-assisted -> "augmented", partly automatable -> "shrinks" (parts move to tools; a person verifies). Each keeps the FS06 reasons;
//  - added: requirements new or raised from now to 2030 and from 2030 to 2035 (FS05);
//  - complements: the skills that complement AI (skills linked to human-core tasks; profile human/transversal skills if the role
//    has no task analysis yet);
//  - bridge: one step per added requirement: the shortest short course (staff, not initial training, <= 80 hours) teaching its
//    competency, else guided practice at 20 hours per level (no course in the catalogue yet);
//  - me: my time-to-ready for the horizon from my own skill states: every requirement I am below, the level gap, and
//    months = 2 x total level gap (the same 2 months per level as the F05 Career Navigator).
// Security, safeguards and cyber roles are path-level only: no tasks, skills, bridge or time-to-ready.
import { profileTextIsClean } from '../m01/roleProfiles.ts';
import { exposureOf, type CapLevel } from '../m26/future.ts';
import type { Reason } from '../../domain/engines/types';

export const ARCHETYPES = ['mastery_builder', 'analytical_specialist', 'human_connector'] as const;
export type Archetype = (typeof ARCHETYPES)[number];
/** Technology drivers: the FS06 task vocabulary (FS05 writes ai_assistance, normalised to ai_assist). */
export const DRIVERS = ['ai_assist', 'digital_ic', 'robotics', 'digital_twin', 'smr_design'] as const;
export type Driver = (typeof DRIVERS)[number];
export const BANDS = ['augment', 'automate_partly', 'human_core'] as const;
export type Band = (typeof BANDS)[number];
export const MOVES = ['grow', 'augmented', 'shrink'] as const;
export type Move = (typeof MOVES)[number];
export const MOVE_OF: Record<Band, Move> = { human_core: 'grow', augment: 'augmented', automate_partly: 'shrink' };
export const IMPORTANCE = ['core', 'important', 'useful'] as const;
export const HORIZONS = ['2030', '2035'] as const;
export type Horizon = (typeof HORIZONS)[number];
/** Security, safeguards and cyber families: career-path level only (CONTRACT non-negotiable 3). */
export const RESTRICTED_FAMILIES = ['security', 'safeguards', 'cyber'];
/** The F05 Career Navigator's estimate: two months of learning and practice per level of gap. */
export const MONTHS_PER_LEVEL = 2;
/** Guided practice when no short course teaches a skill yet. */
export const PRACTICE_HOURS_PER_LEVEL = 20;
/** A bridge course is a short course: staff audience, not initial qualification training, at most this many hours. */
export const BRIDGE_MAX_HOURS = 80;
/** Aggregates over fewer people are suppressed (MIN_GROUP_SIZE in src/auth/policy.ts). */
export const MIN_GROUP = 10;
export const SUMMARY_MIN = 40;
export const SUMMARY_MAX = 700;
export const PUBLIC_MIN = 20;
export const PUBLIC_MAX = 320;
export const HUMAN_AREAS = ['human_performance', 'leadership'];

export const normDriver = (d: unknown): Driver | null => {
  const s = d === 'ai_assistance' ? 'ai_assist' : d;
  return typeof s === 'string' && (DRIVERS as readonly string[]).includes(s) ? (s as Driver) : null;
};
export const isPathOnly = (role: { family_id?: string | null; security_sensitive?: boolean | null } | null | undefined) =>
  !!role && (!!role.security_sensitive || RESTRICTED_FAMILIES.includes(String(role.family_id ?? '')));

const R = (code: string, vars: Record<string, string | number> = {}): Reason => ({ code, key: `m30.reasons.${code}`, vars });
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const IMP_ORDER: Record<string, number> = { core: 0, important: 1, useful: 2 };

// ───────────── FS12 copy check: change is framed as tasks moving, never as people being made surplus
/** Banned wording, English: "replace" and "redundant" families, plus job-loss phrasing. Word-bounded, case-insensitive. */
export const BANNED_EN = /\b(replac(e|es|ed|ing|ement|ements)|redundan(t|cy|cies)|job (loss|losses|cuts?)|lay ?offs?|laid off|eliminat(e|es|ed|ing) (jobs?|roles?|positions?)|made surplus|headcount reduction)\b/i;
/** Banned wording, Arabic: replace (يستبدل / استبدال / إحلال), redundant (فائض / زائد عن الحاجة / الاستغناء), layoffs (تسريح), job cuts. */
export const BANNED_AR = /(استبدال|يستبدل|تستبدل|سيستبدل|(سي|ست|ي|ت)حل( [^ ]+){0,4} محل|إحلال|فائض عن الحاجة|زائد عن الحاجة|الاستغناء عن|تسريح|إلغاء الوظائف|إلغاء الوظيفة|خفض عدد الموظفين)/;
/** The first banned phrase in a text, or null (EN and AR). */
export function bannedWording(text: unknown): string | null {
  const s = typeof text === 'string' ? text : text && typeof text === 'object' ? JSON.stringify(text) : '';
  const m = s.match(BANNED_EN) ?? s.match(BANNED_AR);
  return m ? m[0] : null;
}
export const copyIsClean = (values: unknown[]): boolean => values.every((v) => bannedWording(v) === null);
/** Public summaries carry no numbers at all (no headcount, no shares, no levels): ASCII or Arabic-Indic digits. */
export const hasDigits = (s: unknown): boolean => typeof s === 'string' && /[0-9٠-٩۰-۹]/.test(s);

// ───────────── publishTransformation checks (order mirrored by SQL kafaa_rt_check)
export type CheckCode = 'ok' | 'not_found' | 'invalid' | 'security_restricted' | 'unclean_text' | 'banned_wording' | 'public_numbers' | 'source_required';
export const RT_MSG = {
  not_signed_in: 'Sign in to edit role transformation maps',
  forbidden: 'Only the training manager or the HR director can edit role transformation maps',
  not_found: 'Role not found (current roles only)',
  invalid: 'Choose an archetype, known drivers (each once), a summary of 40 to 700 characters and a public summary of 20 to 320 characters, in English and Arabic',
  security_restricted: 'Security, safeguards and cyber roles stay at career-path level: no archetype and no drivers',
  unclean_text: 'Map text must not mention headcount, sites or a deployment decision',
  banned_wording: 'Describe how tasks change, not people: wording such as "replace" or "redundant" is not used (English and Arabic)',
  public_numbers: 'The public summary carries no numbers',
  source_required: 'Publishing needs at least one https source with a label',
} as const;
export interface RtInput {
  role_id: string;
  archetype: string | null;
  drivers: string[];
  summary_en: string;
  summary_ar: string;
  public_summary_en: string;
  public_summary_ar: string;
  sources: { label: string; url: string; as_of?: string | null }[];
  publish: boolean;
}
export function checkTransformation(input: RtInput, role: { lifecycle?: string | null; family_id?: string | null; security_sensitive?: boolean | null } | null): CheckCode {
  if (!role || (role.lifecycle ?? 'current') !== 'current') return 'not_found';
  const path = isPathOnly(role);
  const txt = (k: keyof RtInput) => (typeof input?.[k] === 'string' ? (input[k] as string).trim() : null);
  const drivers = Array.isArray(input?.drivers) ? input.drivers : null;
  if (!drivers || drivers.some((d) => typeof d !== 'string' || !(DRIVERS as readonly string[]).includes(d)) || new Set(drivers).size !== drivers.length) return 'invalid';
  const arch = input?.archetype ?? null;
  if (arch !== null && !(ARCHETYPES as readonly string[]).includes(arch)) return 'invalid';
  if (!path && arch === null) return 'invalid';
  for (const k of ['summary_en', 'summary_ar'] as const) { const s = txt(k); if (s === null || s.length < SUMMARY_MIN || s.length > SUMMARY_MAX) return 'invalid'; }
  for (const k of ['public_summary_en', 'public_summary_ar'] as const) { const s = txt(k); if (s === null || s.length < PUBLIC_MIN || s.length > PUBLIC_MAX) return 'invalid'; }
  if (path && (arch !== null || drivers.length > 0)) return 'security_restricted';
  const texts = [txt('summary_en'), txt('summary_ar'), txt('public_summary_en'), txt('public_summary_ar')];
  if (!profileTextIsClean(texts)) return 'unclean_text';
  if (!copyIsClean(texts)) return 'banned_wording';
  if (hasDigits(texts[2]) || hasDigits(texts[3])) return 'public_numbers';
  if (input.publish) {
    const src = Array.isArray(input.sources) ? input.sources : [];
    if (!src.some((s) => s && typeof s === 'object' && typeof s.url === 'string' && /^https:\/\//.test(s.url) && typeof s.label === 'string' && s.label.trim().length > 0)) return 'source_required';
  }
  return 'ok';
}

// ───────────── transformRole
export interface Req { kind: 'competency' | 'skill'; ref_id: string; level: number; importance: string; driver?: string | null }
export interface VersionLite { role_id: string; horizon: string; version: number; status: string; requirements: unknown; drivers?: string[] | null }
export interface TaskLite {
  id: string; role_id: string; code: string; title_en: string; title_ar: string; critical: boolean; restricted: boolean; status: string; sort: number;
  ai_capability_needed: unknown; change_horizon: string | null; tech_driver: string | null;
}
export interface TaskSkillLite { task_id: string; skill_id: string; level: number; active: boolean }
export interface SkillLite { id: string; competency_id: string; core: boolean; area: string; fs_area?: string | null }
export interface CourseLite { id: string; competency_ids: string[]; duration_hours: number | null; audience: string; initial: boolean }
export interface StateLite { skill_id: string; level: number; active: boolean }
export interface RoleLite { id: string; family_id: string; lifecycle?: string | null; security_sensitive?: boolean | null }
export interface MapRowLite { archetype: string | null; drivers: string[]; status: string; version: number }

export interface MapTask { id: string; code: string; title_en: string; title_ar: string; critical: boolean; band: Band; move: Move; horizon: string; driver: string | null; reasons: Reason[] }
export interface Added { horizon: Horizon; kind: 'competency' | 'skill'; ref_id: string; skill_id: string | null; change: 'new' | 'raised'; from: number; to: number; importance: string; driver: Driver | null; reasons: Reason[] }
export interface Complement { skill_id: string; tasks: number; level: number; source: 'tasks' | 'profile'; reasons: Reason[] }
export interface BridgeStep { step: number; horizon: Horizon; kind: 'competency' | 'skill'; ref_id: string; skill_id: string | null; from: number; to: number; mode: 'course' | 'practice'; course_id: string | null; hours: number; reasons: Reason[] }
export interface Gap { kind: 'competency' | 'skill'; ref_id: string; skill_id: string | null; need: number; have: number; gap: number; importance: string; reasons: Reason[] }
export interface MyReadiness { horizon: Horizon; gaps: Gap[]; levels: number; months: number; ready_pct: number; requirements: number; reasons: Reason[] }
export interface DriverRow { driver: Driver; in_map: boolean; in_profile: boolean; reqs: number; tasks: number }
export interface RoleMap {
  role_id: string; family_id: string; path_only: boolean; status: string; version: number; archetype: Archetype | null; horizon: Horizon;
  drivers: DriverRow[]; tasks: MapTask[]; counts: { rated: number; grow: number; augmented: number; shrink: number };
  added: Added[]; complements: Complement[]; bridge: BridgeStep[]; bridge_hours: number; me: MyReadiness | null;
}
export interface TransformInput {
  role: RoleLite; map: MapRowLite | null; versions: VersionLite[]; tasks: TaskLite[]; taskSkills: TaskSkillLite[]; levels: CapLevel[];
  skills: SkillLite[]; courses: CourseLite[]; mine: StateLite[] | null; horizon?: string | null;
}

const reqsOf = (v: VersionLite | undefined): Req[] => (v && Array.isArray(v.requirements) ? (v.requirements as Req[]) : []);
/** The current published version per horizon (highest version wins), as FS05 publishedByHorizon. */
export function publishedOf(versions: VersionLite[], roleId: string): Record<string, VersionLite | undefined> {
  const out: Record<string, VersionLite | undefined> = {};
  for (const v of versions) {
    if (v.role_id !== roleId || v.status !== 'published') continue;
    if (!out[v.horizon] || out[v.horizon]!.version < v.version) out[v.horizon] = v;
  }
  return out;
}
/** The skill that carries a requirement: the skill itself, or the core skill of a competency. */
export function skillOfReq(r: Pick<Req, 'kind' | 'ref_id'>, skills: SkillLite[]): string | null {
  if (r.kind === 'skill') return r.ref_id;
  return skills.filter((s) => s.core && s.competency_id === r.ref_id).map((s) => s.id).sort(cmp)[0] ?? null;
}
/** My level on a requirement: a skill's state, or a competency's level (its core skill, else its best skill), 0 when none. */
export function levelOn(r: Pick<Req, 'kind' | 'ref_id'>, mine: StateLite[], skills: SkillLite[]): number {
  const live = mine.filter((s) => s.active);
  if (r.kind === 'skill') return Math.max(0, ...live.filter((s) => s.skill_id === r.ref_id).map((s) => Number(s.level)));
  const byId = new Map(skills.map((s) => [s.id, s]));
  const core = live.filter((s) => byId.get(s.skill_id)?.core && byId.get(s.skill_id)?.competency_id === r.ref_id);
  if (core.length) return Math.max(...core.map((s) => Number(s.level)));
  return Math.max(0, ...live.filter((s) => !byId.get(s.skill_id)?.core && byId.get(s.skill_id)?.competency_id === r.ref_id).map((s) => Number(s.level)));
}
/** Round half up of 100 x num / den with integers only (SQL computes the same). */
export const pctOf = (num: number, den: number): number | null => (den > 0 ? Math.floor((200 * num + den) / (2 * den)) : null);

/** My time-to-ready for one target profile. ready_pct = mean over requirements of min(have, need) / need (in twelfths, so integers). */
export function readinessFor(reqs: Req[], mine: StateLite[], skills: SkillLite[], horizon: Horizon): MyReadiness {
  const gaps: Gap[] = [];
  let s12 = 0;
  for (const r of reqs) {
    const have = levelOn(r, mine, skills);
    const need = Number(r.level);
    s12 += (12 * Math.min(have, need)) / need;
    if (have < need) gaps.push({ kind: r.kind, ref_id: r.ref_id, skill_id: skillOfReq(r, skills), need, have, gap: need - have, importance: r.importance, reasons: [R('gap', { have, need, gap: need - have }), R(`importance_${r.importance}`)] });
  }
  gaps.sort((a, b) => b.gap - a.gap || (IMP_ORDER[a.importance] ?? 3) - (IMP_ORDER[b.importance] ?? 3) || cmp(a.kind, b.kind) || cmp(a.ref_id, b.ref_id));
  const levels = gaps.reduce((t, g) => t + g.gap, 0);
  const months = MONTHS_PER_LEVEL * levels;
  const ready_pct = reqs.length ? Math.floor((100 * s12 + 6 * reqs.length) / (12 * reqs.length)) : 100;
  const reasons = [levels === 0 ? R('time_ready', { horizon }) : R('time_rule', { levels, per: MONTHS_PER_LEVEL, months }), R('time_gaps', { n: gaps.length, of: reqs.length })];
  return { horizon, gaps, levels, months, ready_pct, requirements: reqs.length, reasons };
}

function diffAdded(prev: Req[], next: Req[], horizon: Horizon, skills: SkillLite[]): Added[] {
  const before = new Map(prev.map((r) => [`${r.kind}:${r.ref_id}`, Number(r.level)]));
  const out: Added[] = [];
  for (const r of next) {
    const p = before.get(`${r.kind}:${r.ref_id}`);
    const to = Number(r.level);
    if (p !== undefined && to <= p) continue;
    const change = p === undefined ? 'new' : 'raised';
    const driver = normDriver(r.driver);
    const reasons = [R(`added_${change}`, { horizon, from: p ?? 0, to })];
    if (driver) reasons.push(R(`driver_${driver}`));
    reasons.push(R(`importance_${r.importance}`));
    out.push({ horizon, kind: r.kind, ref_id: r.ref_id, skill_id: skillOfReq(r, skills), change, from: p ?? 0, to, importance: r.importance, driver, reasons });
  }
  return out.sort((a, b) => (a.change === b.change ? 0 : a.change === 'new' ? -1 : 1) || (IMP_ORDER[a.importance] ?? 3) - (IMP_ORDER[b.importance] ?? 3) || cmp(a.kind, b.kind) || cmp(a.ref_id, b.ref_id));
}

/** The shortest short course teaching a competency (ties by id), or null. */
export function bridgeCourse(competencyId: string | null, courses: CourseLite[]): CourseLite | null {
  if (!competencyId) return null;
  return courses
    .filter((c) => c.audience === 'staff' && !c.initial && c.duration_hours != null && Number(c.duration_hours) <= BRIDGE_MAX_HOURS && (c.competency_ids ?? []).includes(competencyId))
    .sort((a, b) => Number(a.duration_hours) - Number(b.duration_hours) || cmp(a.id, b.id))[0] ?? null;
}

/** Rated, non-restricted, active tasks of a role, with their FS06 exposure and reasons. */
export function mapTasks(tasks: TaskLite[], levels: CapLevel[], roleId: string): MapTask[] {
  const out: MapTask[] = [];
  const live = tasks.filter((t) => t.role_id === roleId && !t.restricted && t.status === 'active').sort((a, b) => Number(a.sort) - Number(b.sort) || cmp(a.id, b.id));
  for (const t of live) {
    const ex = exposureOf({ needs: t.ai_capability_needed as never, change_horizon: t.change_horizon, critical: !!t.critical, restricted: false }, levels);
    if (!ex) continue;
    const move = MOVE_OF[ex.exposure];
    out.push({ id: t.id, code: t.code, title_en: t.title_en, title_ar: t.title_ar, critical: !!t.critical, band: ex.exposure, move, horizon: t.change_horizon as string, driver: normDriver(t.tech_driver), reasons: [R(`move_${move}`), ...ex.reasons] });
  }
  return out.sort((a, b) => MOVES.indexOf(a.move) - MOVES.indexOf(b.move));
}

export function transformRole(input: TransformInput): RoleMap {
  const { role, map } = input;
  const horizon: Horizon = input.horizon === '2035' ? '2035' : '2030';
  const base: RoleMap = {
    role_id: role.id, family_id: role.family_id, path_only: true, status: map?.status ?? 'none', version: map?.version ?? 0, archetype: null, horizon,
    drivers: [], tasks: [], counts: { rated: 0, grow: 0, augmented: 0, shrink: 0 }, added: [], complements: [], bridge: [], bridge_hours: 0, me: null,
  };
  if (isPathOnly(role)) return base;
  const pub = publishedOf(input.versions, role.id);
  const now = reqsOf(pub.now), h30 = reqsOf(pub['2030']), h35 = reqsOf(pub['2035']);
  const tasks = mapTasks(input.tasks, input.levels, role.id);
  const counts = { rated: tasks.length, grow: tasks.filter((t) => t.move === 'grow').length, augmented: tasks.filter((t) => t.move === 'augmented').length, shrink: tasks.filter((t) => t.move === 'shrink').length };
  const added = [...diffAdded(now, h30, '2030', input.skills), ...diffAdded(h30, h35, '2035', input.skills)];
  const mapDrivers = new Set((map?.drivers ?? []).map(normDriver).filter(Boolean));
  const profDrivers = new Set([...(pub['2030']?.drivers ?? []), ...(pub['2035']?.drivers ?? [])].map(normDriver).filter(Boolean));
  const drivers: DriverRow[] = DRIVERS.map((d) => ({ driver: d, in_map: mapDrivers.has(d), in_profile: profDrivers.has(d), reqs: added.filter((a) => a.driver === d).length, tasks: tasks.filter((t) => t.driver === d).length }))
    .filter((x) => x.in_map || x.in_profile || x.reqs > 0 || x.tasks > 0);

  // skills that complement AI
  const skillById = new Map(input.skills.map((s) => [s.id, s]));
  const humanTasks = new Set(tasks.filter((t) => t.band === 'human_core').map((t) => t.id));
  const agg = new Map<string, { n: number; level: number }>();
  for (const x of input.taskSkills) {
    if (!x.active || !humanTasks.has(x.task_id) || skillById.get(x.skill_id)?.area === 'security') continue;
    const cur = agg.get(x.skill_id) ?? { n: 0, level: 0 };
    agg.set(x.skill_id, { n: cur.n + 1, level: Math.max(cur.level, Number(x.level)) });
  }
  let complements: Complement[] = [...agg].map(([skill_id, v]) => ({ skill_id, tasks: v.n, level: v.level, source: 'tasks' as const, reasons: [R('complement_tasks', { n: v.n, level: v.level })] }));
  if (tasks.length === 0) {
    const seen = new Map<string, number>();
    for (const r of h30) {
      const sid = skillOfReq(r, input.skills);
      const sk = sid ? skillById.get(sid) : undefined;
      if (!sid || !sk || sk.area === 'security' || !(HUMAN_AREAS.includes(sk.area) || sk.fs_area === 'transversal')) continue;
      seen.set(sid, Math.max(seen.get(sid) ?? 0, Number(r.level)));
    }
    complements = [...seen].map(([skill_id, level]) => ({ skill_id, tasks: 0, level, source: 'profile' as const, reasons: [R('complement_profile', { level, horizon: '2030' })] }));
  }
  complements.sort((a, b) => b.tasks - a.tasks || b.level - a.level || cmp(a.skill_id, b.skill_id));

  // bridge curriculum: one step per added requirement, 2030 first
  const bridge: BridgeStep[] = added.map((a, i) => {
    const comp = a.kind === 'competency' ? a.ref_id : (skillById.get(a.ref_id)?.competency_id ?? null);
    const c = bridgeCourse(comp, input.courses);
    const lv = a.to - a.from;
    const hours = c ? Number(c.duration_hours) : PRACTICE_HOURS_PER_LEVEL * lv;
    const reasons = [c ? R('bridge_course', { hours }) : R('bridge_practice', { levels: lv, per: PRACTICE_HOURS_PER_LEVEL, hours }), R('bridge_for', { horizon: a.horizon })];
    return { step: i + 1, horizon: a.horizon, kind: a.kind, ref_id: a.ref_id, skill_id: a.skill_id, from: a.from, to: a.to, mode: c ? 'course' : 'practice', course_id: c?.id ?? null, hours, reasons };
  });
  const me = input.mine ? readinessFor(horizon === '2035' ? h35 : h30, input.mine, input.skills, horizon) : null;
  return {
    ...base, path_only: false, archetype: (map?.archetype as Archetype | null) ?? null, drivers, tasks, counts, added, complements, bridge,
    bridge_hours: bridge.reduce((t, s) => t + s.hours, 0), me,
  };
}

// ───────────── HR aggregates (FS12 exposure by job family; FS11 readiness by family), suppressed under MIN_GROUP people
export interface PersonLite { id: string; kind: string; status: string; job_role_id: string | null }
export interface FamilyLite { id: string; grp: string }
export interface CohortInput { people: PersonLite[]; roles: RoleLite[]; families: FamilyLite[] }
/** Staff in current, non-restricted roles: the people an aggregate counts (protected attributes are never read). */
export function cohortOf(input: CohortInput): { person: PersonLite; role: RoleLite; family: FamilyLite }[] {
  const roles = new Map(input.roles.map((r) => [r.id, r]));
  const fams = new Map(input.families.map((f) => [f.id, f]));
  const out: { person: PersonLite; role: RoleLite; family: FamilyLite }[] = [];
  for (const p of input.people) {
    if (p.kind !== 'staff' || p.status !== 'active' || !p.job_role_id) continue;
    const r = roles.get(p.job_role_id);
    if (!r || (r.lifecycle ?? 'current') !== 'current' || isPathOnly(r)) continue;
    const f = fams.get(r.family_id);
    if (!f) continue;
    out.push({ person: p, role: r, family: f });
  }
  return out.sort((a, b) => cmp(a.person.id, b.person.id));
}
export interface ExposureCell { key: string; people: number | null; suppressed: boolean; analysed: number | null; tasks: number | null; shares: Record<Band, number> | null }
export interface ExposureAgg { min_group: number; families: ExposureCell[]; groups: ExposureCell[]; total: ExposureCell; not_broken_out: string[] }
export function exposureAggregate(input: CohortInput & { tasks: TaskLite[]; levels: CapLevel[] }): ExposureAgg {
  const cohort = cohortOf(input);
  const byRole = new Map<string, Record<Band, number>>();
  const roleCounts = (roleId: string) => {
    if (!byRole.has(roleId)) {
      const ts = mapTasks(input.tasks, input.levels, roleId);
      byRole.set(roleId, { augment: ts.filter((t) => t.band === 'augment').length, automate_partly: ts.filter((t) => t.band === 'automate_partly').length, human_core: ts.filter((t) => t.band === 'human_core').length });
    }
    return byRole.get(roleId)!;
  };
  const cell = (key: string, members: typeof cohort): ExposureCell => {
    const n = members.length;
    if (n < MIN_GROUP) return { key, people: null, suppressed: true, analysed: null, tasks: null, shares: null };
    const sums: Record<Band, number> = { augment: 0, automate_partly: 0, human_core: 0 };
    let analysed = 0;
    for (const m of members) {
      const c = roleCounts(m.role.id);
      const rated = c.augment + c.automate_partly + c.human_core;
      if (!rated) continue;
      analysed++;
      for (const b of BANDS) sums[b] += c[b];
    }
    const den = sums.augment + sums.automate_partly + sums.human_core;
    return { key, people: n, suppressed: false, analysed, tasks: den, shares: den ? { augment: pctOf(sums.augment, den)!, automate_partly: pctOf(sums.automate_partly, den)!, human_core: pctOf(sums.human_core, den)! } : null };
  };
  const famIds = [...new Set(cohort.map((m) => m.family.id))].sort(cmp);
  const grpIds = [...new Set(cohort.map((m) => m.family.grp))].sort(cmp);
  return {
    min_group: MIN_GROUP,
    families: famIds.map((f) => cell(f, cohort.filter((m) => m.family.id === f))),
    groups: grpIds.map((g) => cell(g, cohort.filter((m) => m.family.grp === g))),
    total: cell('all', cohort),
    not_broken_out: [...RESTRICTED_FAMILIES],
  };
}

export interface ReadyCell { key: string; people: number | null; suppressed: boolean; ready_now: number | null; ready_pct: number | null; median_months: number | null }
export interface Overview { min_group: number; horizon: Horizon; families: ReadyCell[]; groups: ReadyCell[]; total: ReadyCell; not_broken_out: string[] }
/** FS11 HR overview: how many people already meet their role's 2030 (or 2035) profile, and the median months to get there. */
export function transformationOverview(input: CohortInput & { versions: VersionLite[]; states: (StateLite & { person_id: string })[]; skills: SkillLite[]; horizon?: string | null }): Overview {
  const horizon: Horizon = input.horizon === '2035' ? '2035' : '2030';
  const cohort = cohortOf(input);
  const statesBy = new Map<string, StateLite[]>();
  for (const s of input.states) { if (!statesBy.has(s.person_id)) statesBy.set(s.person_id, []); statesBy.get(s.person_id)!.push(s); }
  const reqCache = new Map<string, Req[]>();
  const months = new Map<string, number>();
  for (const m of cohort) {
    if (!reqCache.has(m.role.id)) reqCache.set(m.role.id, reqsOf(publishedOf(input.versions, m.role.id)[horizon]));
    months.set(m.person.id, readinessFor(reqCache.get(m.role.id)!, statesBy.get(m.person.id) ?? [], input.skills, horizon).months);
  }
  const cell = (key: string, members: typeof cohort): ReadyCell => {
    const n = members.length;
    if (n < MIN_GROUP) return { key, people: null, suppressed: true, ready_now: null, ready_pct: null, median_months: null };
    const ms = members.map((m) => months.get(m.person.id)!).sort((a, b) => a - b);
    const ready = ms.filter((x) => x === 0).length;
    return { key, people: n, suppressed: false, ready_now: ready, ready_pct: pctOf(ready, n), median_months: ms[Math.floor((n - 1) / 2)] };
  };
  const famIds = [...new Set(cohort.map((m) => m.family.id))].sort(cmp);
  const grpIds = [...new Set(cohort.map((m) => m.family.grp))].sort(cmp);
  return {
    min_group: MIN_GROUP, horizon,
    families: famIds.map((f) => cell(f, cohort.filter((m) => m.family.id === f))),
    groups: grpIds.map((g) => cell(g, cohort.filter((m) => m.family.grp === g))),
    total: cell('all', cohort),
    not_broken_out: [...RESTRICTED_FAMILIES],
  };
}
