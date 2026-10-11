/**
 * FS34 Transferable-skills translator for career-changers (FS wave D · E4, M18). Pure rules, import-free apart from the F05
 * competency rule in ./career.ts (also pure), so the seed builder, the PGlite validator, the LocalBackend and the public page
 * share them. SQL mirror, change both together: supabase/migrations/20261010244001_kafaa_fs44_translator_health.sql
 *   translate() = kafaa_fs34_translate(p_held jsonb, p_industry text, p_exclude text)
 * scripts/validate/fs44-translator-health.mjs proves SQL = TS for every occupation template and every staff passport.
 *
 * Benchmarks: UK Nuclear Skills Plan and Destination Nuclear (career-changers with transferable skills), new-build and SMR
 * workforce models (cross-over courses for adjacent industries; France: one in two needed is not in the industry yet), ESCO
 * (occupation and skill concepts the templates are aligned to).
 *
 * Input: a set of held skills with levels (an ESCO-aligned occupation template, or my own passport) and the industry the
 * person comes from. Output: the nearest ENEC roles, each with:
 *   pct       weighted coverage of the role's competencies (the F05 Navigator formula and engine weights: core 3, important 2,
 *             useful 1): Σ min(have, need) / need × w / Σ w, as a whole percentage (half up; twelfths keep it exact);
 *             have = competency level from the held skills (its core skill, else its best other skill: F05 rule)
 *   transfers the competencies that already count (have > 0)
 *   gaps      the delta skills (need > have), largest first, then core / important / useful, then id
 *   bridge    the bridging route: the FS19 cross-over courses for the person's industry first, then for each gap the shortest
 *             course in the public catalogue that teaches it (one level), plus supervised practice for the levels left
 *             (20 hours per level, the FS11 rule); a course already on the route is not repeated
 *   duration  hours, weeks at 4 study hours a week (each item rounded up) and months (weeks × 12 / 52, rounded up)
 * Candidate roles: current roles open to external entrants (entry and professional levels), never security, safeguards or
 * cyber roles (career-path level only), never concept roles (no vacancy), never generic corporate roles. Ties: coverage, then fewer gap levels, then id.
 * Nothing is stored: the public page computes this in the browser from public rows; the staff variant runs the same rule.
 */
import { competencyLevelsOf, type BiText, type Reason } from './career.ts';

export const TRANSLATE_LEVELS = ['entry', 'professional'];
/** Generic corporate roles are not nuclear destinations for a career-changer. */
export const EXCLUDED_FAMILIES = ['corporate'];
export const MAX_RESULTS = 5;
export const PRACTICE_HOURS_PER_LEVEL = 20;
export const STUDY_HOURS_PER_WEEK = 4;
export const COURSE_AUDIENCES = ['public', 'staff'];
export const INDUSTRIES = ['oil_gas', 'power', 'process', 'aviation', 'defence', 'utilities'] as const;
export type Industry = (typeof INDUSTRIES)[number];
const IMP_DEFAULT: Record<string, number> = { core: 3, important: 2, useful: 1 };
const IMP_ORDER: Record<string, number> = { core: 0, important: 1, useful: 2 };

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const rsn = (code: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code: `fs34_${code}`, key: `m18.fs34.reason.${code}`, ...(vars ? { vars } : {}), ...(ref ? { ref } : {}) });

