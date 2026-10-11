// FS07 (future skills, wave B · E1, M28) · Skills Catalogue Explorer: pure rules for /skills and /skills/:id.
// Search over EN and AR names, alternative labels, codes and crosswalk labels (Arabic normalised: alef, ya, ta marbuta and hamza
// forms unified, diacritics and tatweel stripped), the filters, the sources with their as-of dates, the roles that need a skill now
// and at the 2030/2035 horizons, and the learning that builds it. Every search hit carries reasons[] (rendered by <WhyThis>).
import { normAr } from '../../domain/text';
import { isPublishable, type TaxonomySkill } from '../../domain/taxonomy';
import type { Reason } from '../../domain/engines/types';

export interface ExplorerSkill extends TaxonomySkill {
  code: string;
  area: string;
  competency_id: string;
  core?: boolean;
  key_level?: number;
  evidence_keys?: string[] | null;
  future_group?: string | null;
  description_en?: string;
  description_ar?: string;
  sort?: number;
}
export interface Bi { en: string; ar: string }

/** Lower-case, Arabic-normalised, punctuation to spaces, single-spaced. */
export function norm(s: string | null | undefined): string {
  return normAr(String(s ?? '').toLowerCase()).replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Published = publishable definition and not obsolete (obsolete skills stay reachable by direct link only). */
export const isListed = (s: TaxonomySkill) => s.lifecycle !== 'obsolete' && isPublishable(s);

export interface SkillFilter { area?: string; reusability?: string; lifecycle?: string; group?: string; future?: string }
/** future: '' (all), 'any' (every future skill), 'established' (the F01 catalogue), or one FS area. */
export function filterSkills<T extends ExplorerSkill>(skills: T[], f: SkillFilter): T[] {
  return skills.filter((x) => (!f.area || x.area === f.area) && (!f.reusability || x.reusability === f.reusability) && (!f.lifecycle || x.lifecycle === f.lifecycle)
    && (!f.group || x.future_group === f.group)
    && (!f.future || (f.future === 'any' ? !!x.fs_area : f.future === 'established' ? !x.fs_area : x.fs_area === f.future)));
}

export interface SearchHit<T> { id: string; score: number; reasons: Reason[]; item: T }
const R = (code: string, vars: Reason['vars'] = {}, weight?: number): Reason => ({ code, key: `m28.why.${code}`, vars, weight });

/**
 * Ranks skills for a query in either language. Scores: whole name 10 (prefix 8, contains 6), alternative label 5, code 5,
 * crosswalk label 3, every query word somewhere in the name, labels or description 2. A skill with no match is dropped.
 * `extra` maps a skill id to crosswalk labels (ESCO, SFIA, O*NET ...) in both languages.
 */
export function searchSkills<T extends ExplorerSkill>(skills: T[], query: string, extra: Map<string, Bi[]> = new Map()): SearchHit<T>[] {
  const q = norm(query);
  if (!q) return skills.map((item) => ({ id: item.id, score: 0, reasons: [], item }));
  const words = q.split(' ').filter((w) => w.length > 1 || /\p{N}/u.test(w));
  const out: SearchHit<T>[] = [];
  for (const item of skills) {
    const reasons: Reason[] = [];
    let score = 0;
    const names: Bi = { en: item.name_en, ar: item.name_ar };
    for (const lang of ['en', 'ar'] as const) {
      const n = norm(names[lang]);
      if (!n) continue;
      if (n === q) { score = Math.max(score, 10); reasons.push(R('name_exact', { name: names }, 10)); break; }
      if (n.startsWith(q)) { score = Math.max(score, 8); reasons.push(R('name', { name: names }, 8)); break; }
      if (n.includes(q)) { score = Math.max(score, 6); reasons.push(R('name', { name: names }, 6)); break; }
    }
    const alts = [...(item.alt_labels_en ?? []), ...(item.alt_labels_ar ?? [])];
    const alt = alts.find((a) => norm(a).includes(q));
    if (alt) { score += 5; reasons.push(R('alt', { label: alt }, 5)); }
    if (norm(item.code) === q || norm(item.code).startsWith(q)) { score += 5; reasons.push(R('code', { code: item.code }, 5)); }
    const xw = (extra.get(item.id) ?? []).find((b) => norm(b.en).includes(q) || norm(b.ar).includes(q));
    if (xw) { score += 3; reasons.push(R('crosswalk', { label: xw }, 3)); }
    if (!score && words.length) {
      const hay = norm([item.name_en, item.name_ar, ...alts, item.description_en, item.description_ar, ...(extra.get(item.id) ?? []).flatMap((b) => [b.en, b.ar])].join(' '));
      if (words.every((w) => hay.includes(w))) { score = 2; reasons.push(R('words', { n: words.length }, 2)); }
    }
    if (score > 0) out.push({ id: item.id, score, reasons, item });
  }
  return out.sort((a, b) => b.score - a.score || (a.item.sort ?? 0) - (b.item.sort ?? 0) || (a.id < b.id ? -1 : 1));
}

// ───────────── Sources with their as-of dates

export interface SourceRef { id?: string; label?: string; url?: string }
export interface DatedSource { id: string; label: string; url: string; as_of: string | null }
/**
 * Resolves each skill source to its as-of date: citation-registry rows (`sources.accessed`) by id, benchmark rows
 * (`bm:<ID>` -> `benchmarks.as_of`). Only https sources are returned.
 */
export function datedSources(src: unknown, registry: Map<string, { accessed?: string | null }>, benchmarks: Map<string, { as_of?: string | null }>): DatedSource[] {
  const list = Array.isArray(src) ? (src as SourceRef[]) : [];
  return list.filter((x) => typeof x.url === 'string' && /^https:\/\//.test(x.url)).map((x) => {
    const id = x.id ?? '';
    const asOf = id.startsWith('bm:') ? benchmarks.get(id.slice(3))?.as_of ?? null : registry.get(id)?.accessed ?? null;
    return { id, label: x.label ?? x.url!, url: x.url!, as_of: asOf ? String(asOf).slice(0, 10) : null };
  });
}

