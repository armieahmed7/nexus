// FS38 SMR delta overlay for every Barakah role: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder and (mirrored
// in SQL) supabase/migrations/20261010251001_kafaa_fs51_next_gen.sql (kafaa_smr_needs, kafaa_smr_readiness, kafaa_smr_matrix_core,
// kafaa_smr_problem). Import-free apart from types (node scripts import it directly).
//
// Benchmarks: SMR-WF (an SMR delta per existing role, the Canadian BWRX-300 build and NuScale E2), IAEA-WFP (NG-T-3.10: assess capability,
// identify competence gaps, plan how to fill them).
//
//  - A delta row = one current Barakah role x one ADVANCE technology family (kafaa_adv_technologies). It lists what changes along up to
//    seven dimensions (multi-module operation, passive safety, digital I&C, factory fabrication, maintenance regime, plant systems,
//    project delivery), each `adapts` or `new`, what stays the same, the skills the delta asks for and links to existing delta training
//    (FS31 micro-credentials, FS19 courses, FS17 pathways, FS14 horizon lanes). Planning assumption: no deployment decision implied.
//  - deltaFor(delta, profile2035, states) adds the role's FS05 2035 profile: its skill requirements driven by `smr_design` join the
//    delta's skills (the higher level wins), then compares them with the person's current levels: readiness = round(100 x sum(min(have,
//    need)) / sum(need)). Change size = sum over the dimensions (adapts 1, new 2), banded small (<= 3), moderate (<= 6), large.
//  - Security, safeguards and cyber roles stay at career-path level (path_only): no dimensions beyond awareness, no skills, no readiness.
//  - matrixStats(): the HR view of readiness per technology and job family, cells under MIN_GROUP_SIZE suppressed.
import type { Reason } from '../../domain/engines/types';

export const DIMENSIONS = ['multi_module', 'passive_safety', 'digital_ic', 'factory_fab', 'maintenance', 'systems', 'delivery'] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export const CHANGES = ['adapts', 'new'] as const;
export const DELTA_STATUSES = ['draft', 'published', 'retired'] as const;
export const TRAINING_KINDS = ['microcred', 'course', 'pathway', 'lane'] as const;
export const PATH_ONLY_FAMILIES = ['security', 'safeguards', 'cyber'];
/** FS05 2035 profile drivers that belong to the SMR delta. */
export const SMR_DRIVERS = ['smr_design'];
/** A person counts as "delta-ready" for a technology at this readiness or above (HR view). */
export const READY_PCT = 50;
export const MIN_SOURCES = 2;

export interface DeltaDim { dim: string; change: string; text_en: string; text_ar: string }
export interface DeltaSkill { skill_id: string; level: number }
export interface DeltaTraining { kind: string; ref: string }
export interface SourceRef { id?: string; label: string; url: string; as_of?: string }
export interface DeltaRow {
  id: string; role_id: string; tech_id: string; rank: number; path_only: boolean; dims: DeltaDim[]; skills: DeltaSkill[]; training: DeltaTraining[];
  status?: string; concept_role_ids?: string[];
}
export interface ProfileReq { kind: string; ref_id: string; level: number; driver?: string | null }
export interface StateLite { skill_id: string; level: number; active?: boolean }

export interface Need { skill_id: string; need: number; have: number; gap: number; source: 'delta' | 'profile' | 'both' }
export interface DeltaView {
  delta_id: string;
  role_id: string;
  tech_id: string;
  path_only: boolean;
  change_size: number;
  band: 'small' | 'moderate' | 'large';
  dims: { dim: string; change: 'same' | 'adapts' | 'new' }[];
  needs: Need[];
  readiness: number | null;
  met: number;
  total: number;
  training: { kind: string; ref: string; closes: string[] }[];
  reasons: Reason[];
}

const W: Record<string, number> = { adapts: 1, new: 2 };
/** Change size of a delta: adapts 1, new 2 per dimension (first entry per dimension counts). */
export function changeSize(dims: DeltaDim[]): number {
  const seen = new Set<string>();
  let n = 0;
  for (const d of dims ?? []) { if (!d || seen.has(d.dim) || !(DIMENSIONS as readonly string[]).includes(d.dim)) continue; seen.add(d.dim); n += W[d.change] ?? 0; }
  return n;
}
export const sizeBand = (n: number): 'small' | 'moderate' | 'large' => (n <= 3 ? 'small' : n <= 6 ? 'moderate' : 'large');

