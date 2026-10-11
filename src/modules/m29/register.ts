// FS36 AI-literacy register: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder and (mirrored in SQL)
// supabase/migrations/20261010245001_kafaa_fs45_ai_register_drills.sql (kafaa_air_coverage, kafaa_air_problem). Import-free apart
// from types (node seed and validator scripts load it directly).
//
// Benchmarks: EU AI Act Article 4 and the AI Office living repository of AI-literacy practices (literacy per AI system, provider vs
// deployer, maturity labels planned / partially rolled out / fully implemented); UAE National AI Strategy 2031 and DGE AiNative
// (approved-use classes, a dated capability target). Kafa'a is not a regulator: the register and its pack are a voluntary alignment
// with the repository's practice, never a statement of compliance.
//
//  - A system (kafaa_ai_systems) names ENEC's role for it (provider or deployer), its approved-use class, a maturity label, its owner
//    (a role card), the literacy measures that cover its users and its sources.
//  - Each user group (kafaa_ai_system_users) is a set of job families (or all staff), a side (provider-side people build or configure,
//    deployer-side people use the outputs), a required FS09 rung and optional single cells from a higher rung.
//  - Coverage is computed from FS09 rungs (aiRung over F01 states), never entered by hand: a member is covered when their rung is at
//    or above the required rung and every extra cell is met. Groups under MIN_GROUP_SIZE are suppressed (n, covered, pct, gaps null).
//  - "Fully implemented" is a claim the data must carry: the label is refused (and flagged later) when fewer than THRESHOLD % of the
//    system's users are covered.
import type { Reason } from '../../domain/engines/types';

export const AI_ROLES = ['provider', 'deployer'] as const;
export const USE_CLASSES = ['information', 'decision_support', 'automation'] as const;
export const MATURITIES = ['planned', 'partial', 'full'] as const;
export const SIDES = ['provider', 'deployer'] as const;
export const MEASURE_KINDS = ['ladder', 'check', 'drill', 'course', 'briefing'] as const;
export const SYSTEM_STATUSES = ['draft', 'published', 'retired'] as const;
/** Coverage a system needs before it may be labelled "fully implemented". */
export const THRESHOLD = 80;
export const MAX_GROUPS = 8;
const DIMS = ['mindset', 'ethics', 'techniques', 'design'];

/** Fixed statement every pack carries (data, both languages): not a regulator, voluntary alignment, no presumption of compliance. */
export const PACK_STATEMENT = {
  en: 'Kafa\'a is not a regulator and this pack is not a compliance statement. It is a voluntary alignment with the practice collected in the EU AI Office living repository of AI-literacy practices (EU AI Act Article 4); replicating those practices does not grant a presumption of compliance. Coverage is computed from skill evidence on the AI fluency ladder; groups under 10 people are suppressed.',
  ar: 'كفاءة ليست جهة تنظيمية، وهذه الحزمة ليست بيان امتثال. إنها مواءمة طوعية مع الممارسات التي جمعها المستودع الحي لممارسات الإلمام بالذكاء الاصطناعي لدى مكتب الذكاء الاصطناعي الأوروبي (المادة 4 من قانون الذكاء الاصطناعي الأوروبي)؛ ولا يمنح تكرار تلك الممارسات افتراضاً بالامتثال. تُحسب التغطية من أدلة المهارات على سلّم الطلاقة في الذكاء الاصطناعي، وتُحجب المجموعات التي تضم أقل من 10 أشخاص.',
} as const;

/** Wording a register entry may never use: Kafa'a does not certify or declare compliance (EN and AR, lower-cased match). */
export const CLAIM_TERMS = ['compliant', 'compliance certified', 'certified', 'certifies', 'complies with', 'presumption of compliance', 'approved by fanr', 'fanr approved', 'licensed by', 'conformity assessed',
  'معتمد من', 'ممتثل', 'شهادة امتثال', 'يمتثل', 'مرخص من'];
export const hasClaim = (text: string) => { const t = text.toLowerCase(); return CLAIM_TERMS.some((w) => t.includes(w)); };

