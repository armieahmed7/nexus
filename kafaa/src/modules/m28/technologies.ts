// FS71 (future skills, wave H · E1, M28) · Hot technologies and in-demand badges: pure rules.
// Import-free (the seed builder, the PGlite validator and both backends load it). SQL mirror, change both together:
// supabase/migrations/20261010281001_kafaa_fs81_skill_signals.sql (kafaa_ht_* functions: kafaa_ht_problem = techProblem,
// kafaa_ht_brand_hits = brandHits, kafaa_ht_compute = technologyBadges).
//
// Technologies are generic tags (never a vendor or product brand: a deny-list check in TS and SQL) linked to opportunities and gigs
// (M20) and to role-profile versions (FS05). Two badges, kept apart as O*NET keeps "hot technology" apart from "in demand":
//   Hot across ENEC   in the four quarters ending with the badge quarter, at least 6 distinct sources (opportunities and published
//                     role-profile versions) link the technology, from at least 3 job families, and at least 1 of them is new in the
//                     badge quarter (so the badge follows current demand)
//   In demand for your role   the technology is linked to a role-profile version of the role published by the end of the quarter, or to
//                     at least 2 opportunities of the role's job family opened in the four-quarter window
// The criteria are published (/skills/technologies, "How badges are given") and the badges reproduce from them. A quarter's badge list
// is published once, after the quarter ends, and kept: past lists are never overwritten.

export const TECH_CATEGORIES = ['plant_data', 'analytics', 'automation', 'digital_twin', 'inspection', 'work_management', 'ai_tools', 'simulation'] as const;
export type TechCategory = (typeof TECH_CATEGORIES)[number];
export const SOURCE_TABLES = ['opportunities', 'role_profile_versions'] as const;
export type SourceTable = (typeof SOURCE_TABLES)[number];
export const HOT = { window_quarters: 4, min_sources: 6, min_families: 3, min_recent: 1 } as const;
export const IN_DEMAND = { min_family_opportunities: 2 } as const;
export const CRITERIA_VERSION = 'fs71-v1';
export const ID_RE = /^tech-[a-z0-9-]{3,40}$/;
export const NAME: [number, number] = [3, 80];
export const DESC: [number, number] = [20, 400];
export const MAX_SKILLS = 6;

/**
 * Vendor and product brand names that must never appear in a technology tag (EN and AR). Matched case-insensitively as whole words
 * (letters and digits around a match make it a different word). Generic words only in the catalogue: "process historian", not a product.
 */
export const BRAND_DENY = [
  'osisoft', 'aveva', 'pi system', 'siemens', 'honeywell', 'emerson', 'abb', 'schneider', 'rockwell', 'yokogawa', 'westinghouse', 'framatome', 'kepco', 'khnp', 'doosan',
  'microsoft', 'excel', 'power bi', 'azure', 'copilot', 'sharepoint', 'google', 'gemini', 'aws', 'amazon', 'oracle', 'sap', 'ibm', 'maximo', 'servicenow',
  'tableau', 'qlik', 'splunk', 'python', 'matlab', 'labview', 'jupyter', 'tensorflow', 'pytorch', 'openai', 'chatgpt', 'anthropic',
  'hololens', 'magic leap', 'unreal engine', 'autodesk', 'autocad', 'revit', 'bentley', 'ansys', 'dassault', 'catia', 'solidworks', 'primavera', 'boston dynamics',
  'dji', 'faro', 'leica', 'jira', 'salesforce', 'workday', 'cornerstone', 'degreed', 'linkedin',
  'مايكروسوفت', 'سيمنز', 'أوراكل', 'جوجل', 'غوغل', 'بايثون', 'إكسل', 'هانيويل', 'وستنجهاوس', 'أمازون', 'آي بي إم', 'تشات جي بي تي',
] as const;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BRAND_RES = BRAND_DENY.map((w) => ({ w, re: new RegExp(`(^|[^A-Za-z0-9؀-ۿ])${esc(w)}($|[^A-Za-z0-9؀-ۿ])`, 'i') }));
/** The deny-listed brand names a text contains (lower-case list order). TS = SQL kafaa_ht_brand_hits. */
export function brandHits(text: unknown): string[] {
  const s = typeof text === 'string' ? text.toLowerCase() : '';
  return s ? BRAND_RES.filter((x) => x.re.test(s)).map((x) => x.w) : [];
}

