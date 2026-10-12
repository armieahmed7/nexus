// FS63 MoHRE occupation and skill-level mapping (M37 National Alignment, FS wave G · E2). Pure rules shared by the pages, the
// LocalBackend, the seed builder, the unit tests and the PGlite validator, mirrored 1:1 by SQL in
// supabase/migrations/20261010272001_kafaa_fs72_national_alignment.sql:
//   indicativeLevel()     = kafaa_ro_indicative       Kafa'a's indicative national skill level from the role's entry education
//                                                      (pending review; never presented as MoHRE's own level)
//   occupationProblem()   = kafaa_ro_problem          checks run by saveRoleOccupation (current roles only; concept roles get no row)
//   codeProblem()         = kafaa_ro_code_problem     checks run by verifyOccupationCode: a code is stored only with a source on an
//                                                      official UAE government domain, the date it was read and the verifier
//   codeView()                                         the code is shown only when verified, otherwise "code pending review"
//   occupationTrend()     = kafaa_ro_trend_core       SIMULATED skill-level uplift trend of the synthetic workforce, cells under 10 suppressed
// Kafa'a is not a MoHRE system: it holds a labelled mapping for internal reporting and never issues or validates a classification.
// Import-free except `.ts` rule files that are themselves import-free.
import { publicTextIsClean } from '../../domain/future.ts';
import { hostOf, typedTotalFree } from './national.ts';

/** The five national skill levels; Kafa'a numbers them 1 (highest qualification requirement) to 5 for this demo, pending review. */
export const LEVELS = [1, 2, 3, 4, 5] as const;
/** Indicative rule (Kafa'a's, not MoHRE's): degree -> 1, diploma -> 2, secondary school -> 3; levels 4 and 5 are not used by ENEC roles. */
export const EDUCATION_LEVEL: Record<string, number> = { doctorate: 1, master: 1, bachelor: 1, diploma: 2, high_school: 3 };
export const LEVEL_BASES = ['education_rule', 'reviewed'] as const;
export const CODE_STATUSES = ['pending_review', 'verified'] as const;
export const MIN_GROUP = 10;
export const TREND_FROM = 2016;
/** The "skilled share" of the trend: levels 1 and 2 (degree or diploma). */
export const UPPER_LEVELS = [1, 2];

export const indicativeLevel = (education: string | null | undefined): number | null => EDUCATION_LEVEL[String(education ?? '')] ?? null;
/** A code source must sit on an official UAE government domain (u.ae, *.gov.ae, e.g. mohre.gov.ae). */
export const officialCodeHost = (url: string) => { const h = hostOf(url); return /(^|\.)u\.ae$/.test(h) || /(^|\.)gov\.ae$/.test(h); };

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const len = (v: unknown, lo: number, hi: number) => { const n = [...txt(v)].length; return n >= lo && n <= hi; };

export interface RoleLite { id: string; lifecycle?: string | null; education?: string | null; family_id?: string | null; security_sensitive?: boolean | null }
export interface OccupationInput { role_id: string; label_en: string; label_ar: string; skill_level: number; level_basis: string; rationale_en?: string | null; rationale_ar?: string | null }
export interface CodeInput { role_id: string; code: string; source_label: string; source_url: string; source_as_of: string }
export interface OccupationRow {
  id: string; role_id: string; label_en: string; label_ar: string; mohre_code: string | null; code_status: string; code_source: { label: string; url: string; as_of: string } | null;
  verified_by: string | null; verified_on: string | null; skill_level: number; level_basis: string; education_basis: string | null; rationale_en: string | null; rationale_ar: string | null;
  version: number; updated_by: string; updated_at?: string;
}