export interface SystemLite { id: string; status: string; maturity: string; owner_person_id?: string | null; sort?: number; listed?: boolean }
export interface GroupLite { id: string; system_id: string; family_ids: string[]; all_staff: boolean; side: string; required_rung: number; required_cells: string[]; active: boolean; sort: number }
/** One staff member's FS09 result reduced to what coverage needs. */
export interface PersonRung { person_id: string; family_id: string | null; rung: number; met: string[] }
export interface CellLite { id: string; rung: number; dimension: string }

export interface GroupCoverage { group_id: string; n: number | null; covered: number | null; pct: number | null; gaps: { cell_id: string; n: number | null }[] }
export interface SystemCoverage { system_id: string; n: number | null; covered: number | null; pct: number | null; maturity: string; label_ok: boolean | null; groups: GroupCoverage[] }
export interface Coverage { threshold: number; systems: SystemCoverage[]; overall: { systems: number; n: number | null; covered: number | null; pct: number | null } }

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const pct1 = (a: number, b: number) => (b > 0 ? Math.floor((1000 * a) / b + 0.5) / 10 : 0);
const cellOrder = (c: CellLite) => c.rung * 10 + Math.max(0, DIMS.indexOf(c.dimension));
export const sortGroups = <T extends { sort: number; id: string }>(g: T[]) => [...g].sort((a, b) => a.sort - b.sort || cmp(a.id, b.id));
export const sortSystems = <T extends { sort?: number; id: string }>(s: T[]) => [...s].sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0) || cmp(a.id, b.id));

export const isMember = (g: Pick<GroupLite, 'all_staff' | 'family_ids'>, p: Pick<PersonRung, 'family_id'>) => g.all_staff || (!!p.family_id && (g.family_ids ?? []).includes(p.family_id));
/** Cells a group needs: every cell at or below the required rung, then the extra cells (ladder order). */
export function neededCells(g: Pick<GroupLite, 'required_rung' | 'required_cells'>, cells: CellLite[]): string[] {
  const base = cells.filter((c) => c.rung <= g.required_rung).sort((a, b) => cellOrder(a) - cellOrder(b) || cmp(a.id, b.id)).map((c) => c.id);
  const extra = cells.filter((c) => (g.required_cells ?? []).includes(c.id) && !base.includes(c.id)).sort((a, b) => cellOrder(a) - cellOrder(b) || cmp(a.id, b.id)).map((c) => c.id);
  return [...base, ...extra];
}
export const isCovered = (g: Pick<GroupLite, 'required_rung' | 'required_cells'>, p: Pick<PersonRung, 'rung' | 'met'>) =>
  p.rung >= g.required_rung && (g.required_cells ?? []).every((c) => p.met.includes(c));

/** Coverage of the given systems (mirror of SQL kafaa_air_coverage). Groups and systems under minGroup are suppressed. */
export function coverage(systems: SystemLite[], groups: GroupLite[], people: PersonRung[], cells: CellLite[], minGroup: number, threshold = THRESHOLD): Coverage {
  const out: SystemCoverage[] = [];
  const users = new Set<string>();
  const coveredAll = new Set<string>();
  const uncovered = new Set<string>();
  for (const s of sortSystems(systems)) {
    const gs = sortGroups(groups.filter((g) => g.system_id === s.id && g.active));
    const members = new Map<string, boolean>(); // person -> covered for every group of the system they belong to
    const gc: GroupCoverage[] = gs.map((g) => {
      const m = people.filter((p) => isMember(g, p));
      const cov = m.filter((p) => isCovered(g, p));
      for (const p of m) members.set(p.person_id, (members.get(p.person_id) ?? true) && isCovered(g, p));
      const big = m.length >= minGroup;
      const need = neededCells(g, cells);
      const gaps = big
        ? need.map((c, i) => ({ c, i, k: m.filter((p) => !p.met.includes(c)).length })).filter((x) => x.k > 0).sort((a, b) => b.k - a.k || a.i - b.i).slice(0, 3)
          .map((x) => ({ cell_id: x.c, n: x.k >= minGroup ? x.k : null }))
        : [];
      return { group_id: g.id, n: big ? m.length : null, covered: big && cov.length >= minGroup ? cov.length : null, pct: big ? pct1(cov.length, m.length) : null, gaps };
    });
    const n = members.size;
    const c = [...members.values()].filter(Boolean).length;
    for (const [pid, ok] of members) { users.add(pid); if (!ok) uncovered.add(pid); }
    const big = n >= minGroup;
    out.push({
      system_id: s.id, n: big ? n : null, covered: big && c >= minGroup ? c : null, pct: big ? pct1(c, n) : null, maturity: s.maturity,
      label_ok: s.maturity === 'full' ? n > 0 && pct1(c, n) >= threshold : null, groups: gc,
    });
  }
  for (const u of users) if (!uncovered.has(u)) coveredAll.add(u);
  const n = users.size;
  const big = n >= minGroup;
  return { threshold, systems: out, overall: { systems: out.length, n: big ? n : null, covered: big && coveredAll.size >= minGroup ? coveredAll.size : null, pct: big ? pct1(coveredAll.size, n) : null } };
}