/** The skills a delta asks for: the delta's own skills (in order) then the 2035 profile's smr_design skills (by id); the higher level wins. */
export function needsFor(delta: Pick<DeltaRow, 'skills' | 'path_only'>, profile: ProfileReq[] | null | undefined): { skill_id: string; need: number; source: 'delta' | 'profile' | 'both' }[] {
  if (delta.path_only) return [];
  const out: { skill_id: string; need: number; source: 'delta' | 'profile' | 'both' }[] = [];
  for (const s of delta.skills ?? []) {
    if (!s || out.some((o) => o.skill_id === s.skill_id)) continue;
    out.push({ skill_id: s.skill_id, need: Math.min(3, Math.max(1, Math.floor(Number(s.level)))), source: 'delta' });
  }
  const prof = (profile ?? []).filter((r) => r.kind === 'skill' && SMR_DRIVERS.includes(r.driver ?? '')).sort((a, b) => (a.ref_id < b.ref_id ? -1 : a.ref_id > b.ref_id ? 1 : 0));
  for (const r of prof) {
    const lvl = Math.min(4, Math.max(1, Math.floor(Number(r.level))));
    const cur = out.find((o) => o.skill_id === r.ref_id);
    if (cur) { cur.need = Math.max(cur.need, lvl); if (cur.source === 'delta') cur.source = 'both'; continue; }
    out.push({ skill_id: r.ref_id, need: lvl, source: 'profile' });
  }
  return out;
}

/** Readiness against a set of needs (mirror of SQL kafaa_smr_readiness): round half up of 100 x sum(min(have, need)) / sum(need). */
export function readinessOf(needs: { skill_id: string; need: number }[], states: StateLite[]): { pct: number | null; met: number; total: number; have: Map<string, number> } {
  const have = new Map<string, number>();
  for (const s of states ?? []) if (s && s.active !== false) have.set(s.skill_id, Math.max(have.get(s.skill_id) ?? 0, Number(s.level) || 0));
  let num = 0;
  let den = 0;
  let met = 0;
  for (const n of needs) { const h = have.get(n.skill_id) ?? 0; num += Math.min(h, n.need); den += n.need; if (h >= n.need) met++; }
  return { pct: den > 0 ? Math.floor((200 * num + den) / (2 * den)) : null, met, total: needs.length, have };
}

/** The personal view of one delta: dimensions in fixed order, needs with my levels, readiness, training that closes my gaps, reasons. */
export function deltaFor(delta: DeltaRow, profile: ProfileReq[] | null | undefined, states: StateLite[], trainingSkills: Record<string, string[]> = {}): DeltaView {
  const dims = DIMENSIONS.map((d) => { const x = (delta.dims ?? []).find((y) => y && y.dim === d); return { dim: d, change: (x && (CHANGES as readonly string[]).includes(x.change) ? x.change : 'same') as 'same' | 'adapts' | 'new' }; });
  const size = changeSize(delta.dims ?? []);
  const band = sizeBand(size);
  const base = needsFor(delta, profile);
  const r = readinessOf(base, states);
  const needs: Need[] = base.map((n) => { const h = r.have.get(n.skill_id) ?? 0; return { skill_id: n.skill_id, need: n.need, have: h, gap: Math.max(0, n.need - h), source: n.source }; });
  const gaps = new Set(needs.filter((n) => n.gap > 0).map((n) => n.skill_id));
  const training = (delta.training ?? []).map((t) => ({ kind: t.kind, ref: t.ref, closes: (trainingSkills[`${t.kind}:${t.ref}`] ?? []).filter((s) => gaps.has(s)) }));
  const nNew = dims.filter((d) => d.change === 'new').length;
  const nAdapts = dims.filter((d) => d.change === 'adapts').length;
  const reasons: Reason[] = [
    { code: 'fs38_change', key: `m31.ng.reason.change.${band}`, vars: { n: size } },
    { code: 'fs38_dims', key: 'm31.ng.reason.dims', vars: { new: nNew, adapts: nAdapts, same: DIMENSIONS.length - nNew - nAdapts } },
  ];
  if (delta.path_only) reasons.push({ code: 'fs38_path_only', key: 'm31.ng.reason.pathOnly' });
  else {
    const fromProfile = needs.filter((n) => n.source !== 'delta').length;
    reasons.push({ code: 'fs38_profile', key: 'm31.ng.reason.profile', vars: { n: fromProfile } });
    reasons.push({ code: 'fs38_gap', key: 'm31.ng.reason.gap', vars: { gaps: gaps.size, total: needs.length } });
    if (r.pct !== null) reasons.push({ code: 'fs38_ready', key: 'm31.ng.reason.ready', vars: { pct: r.pct, met: r.met, total: r.total } });
  }
  return { delta_id: delta.id, role_id: delta.role_id, tech_id: delta.tech_id, path_only: !!delta.path_only, change_size: size, band, dims, needs, readiness: delta.path_only ? null : r.pct,
    met: r.met, total: r.total, training, reasons };
}