export interface HeldSkill { skill_id: string; level: number }
export interface TrRole { id: string; title_en: string; title_ar: string; family_id?: string | null; level?: string | null; lifecycle?: string | null; security_sensitive?: boolean | null; education?: string | null }
export interface TrCourse { id: string; title_en: string; title_ar: string; duration_hours: number | string | null; audience: string; public_summary?: boolean | null; competency_ids?: string[] | null }
export interface TrData {
  roles: TrRole[];
  roleComps: { role_id: string; competency_id: string; required_level: number; importance: string }[];
  competencies: { id: string; name_en: string; name_ar: string }[];
  skills: { id: string; competency_id: string; core: boolean }[];
  courses: TrCourse[];
  links: { course_id: string; skill_id: string; active?: boolean | null }[];
  packs: { course_id: string; kind: string; for_industries?: string[] | null; sort?: number | null }[];
  edges: { id: string; from_role_id: string | null; to_role_id: string; label_en: string; label_ar: string; kind?: string | null }[];
  weights?: Record<string, number>;
}
export interface TrGap { competency_id: string; have: number; need: number; importance: string }
export interface TrTransfer { competency_id: string; have: number; need: number }
export interface TrItem { step: number; kind: 'crossover' | 'course' | 'practice'; course_id: string | null; competency_ids: string[]; levels: number; hours: number; weeks: number; reasons: Reason[] }
export interface TrResult {
  role_id: string;
  pct: number;
  gap_levels: number;
  transfers: TrTransfer[];
  gaps: TrGap[];
  bridge: TrItem[];
  hours: number;
  weeks: number;
  months: number;
  entry_routes: string[];
  reasons: Reason[];
}
export interface Translation { industry: string | null; profile: { competency_id: string; level: number }[]; results: TrResult[] }

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));
export const weeksOf = (hours: number) => Math.ceil(hours / STUDY_HOURS_PER_WEEK);
export const monthsOfWeeks = (weeks: number) => Math.ceil((weeks * 12) / 52);
/** Whole percentage, half up, from coverage in twelfths (exact for integer weights). */
export const coveragePct = (num12: number, den: number) => (den > 0 ? Math.floor((100 * num12 + 6 * den) / (12 * den)) : 0);

/** Weighted coverage of one role's competencies by a competency profile (the F05 formula), with the gaps and transfers. */
export function coverageOf(have: Map<string, number>, roleComps: TrData['roleComps'], roleId: string, weights?: Record<string, number>) {
  let num12 = 0, den = 0;
  const gaps: TrGap[] = [];
  const transfers: TrTransfer[] = [];
  for (const r of roleComps) {
    if (r.role_id !== roleId) continue;
    const need = num(r.required_level);
    const h = have.get(r.competency_id) ?? 0;
    const w = typeof weights?.[r.importance] === 'number' ? (weights[r.importance] as number) : IMP_DEFAULT[r.importance] ?? 1;
    num12 += ((12 * Math.min(h, need)) / need) * w;
    den += w;
    if (h > 0) transfers.push({ competency_id: r.competency_id, have: h, need });
    if (h < need) gaps.push({ competency_id: r.competency_id, have: h, need, importance: r.importance });
  }
  gaps.sort((a, b) => b.need - b.have - (a.need - a.have) || (IMP_ORDER[a.importance] ?? 3) - (IMP_ORDER[b.importance] ?? 3) || cmp(a.competency_id, b.competency_id));
  // strongest share first (cross-multiplied, so TS and SQL compare exactly), then id
  transfers.sort((a, b) => Math.min(b.have, b.need) * a.need - Math.min(a.have, a.need) * b.need || cmp(a.competency_id, b.competency_id));
  return { pct: coveragePct(num12, den), den, gaps, transfers };
}

/** Competency levels from held skills (F05 rule: a competency's core skill, else its best other skill). */
export function profileOf(skills: TrData['skills'], held: HeldSkill[]): Map<string, number> {
  return competencyLevelsOf({ skills, states: held.map((h) => ({ person_id: '_', skill_id: h.skill_id, level: num(h.level), active: true })) }, '_');
}

/** Courses that teach a competency: listed in the public catalogue, for the public or staff, with a duration. */
export function courseFor(d: Pick<TrData, 'courses' | 'links' | 'skills'>, competencyId: string): TrCourse | null {
  const skillComp = new Map(d.skills.map((s) => [s.id, s.competency_id]));
  const viaLinks = new Set(d.links.filter((l) => l.active !== false && skillComp.get(l.skill_id) === competencyId).map((l) => l.course_id));
  return d.courses
    .filter((c) => c.public_summary === true && COURSE_AUDIENCES.includes(c.audience) && c.duration_hours != null && ((c.competency_ids ?? []).includes(competencyId) || viaLinks.has(c.id)))
    .sort((a, b) => num(a.duration_hours) - num(b.duration_hours) || cmp(a.id, b.id))[0] ?? null;
}

