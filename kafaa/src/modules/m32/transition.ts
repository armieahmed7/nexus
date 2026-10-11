// FS42 Energy-system integration pathway (hydrogen, process heat, grid) and FS43 ESG and GHG literacy for managers (M32 Energy
// Transition Skills, FS wave E · E2). Pure rules shared by the pages, the seed builder, the tests and the PGlite validator.
// The pathways themselves are FS17 rows in M19 (kafaa_pathways / kafaa_pathway_steps, data-only coupling): they are checked with M19's
// pathwayProblems() and resolved with M19's resolvePathway(); this file adds what M32 shows on top:
//   trackHours()       planned hours, envelope weeks, weekly cost and the hour cap (FS43: under 10 hours)
//   quickRoute()       per step, the quickest item and whether it fits the step's planned hours (an item without hours is a short reading)
//   credentialRoute()  which pathway items count toward each criterion of the matching micro-credential (FS43 -> MC-CLEAN-ENERGY)
//   chainProblems()    value-chain explainer checks: EN/AR, every fact with an https source and an as-of date, clean copy (no
//                      headcount, site or ENEC project claim), links that exist
// Import-free except import-free `.ts` rules (node scripts load this file directly).
import { publicTextIsClean } from '../../domain/future.ts';
import { envelopeWeeks, pathwayProblems, type ResolvedPathway, type SkillRef } from '../m19/pathways.ts';

type Row = Record<string, unknown>;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const r2 = (x: number) => Math.round(x * 100) / 100;
const txt = (v: unknown, lo = 3, hi = 600) => typeof v === 'string' && v.trim().length >= lo && v.trim().length <= hi;
const HTTPS = /^https:\/\/[^\s]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** An ENEC project claim (FS42: "no ENEC project claims"): ENEC or Barakah stated as building, supplying or deciding something. */
export const PROJECT_CLAIM = /\b(ENEC|Barakah)\b[^.]{0,60}\b(will (build|supply|produce|deploy|export)|is (building|supplying|producing)|plans to (build|supply|produce|deploy)|has decided)\b/i;
export const PROJECT_CLAIM_AR = /(ستبني|ستزوّد|ستنتج|قررت المؤسسة|تخطط المؤسسة لبناء)/;
export const textClean = (values: unknown[]) => publicTextIsClean(values)
  && values.every((v) => { const s = typeof v === 'string' ? v : v && typeof v === 'object' ? JSON.stringify(v) : ''; return !PROJECT_CLAIM.test(s) && !PROJECT_CLAIM_AR.test(s); });

// ───────────── tracks (kafaa_transition_tracks) and their pathway hours
export const FS43_HOUR_CAP = 10;
export interface PathwayLite { id: string; skill_id: string; level: number; envelope_months: number; weekly_hours: number | string; version?: number; status?: string; title_en?: string; title_ar?: string }
export interface StepLite { id: string; pathway_id: string; n: number; kind: string; hours: number | string; version?: number; pins?: string[] | null; title_en?: string; title_ar?: string; auto?: boolean | null }
export interface TrackHours { weeks: number; weekly_hours: number; capacity: number; total_hours: number; fits: boolean; cap: number | null; under_cap: boolean; steps: number }
/** Planned hours of a pathway (sum of its current-version step hours) against its envelope and an optional cap (strictly under). */
export function trackHours(p: PathwayLite, steps: StepLite[], cap: number | null): TrackHours {
  const ver = Number(p.version ?? 1);
  const mine = steps.filter((s) => s.pathway_id === p.id && Number(s.version ?? 1) === ver);
  const total = r2(mine.reduce((n, s) => n + Number(s.hours), 0));
  const weeks = envelopeWeeks(Number(p.envelope_months));
  const capacity = r2(weeks * Number(p.weekly_hours));
  return { weeks, weekly_hours: Number(p.weekly_hours), capacity, total_hours: total, fits: total <= capacity, cap, under_cap: cap == null || total < cap, steps: mine.length };
}

