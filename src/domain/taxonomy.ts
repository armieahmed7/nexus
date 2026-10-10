/**
 * FS01/FS02 (future skills, wave A): the skills-taxonomy vocabulary and its rules. Pure and import-free: seed builders,
 * validators, both backends and pages load it. The SQL mirror of skillGuard() is kafaa_fs_skill_guard (migration
 * 20261010211001_kafaa_fs11_foundation_catalogue.sql); the LocalBackend applies it through src/data/local/guards.ts.
 *
 * Benchmarks behind each attribute (rows in kafaa_benchmarks):
 *   reusability (transversal ... occupation-specific) and "obsolete, never delete" - ESCO v1.2.1
 *   skill type (common, specialised, licence-like)                                  - Lightcast Open Skills
 *   lifecycle (emerging ... declining) as a trend field on every skill               - WEF Future of Jobs 2025
 *   level essence at each level (generic attributes)                                 - SFIA 9
 *   future group (Digital, 10X, Data and AI, New Economy + a nuclear fifth group)    - Jahiz (UAE)
 *   owner, version and review date with staleness flags                              - Australia/Korea upkeep lessons
 */
export const REUSABILITY = ['transversal', 'cross_sectoral', 'sector_specific', 'occupation_specific'] as const;
export type Reusability = (typeof REUSABILITY)[number];
export const SKILL_TYPES = ['common', 'specialised', 'licence_like'] as const;
export type SkillType = (typeof SKILL_TYPES)[number];
export const LIFECYCLES = ['emerging', 'growing', 'stable', 'declining', 'obsolete'] as const;
export type Lifecycle = (typeof LIFECYCLES)[number];
export const DECAY_CLASSES = ['fast', 'standard', 'slow'] as const;
export type DecayClass = (typeof DECAY_CLASSES)[number];
/** Half-lives per decay class (FS03 wires them into the confidence model; F01 today uses one 36-month half-life). */
export const DECAY_HALF_LIFE_MONTHS: Record<DecayClass, number> = { fast: 18, standard: 36, slow: 60 };
/** How often a skill definition is reviewed, by decay class (months). */
export const REVIEW_CYCLE_MONTHS: Record<DecayClass, number> = { fast: 12, standard: 24, slow: 36 };
/** Jahiz's four groups plus a nuclear fifth group. */
export const FUTURE_GROUPS = ['digital', 'ten_x', 'data_ai', 'new_economy', 'nuclear_excellence'] as const;
export type FutureGroup = (typeof FUTURE_GROUPS)[number];
/** The six future-skills areas added by FS02 (the original 71 skills carry none). */
export const FS_AREAS = ['transversal', 'ai_data', 'green_energy', 'advanced_reactor', 'cyber_hygiene', 'digital_plant'] as const;
export type FsArea = (typeof FS_AREAS)[number];
/** The function that owns a skill definition (a role card, never a named person). */
export const OWNER_ROLES = [
  'nuclear_training', 'operations', 'maintenance', 'engineering', 'radiation_chemistry', 'safety_licensing', 'human_performance', 'emergency_preparedness',
  'quality', 'leadership_development', 'digital_ai_governance', 'sustainability', 'advanced_reactors', 'cyber_awareness',
] as const;
export type OwnerRole = (typeof OWNER_ROLES)[number];