/** Raw coverage % of one system's users (no suppression): the check behind "fully implemented". Mirror of SQL kafaa_air_raw_pct. */
export function rawSystemPct(groups: Pick<GroupLite, 'family_ids' | 'all_staff' | 'required_rung' | 'required_cells' | 'active'>[], people: PersonRung[]): number {
  const members = new Map<string, boolean>();
  for (const g of groups.filter((x) => x.active)) for (const p of people) if (isMember(g, p)) members.set(p.person_id, (members.get(p.person_id) ?? true) && isCovered(g, p));
  return members.size ? pct1([...members.values()].filter(Boolean).length, members.size) : 0;
}

export interface MeasureInput { kind: string; ref?: string | null; title_en: string; title_ar: string }
export interface GroupInput { id?: string | null; label_en: string; label_ar: string; family_ids: string[]; all_staff: boolean; side: string; required_rung: number; required_cells: string[]; rationale_en?: string; rationale_ar?: string }
export interface SystemInput {
  id?: string | null; name_en: string; name_ar: string; purpose_en: string; purpose_ar: string; ai_role: string; use_class: string; maturity: string; simulated: boolean;
  owner_person_id: string; oversight_en: string; oversight_ar: string; measures: MeasureInput[]; groups: GroupInput[]; status: string; review_due?: string | null;
}
const str = (x: unknown, max: number) => typeof x === 'string' && x.trim().length > 0 && x.trim().length <= max;
/** First problem code of a register entry, or null (mirror of SQL kafaa_air_problem). Wording is checked across every text. */
export function systemProblem(i: SystemInput, ctx: { families: string[]; cells: CellLite[]; staff: string[] }): string | null {
  if (!str(i?.name_en, 120) || !str(i?.name_ar, 120)) return 'name';
  if (!str(i.purpose_en, 600) || !str(i.purpose_ar, 600)) return 'purpose';
  if (!(AI_ROLES as readonly string[]).includes(i.ai_role)) return 'ai_role';
  if (!(USE_CLASSES as readonly string[]).includes(i.use_class)) return 'use_class';
  if (!(MATURITIES as readonly string[]).includes(i.maturity)) return 'maturity';
  if (!(SYSTEM_STATUSES as readonly string[]).includes(i.status)) return 'status';
  if (typeof i.simulated !== 'boolean') return 'simulated';
  if (!ctx.staff.includes(i.owner_person_id)) return 'owner';
  if (!str(i.oversight_en, 400) || !str(i.oversight_ar, 400)) return 'oversight';
  if (!Array.isArray(i.measures) || i.measures.length > 6 || i.measures.some((m) => !(MEASURE_KINDS as readonly string[]).includes(m?.kind) || !str(m?.title_en, 160) || !str(m?.title_ar, 160))) return 'measures';
  if (i.status === 'published' && i.measures.length === 0) return 'measures';
  if (!Array.isArray(i.groups) || i.groups.length < 1 || i.groups.length > MAX_GROUPS) return 'groups';
  for (const g of i.groups) {
    if (!str(g?.label_en, 120) || !str(g?.label_ar, 120)) return 'groups';
    if (!(SIDES as readonly string[]).includes(g.side)) return 'groups';
    if (!Number.isInteger(g.required_rung) || g.required_rung < 1 || g.required_rung > 4) return 'rung';
    if (typeof g.all_staff !== 'boolean' || !Array.isArray(g.family_ids) || (!g.all_staff && g.family_ids.length === 0) || g.family_ids.some((f) => !ctx.families.includes(f))) return 'families';
    if (!Array.isArray(g.required_cells) || g.required_cells.some((c) => { const x = ctx.cells.find((y) => y.id === c); return !x || x.rung <= g.required_rung; })) return 'cells';
  }
  const texts = [i.name_en, i.name_ar, i.purpose_en, i.purpose_ar, i.oversight_en, i.oversight_ar, ...i.measures.flatMap((m) => [m.title_en, m.title_ar]),
    ...i.groups.flatMap((g) => [g.label_en, g.label_ar, g.rationale_en ?? '', g.rationale_ar ?? ''])].join(' \n ');
  if (hasClaim(texts)) return 'claim';
  return null;
}