/** First problem of a mapping save (null = ok). Codes: role, concept, label, clean, level, basis, rationale. */
export function occupationProblem(p: OccupationInput, role: RoleLite | undefined): string | null {
  if (!role) return 'role';
  if ((role.lifecycle ?? 'current') !== 'current') return 'concept';
  if (!len(p?.label_en, 3, 120) || !len(p?.label_ar, 3, 120)) return 'label';
  const text = [p.label_en, p.label_ar, p.rationale_en ?? '', p.rationale_ar ?? ''];
  if (!publicTextIsClean(text) || !typedTotalFree(text)) return 'clean';
  if (!Number.isInteger(p.skill_level) || p.skill_level < 1 || p.skill_level > 5) return 'level';
  if (!(LEVEL_BASES as readonly string[]).includes(p.level_basis)) return 'basis';
  const rule = indicativeLevel(role.education);
  if (p.level_basis === 'education_rule' && p.skill_level !== rule) return 'basis';
  if (p.level_basis === 'reviewed' && (!len(p.rationale_en, 10, 400) || !len(p.rationale_ar, 10, 400))) return 'rationale';
  return null;
}

/** First problem of a code verification (null = ok). Codes: code, source, host, date. */
export function codeProblem(p: CodeInput, today: string): string | null {
  if (!/^[0-9A-Z][0-9A-Z.-]{1,15}$/.test(String(p?.code ?? ''))) return 'code';
  if (!len(p.source_label, 3, 200) || !/^https:\/\/\S+$/.test(String(p.source_url ?? ''))) return 'source';
  if (!officialCodeHost(p.source_url)) return 'host';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.source_as_of ?? '')) || p.source_as_of > today) return 'date';
  return null;
}

/** What a page may show: the code only when verified (with its source), otherwise null and "code pending review". */
export function codeView(r: Pick<OccupationRow, 'mohre_code' | 'code_status' | 'code_source' | 'verified_on'>): { shown: string | null; pending: boolean; source: OccupationRow['code_source']; verified_on: string | null } {
  const ok = r.code_status === 'verified' && !!r.mohre_code && !!r.code_source && /^https:\/\//.test(r.code_source.url ?? '');
  return { shown: ok ? r.mohre_code : null, pending: !ok, source: ok ? r.code_source : null, verified_on: ok ? r.verified_on : null };
}

export interface TrendYear { year: number; total: number | null; levels: { level: number; n: number | null }[]; upper_pct: number | null; mean: number | null }
export interface OccupationTrend { simulated: true; min_group: number; from: number; to: number; mapped_roles: number; years: TrendYear[] }
interface PersonLite { id: string; kind: string; status: string; job_role_id: string | null; hire_date: string | null }

/** SIMULATED uplift trend: for each year-end from TREND_FROM to this year, the active synthetic staff hired by then whose current role has
 *  a mapping, placed at that role's level (role moves and leavers are not modelled, so the trend shows the hiring mix). Every count under
 *  10 suppressed; a year under 10 people shows nothing; the skilled share (levels 1-2) and the mean level only from 10 people up. */
export function occupationTrend(people: PersonLite[], rows: Pick<OccupationRow, 'role_id' | 'skill_level'>[], today: string): OccupationTrend {
  const levelOf = new Map(rows.map((r) => [r.role_id, Number(r.skill_level)]));
  const pop = people.filter((p) => p.kind === 'staff' && p.status === 'active' && p.job_role_id && levelOf.has(p.job_role_id) && p.hire_date)
    .map((p) => ({ hired: String(p.hire_date).slice(0, 10), level: levelOf.get(p.job_role_id!)! }));
  const to = Number(today.slice(0, 4));
  const years: TrendYear[] = [];
  for (let y = TREND_FROM; y <= to; y++) {
    const end = y === to ? today : `${y}-12-31`;
    const at = pop.filter((p) => p.hired <= end);
    const total = at.length;
    const ok = total >= MIN_GROUP;
    const levels = LEVELS.map((l) => { const n = at.filter((p) => p.level === l).length; return { level: l, n: ok && n >= MIN_GROUP ? n : null }; });
    const upper = at.filter((p) => UPPER_LEVELS.includes(p.level)).length;
    const sum = at.reduce((s, p) => s + p.level, 0);
    years.push({
      year: y, total: ok ? total : null, levels,
      upper_pct: ok && upper >= MIN_GROUP ? Math.floor((2000 * upper + total) / (2 * total)) / 10 : null,
      mean: ok ? Math.floor((200 * sum + total) / (2 * total)) / 100 : null,
    });
  }
  return { simulated: true, min_group: MIN_GROUP, from: TREND_FROM, to, mapped_roles: levelOf.size, years };
}