export interface BiText {
  en: string;
  ar: string;
}
/** Generic level attributes (SFIA-style essence), levels 1-4 of the F01 scale (0 = not held). {skill} is replaced by the name. */
export const LEVEL_ESSENCE: Record<1 | 2 | 3 | 4, BiText> = {
  1: { en: 'Awareness: explains what {skill} is for and follows guidance on routine tasks under close supervision.', ar: 'إلمام: يشرح الغرض من {skill} ويتبع الإرشادات في المهام الروتينية تحت إشراف مباشر.' },
  2: { en: 'Practitioner: applies {skill} on routine work with some supervision, using procedures and checking own work.', ar: 'ممارس: يطبّق {skill} في الأعمال الروتينية بإشراف محدود، ملتزماً بالإجراءات ومراجعاً عمله.' },
  3: { en: 'Independent: applies {skill} on varied work without supervision, checks the work of others and solves non-routine problems.', ar: 'مستقل: يطبّق {skill} في أعمال متنوعة دون إشراف، ويراجع عمل الآخرين ويحل المشكلات غير الروتينية.' },
  4: { en: 'Expert: sets the standard for {skill}, advises across teams and develops others.', ar: 'خبير: يضع المعيار في {skill}، ويقدّم المشورة عبر الفرق ويطوّر الآخرين.' },
};
const clampLevel = (n: number) => (Math.min(4, Math.max(1, Math.round(n))) as 1 | 2 | 3 | 4);
/** The generic essence of a level, optionally filled with a skill name ({en, ar}). */
export function levelEssence(level: number, name?: BiText): BiText {
  const e = LEVEL_ESSENCE[clampLevel(level)];
  const en = name?.en ?? 'the skill';
  const ar = name?.ar ?? 'المهارة';
  return { en: e.en.replace('{skill}', en.charAt(0).toLowerCase() + en.slice(1)), ar: e.ar.replace('{skill}', ar) };
}