// ───────────── Checks for an edit (mirror of SQL kafaa_smr_problem)
/** Headcount and site wording (M11 publicTextIsClean) plus deployment claims in English and Arabic: the same patterns as
 *  src/modules/m01/roleProfiles.ts (profileTextIsClean, SQL kafaa_rpv_text_clean). Copied because rule files stay import-free; a unit
 *  test keeps them equal. The disclaimer "no deployment decision implied" is allowed. */
export const HEADCOUNT_OR_SITE = /\b(headcount|fte|full[- ]time equivalents?|[0-9]+\s*(staff|people|jobs|positions|operators|engineers|workers)|site (selection|identified|chosen)|candidate site|located at|to be built (at|in))\b/i;
export const DEPLOYMENT_CLAIM = /\b(will be deployed|to be deployed|decided to deploy|deployment (has been|is|was) (approved|decided|confirmed|planned)|construction (will|is planned to) (start|begin)|units? will be built)\b/i;
export const AR_UNCLEAN = /(عدد الموظفين|عدد العاملين|اختيار الموقع|الموقع المختار|سيتم نشر|تقرر نشر|تمت الموافقة على النشر|سيتم بناء|سيُبنى|سيبنى|[0-9]+\s*(موظف|موظفين|مشغل|مشغلين|مهندس|مهندسين|وظيفة|وظائف))/;
export function textIsClean(values: unknown[]): boolean {
  return values.every((v) => {
    const s = typeof v === 'string' ? v : v && typeof v === 'object' ? JSON.stringify(v) : '';
    return !HEADCOUNT_OR_SITE.test(s) && !DEPLOYMENT_CLAIM.test(s) && !AR_UNCLEAN.test(s);
  });
}

export interface DeltaInput {
  role_id: string; tech_id: string; rank: number; status: string; dims: DeltaDim[]; changes_en: string; changes_ar: string; stays_en: string; stays_ar: string;
  skills: DeltaSkill[]; training: DeltaTraining[]; sources: SourceRef[]; path_only?: boolean;
}
export interface DeltaCtx {
  /** job family of the role (the RPC refuses unknown or concept roles before calling this) */
  family: string | null;
  /** skill id -> { area, lifecycle } for the catalogue */
  skills: Record<string, { area: string | null; lifecycle: string | null }>;
  refs: { microcred: string[]; course: string[]; pathway: string[]; lane: string[] };
}
const str = (x: unknown, max: number) => typeof x === 'string' && x.trim().length > 0 && x.trim().length <= max;
/** First problem code of an edited delta, or null: rank, status, security (path-only rule), dims, texts, skills, training, sources, unclean. */
export function deltaProblem(d: DeltaInput, ctx: DeltaCtx): string | null {
  if (!d || !Number.isInteger(d.rank) || d.rank < 1 || d.rank > 6) return 'rank';
  if (!(DELTA_STATUSES as readonly string[]).includes(d.status)) return 'status';
  const pathOnly = PATH_ONLY_FAMILIES.includes(ctx.family ?? '');
  if (!!d.path_only !== pathOnly) return 'security';
  if (!Array.isArray(d.dims) || d.dims.length > DIMENSIONS.length || (!pathOnly && d.dims.length < 1)
    || d.dims.some((x) => !x || !(DIMENSIONS as readonly string[]).includes(x.dim) || !(CHANGES as readonly string[]).includes(x.change) || !str(x.text_en, 400) || !str(x.text_ar, 400))
    || new Set(d.dims.map((x) => x.dim)).size !== d.dims.length) return 'dims';
  if (!str(d.changes_en, 600) || !str(d.changes_ar, 600) || !str(d.stays_en, 600) || !str(d.stays_ar, 600)) return 'texts';
  if (!Array.isArray(d.skills) || d.skills.length > 8) return 'skills';
  if (pathOnly && d.skills.length > 0) return 'security';
  for (const s of d.skills) {
    const k = s && typeof s.skill_id === 'string' ? ctx.skills[s.skill_id] : undefined;
    if (!k || !Number.isInteger(s.level) || s.level < 1 || s.level > 3 || k.lifecycle === 'obsolete') return 'skills';
    if (k.area === 'security') return 'security';
  }
  if (new Set(d.skills.map((s) => s.skill_id)).size !== d.skills.length) return 'skills';
  if (!Array.isArray(d.training) || d.training.length > 8
    || d.training.some((t) => !t || !(TRAINING_KINDS as readonly string[]).includes(t.kind) || typeof t.ref !== 'string' || !(ctx.refs[t.kind as keyof DeltaCtx['refs']] ?? []).includes(t.ref))
    || new Set(d.training.map((t) => `${t.kind}:${t.ref}`)).size !== d.training.length) return 'training';
  if (!Array.isArray(d.sources) || d.sources.length > 6 || d.sources.some((s) => !s || !str(s.label, 200) || typeof s.url !== 'string' || !/^https:\/\/\S+$/.test(s.url))
    || (d.status === 'published' && d.sources.length < MIN_SOURCES)) return 'sources';
  if (!textIsClean([d.changes_en, d.changes_ar, d.stays_en, d.stays_ar, ...d.dims.flatMap((x) => [x.text_en, x.text_ar])])) return 'unclean';
  return null;
}

