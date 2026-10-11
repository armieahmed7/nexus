/**
 * FS23 (future skills, wave C · E4, module M02): behaviourally anchored level descriptors and generic level attributes.
 * Pure and import-free: seed builders, the PGlite validator, both backends and pages load it.
 *
 *   level attributes  SFIA 9 style generic attributes (autonomy, influence, complexity, knowledge, behaviours) plus a one-line level
 *                     essence, applied across every skill of the four-level Kafa'a scale (kafaa_level_attributes).
 *   descriptors       per skill and level: a skill-specific essence line and 2-4 observable indicators in EN and AR, with the evidence
 *                     modes an assessor uses to see them (IAEA-TECDOC-1917: behavioural competence is assessable evidence)
 *                     (kafaa_skill_descriptors).
 *   level ranges      the levels where a skill exists, with a published rationale (SFIA: "skills are not defined at every level")
 *                     (kafaa_skill_level_ranges). Published descriptor levels always equal the range.
 *
 * SQL mirror (supabase/migrations/20261010234001_kafaa_fs34_descriptors_scale.sql): kafaa_sd_check = checkDescriptor,
 * kafaa_sd_range_check = checkRange, kafaa_sd_templated = isTemplated, kafaa_sd_message = DESC_MSG. Same codes, same order.
 */