// ───────────── Roles now and at the horizons (FS05 role profile versions)

export interface Requirement { kind: string; ref_id: string; level: number; importance?: string; why_en?: string; why_ar?: string }
export interface ProfileVersion { id: string; role_id: string; horizon: string; status: string; requirements: unknown; path_only?: boolean }
export interface RoleRef { id: string; title_en: string; title_ar: string; lifecycle?: string | null; security_sensitive?: boolean | null }
export interface RoleNeed { role: RoleRef; horizon: 'now' | '2030' | '2035'; level: number; importance: string; via: 'skill' | 'competency'; why: Bi | null }
/**
 * Roles whose published profile needs the skill: directly (requirement kind skill) or, for the core skill of a competency,
 * through a competency requirement. Security-sensitive roles are path-only and never listed.
 */
export function rolesForSkill(skill: ExplorerSkill, versions: ProfileVersion[], roles: RoleRef[]): Record<'now' | '2030' | '2035', RoleNeed[]> {
  const byId = new Map(roles.map((r) => [r.id, r]));
  const out: Record<'now' | '2030' | '2035', RoleNeed[]> = { now: [], 2030: [], 2035: [] };
  for (const v of versions) {
    if (v.status !== 'published' || v.path_only) continue;
    const h = v.horizon as 'now' | '2030' | '2035';
    if (!(h in out)) continue;
    const role = byId.get(v.role_id);
    if (!role || role.security_sensitive) continue;
    const reqs = Array.isArray(v.requirements) ? (v.requirements as Requirement[]) : [];
    const direct = reqs.find((r) => r.kind === 'skill' && r.ref_id === skill.id);
    const viaComp = skill.core ? reqs.find((r) => r.kind === 'competency' && r.ref_id === skill.competency_id) : undefined;
    const r = direct ?? viaComp;
    if (!r) continue;
    out[h].push({ role, horizon: h, level: Number(r.level), importance: r.importance ?? 'important', via: direct ? 'skill' : 'competency', why: r.why_en || r.why_ar ? { en: r.why_en ?? '', ar: r.why_ar ?? r.why_en ?? '' } : null });
  }
  for (const h of Object.keys(out) as (keyof typeof out)[]) out[h].sort((a, b) => b.level - a.level || (a.role.title_en < b.role.title_en ? -1 : 1));
  return out;
}

// ───────────── Learning that builds the skill

export interface CourseRef { id: string; code: string; title_en: string; title_ar: string; competency_ids?: string[] | null; modality?: string; duration_hours?: number | null }
export interface PathRef { id: string; title: Bi; stages: { id: string; title: Bi; courses?: string[]; standards?: string[] }[]; careerOnly?: boolean }
export interface CredRef { id: string; code: string; title_en: string; title_ar: string; status: string; criteria?: unknown; alignment?: unknown; level?: string }
export interface Learning {
  courses: { course: CourseRef; via: 'evidence' | 'competency' }[];
  paths: { path: PathRef; stages: Bi[] }[];
  credentials: { cred: CredRef; via: 'skill' | 'course' }[];
}
/** Courses (evidence key first, then the skill's competency for core skills), training-path stages and current micro-credentials. */
export function learningFor(skill: ExplorerSkill, courses: CourseRef[], paths: PathRef[], creds: CredRef[]): Learning {
  const keys = new Set(skill.evidence_keys ?? []);
  const direct = courses.filter((c) => keys.has(c.id));
  const comp = skill.core ? courses.filter((c) => !keys.has(c.id) && (c.competency_ids ?? []).includes(skill.competency_id)) : [];
  const list = [...direct.map((course) => ({ course, via: 'evidence' as const })), ...comp.map((course) => ({ course, via: 'competency' as const }))];
  const ids = new Set(list.map((x) => x.course.id));
  const outPaths = paths.filter((p) => !p.careerOnly).map((p) => ({ path: p, stages: p.stages.filter((st) => (st.courses ?? []).some((c) => ids.has(c)) || (st.standards ?? []).some((q) => keys.has(q))).map((st) => st.title) }))
    .filter((x) => x.stages.length > 0);
  const outCreds: Learning['credentials'] = [];
  for (const c of creds) {
    if (c.status !== 'current') continue;
    const crit = Array.isArray(c.criteria) ? (c.criteria as { kind?: string; ref?: string }[]) : [];
    const al = Array.isArray(c.alignment) ? (c.alignment as { skill_id?: string }[]) : [];
    if (crit.some((x) => x.kind === 'skill' && x.ref === skill.id) || al.some((x) => x.skill_id === skill.id)) outCreds.push({ cred: c, via: 'skill' });
    else if (crit.some((x) => x.kind === 'course' && x.ref && ids.has(x.ref))) outCreds.push({ cred: c, via: 'course' });
  }
  return { courses: list, paths: outPaths, credentials: outCreds };
}

// ───────────── Personal overlay (signed in): the goal rules live in the import-free crosswalk.ts (also loaded by the PGlite validator)
export { GOAL_MAX_ACTIVE, GOAL_MSG } from './crosswalk';