export interface SkillSource {
  id?: string;
  label?: string;
  url?: string;
}
export interface TaxonomySkill {
  id: string;
  name_en: string;
  name_ar: string;
  sources?: SkillSource[] | unknown;
  owner_role?: string | null;
  version?: number | null;
  review_due?: string | null;
  lifecycle?: string | null;
  level_essence_en?: string | null;
  level_essence_ar?: string | null;
  alt_labels_en?: string[] | null;
  alt_labels_ar?: string[] | null;
  fs_area?: string | null;
  reusability?: string | null;
  skill_type?: string | null;
  decay_class?: string | null;
  obsolete_on?: string | null;
  replaced_by?: string | null;
}
export const isHttps = (u: unknown): boolean => typeof u === 'string' && /^https:\/\/[^\s/$.?#][^\s]*$/i.test(u);
const sourcesOf = (s: TaxonomySkill): SkillSource[] => (Array.isArray(s.sources) ? (s.sources as SkillSource[]) : []);

/** Problems that keep a skill definition from being published (empty list = publishable). Obsolete skills stay readable by link. */
export function publishProblems(s: TaxonomySkill): string[] {
  const p: string[] = [];
  if (!s.name_en?.trim() || !s.name_ar?.trim()) p.push('name');
  if (!sourcesOf(s).some((x) => isHttps(x.url))) p.push('source');
  if (!s.owner_role || !(OWNER_ROLES as readonly string[]).includes(s.owner_role)) p.push('owner');
  if (!s.version || s.version < 1) p.push('version');
  if (!s.review_due) p.push('review');
  if (!s.lifecycle || !(LIFECYCLES as readonly string[]).includes(s.lifecycle)) p.push('lifecycle');
  if (s.lifecycle === 'obsolete') p.push('obsolete');
  if (!s.level_essence_en?.trim() || !s.level_essence_ar?.trim()) p.push('essence');
  if (s.fs_area && ((s.alt_labels_en ?? []).length < 2 || (s.alt_labels_ar ?? []).length < 2)) p.push('alt_labels');
  return p;
}
export const isPublishable = (s: TaxonomySkill): boolean => publishProblems(s).length === 0;

/** Review state of a definition on a date: overdue after review_due, due within 90 days. */
export function reviewState(reviewDue: string | null | undefined, today: string): 'none' | 'ok' | 'due_soon' | 'overdue' {
  if (!reviewDue) return 'none';
  const d = Date.parse(`${reviewDue.slice(0, 10)}T00:00:00Z`);
  const t = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (d < t) return 'overdue';
  return d - t <= 90 * 86400000 ? 'due_soon' : 'ok';
}
/** Adds months to an ISO date (day clamped to the month's length). */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

/**
 * Direct-write guard for kafaa_skills ("obsolete, never delete", ESCO). Returns a user-facing refusal or null.
 * Same rules as the SQL trigger kafaa_fs_skill_guard: lifecycle obsolete is final, obsolete needs a date, a replacement
 * must be another existing skill, versions never go down. Deleting a skill is refused everywhere (no API exposes delete;
 * the SQL trigger also refuses it for definer functions and migrations).
 */
export const SKILL_GUARD_MSG = {
  unobsolete: 'An obsolete skill stays obsolete: publish a new skill instead (ESCO: obsolete, never deleted)',
  obsoleteDate: 'Mark a skill obsolete with the date it became obsolete',
  replacedSelf: 'A skill cannot replace itself',
  version: 'A skill version can only go up',
  delete: 'Skills are never deleted: mark the skill obsolete instead',
} as const;
export function skillGuard(before: Partial<TaxonomySkill> | null, next: Partial<TaxonomySkill>): string | null {
  if (before?.lifecycle === 'obsolete' && next.lifecycle !== 'obsolete') return SKILL_GUARD_MSG.unobsolete;
  if (next.lifecycle === 'obsolete' && !next.obsolete_on) return SKILL_GUARD_MSG.obsoleteDate;
  if (next.replaced_by && next.replaced_by === (next.id ?? before?.id)) return SKILL_GUARD_MSG.replacedSelf;
  if (before && Number(next.version ?? 1) < Number(before.version ?? 1)) return SKILL_GUARD_MSG.version;
  return null;
}

/** Benchmark ids each FS feature card follows (PLAN.md section 6, generated from fs/data.json). Pages: <BenchmarkChips feature="FS07" />. */
export const FEATURE_BENCHMARKS: Record<string, string[]> = {
  FS01: ['ESCO', 'OECD-PIAAC', 'SFIA9'],
  FS02: ['WEF-FOJ', 'ESCO', 'LIGHTCAST', 'MCK-DELTA', 'JAHIZ'],
  FS03: ['WEF-FOJ', 'SKILLS-TECH', 'FORECAST'],
  FS04: ['IAEA-WFP', 'ESCO'],
  FS05: ['SG-JTM', 'SSG-SF', 'IAEA-WFP'],
  FS06: ['OECD-AICI', 'SSG-SF', 'ONET'],
  FS07: ['SFIA9', 'ESCO', 'SSG-SF'],
  FS08: ['ESCO', 'SFIA9', 'ONET', 'DIGCOMP', '1EDTECH', 'OT-CYBER'],
  FS09: ['AI-LIT', 'UAE-AI', 'LINKEDIN', 'DIGCOMP'],
  FS10: ['DIGCOMP', 'SKILLS-TECH', 'OECD-PIAAC'],
  FS11: ['SG-JTM', 'SSG-SF', 'CORP'],
  FS12: ['SSG-SF', 'OECD-AICI', 'ENERGY-JOBS'],
  FS13: ['SMR-WF', 'NEA', 'IAEA-WFP'],
  FS14: ['IAEA-AI', 'ENERGY-JOBS', 'SMR-WF', 'NEA'],
  FS15: ['SG-CAREER', 'CORP'],
  FS16: ['ONET', 'CORP', 'FORECAST'],
  FS17: ['ENTITLE', 'CORP', 'LIGHTCAST'],
  FS18: ['ENTITLE', 'NUC-NET', 'NEA'],
  FS19: ['SMR-WF', 'UAE-PEERS', 'ENTITLE'],
  FS20: ['NUC-NET', 'UAE-PEERS'],
  FS21: ['SKILLS-TECH', 'OECD-PIAAC'],
  FS22: ['SKILLS-TECH', 'IAEA-AI'],
  FS23: ['SFIA9', 'SSG-SF', 'IAEA-1917'],
  FS24: ['SFIA9', 'DIGCOMP', 'UAE-NQF'],
  FS25: ['SSG-SF', 'WEF-FOJ', 'GREENCOMP', 'MCK-DELTA'],
  FS26: ['IAEA-1917', 'MCK-DELTA'],
  FS27: ['CORP', 'NEA'],
  FS28: ['NEA', 'NUC-NET', 'SMR-WF'],
  FS29: ['ILO-RPL', 'UAE-NQF', 'UK-NUC'],
  FS30: ['UAE-NQF', 'ENTITLE', 'UPKEEP'],
  FS31: ['1EDTECH', 'CORP', 'JAHIZ'],
  FS32: ['1EDTECH', 'SG-CAREER', 'UK-NUC'],
  FS33: ['SG-CAREER', 'SKILLS-TECH'],
  FS34: ['UK-NUC', 'SMR-WF', 'ESCO'],
  FS35: ['SG-CAREER', 'WEF-FOJ'],
  FS36: ['AI-LIT', 'UAE-AI'],
  FS37: ['IAEA-AI', 'AI-LIT', 'UAE-PEERS'],
  FS38: ['SMR-WF', 'IAEA-WFP'],
  FS39: ['SMR-WF', 'NEA'],
  FS40: ['IAEA-AI', 'SMR-WF'],
  FS41: ['GREENCOMP', 'WEF-FOJ', 'JAHIZ'],
  FS42: ['ENERGY-JOBS', 'NEA'],
  FS43: ['GREENCOMP', 'ISO30414', 'ENERGY-JOBS'],
  FS44: ['NEA', 'SKILLS-TECH'],
  FS45: ['NUC-NET', 'IAEA-WFP'],
  FS46: ['GREENCOMP', 'WEF-FOJ', 'NEA'],
  FS47: ['NUC-NET', 'NEA'],
  FS48: ['NUC-NET', 'ENERGY-JOBS'],
  FS49: ['IAEA-AI', 'IAEA-1917', 'AI-LIT'],
  FS50: ['IAEA-WFP', 'ISO30414', 'FORECAST'],
  FS51: ['IAEA-WFP', 'FORECAST', 'SMR-WF'],
  FS52: ['OECD-AICI', 'SSG-SF', 'ENERGY-JOBS'],
  FS53: ['WEF-FOJ', 'ENERGY-JOBS', 'EU-PACT', 'CORP'],
  FS54: ['SFIA9', 'UPKEEP', 'MCK-DELTA', 'FORECAST'],
  FS55: ['SKILLS-TECH', 'AI-LIT'],
  FS56: ['FSC', 'ISO30414', 'SKILLS-TECH'],
  FS57: ['LIGHTCAST', 'UPKEEP'],
  FS58: ['OECD-PIAAC', 'IAEA-1917'],
  FS59: ['SKILLS-TECH', 'IAEA-1917'],
  FS60: ['ISO30414', 'EU-PACT', 'UAE-PEERS'],
  FS61: ['FSC'],
  FS62: ['JAHIZ', 'UAE-AI', 'NAFIS'],
  FS63: ['MOHRE', 'ESCO'],
  FS64: ['FORECAST', 'EU-PACT'],
  FS65: ['EU-PACT', 'ENERGY-JOBS'],
  FS66: ['NUC-NET', 'UAE-NQF', 'LIGHTCAST'],
  FS67: ['NEA', 'NUC-NET'],
  FS68: ['EU-PACT', 'SMR-WF', 'UK-NUC'],
  FS69: ['UK-NUC', '1EDTECH', 'SG-CAREER'],
  FS70: ['LINKEDIN', 'WEF-FOJ', 'SSG-SF'],
  FS71: ['ONET'],
  FS72: ['SKILLS-TECH', 'LINKEDIN'],
  FS73: ['NAFIS', 'IAEA-WFP'],
  FS74: ['JAHIZ', 'UAE-AI', 'UAE-PEERS'],
  FS75: ['SG-CAREER', 'CORP'],
  FS76: ['SG-CAREER', 'AI-LIT'],
  FS77: ['UAE-AI', 'NEA', 'UK-NUC'],
  FS78: ['ENTITLE'],
  FS79: ['CORP', 'SKILLS-TECH', '1EDTECH'],
  FS80: ['UAE-PEERS', 'AI-LIT'],
  FS81: ['SSG-SF', 'SG-JTM', 'CORP'],
  FS82: ['NUC-NET'],
  FS83: ['NUC-NET', 'UAE-PEERS'],
  FS84: ['ISO30414', 'IAEA-WFP'],
};