// ───────────── HR view (mirror of SQL kafaa_smr_matrix_core)
export interface PersonLite { id: string; job_role_id: string | null; job_family_id: string | null; kind: string; status: string }
export interface MatrixStats {
  people: number | null;
  techs: { tech_id: string; deltas: number; n: number | null; ready: number | null; ready_pct: number | null; avg_pct: number | null }[];
  families: { family_id: string; tech_id: string; n: number | null; ready_pct: number | null }[];
}
/** Readiness per technology and per job family x technology over active staff whose role has a published, non-path-only delta. */
export function matrixStats(deltas: DeltaRow[], people: PersonLite[], states: Map<string, StateLite[]>, profiles: Map<string, ProfileReq[]>, techIds: string[], minGroup: number): MatrixStats {
  const pub = deltas.filter((d) => d.status === 'published' && !d.path_only);
  const staff = people.filter((p) => p.kind === 'staff' && p.status === 'active' && p.job_role_id).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rows: { person: string; family: string; tech: string; pct: number }[] = [];
  for (const p of staff) {
    for (const d of pub.filter((x) => x.role_id === p.job_role_id)) {
      const r = readinessOf(needsFor(d, profiles.get(d.role_id)), states.get(p.id) ?? []);
      if (r.pct !== null) rows.push({ person: p.id, family: p.job_family_id ?? '', tech: d.tech_id, pct: r.pct });
    }
  }
  const r1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;
  const people_n = new Set(rows.map((r) => r.person)).size;
  const techs = [...techIds].sort().map((t) => {
    const g = rows.filter((r) => r.tech === t);
    const big = g.length >= minGroup;
    const ready = g.filter((r) => r.pct >= READY_PCT).length;
    return { tech_id: t, deltas: pub.filter((d) => d.tech_id === t).length, n: big ? g.length : null, ready: big ? ready : null,
      ready_pct: big ? r1((100 * ready) / g.length) : null, avg_pct: big ? r1(g.reduce((m, r) => m + r.pct, 0) / g.length) : null };
  });
  const keys = [...new Set(rows.map((r) => `${r.family}|${r.tech}`))].sort();
  const families = keys.map((k) => {
    const [f, t] = k.split('|');
    const g = rows.filter((r) => r.family === f && r.tech === t);
    const big = g.length >= minGroup;
    return { family_id: f, tech_id: t, n: big ? g.length : null, ready_pct: big ? r1((100 * g.filter((r) => r.pct >= READY_PCT).length) / g.length) : null };
  });
  return { people: people_n >= minGroup ? people_n : null, techs, families };
}
