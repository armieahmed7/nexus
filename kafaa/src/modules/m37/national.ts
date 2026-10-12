// FS62 National-strategy alignment layer (M37 National Alignment, FS wave G · E2). Pure rules shared by the pages, the LocalBackend,
// the seed builder, the unit tests and the PGlite validator, mirrored 1:1 by SQL in
// supabase/migrations/20261010272001_kafaa_fs72_national_alignment.sql:
//   sourceTier() / tagSourceView()  = kafaa_na_tier / kafaa_na_source_view   official (UAE government domain), intergovernmental or
//                                       secondary; the primary source is the most official one; a tag whose best source is not official
//                                       (or that cites the strategy only indirectly) is flagged visibly
//   tagProblem() / linkProblem()    = kafaa_na_tag_problem / kafaa_na_link_problem   checks run by saveNationalTag / setTagLink
//   effectiveLinks()                = kafaa_na_links                          curated links plus the links derived from data: Jahiz groups
//                                       from the FS02 skills column future_group, Net Zero 2050 from FS41 cec_competences.net_zero
//   nationalReport()                = kafaa_na_report_core                    a filter over the data: linked items, their live status and,
//                                       for national_alignment Agg/W/A, measures computed from the tables (suppressed under 10); no
//                                       total is ever typed or stored (tag text may carry years only, typedTotalFree)
// Import-free except `.ts` rule files that are themselves import-free (node scripts load this file directly).
import type { Reason } from '../../domain/engines/types';
import { publicTextIsClean } from '../../domain/future.ts';
import { cecLevel } from '../m32/cec.ts';
import { aiRung } from '../m29/fluency.ts';
import { walletStatus, walletWorld } from './wallet.ts'; // FS74 (fsHe2): the wallet target row and its measure