/** The FS19 cross-over courses for an industry, in pack order. */
export function crossoversFor(d: Pick<TrData, 'packs' | 'courses'>, industry: string | null): TrCourse[] {
  if (!industry) return [];
  const byId = new Map(d.courses.map((c) => [c.id, c]));
  return d.packs
    .filter((p) => p.kind === 'crossover' && (p.for_industries ?? []).includes(industry) && byId.get(p.course_id)?.duration_hours != null)
    .sort((a, b) => num(a.sort ?? 0) - num(b.sort ?? 0) || cmp(a.course_id, b.course_id))
    .map((p) => byId.get(p.course_id)!);
}

export function translate(d: TrData, held: HeldSkill[], industry: string | null, exclude: string | null = null): Translation {
  const have = profileOf(d.skills, held);
  const compName = new Map(d.competencies.map((c) => [c.id, { en: c.name_en, ar: c.name_ar } as BiText]));
  const name = (id: string): BiText => compName.get(id) ?? { en: id, ar: id };
  const withComps = new Set(d.roleComps.map((r) => r.role_id));
  const cands = d.roles.filter((r) => (r.lifecycle ?? 'current') === 'current' && !r.security_sensitive && TRANSLATE_LEVELS.includes(String(r.level)) && !EXCLUDED_FAMILIES.includes(String(r.family_id)) && r.id !== exclude && withComps.has(r.id));
  const scored = cands.map((r) => ({ r, c: coverageOf(have, d.roleComps, r.id, d.weights) }))
    .map((x) => ({ ...x, gl: x.c.gaps.reduce((s, g) => s + g.need - g.have, 0) }))
    .sort((a, b) => b.c.pct - a.c.pct || a.gl - b.gl || cmp(a.r.id, b.r.id))
    .slice(0, MAX_RESULTS);
  const cross = crossoversFor(d, industry);
  const results: TrResult[] = scored.map(({ r, c, gl }) => {
    const bridge: TrItem[] = [];
    const push = (x: Omit<TrItem, 'step' | 'weeks'>) => bridge.push({ step: bridge.length + 1, ...x, weeks: weeksOf(x.hours) });
    for (const k of cross) push({ kind: 'crossover', course_id: k.id, competency_ids: [], levels: 0, hours: num(k.duration_hours), reasons: [rsn('b_crossover', { hours: num(k.duration_hours) }, { table: 'courses', id: k.id })] });
    for (const g of c.gaps) {
      const lv = g.need - g.have;
      const course = courseFor(d, g.competency_id);
      let left = lv;
      if (course) {
        const on = bridge.find((x) => x.course_id === course.id);
        if (on) {
          if (!on.competency_ids.includes(g.competency_id)) on.competency_ids.push(g.competency_id);
          on.reasons.push(rsn('b_also', { skill: name(g.competency_id) }));
        } else push({ kind: 'course', course_id: course.id, competency_ids: [g.competency_id], levels: 1, hours: num(course.duration_hours), reasons: [rsn('b_course', { skill: name(g.competency_id), hours: num(course.duration_hours) }, { table: 'courses', id: course.id })] });
        left = lv - 1;
      }
      if (left > 0) push({ kind: 'practice', course_id: null, competency_ids: [g.competency_id], levels: left, hours: PRACTICE_HOURS_PER_LEVEL * left, reasons: [rsn('b_practice', { skill: name(g.competency_id), levels: left, per: PRACTICE_HOURS_PER_LEVEL, hours: PRACTICE_HOURS_PER_LEVEL * left })] });
    }
    const hours = bridge.reduce((s, x) => s + x.hours, 0);
    const weeks = bridge.reduce((s, x) => s + x.weeks, 0);
    const months = monthsOfWeeks(weeks);
    const entries = d.edges.filter((e) => e.to_role_id === r.id && !e.from_role_id && (e.kind ?? 'current') === 'current').sort((a, b) => cmp(a.id, b.id));
    const reqs = d.roleComps.filter((x) => x.role_id === r.id).length;
    const reasons: Reason[] = [rsn('cover', { pct: c.pct }), rsn('transfer', { n: c.transfers.length, of: reqs })];
    for (const t of c.transfers.slice(0, 2)) reasons.push(rsn('transfer_item', { skill: name(t.competency_id), have: t.have, need: t.need }, { table: 'competencies', id: t.competency_id }));
    for (const g of c.gaps.slice(0, 3)) reasons.push(rsn('gap', { skill: name(g.competency_id), from: g.have, to: g.need }, { table: 'competencies', id: g.competency_id }));
    reasons.push(c.gaps.length ? rsn('route', { hours, weeks, months }) : rsn('route_none'));
    if (cross.length) reasons.push(rsn('crossover', { n: cross.length }));
    if (entries.length) reasons.push(rsn('entry', { route: { en: entries[0].label_en, ar: entries[0].label_ar } }, { table: 'career_paths', id: entries[0].id }));
    else reasons.push(rsn(`education_${r.education ?? 'none'}`));
    return { role_id: r.id, pct: c.pct, gap_levels: gl, transfers: c.transfers, gaps: c.gaps, bridge, hours, weeks, months, entry_routes: entries.map((e) => e.id), reasons };
  });
  const profile = [...have].map(([competency_id, level]) => ({ competency_id, level })).sort((a, b) => cmp(a.competency_id, b.competency_id));
  return { industry, profile, results };
}