export interface QuickStep { step_id: string; n: number; kind: string; hours: number; quickest: { type: string; id: string; hours: number | null } | null; fits: boolean }
export interface QuickRoute { steps: QuickStep[]; planned: number; all_fit: boolean }
/** Per step the quickest resolved item (an item without hours, a short reading or a check, counts as fitting the step) and whether it fits. */
export function quickRoute(resolved: ResolvedPathway): QuickRoute {
  const steps = resolved.steps.map((s) => {
    const items = [...s.items].sort((a, b) => (a.hours ?? -1) - (b.hours ?? -1) || cmp(a.type, b.type) || cmp(a.id, b.id));
    const q = items[0] ?? null;
    const fits = !!q && (q.hours == null || q.hours <= s.hours);
    return { step_id: s.step_id, n: s.n, kind: s.kind, hours: s.hours, quickest: q ? { type: q.type, id: q.id, hours: q.hours } : null, fits };
  });
  return { steps, planned: r2(steps.reduce((n, s) => n + s.hours, 0)), all_fit: steps.length > 0 && steps.every((s) => s.fits) };
}

// ───────────── credential route (which pathway items count toward each criterion)
export interface CriterionLite { key: string; kind: string; ref: string; min_level?: number | null; label_en: string; label_ar: string }
export interface ContentSkills { courses: Row[]; adaptive: Row[]; tasks: Row[] }
export interface RouteHit { step_id: string; n: number; type: string; id: string }
export interface CriterionRoute { key: string; kind: string; ref: string; label_en: string; label_ar: string; via: RouteHit[]; covered: boolean }
/** Skills an item evidences: a course through its { skill_id } objectives, an adaptive bank or a performance task through skill_ids. */
export function itemSkills(type: string, id: string, c: ContentSkills): string[] {
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  if (type === 'course') return arr(c.courses.find((x) => x.id === id)?.objectives).map((o) => (o as Row)?.skill_id).filter((x): x is string => typeof x === 'string');
  if (type === 'adaptive') return arr(c.adaptive.find((x) => x.id === id)?.skill_ids) as string[];
  if (type === 'task') return arr(c.tasks.find((x) => x.id === id)?.skill_ids) as string[];
  return [];
}
export function credentialRoute(criteria: CriterionLite[], resolved: ResolvedPathway, content: ContentSkills): CriterionRoute[] {
  return criteria.map((cr) => {
    const via: RouteHit[] = [];
    for (const s of resolved.steps) for (const it of s.items) {
      const hit = cr.kind === 'course' ? it.type === 'course' && it.id === cr.ref
        : cr.kind === 'adaptive' ? it.type === 'adaptive' && it.id === cr.ref
        : cr.kind === 'task' ? it.type === 'task' && it.id === cr.ref
        : cr.kind === 'opportunity' ? it.type === 'opportunity' && (it.id === cr.ref || cr.ref.startsWith('kind:'))
        : cr.kind === 'skill' ? itemSkills(it.type, it.id, content).includes(cr.ref)
        : false;
      if (hit) via.push({ step_id: s.step_id, n: s.n, type: it.type, id: it.id });
    }
    return { key: cr.key, kind: cr.kind, ref: cr.ref, label_en: cr.label_en, label_ar: cr.label_ar, via, covered: via.length > 0 };
  });
}