export const STRATEGIES = ['nes_2031', 'we_uae_2031', 'ai_2031', 'net_zero_2050', 'jahiz', 'centennial_2071'] as const;
export type Strategy = (typeof STRATEGIES)[number];
export const TAG_KINDS = ['strategy', 'pillar', 'goal', 'group'] as const;
export const SOURCE_TIERS = ['official', 'intergovernmental', 'secondary'] as const;
export type SourceTier = (typeof SOURCE_TIERS)[number];
export const TIER_RANK: Record<SourceTier, number> = { official: 3, intergovernmental: 2, secondary: 1 };
/** The four Jahiz groups (FS02 skills.future_group values). nuclear_excellence is ENEC's own fifth group, not a national tag. */
export const JAHIZ_GROUPS = ['digital', 'ten_x', 'data_ai', 'new_economy'] as const;
export const JAHIZ_GROUP_NAME: Record<string, { en: string; ar: string }> = {
  digital: { en: 'Digital Skills', ar: 'المهارات الرقمية' },
  ten_x: { en: '10X Skills', ar: 'مهارات 10X' },
  data_ai: { en: 'Data & AI Skills', ar: 'مهارات البيانات والذكاء الاصطناعي' },
  new_economy: { en: 'New Economy Skills', ar: 'مهارات الاقتصاد الجديد' },
};
export const DERIVE_RULES = ['future_group', 'cec_net_zero'] as const;
export const ITEM_KINDS = ['skill', 'programme', 'target'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export type MeasureKind = 'holders' | 'completers' | 'enrolled' | 'awarded' | 'applicants' | 'participants' | 'at_target' | 'org_share' | 'family_share' | 'wallet_share';
/** Tables a tag may link to: what kind of item each row is and which measure the report computes for it. A later wave (FS74's future
 *  target) adds a table here and in SQL kafaa_na_target (create or replace); no check constraint has to be widened. */
export const TARGET_TABLES: Record<string, { kind: ItemKind; measure: MeasureKind }> = {
  skills: { kind: 'skill', measure: 'holders' },
  cec_competences: { kind: 'skill', measure: 'holders' },
  programmes: { kind: 'programme', measure: 'completers' },
  pathways: { kind: 'programme', measure: 'enrolled' },
  microcred_defs: { kind: 'programme', measure: 'awarded' },
  talent_programmes: { kind: 'programme', measure: 'applicants' },
  leadership_programmes: { kind: 'programme', measure: 'participants' },
  critical_skills: { kind: 'target', measure: 'at_target' },
  ai_org_targets: { kind: 'target', measure: 'org_share' },
  cec_role_targets: { kind: 'target', measure: 'family_share' },
  wallet_targets: { kind: 'target', measure: 'wallet_share' }, // FS74 (fsHe2, wave H): the Future Skills Wallet target (SQL lists in the fs82 migration)
};
export const TABLE_ORDER = Object.keys(TARGET_TABLES);
export const MIN_GROUP = 10;
/** Families never broken out in aggregates (security, safeguards and cyber stay at career-path level). */
export const NO_BREAKOUT = ['security', 'safeguards', 'cyber'];
const COUNTED = ['verified', 'evidenced', 'validated'];

export interface TagSource { label: string; url: string; as_of: string; tier?: string; year?: number | null }
export interface TagRow {
  id: string; strategy: string; parent_id: string | null; kind: string; code: string; name_en: string; name_ar: string; summary_en: string; summary_ar: string;
  horizon_year: number | null; owner_en?: string | null; owner_ar?: string | null; sources: TagSource[]; source_scope: string; source_note_en?: string | null; source_note_ar?: string | null;
  derive: string | null; future_group: string | null; status: string; sort: number; version?: number; benchmark_ids?: string[];
}
export interface LinkRow { id: string; tag_id: string; target_table: string; target_id: string; note_en: string; note_ar: string; active: boolean }
export interface TagInput {
  id?: string | null; strategy: string; parent_id?: string | null; kind: string; code: string; name_en: string; name_ar: string; summary_en: string; summary_ar: string;
  horizon_year?: number | null; owner_en?: string | null; owner_ar?: string | null; sources: TagSource[]; source_scope?: string; source_note_en?: string | null; source_note_ar?: string | null;
  status?: string;
}
export interface LinkInput { tag_id: string; target_table: string; target_id: string; active: boolean; note_en: string; note_ar: string }

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const len = (v: unknown, lo: number, hi: number) => { const n = [...txt(v)].length; return n >= lo && n <= hi; };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The host of an https URL (lower case), or '' (identical regex in SQL). */
export function hostOf(url: string): string {
  const m = /^https:\/\/([^/:?#]+)/i.exec(String(url ?? ''));
  return m ? m[1].toLowerCase() : '';
}
/** official: a UAE government domain (u.ae, wam.ae, *.gov.ae); intergovernmental: UN / OECD bodies; everything else secondary. */
export function sourceTier(url: string): SourceTier {
  const h = hostOf(url);
  if (/(^|\.)u\.ae$/.test(h) || /(^|\.)wam\.ae$/.test(h) || /(^|\.)gov\.ae$/.test(h)) return 'official';
  if (/(^|\.)(un\.org|unescwa\.org|oecd\.org|unesco\.org|ilo\.org)$/.test(h)) return 'intergovernmental';
  return 'secondary';
}
export interface SourceView { best_tier: SourceTier; primary: TagSource & { tier: SourceTier }; flagged: boolean; tiers: SourceTier[] }
/** The most official source first (ties keep the authored order); flagged when the best tier is not official or the scope is indirect. */
export function tagSourceView(sources: TagSource[], scope: string): SourceView | null {
  const list = (sources ?? []).map((s, i) => ({ ...s, tier: sourceTier(s.url), i }));
  if (!list.length) return null;
  const best = [...list].sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || a.i - b.i)[0];
  const { i: _i, ...primary } = best; void _i;
  return { best_tier: best.tier, primary, flagged: best.tier !== 'official' || scope === 'indirect', tiers: list.map((s) => s.tier) };
}

/** Proper names that contain digits (the Jahiz "10X Skills" group). */
export const NAMED_TOKENS = ['10X'];
/** Reports are filters over data: tag text may name years (2031, 2050, 2071) and proper names (10X) but never a typed number (no total,
 *  target or count). */
export function typedTotalFree(values: unknown[]): boolean {
  // explicit ASCII word boundaries, identical in SQL kafaa_na_typed_free (lookarounds on [A-Za-z0-9_])
  return values.every((v) => !/[0-9٠-٩]/.test(String(v ?? '').replace(/(?<![A-Za-z0-9_])10X(?![A-Za-z0-9_])/g, '').replace(/(?<![A-Za-z0-9_])(19|20)[0-9]{2}(?![A-Za-z0-9_])/g, '')));
}

export interface TagCtx { tags: Pick<TagRow, 'id' | 'strategy' | 'kind' | 'status' | 'future_group'>[]; today: string }
/** First problem of a tag save (null = ok). Codes: strategy, kind, parent, code, name, summary, clean, typed_total, sources, horizon, scope, status. */
export function tagProblem(p: TagInput, ctx: TagCtx): string | null {
  if (!(STRATEGIES as readonly string[]).includes(p?.strategy)) return 'strategy';
  if (!(TAG_KINDS as readonly string[]).includes(p?.kind)) return 'kind';
  const parentId = txt(p.parent_id) || null;
  if (p.kind === 'strategy') { if (parentId) return 'parent'; }
  else {
    const par = ctx.tags.find((t) => t.id === parentId);
    if (!par || par.kind !== 'strategy' || par.strategy !== p.strategy || par.status !== 'active' || par.id === p.id) return 'parent';
  }
  if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(String(p.code ?? ''))) return 'code';
  if (!len(p.name_en, 2, 120) || !len(p.name_ar, 2, 120)) return 'name';
  if (!len(p.summary_en, 20, 600) || !len(p.summary_ar, 20, 600)) return 'summary';
  const text = [p.name_en, p.name_ar, p.summary_en, p.summary_ar, p.owner_en ?? '', p.owner_ar ?? '', p.source_note_en ?? '', p.source_note_ar ?? ''];
  if (!publicTextIsClean(text)) return 'clean';
  if (!typedTotalFree(text)) return 'typed_total';
  const src = Array.isArray(p.sources) ? p.sources : [];
  if (src.length < 1 || src.length > 5 || !src.every((s) => s && len(s.label, 3, 200) && /^https:\/\/\S+$/.test(String(s.url ?? '')) && DATE.test(String(s.as_of ?? '')) && String(s.as_of) <= ctx.today)) return 'sources';
  if (p.horizon_year != null && !(Number.isInteger(p.horizon_year) && p.horizon_year >= 2022 && p.horizon_year <= 2100)) return 'horizon';
  if (!['direct', 'indirect'].includes(p.source_scope ?? 'direct')) return 'scope';
  if (!['active', 'retired'].includes(p.status ?? 'active')) return 'status';
  return null;
}

export interface TargetInfo { exists: boolean; area?: string | null }
/** First problem of a link save (null = ok). Codes: tag, table, target, derived, security, note, clean, typed_total. */
export function linkProblem(p: LinkInput, tag: Pick<TagRow, 'status' | 'derive'> | undefined, target: TargetInfo): string | null {
  if (!tag || tag.status !== 'active') return 'tag';
  const tt = TARGET_TABLES[p?.target_table];
  if (!tt) return 'table';
  if (!target.exists) return 'target';
  if ((tag.derive === 'future_group' && p.target_table === 'skills') || (tag.derive === 'cec_net_zero' && p.target_table === 'cec_competences')) return 'derived';
  if (p.target_table === 'skills' && target.area === 'security') return 'security';
  if (p.active && (!len(p.note_en, 10, 300) || !len(p.note_ar, 10, 300))) return 'note';
  if (!publicTextIsClean([p.note_en, p.note_ar])) return 'clean';
  if (!typedTotalFree([p.note_en, p.note_ar])) return 'typed_total';
  return null;
}

// ───────────── the data world the report filters
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface NaWorld {
  tags: TagRow[]; links: LinkRow[];
  skills: Row[]; cec_competences: Row[]; programmes: Row[]; pathways: Row[]; microcred_defs: Row[]; talent_programmes: Row[]; leadership_programmes: Row[];
  critical_skills: Row[]; ai_org_targets: Row[]; cec_role_targets: Row[]; job_families: Row[];
  people: Row[]; person_skills: Row[]; courses: Row[]; enrolments: Row[]; training_records: Row[]; pathway_enrolments: Row[]; microcred_awards: Row[];
  applications: Row[]; leadership_nominations: Row[]; ai_rungs: Row[]; ai_skill_tracks: Row[];
  wallet_targets: Row[]; core_skills: Row[]; // FS74 (fsHe2)
}
export const WORLD_TABLES = ['national_tags', 'tag_links', 'skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes',
  'critical_skills', 'ai_org_targets', 'cec_role_targets', 'job_families', 'people', 'person_skills', 'courses', 'enrolments', 'training_records', 'pathway_enrolments',
  'microcred_awards', 'applications', 'leadership_nominations', 'ai_rungs', 'ai_skill_tracks', 'wallet_targets', 'core_skills'] as const;
export function worldFrom(raw: (t: string) => Row[]): NaWorld {
  const w = Object.fromEntries(WORLD_TABLES.map((t) => [t, raw(t) ?? []])) as Row;
  return { ...w, tags: w.national_tags, links: w.tag_links } as NaWorld;
}

export type LinkBasis = 'curated' | 'future_group' | 'net_zero';
export interface EffLink { tag_id: string; target_table: string; target_id: string; basis: LinkBasis; link_id: string | null; note_en: string | null; note_ar: string | null }
const BASIS_ORDER: Record<LinkBasis, number> = { curated: 0, future_group: 1, net_zero: 2 };

/** Curated links (active, on active tags) plus links derived from data; one row per tag, table and target (curated first). */
export function effectiveLinks(w: Pick<NaWorld, 'tags' | 'links' | 'skills' | 'cec_competences'>): EffLink[] {
  const active = new Map(w.tags.filter((t) => t.status === 'active').map((t) => [t.id, t]));
  const out: EffLink[] = [];
  for (const l of w.links) if (l.active && active.has(l.tag_id) && TARGET_TABLES[l.target_table]) out.push({ tag_id: l.tag_id, target_table: l.target_table, target_id: l.target_id, basis: 'curated', link_id: l.id, note_en: l.note_en, note_ar: l.note_ar });
  for (const t of active.values()) {
    if (t.derive === 'future_group' && t.future_group) {
      for (const s of w.skills) if (s.future_group === t.future_group && s.lifecycle !== 'obsolete') out.push({ tag_id: t.id, target_table: 'skills', target_id: s.id, basis: 'future_group', link_id: null, note_en: null, note_ar: null });
    } else if (t.derive === 'cec_net_zero') {
      for (const c of w.cec_competences) if (c.net_zero && (c.status ?? 'active') === 'active') out.push({ tag_id: t.id, target_table: 'cec_competences', target_id: c.id, basis: 'net_zero', link_id: null, note_en: null, note_ar: null });
    }
  }
  const seen = new Set<string>();
  return out.sort((a, b) => cmp(a.tag_id, b.tag_id) || TABLE_ORDER.indexOf(a.target_table) - TABLE_ORDER.indexOf(b.target_table) || cmp(a.target_id, b.target_id) || BASIS_ORDER[a.basis] - BASIS_ORDER[b.basis])
    .filter((l) => { const k = `${l.tag_id}|${l.target_table}|${l.target_id}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export interface Measure { kind: MeasureKind; n: number | null; base: number | null; pct: number | null; target: number | null; due_on: string | null }
export interface ReportItem {
  tag_id: string; strategy: string; target_table: string; kind: ItemKind; target_id: string; basis: LinkBasis; link_id: string | null;
  title_en: string; title_ar: string; status: 'active' | 'inactive' | 'missing'; note_en: string | null; note_ar: string | null; measure: Measure | null; reasons: Reason[];
}
export interface TagSummary { tag_id: string; strategy: string; parent_id: string | null; kind: string; skills: number; programmes: number; targets: number; reach: number | null }
export interface ReportFilter { strategy?: string | null; tag_id?: string | null; kind?: string | null }
export interface NationalReport { filter: { strategy: string | null; tag_id: string | null; kind: string | null }; measures: boolean; tags: TagSummary[]; items: ReportItem[] }

/** One-decimal percentage a / b, half up, in integers (identical in SQL kafaa_na_pct1). */
export const pct1 = (a: number, b: number) => Math.floor((2000 * a + b) / (2 * b)) / 10;
const sup = (n: number) => (n >= MIN_GROUP ? n : null);

/** Lookups built once per report: active staff, counted states by skill, the measure inputs. */
function index(w: NaWorld) {
  const staff = new Map(w.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => [p.id, p]));
  const counted = new Map<string, Row[]>(); // person -> counted states (level >= 1)
  const holdersBySkill = new Map<string, Set<string>>(); const levelOf = new Map<string, number>();
  for (const s of w.person_skills) {
    if (!s.active || !staff.has(s.person_id) || !COUNTED.includes(s.basis) || Number(s.level) < 1) continue;
    (counted.get(s.person_id) ?? counted.set(s.person_id, []).get(s.person_id)!).push(s);
    (holdersBySkill.get(s.skill_id) ?? holdersBySkill.set(s.skill_id, new Set()).get(s.skill_id)!).add(s.person_id);
    levelOf.set(`${s.person_id}|${s.skill_id}`, Math.max(levelOf.get(`${s.person_id}|${s.skill_id}`) ?? 0, Number(s.level)));
  }
  return { staff, counted, holdersBySkill, levelOf };
}
type Ix = ReturnType<typeof index>;

/** The title and live status of a linked row (identical CASE in SQL kafaa_na_target). */
export function targetView(w: NaWorld, table: string, id: string): { exists: boolean; title_en: string; title_ar: string; active: boolean; area: string | null } {
  const none = { exists: false, title_en: id, title_ar: id, active: false, area: null };
  const find = (rows: Row[]) => rows.find((r) => r.id === id);
  switch (table) {
    case 'skills': { const r = find(w.skills); return r ? { exists: true, title_en: r.name_en, title_ar: r.name_ar, active: r.lifecycle !== 'obsolete', area: r.area ?? null } : none; }
    case 'cec_competences': { const r = find(w.cec_competences); return r ? { exists: true, title_en: `${r.code} ${r.name_en}`, title_ar: `${r.code} ${r.name_ar}`, active: (r.status ?? 'active') === 'active', area: null } : none; }
    case 'programmes': { const r = find(w.programmes); return r ? { exists: true, title_en: r.name_en, title_ar: r.name_ar, active: true, area: null } : none; }
    case 'pathways': { const r = find(w.pathways); return r ? { exists: true, title_en: r.title_en, title_ar: r.title_ar, active: r.status === 'published', area: null } : none; }
    case 'microcred_defs': { const r = find(w.microcred_defs); return r ? { exists: true, title_en: `${r.code} ${r.title_en}`, title_ar: `${r.code} ${r.title_ar}`, active: r.status === 'current', area: null } : none; }
    case 'talent_programmes': { const r = find(w.talent_programmes); return r ? { exists: true, title_en: r.name_en, title_ar: r.name_ar, active: true, area: null } : none; }
    case 'leadership_programmes': { const r = find(w.leadership_programmes); return r ? { exists: true, title_en: r.title_en, title_ar: r.title_ar, active: true, area: null } : none; }
    case 'critical_skills': {
      const r = find(w.critical_skills); if (!r) return none;
      const s = w.skills.find((x) => x.id === r.skill_id);
      return { exists: true, title_en: `Critical skill: ${s?.name_en ?? r.skill_id}`, title_ar: `مهارة حرجة: ${s?.name_ar ?? r.skill_id}`, active: r.status === 'active', area: null };
    }
    case 'ai_org_targets': {
      const r = find(w.ai_org_targets); if (!r) return none;
      return r.metric === 'practitioner_or_above'
        ? { exists: true, title_en: 'AI fluency target: Practitioner or above', title_ar: 'هدف الطلاقة في الذكاء الاصطناعي: ممارِس أو أعلى', active: true, area: null }
        : { exists: true, title_en: 'AI fluency target: above basic', title_ar: 'هدف الطلاقة في الذكاء الاصطناعي: فوق المستوى الأساسي', active: true, area: null };
    }
    case 'cec_role_targets': {
      const r = find(w.cec_role_targets); if (!r) return none;
      const f = w.job_families.find((x) => x.id === r.family_id);
      return { exists: true, title_en: `CleanEnergyComp target: ${f?.name_en ?? r.family_id}`, title_ar: `هدف كفاءات الطاقة النظيفة: ${f?.name_ar ?? r.family_id}`, active: true, area: null };
    }
    case 'wallet_targets': { // FS74 (fsHe2)
      const r = find(w.wallet_targets ?? []); if (!r) return none;
      return { exists: true, title_en: 'Future Skills Wallet target: the core five', title_ar: 'هدف محفظة مهارات المستقبل: المهارات الخمس الأساسية', active: r.status === 'active', area: null };
    }
    default: return none;
  }
}

/** The live measure of one linked row (active staff only, except applicants); every count under 10 suppressed (identical in SQL kafaa_na_measure). */
export function measureOf(w: NaWorld, ix: Ix, table: string, id: string): Measure | null {
  const kind = TARGET_TABLES[table]?.measure; if (!kind) return null;
  const m = (n: number, extra: Partial<Measure> = {}): Measure => ({ kind, n: sup(n), base: null, pct: null, target: null, due_on: null, ...extra });
  const holdersOf = (skillIds: string[]) => { const s = new Set<string>(); for (const k of skillIds) for (const p of ix.holdersBySkill.get(k) ?? []) s.add(p); return s.size; };
  switch (table) {
    case 'skills': return m(holdersOf([id]));
    case 'cec_competences': { const c = w.cec_competences.find((x) => x.id === id); return m(c ? holdersOf(c.skill_ids ?? []) : 0); }
    case 'programmes': {
      const courses = new Set(w.courses.filter((c) => c.programme_id === id).map((c) => c.id));
      const s = new Set<string>();
      for (const e of w.enrolments) if (e.status === 'completed' && courses.has(e.course_id) && ix.staff.has(e.person_id)) s.add(e.person_id);
      for (const r of w.training_records) if (r.result === 'passed' && courses.has(r.course_id) && ix.staff.has(r.person_id)) s.add(r.person_id);
      return m(s.size);
    }
    case 'pathways': return m(new Set(w.pathway_enrolments.filter((e) => e.pathway_id === id && ['active', 'completed'].includes(e.status) && ix.staff.has(e.person_id)).map((e) => e.person_id)).size);
    case 'microcred_defs': {
      const d = w.microcred_defs.find((x) => x.id === id);
      return m(d ? new Set(w.microcred_awards.filter((a) => a.def_code === d.code && a.status === 'awarded' && ix.staff.has(a.person_id)).map((a) => a.person_id)).size : 0);
    }
    case 'talent_programmes': return m(new Set(w.applications.filter((a) => a.programme_id === id).map((a) => a.person_id)).size);
    case 'leadership_programmes': return m(new Set(w.leadership_nominations.filter((n) => n.programme_id === id && ['approved', 'completed'].includes(n.status) && ix.staff.has(n.person_id)).map((n) => n.person_id)).size);
    case 'critical_skills': {
      const c = w.critical_skills.find((x) => x.id === id); if (!c) return m(0);
      let n = 0; for (const p of ix.holdersBySkill.get(c.skill_id) ?? []) if ((ix.levelOf.get(`${p}|${c.skill_id}`) ?? 0) >= Number(c.target_level)) n++;
      return m(n, { target: Number(c.target_level) });
    }
    case 'ai_org_targets': {
      const o = w.ai_org_targets.find((x) => x.id === id); if (!o) return m(0);
      const base = ix.staff.size;
      let n = 0;
      for (const pid of ix.staff.keys()) {
        const states = w.person_skills.filter((s) => s.person_id === pid && s.active).map((s) => ({ skill_id: s.skill_id, level: Number(s.level), active: s.active, basis: s.basis }));
        if (aiRung(pid, w.ai_rungs as never, w.ai_skill_tracks as never, states).rung >= 2) n++;
      }
      return { kind, n: base >= MIN_GROUP ? sup(n) : null, base: sup(base), pct: base >= MIN_GROUP && n >= MIN_GROUP ? pct1(n, base) : null, target: Number(o.pct), due_on: String(o.due_on).slice(0, 10) };
    }
    case 'cec_role_targets': {
      const t = w.cec_role_targets.find((x) => x.id === id); if (!t) return m(0);
      const fam = [...ix.staff.values()].filter((p) => p.job_family_id === t.family_id);
      if (NO_BREAKOUT.includes(t.family_id)) return { kind, n: null, base: null, pct: null, target: Number(t.level), due_on: null };
      let n = 0;
      for (const p of fam) if (cecLevel(w.cec_competences as never, w.person_skills.filter((s) => s.person_id === p.id && s.active) as never) >= Number(t.level)) n++;
      return { kind, n: fam.length >= MIN_GROUP ? sup(n) : null, base: sup(fam.length), pct: fam.length >= MIN_GROUP && n >= MIN_GROUP ? pct1(n, fam.length) : null, target: Number(t.level), due_on: null };
    }
    case 'wallet_targets': { // FS74 (fsHe2): active staff with a complete core-five wallet against the leadership target
      const t = (w.wallet_targets ?? []).find((x) => x.id === id); if (!t) return m(0);
      const ww = walletWorld((name) => (w as unknown as Record<string, Row[]>)[name] ?? []);
      const today = new Date().toISOString().slice(0, 10);
      const base = ix.staff.size;
      let n = 0;
      for (const pid of ix.staff.keys()) if (walletStatus(pid, ww.inputsFor(pid), today).complete) n++;
      return { kind, n: base >= MIN_GROUP ? sup(n) : null, base: sup(base), pct: base >= MIN_GROUP && n >= MIN_GROUP ? pct1(n, base) : null, target: Number(t.pct), due_on: String(t.due_on).slice(0, 10) };
    }
    default: return null;
  }
}

/** The reasons behind a link: curated (with the tag name) or derived from data, and a note when the linked row is no longer active. */
export function linkReasons(l: EffLink, tag: TagRow, status: string): Reason[] {
  const r: Reason[] = l.basis === 'curated'
    ? [{ code: 'na_curated', key: 'm37.reason.curated', vars: { tag: { en: tag.name_en, ar: tag.name_ar } }, ref: { table: 'tag_links', id: l.link_id ?? '' } }]
    : l.basis === 'future_group'
      ? [{ code: 'na_future_group', key: 'm37.reason.futureGroup', vars: { group: JAHIZ_GROUP_NAME[tag.future_group ?? ''] ?? { en: tag.future_group ?? '', ar: tag.future_group ?? '' } }, ref: { table: 'skills', id: l.target_id } }]
      : [{ code: 'na_net_zero', key: 'm37.reason.netZero', ref: { table: 'cec_competences', id: l.target_id } }];
  if (status === 'inactive') r.push({ code: 'na_inactive', key: 'm37.reason.inactive' });
  if (status === 'missing') r.push({ code: 'na_missing', key: 'm37.reason.missing' });
  return r;
}

export function normalizeFilter(f: ReportFilter | null | undefined, tags: TagRow[]): NationalReport['filter'] {
  const strategy = typeof f?.strategy === 'string' && (STRATEGIES as readonly string[]).includes(f.strategy) ? f.strategy : null;
  const tag = typeof f?.tag_id === 'string' ? tags.find((t) => t.id === f.tag_id) : undefined;
  const kind = typeof f?.kind === 'string' && (ITEM_KINDS as readonly string[]).includes(f.kind) ? f.kind : null;
  return { strategy: tag ? tag.strategy : strategy, tag_id: tag ? tag.id : null, kind };
}

const tagOrder = (tags: TagRow[]) => {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const key = (t: TagRow): [number, number, number, string] => {
    const root = t.parent_id ? byId.get(t.parent_id) ?? t : t;
    return [STRATEGIES.indexOf(t.strategy as Strategy), Number(root.sort), t.parent_id ? Number(t.sort) : -1, t.id];
  };
  return (a: TagRow, b: TagRow) => { const x = key(a); const y = key(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || cmp(x[3], y[3]); };
};

/** The filtered report: every tag in scope (all tags, one strategy, or one tag and its children) with item counts and, when measures
 *  are visible, the people reached (distinct active staff with counted evidence on a linked skill or competence, suppressed under 10);
 *  the items of the scope (optionally one kind) with title, live status, measure and reasons. Retired tags are left out. */
export function nationalReport(w: NaWorld, f: ReportFilter | null | undefined, measures: boolean): NationalReport {
  const filter = normalizeFilter(f, w.tags);
  const tags = w.tags.filter((t) => t.status === 'active').sort(tagOrder(w.tags));
  const byId = new Map(tags.map((t) => [t.id, t]));
  const eff = effectiveLinks(w);
  const ix = index(w);
  const inScope = (t: TagRow) => (filter.tag_id ? t.id === filter.tag_id || t.parent_id === filter.tag_id : filter.strategy ? t.strategy === filter.strategy : true);
  const scopeTags = tags.filter(inScope);
  const linksOf = (t: TagRow) => eff.filter((l) => l.tag_id === t.id || (t.kind === 'strategy' && byId.get(l.tag_id)?.parent_id === t.id));
  const summaries: TagSummary[] = scopeTags.map((t) => {
    const ls = linksOf(t);
    const uniq = new Map(ls.map((l) => [`${l.target_table}|${l.target_id}`, l]));
    const n = (k: ItemKind) => [...uniq.values()].filter((l) => TARGET_TABLES[l.target_table].kind === k).length;
    let reach: number | null = null;
    if (measures) {
      const skillIds = new Set<string>();
      for (const l of uniq.values()) {
        if (l.target_table === 'skills') skillIds.add(l.target_id);
        if (l.target_table === 'cec_competences') for (const s of w.cec_competences.find((c) => c.id === l.target_id)?.skill_ids ?? []) skillIds.add(s);
      }
      const people = new Set<string>(); for (const s of skillIds) for (const p of ix.holdersBySkill.get(s) ?? []) people.add(p);
      reach = sup(people.size);
    }
    return { tag_id: t.id, strategy: t.strategy, parent_id: t.parent_id, kind: t.kind, skills: n('skill'), programmes: n('programme'), targets: n('target'), reach };
  });
  const order = new Map(tags.map((t, i) => [t.id, i]));
  const items: ReportItem[] = eff.filter((l) => { const t = byId.get(l.tag_id); return !!t && inScope(t) && (!filter.kind || TARGET_TABLES[l.target_table].kind === filter.kind); })
    .sort((a, b) => (order.get(a.tag_id)! - order.get(b.tag_id)!) || ITEM_KINDS.indexOf(TARGET_TABLES[a.target_table].kind) - ITEM_KINDS.indexOf(TARGET_TABLES[b.target_table].kind)
      || TABLE_ORDER.indexOf(a.target_table) - TABLE_ORDER.indexOf(b.target_table) || cmp(a.target_id, b.target_id))
    .map((l) => {
      const t = byId.get(l.tag_id)!;
      const v = targetView(w, l.target_table, l.target_id);
      const status = !v.exists ? 'missing' : v.active ? 'active' : 'inactive';
      return {
        tag_id: l.tag_id, strategy: t.strategy, target_table: l.target_table, kind: TARGET_TABLES[l.target_table].kind, target_id: l.target_id, basis: l.basis, link_id: l.link_id,
        title_en: v.title_en, title_ar: v.title_ar, status, note_en: l.note_en, note_ar: l.note_ar,
        measure: measures && v.exists ? measureOf(w, ix, l.target_table, l.target_id) : null, reasons: linkReasons(l, t, status),
      };
    });
  return { filter, measures, tags: summaries, items };
}

/** CSV of a report (one row per item; measures only when the report carries them); the header states what the export is and is not. */
export function reportCsv(r: NationalReport, lang: 'en' | 'ar', tagName: (id: string) => string): string {
  const q = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ['strategy', 'tag', 'kind', 'table', 'id', 'title', 'basis', 'status', ...(r.measures ? ['measure', 'n', 'base', 'pct', 'target'] : [])];
  const rows = r.items.map((i) => [i.strategy, tagName(i.tag_id), i.kind, i.target_table, i.target_id, lang === 'ar' ? i.title_ar : i.title_en, i.basis, i.status,
    ...(r.measures ? [i.measure?.kind ?? '', i.measure?.n ?? 'suppressed', i.measure?.base ?? '', i.measure?.pct ?? '', i.measure?.target ?? ''] : [])]);
  return [head, ...rows].map((x) => x.map(q).join(',')).join('\n');
}