// ───────────── Occupation templates (kafaa_occupation_templates): validation used by the seed builder and the tests
export interface TemplateSkill { skill_id: string; level: number; esco_uri: string; esco_label_en: string; esco_label_ar: string; esco_relation: 'essential' | 'optional'; match: 'exact' | 'related'; why_en: string; why_ar: string }
export interface OccupationTemplate {
  id: string; esco_uri: string; esco_code: string; isco_code: string | null; title_en: string; title_ar: string; esco_label_en: string; esco_label_ar: string;
  industry: string; summary_en: string; summary_ar: string; skills: TemplateSkill[] | unknown; sources: { label: string; url: string; as_of: string }[] | unknown;
  benchmark_ids: string[]; as_of: string; status: string; listed: boolean; sort: number;
}
export const templateSkills = (t: Pick<OccupationTemplate, 'skills'>): TemplateSkill[] => (Array.isArray(t.skills) ? (t.skills as TemplateSkill[]) : []);
export const heldOf = (t: Pick<OccupationTemplate, 'skills'>): HeldSkill[] => templateSkills(t).map((s) => ({ skill_id: s.skill_id, level: s.level }));
const ESCO_OCC = /^http:\/\/data\.europa\.eu\/esco\/occupation\/[0-9a-f-]{36}$/;
const ESCO_SKILL = /^http:\/\/data\.europa\.eu\/esco\/(skill|knowledge)\/[0-9a-f-]{36}$/;
/** Problems that keep a template off the public list (empty = fine). */
export function templateProblems(t: Partial<OccupationTemplate>, skillIds: Set<string>): string[] {
  const p: string[] = [];
  if (!t.esco_uri || !ESCO_OCC.test(t.esco_uri)) p.push('esco_uri');
  if (!t.title_en?.trim() || !t.title_ar?.trim() || !t.summary_en?.trim() || !t.summary_ar?.trim()) p.push('text');
  if (!t.industry || !(INDUSTRIES as readonly string[]).includes(t.industry)) p.push('industry');
  const sk = templateSkills(t as OccupationTemplate);
  if (sk.length < 6) p.push('skills');
  if (sk.some((s) => !skillIds.has(s.skill_id) || !(s.level >= 1 && s.level <= 4) || !ESCO_SKILL.test(s.esco_uri) || !s.esco_label_en || !s.esco_label_ar || !s.why_en || !s.why_ar)) p.push('skill_rows');
  if (new Set(sk.map((s) => s.skill_id)).size !== sk.length) p.push('duplicate_skill');
  const src = Array.isArray(t.sources) ? (t.sources as { url: string; as_of: string }[]) : [];
  if (!src.length || src.some((s) => !/^https:\/\//.test(s.url) || !/^\d{4}-\d{2}-\d{2}$/.test(s.as_of))) p.push('sources');
  return p;
}