/** Explain a system's coverage (reasons for <WhyThis>): computed from rungs, the threshold, the label check, suppression. */
export function coverageReasons(s: SystemCoverage): Reason[] {
  const r: Reason[] = [{ code: 'fs36_computed', key: 'm29.reg.reason.computed', vars: { groups: s.groups.length } }];
  if (s.pct == null) r.push({ code: 'fs36_suppressed', key: 'm29.reg.reason.suppressed', vars: { min: 10 } });
  else r.push({ code: 'fs36_pct', key: 'm29.reg.reason.pct', vars: { pct: s.pct } });
  if (s.maturity === 'full') r.push({ code: s.label_ok ? 'fs36_label_ok' : 'fs36_label_low', key: s.label_ok ? 'm29.reg.reason.labelOk' : 'm29.reg.reason.labelLow', vars: { threshold: THRESHOLD } });
  for (const g of s.groups) if (g.n == null) r.push({ code: 'fs36_group_suppressed', key: 'm29.reg.reason.groupSuppressed', vars: { min: 10 }, ref: { table: 'ai_system_users', id: g.group_id } });
  return r;
}

export interface PackSystem { id: string; name_en: string; name_ar: string; ai_role: string; use_class: string; maturity: string; simulated: boolean; owner_en: string; owner_ar: string;
  measures: MeasureInput[]; groups: { id: string; label_en: string; label_ar: string; side: string; required_rung: number; required_cells: string[] }[]; review_due: string | null; version: number }
export interface Pack {
  kind: 'kafaa.ai_literacy_register_pack';
  version: 1;
  generated_on: string;
  not_a_regulator: true;
  voluntary_alignment: true;
  statement_en: string;
  statement_ar: string;
  aligned_with: { id: string; url: string }[];
  threshold: number;
  systems: (PackSystem & { coverage: SystemCoverage | null })[];
  overall: Coverage['overall'] | null;
}
/** The exportable compliance-style pack (voluntary alignment, never a compliance claim). Built from rows the caller may read. */
export function buildPack(systems: PackSystem[], cov: Coverage | null, generatedOn: string, aligned: { id: string; url: string }[]): Pack {
  return {
    kind: 'kafaa.ai_literacy_register_pack', version: 1, generated_on: generatedOn, not_a_regulator: true, voluntary_alignment: true,
    statement_en: PACK_STATEMENT.en, statement_ar: PACK_STATEMENT.ar, aligned_with: aligned, threshold: cov?.threshold ?? THRESHOLD,
    systems: sortSystems(systems).map((s) => ({ ...s, coverage: cov?.systems.find((c) => c.system_id === s.id) ?? null })), overall: cov?.overall ?? null,
  };
}
/** Flat CSV rows of a pack (one row per user group). */
export function packRows(p: Pack): Record<string, string | number | null>[] {
  return p.systems.flatMap((s) => s.groups.map((g) => {
    const gc = s.coverage?.groups.find((x) => x.group_id === g.id);
    return { system: s.id, system_name: s.name_en, ai_role: s.ai_role, use_class: s.use_class, maturity: s.maturity, simulated: s.simulated ? 'yes' : 'no', group: g.id, group_label: g.label_en, side: g.side,
      required_rung: g.required_rung, extra_cells: g.required_cells.join(' '), users: gc?.n ?? 'suppressed', covered_pct: gc?.pct ?? 'suppressed', statement: 'voluntary alignment; Kafa\'a is not a regulator' };
  }));
}