type AnyRow = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface TechInput {
  id?: string | null;
  name_en: string; name_ar: string;
  description_en: string; description_ar: string;
  category: string;
  skill_ids?: string[];
  status?: 'active' | 'retired';
}
export type TechProblem = 'id' | 'name' | 'description' | 'brand' | 'category' | 'skills' | 'status';
const len = (v: unknown) => (typeof v === 'string' ? v.trim().length : -1);
const between = (v: unknown, [lo, hi]: [number, number]) => len(v) >= lo && len(v) <= hi;
const ARABIC = /[؀-ۿ]/;
/** The catalogue check for a new or edited technology (TS = SQL kafaa_ht_problem): the first problem, or null. */
export function techProblem(x: Partial<TechInput> | null | undefined, skills: string[], isNew: boolean): TechProblem | null {
  if (!x || typeof x !== 'object') return 'name';
  if (isNew && !(typeof x.id === 'string' && ID_RE.test(x.id))) return 'id';
  if (!between(x.name_en, NAME) || !between(x.name_ar, NAME) || !ARABIC.test(String(x.name_ar))) return 'name';
  if (!between(x.description_en, DESC) || !between(x.description_ar, DESC) || !ARABIC.test(String(x.description_ar))) return 'description';
  if ([x.id, x.name_en, x.name_ar, x.description_en, x.description_ar].some((t) => brandHits(t).length > 0)) return 'brand';
  if (!(TECH_CATEGORIES as readonly string[]).includes(String(x.category))) return 'category';
  const sk = x.skill_ids ?? [];
  if (!Array.isArray(sk) || sk.length > MAX_SKILLS || new Set(sk).size !== sk.length || sk.some((s) => typeof s !== 'string' || !skills.includes(s))) return 'skills';
  if (x.status != null && x.status !== 'active' && x.status !== 'retired') return 'status';
  return null;
}

// ───────────── quarters (same format as FS70)
const QRE = /^(20\d\d)-Q([1-4])$/;
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const d10 = (v: unknown) => (v == null ? '' : String(v).slice(0, 10));
export function qBounds(q: string): { start: string; end: string } | null {
  const m = QRE.exec(typeof q === 'string' ? q : '');
  if (!m) return null;
  const y = Number(m[1]), n = Number(m[2]);
  return { start: `${y}-${String(3 * n - 2).padStart(2, '0')}-01`, end: iso(Date.UTC(n === 4 ? y + 1 : y, n === 4 ? 0 : 3 * n, 1) - DAY) };
}
const qBack = (q: string, k: number) => { let [y, n] = [Number(q.slice(0, 4)), Number(q.slice(6))]; for (let i = 0; i < k; i++) { n -= 1; if (n === 0) { n = 4; y -= 1; } } return `${y}-Q${n}`; };
/** The badge window: first day of the quarter `window_quarters - 1` quarters back, to the last day of the badge quarter. */
export function badgeWindow(q: string): { start: string; end: string; qstart: string } | null {
  const b = qBounds(q);
  if (!b) return null;
  return { start: qBounds(qBack(q, HOT.window_quarters - 1))!.start, end: b.end, qstart: b.start };
}

export interface TechLink { technology_id: string; ref_table: string; ref_id: string; family_id?: string | null; role_id?: string | null; source_on?: string | null; active?: boolean | null }
export interface BadgeInput {
  technologies: { id: string; status?: string | null }[];
  links: TechLink[];
  roles: { id: string; family_id?: string | null; lifecycle?: string | null }[];
}
export function badgeInputFromTables(raw: (t: string) => AnyRow[]): BadgeInput {
  return {
    technologies: raw('technologies').map((t) => ({ id: t.id, status: t.status ?? null })),
    links: raw('technology_links').map((l) => ({ technology_id: l.technology_id, ref_table: l.ref_table, ref_id: l.ref_id, family_id: l.family_id ?? null, role_id: l.role_id ?? null, source_on: l.source_on ?? null, active: l.active ?? null })),
    roles: raw('job_roles').map((r) => ({ id: r.id, family_id: r.family_id ?? null, lifecycle: r.lifecycle ?? null })),
  };
}
export interface HotBadge { technology_id: string; rank: number; sources: number; families: number; recent: number; opportunities: number; versions: number }
export interface RoleBadge { role_id: string; technology_id: string; via_profile: boolean; family_opportunities: number }
export interface BadgeResult { quarter: string; criteria: string; window: { start: string; end: string }; hot: HotBadge[]; roles: RoleBadge[]; near: { technology_id: string; sources: number; families: number; recent: number }[] }