// ───────────── value chains (kafaa_value_chains)
export interface Fact { id: string; en: string; ar: string; label: string; url: string; as_of: string; published?: string | null; secondary?: boolean }
export interface Stage { key: string; en: string; ar: string; role_en: string; role_ar: string }
export interface ChainRow {
  id: string; code: string; name_en: string; name_ar: string; summary_en: string; summary_ar: string; stages: Stage[]; facts: Fact[];
  skill_ids: string[]; lane_ids: string[]; pathway_ids: string[]; cec_ids: string[]; benchmark_ids: string[]; sources: { url: string; as_of?: string; label?: string }[]; sort: number; status?: string;
}
export type ChainProblem = 'name' | 'stages' | 'facts' | 'fact_source' | 'skills' | 'links' | 'clean' | 'sources';
export function chainProblems(c: ChainRow, ctx: { skills: SkillRef[]; lanes: string[]; pathways: string[]; cec: string[]; benchmarks: string[]; today: string }): ChainProblem[] {
  const out: ChainProblem[] = [];
  if (!txt(c.name_en, 3, 80) || !txt(c.name_ar, 3, 80) || !txt(c.summary_en, 20) || !txt(c.summary_ar, 20)) out.push('name');
  if (c.stages.length < 3 || c.stages.length > 6 || !c.stages.every((s) => txt(s.key, 2, 40) && txt(s.en, 3, 120) && txt(s.ar, 3, 120) && txt(s.role_en, 3, 300) && txt(s.role_ar, 3, 300))) out.push('stages');
  if (c.facts.length < 2 || !c.facts.every((f) => txt(f.en, 10) && txt(f.ar, 10))) out.push('facts');
  if (!c.facts.every((f) => HTTPS.test(f.url) && txt(f.label, 3, 200) && DATE.test(f.as_of) && f.as_of <= ctx.today)) out.push('fact_source');
  if (!c.skill_ids.length || !c.skill_ids.every((id) => { const s = ctx.skills.find((x) => x.id === id); return !!s && !!s.fs_area && s.area !== 'security' && s.lifecycle !== 'obsolete'; })) out.push('skills');
  if (!c.lane_ids.length || !c.lane_ids.every((x) => ctx.lanes.includes(x)) || !c.pathway_ids.length || !c.pathway_ids.every((x) => ctx.pathways.includes(x))
    || !c.cec_ids.every((x) => ctx.cec.includes(x)) || !c.benchmark_ids.every((x) => ctx.benchmarks.includes(x))) out.push('links');
  if (!c.sources.length || !c.sources.every((s) => HTTPS.test(s.url) && DATE.test(s.as_of ?? ''))) out.push('sources');
  if (!textClean([c.name_en, c.name_ar, c.summary_en, c.summary_ar, c.stages, c.facts.map((f) => [f.en, f.ar])])) out.push('clean');
  return out;
}

// ───────────── tracks
export interface TrackRow { id: string; feature: string; pathway_id: string; credential_code: string | null; max_hours: number | string | null; audience_en: string; audience_ar: string; summary_en: string; summary_ar: string; chain_ids: string[]; benchmark_ids: string[]; sources: { url: string; as_of?: string }[]; sort: number }
export type TrackProblem = 'feature' | 'pathway' | 'pathway_rules' | 'hours' | 'cap' | 'text' | 'sources' | 'clean';
/** A track: FS42 or FS43, a published M19 pathway that passes pathwayProblems(), fits its envelope and (FS43) stays under the cap. */
export function trackProblems(t: TrackRow, p: (PathwayLite & Row) | undefined, steps: StepLite[], skills: SkillRef[]): TrackProblem[] {
  const out: TrackProblem[] = [];
  if (!['FS42', 'FS43'].includes(t.feature)) out.push('feature');
  if (!p || p.status !== 'published') { out.push('pathway'); return out; }
  const ver = Number(p.version ?? 1);
  const mine = steps.filter((s) => s.pathway_id === p.id && Number(s.version ?? 1) === ver).sort((a, b) => a.n - b.n);
  const input = { ...p, level: Number(p.level), envelope_months: Number(p.envelope_months), weekly_hours: Number(p.weekly_hours),
    steps: mine.map((s) => ({ kind: s.kind, hours: Number(s.hours), title_en: s.title_en, title_ar: s.title_ar, pins: s.pins ?? [], auto: s.auto !== false })) };
  if (pathwayProblems(input as never, skills).length) out.push('pathway_rules');
  const h = trackHours(p, steps, t.max_hours == null ? null : Number(t.max_hours));
  if (!h.fits) out.push('hours');
  if (!h.under_cap) out.push('cap');
  if (!txt(t.audience_en) || !txt(t.audience_ar) || !txt(t.summary_en, 20) || !txt(t.summary_ar, 20)) out.push('text');
  if (!t.sources.length || !t.sources.every((s) => HTTPS.test(s.url) && DATE.test(s.as_of ?? ''))) out.push('sources');
  if (!textClean([t.audience_en, t.audience_ar, t.summary_en, t.summary_ar, p.title_en, p.title_ar, p.summary_en, p.summary_ar, mine.map((s) => [s.title_en, s.title_ar])])) out.push('clean');
  return out;
}