export const LEVELS = [1, 2, 3, 4] as const;
export type Level = (typeof LEVELS)[number];
/** Generic attributes (SFIA 9: autonomy, influence, complexity, knowledge, business skills and behavioural factors) + level essence. */
export const ATTRIBUTES = ['essence', 'autonomy', 'influence', 'complexity', 'knowledge', 'behaviours'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
/** How an assessor sees an indicator (IAEA-TECDOC-1917 assessment methods + the SAT evidence Kafa'a already holds). */
export const EVIDENCE_MODES = ['observation', 'simulator', 'jpm', 'records', 'work_product', 'interview', 'peer', 'sjt', 'attestation'] as const;
export type EvidenceMode = (typeof EVIDENCE_MODES)[number];
/** Technical skills, or behavioural ones assessed with the same evidence model (IAEA-TECDOC-1917). */
export const TRACKS = ['technical', 'behavioural'] as const;
export type Track = (typeof TRACKS)[number];
/** Why a skill exists at the levels it does (the published rationale has a type). */
export const RANGE_BASES = ['full', 'licence_like', 'leading', 'not_operated', 'awareness_only', 'watch', 'declining'] as const;
export type RangeBasis = (typeof RANGE_BASES)[number];
export const DESC_STATUSES = ['draft', 'published', 'archived'] as const;

export const IND_MIN = 2;
export const IND_MAX = 4;
export const IND_LEN_MAX = 220;
export const ESS_LEN_MAX = 200;
export const MODES_MAX = 4;
export const RATIONALE_MIN = 20;
export const RATIONALE_MAX = 400;
/** Security and all-staff cyber hygiene stay at awareness levels (career-path level only beyond that). */
export const RESTRICTED_MAX_LEVEL = 2;

/**
 * The sentence templates the old descriptors were built from (F01 competency levels, FS02 level essence, specialised-skill
 * descriptions). A new descriptor must not reuse them. Patterns are matched case-insensitively (JS 'i' = PostgreSQL ~*).
 */
export const TEMPLATE_PATTERNS: readonly string[] = [
  '^explains the purpose and basic principles of',
  'under supervision using approved procedures',
  'independently and recognises when to stop and ask',
  '^coaches, trains and evaluates others in',
  '^(awareness|practitioner|independent|expert): ',
  ': part of ',
  '^يشرح الغرض والمبادئ الأساسية',
  'تحت الإشراف باستخدام الإجراءات المعتمدة',
  'باستقلالية ويعرف متى يتوقف ويسأل',
  '^يوجّه الآخرين ويدربهم ويقيّمهم',
  '^(إلمام|ممارس|مستقل|خبير): ',
];
const TEMPLATE_RE = TEMPLATE_PATTERNS.map((p) => new RegExp(p, 'i'));
/** The same trim as SQL btrim(x, E' \t\r\n'). */
export const trimWs = (s: unknown): string => (typeof s === 'string' ? s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') : '');
export const isTemplated = (s: unknown): boolean => TEMPLATE_RE.some((re) => re.test(trimWs(s)));

export interface DescriptorInput {
  skill_id?: unknown;
  level?: unknown;
  essence_en?: unknown;
  essence_ar?: unknown;
  indicators_en?: unknown;
  indicators_ar?: unknown;
  evidence_modes?: unknown;
  publish?: unknown;
}
export interface SkillLite {
  id: string;
  area: string;
  fs_area?: string | null;
  lifecycle?: string | null;
}
export interface RangeLite {
  min_level: number;
  max_level: number;
}
/** Security and cyber-hygiene skills are restricted to awareness levels. */
export const isRestrictedSkill = (s: Pick<SkillLite, 'area' | 'fs_area'> | null | undefined): boolean => !!s && (s.area === 'security' || s.fs_area === 'cyber_hygiene');

export type DescCode =
  | 'ok' | 'skill_not_found' | 'obsolete' | 'level' | 'restricted' | 'essence' | 'count' | 'mismatch' | 'indicator' | 'duplicate' | 'template' | 'mode'
  | 'in_range' | 'out_of_range';

const isStrList = (v: unknown): v is unknown[] => Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** checkDescriptor(): 'ok' or the first failing code. Same order as SQL kafaa_sd_check. */
export function checkDescriptor(input: DescriptorInput, ctx: { skill: SkillLite | null | undefined; range: RangeLite | null | undefined }): DescCode {
  const s = ctx.skill;
  if (!s) return 'skill_not_found';
  if (s.lifecycle === 'obsolete') return 'obsolete';
  const level = input.level;
  if (!isInt(level) || level < 1 || level > 4) return 'level';
  if (isRestrictedSkill(s) && level > RESTRICTED_MAX_LEVEL) return 'restricted';
  const een = trimWs(input.essence_en);
  const ear = trimWs(input.essence_ar);
  if (!een || !ear || een.length > ESS_LEN_MAX || ear.length > ESS_LEN_MAX) return 'essence';
  const en = input.indicators_en;
  const ar = input.indicators_ar;
  if (!isStrList(en) || !isStrList(ar) || en.length < IND_MIN || en.length > IND_MAX || ar.length < IND_MIN || ar.length > IND_MAX) return 'count';
  if (en.length !== ar.length) return 'mismatch';
  for (const x of [...en, ...ar]) if (typeof x !== 'string' || !trimWs(x) || trimWs(x).length > IND_LEN_MAX) return 'indicator';
  for (const list of [en, ar]) {
    const seen = new Set((list as string[]).map((x) => trimWs(x).toLowerCase()));
    if (seen.size !== list.length) return 'duplicate';
  }
  if ([een, ear, ...(en as string[]), ...(ar as string[])].some(isTemplated)) return 'template';
  const modes = input.evidence_modes;
  if (!isStrList(modes) || modes.length < 1 || modes.length > MODES_MAX || modes.some((m) => typeof m !== 'string' || !(EVIDENCE_MODES as readonly string[]).includes(m)) || new Set(modes).size !== modes.length) return 'mode';
  const inRange = !!ctx.range && level >= ctx.range.min_level && level <= ctx.range.max_level;
  const publish = input.publish === true;
  if (inRange && !publish) return 'in_range';
  if (!inRange && publish) return 'out_of_range';
  return 'ok';
}

export interface RangeInput {
  skill_id?: unknown;
  min_level?: unknown;
  max_level?: unknown;
  basis?: unknown;
  rationale_en?: unknown;
  rationale_ar?: unknown;
}
export type RangeCode = 'ok' | 'skill_not_found' | 'obsolete' | 'range' | 'restricted' | 'basis' | 'rationale' | 'incomplete' | 'no_change';

/** checkRange(): 'ok' or the first failing code. Same order as SQL kafaa_sd_range_check. `levels` = levels with a non-archived or archived descriptor row. */
export function checkRange(input: RangeInput, ctx: { skill: SkillLite | null | undefined; levels: number[]; current: (RangeLite & { basis: string; rationale_en: string; rationale_ar: string }) | null | undefined }): RangeCode {
  const s = ctx.skill;
  if (!s) return 'skill_not_found';
  if (s.lifecycle === 'obsolete') return 'obsolete';
  const lo = input.min_level;
  const hi = input.max_level;
  if (!isInt(lo) || !isInt(hi) || lo < 1 || hi > 4 || lo > hi) return 'range';
  if (isRestrictedSkill(s) && hi > RESTRICTED_MAX_LEVEL) return 'restricted';
  const basis = trimWs(input.basis);
  if (!(RANGE_BASES as readonly string[]).includes(basis)) return 'basis';
  const ren = trimWs(input.rationale_en);
  const rar = trimWs(input.rationale_ar);
  if (ren.length < RATIONALE_MIN || rar.length < RATIONALE_MIN || ren.length > RATIONALE_MAX || rar.length > RATIONALE_MAX) return 'rationale';
  for (let l = lo; l <= hi; l++) if (!ctx.levels.includes(l)) return 'incomplete';
  const c = ctx.current;
  if (c && c.min_level === lo && c.max_level === hi && c.basis === basis && trimWs(c.rationale_en) === ren && trimWs(c.rationale_ar) === rar) return 'no_change';
  return 'ok';
}

/** Refusal messages (user-facing; SQL kafaa_sd_message returns the same text). */
export const DESC_MSG: Record<string, string> = {
  not_signed_in: 'Sign in to edit level descriptors',
  forbidden: 'Only framework owners (instructors, the training manager and admins) edit level descriptors',
  skill_not_found: 'Skill not found',
  obsolete: 'This skill is obsolete: its descriptors stay readable but are no longer edited',
  level: 'Choose a level from 1 to 4',
  restricted: 'Security and cyber-hygiene skills stay at awareness levels (1-2) for all staff; deeper levels belong to security roles at career-path level only',
  essence: 'Give a level essence in English and Arabic (up to 200 characters each)',
  count: 'Give 2 to 4 observable indicators in each language',
  mismatch: 'Give the same number of indicators in English and Arabic',
  indicator: 'Each indicator is a non-empty sentence of up to 220 characters',
  duplicate: 'Each indicator must say something different',
  template: 'This reuses the old template sentence: describe what someone at this level is seen to do',
  mode: 'Choose 1 to 4 evidence modes from the list',
  in_range: 'This level is inside the skill\'s range: its descriptor is always published',
  out_of_range: 'This level is outside the skill\'s range: save it as a draft, then extend the range',
  range: 'Choose a range from level 1 to 4, lowest first',
  basis: 'Choose why the skill exists at these levels',
  rationale: 'Give the rationale in English and Arabic (20 to 400 characters each)',
  incomplete: 'Write a descriptor for every level in the new range first',
  no_change: 'Nothing changed',
};
/** Refusal code returned to callers for a check code. */
export const descResultCode = (c: string): string =>
  c === 'skill_not_found' ? 'not_found' : c === 'obsolete' ? 'obsolete' : c === 'restricted' ? 'restricted' : c === 'no_change' ? 'no_change' : c === 'incomplete' ? 'incomplete' : 'invalid';

export const descriptorId = (skillId: string, level: number) => `sd:${skillId}:${level}`;

/** The state of a level for a skill: inside the range, or below / above it. */
export function levelState(range: RangeLite | null | undefined, level: number): 'defined' | 'below' | 'above' | 'none' {
  if (!range) return 'none';
  if (level < range.min_level) return 'below';
  if (level > range.max_level) return 'above';
  return 'defined';
}

export interface DescRowLite {
  skill_id: string;
  level: number;
  status: string;
  essence_en: string;
  essence_ar: string;
  indicators_en: string[];
  indicators_ar: string[];
}
export interface Coverage {
  skills: number;
  complete: number;
  pct: number;
  missing: { skill_id: string; level: number }[];
  extra: { skill_id: string; level: number }[];
  templated: { skill_id: string; level: number }[];
  noArabic: { skill_id: string; level: number }[];
  noRange: string[];
  indicators: number;
  levels: number;
}
/** FS23 acceptance as data: every skill has a published descriptor at each level of its range, none outside it, no template, EN + AR. */
export function descriptorCoverage(skills: { id: string }[], ranges: (RangeLite & { skill_id: string })[], descs: DescRowLite[]): Coverage {
  const rangeOf = new Map(ranges.map((r) => [r.skill_id, r]));
  const pub = descs.filter((d) => d.status === 'published');
  const key = (s: string, l: number) => `${s}|${l}`;
  const have = new Set(pub.map((d) => key(d.skill_id, d.level)));
  const missing: Coverage['missing'] = [];
  const extra: Coverage['extra'] = [];
  const noRange: string[] = [];
  let complete = 0;
  for (const s of skills) {
    const r = rangeOf.get(s.id);
    if (!r) { noRange.push(s.id); continue; }
    let ok = true;
    for (let l = r.min_level; l <= r.max_level; l++) if (!have.has(key(s.id, l))) { missing.push({ skill_id: s.id, level: l }); ok = false; }
    for (const d of pub) if (d.skill_id === s.id && (d.level < r.min_level || d.level > r.max_level)) { extra.push({ skill_id: s.id, level: d.level }); ok = false; }
    if (ok) complete++;
  }
  const templated = pub.filter((d) => [d.essence_en, d.essence_ar, ...d.indicators_en, ...d.indicators_ar].some(isTemplated)).map((d) => ({ skill_id: d.skill_id, level: d.level }));
  const noArabic = pub.filter((d) => !trimWs(d.essence_ar) || d.indicators_ar.length !== d.indicators_en.length || d.indicators_ar.some((x) => !trimWs(x))).map((d) => ({ skill_id: d.skill_id, level: d.level }));
  return {
    skills: skills.length, complete, pct: skills.length ? Math.round((complete / skills.length) * 1000) / 10 : 0, missing, extra, templated, noArabic, noRange,
    indicators: pub.reduce((n, d) => n + d.indicators_en.length, 0), levels: pub.length,
  };
}