/** The badges of a quarter from the published criteria (TS = SQL kafaa_ht_compute). Null for a malformed quarter. */
export function technologyBadges(x: BadgeInput, q: string): BadgeResult | null {
  const w = badgeWindow(q);
  if (!w) return null;
  const live = new Set(x.technologies.filter((t) => t.status !== 'retired').map((t) => t.id));
  const links = x.links.filter((l) => l.active === true && live.has(l.technology_id) && d10(l.source_on) >= w.start && d10(l.source_on) <= w.end);
  const hot: Omit<HotBadge, 'rank'>[] = [];
  const near: BadgeResult['near'] = [];
  for (const id of [...live].sort()) {
    const ls = links.filter((l) => l.technology_id === id);
    const src = new Set(ls.map((l) => `${l.ref_table}|${l.ref_id}`));
    const fams = new Set(ls.map((l) => l.family_id).filter((f): f is string => !!f));
    const recent = new Set(ls.filter((l) => d10(l.source_on) >= w.qstart).map((l) => `${l.ref_table}|${l.ref_id}`));
    const row = { technology_id: id, sources: src.size, families: fams.size, recent: recent.size };
    if (row.sources >= HOT.min_sources && row.families >= HOT.min_families && row.recent >= HOT.min_recent)
      hot.push({ ...row, opportunities: new Set(ls.filter((l) => l.ref_table === 'opportunities').map((l) => l.ref_id)).size, versions: new Set(ls.filter((l) => l.ref_table === 'role_profile_versions').map((l) => l.ref_id)).size });
    else if (row.sources > 0) near.push(row);
  }
  hot.sort((a, c) => c.sources - a.sources || c.families - a.families || (a.technology_id < c.technology_id ? -1 : 1));
  near.sort((a, c) => c.sources - a.sources || (a.technology_id < c.technology_id ? -1 : 1));
  const roles: RoleBadge[] = [];
  const all = x.links.filter((l) => l.active === true && live.has(l.technology_id));
  for (const r of [...x.roles].filter((r) => r.lifecycle !== 'concept').sort((a, c) => (a.id < c.id ? -1 : 1))) {
    for (const id of [...live].sort()) {
      const viaProfile = all.some((l) => l.technology_id === id && l.ref_table === 'role_profile_versions' && l.role_id === r.id && d10(l.source_on) <= w.end);
      const famOpp = !r.family_id ? 0 : new Set(links.filter((l) => l.technology_id === id && l.ref_table === 'opportunities' && l.family_id === r.family_id).map((l) => l.ref_id)).size;
      if (viaProfile || famOpp >= IN_DEMAND.min_family_opportunities) roles.push({ role_id: r.id, technology_id: id, via_profile: viaProfile, family_opportunities: famOpp });
    }
  }
  return { quarter: q, criteria: CRITERIA_VERSION, window: { start: w.start, end: w.end }, hot: hot.map((h, i) => ({ ...h, rank: i + 1 })), roles, near };
}

export const HT_MSG = {
  not_signed_in: 'Sign in to see technologies in demand',
  forbidden: 'Only framework owners (instructors, the training manager and admins) maintain technology tags and badges',
  not_found: 'Technology not found',
  invalid: 'Check the technology: ',
  source_not_found: 'Link a technology to an existing opportunity or role-profile version',
  invalid_quarter: 'Choose a quarter from 2025-Q1 to the current quarter',
  open_quarter: 'Badges are published only after the quarter has ended',
  published: 'Badges for this quarter are already published; past lists are kept as they were',
  no_change: 'Nothing to change',
} as const;
export const HT_PROBLEM_TEXT: Record<TechProblem, string> = {
  id: 'an id like tech-short-name (lowercase letters, digits and hyphens)',
  name: 'a generic name of 3 to 80 characters in English and in Arabic',
  description: 'a description of 20 to 400 characters in English and in Arabic',
  brand: 'generic words only: no vendor or product brand name',
  category: 'choose a category',
  skills: 'up to six catalogue skills, each once',
  status: 'choose active or retired',
};
