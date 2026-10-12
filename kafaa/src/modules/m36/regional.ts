/**
 * M36 · FS64 Regional skills plan for Al Dhafra. Pure rules, import-free apart from types (node seed scripts and the PGlite validator
 * import this file directly). Every rule that an RPC uses has a SQL twin in
 * supabase/migrations/20261010273001_kafaa_fs73_regional_pledges.sql (kafaa_rg_*); scripts/validate/fs73-regional-pledges.mjs proves
 * SQL = TS on the seed and on generated cases.
 *
 *  - demandRows(): the released, suppressed regional aggregates built from a RELEASED FS51 skill forecast (kafaa_skill_forecasts, M35).
 *    Per catalogue skill area and horizon year (2028, 2030, 2035): the working-level (level 2+) demand band and gap band across the three
 *    FS51 scenarios, the gap under the forecast's planning scenario, the skills behind the row and how many skills FS51 itself withheld
 *    (fewer than 10 holders). A cell from 1 to 9 people-equivalents is suppressed (null); 0 means "no gap". Security-area skills are
 *    never released. Nothing else of the forecast (levels, supply, assumptions, person counts) reaches a partner. (SQL kafaa_rg_rows)
 *  - Academic terms: "<year>S1" = 1 Sep <year> to 31 Jan <year+1>; "<year>S2" = 1 Feb to 31 Jul <year+1>. Plans run to 2030S2.
 *  - commitmentProblem(): the commit / revise check for a provider commitment (SQL kafaa_rg_commit_problem); deliveryProblem(): a term
 *    delivery report (SQL kafaa_rg_delivery_problem).
 *  - commitmentView(): delivery status per term and overall (shown on every commitment; computed, never stored).
 *  - coverageByArea(): committed seats against the released 2030 gap per area (HR and the provider's own view).
 */
import type { Reason } from '../../domain/engines/types';

export const MIN_GROUP = 10;
export const REGION = 'al_dhafra';
export const DEMAND_YEARS = [2028, 2030, 2035] as const;
export const COVERAGE_YEAR = 2030;
export const SCENARIOS = ['baseline', 'advance', 'accelerated'] as const;
export type Scenario = (typeof SCENARIOS)[number];
/** Working level (FS51 WORK_LEVEL): demand and supply of holders at level 2 or above. */
export const WORK_LEVEL = 2;
/** Catalogue areas that may be released (security is never released). */
export const DEMAND_AREAS = ['plant_systems', 'operations', 'maintenance', 'radiation_chemistry', 'engineering', 'safety', 'human_performance', 'emergency', 'quality', 'leadership', 'digital', 'project'] as const;
export const KINDS = ['cohort', 'course_change', 'new_course', 'apprenticeship'] as const;
export type Kind = (typeof KINDS)[number];
export const LAST_TERM = '2030S2';
export const MAX_TERMS = 8;
export const MAX_SEATS = 500;
export const MAX_ENROLLED = 1000;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const AR = /[؀-ۿ]/;

// ───────────── Released regional demand (from a released FS51 forecast)
export interface DemandRow {
  area: string;
  year: number;
  demand_low: number | null;
  demand_high: number | null;
  gap_low: number | null;
  gap_high: number | null;
  gap_plan: number | null;
  skills_n: number;
  withheld_n: number;
  skill_ids: string[];
  suppressed: boolean;
}
/** A released cell: 1-9 people-equivalents are suppressed (null); 0 stays 0 ("no gap"). */
export const cellOf = (v: number): number | null => (v > 0 && v < MIN_GROUP ? null : v);

/** FS51 results (stored on a released kafaa_skill_forecasts row) -> released regional rows, sorted by area order then year. */
export function demandRows(results: Row | null | undefined, planScenario: string, skillArea: Record<string, string | null | undefined>): DemandRow[] {
  const years: number[] = Array.isArray(results?.years) ? results!.years.map(Number) : [];
  const skills: Row[] = Array.isArray(results?.skills) ? results!.skills : [];
  const withheld: string[] = Array.isArray(results?.suppressed) ? results!.suppressed : [];
  const plan = (SCENARIOS as readonly string[]).includes(planScenario) ? planScenario : 'baseline';
  const li = WORK_LEVEL - 1;
  const out: DemandRow[] = [];
  for (const area of DEMAND_AREAS) {
    const ks = skills.filter((k) => k.area === area).sort((a, b) => (String(a.skill_id) < String(b.skill_id) ? -1 : String(a.skill_id) > String(b.skill_id) ? 1 : 0));
    const wn = withheld.filter((id) => skillArea[id] === area).length;
    if (!ks.length) continue;
    const basis = ks.reduce((t, k) => t + Number(k.basis_n ?? 0), 0);
    for (const y of DEMAND_YEARS) {
      const yi = years.indexOf(y);
      if (yi < 0) continue;
      const D: number[] = [], G: number[] = [];
      for (const s of SCENARIOS) {
        let d = 0, g = 0;
        for (const k of ks) {
          const dv = Number(k.sc?.[s]?.d?.[yi]?.[li] ?? 0), sv = Number(k.sc?.[s]?.s?.[yi]?.[li] ?? 0);
          d = d + dv;
          g = g + Math.max(0, dv - sv);
        }
        D.push(d);
        G.push(g);
      }
      const gp = G[(SCENARIOS as readonly string[]).indexOf(plan)];
      const small = basis < MIN_GROUP;
      const cells = [Math.min(...D), Math.max(...D), Math.min(...G), Math.max(...G), gp].map((v) => (small ? null : cellOf(v)));
      out.push({
        area, year: y, demand_low: cells[0], demand_high: cells[1], gap_low: cells[2], gap_high: cells[3], gap_plan: cells[4],
        skills_n: ks.length, withheld_n: wn, skill_ids: ks.map((k) => String(k.skill_id)), suppressed: cells.some((c) => c === null),
      });
    }
  }
  return out;
}

// ───────────── Academic terms
export const TERM_RE = /^(20\d{2})S([12])$/;
export const termOrd = (term: string) => { const m = TERM_RE.exec(term); return m ? Number(m[1]) * 2 + Number(m[2]) - 1 : -1; };
export const termOfOrd = (o: number) => `${Math.floor(o / 2)}S${(o % 2) + 1}`;
export function termStart(term: string): string {
  const m = TERM_RE.exec(term);
  if (!m) return '';
  const y = Number(m[1]);
  return m[2] === '1' ? `${y}-09-01` : `${y + 1}-02-01`;
}
export function termEnd(term: string): string {
  const m = TERM_RE.exec(term);
  if (!m) return '';
  const y = Number(m[1]);
  return m[2] === '1' ? `${y + 1}-01-31` : `${y + 1}-07-31`;
}
export type TermState = 'past' | 'current' | 'future';
export function termState(term: string, today: string): TermState {
  if (today < termStart(term)) return 'future';
  if (today > termEnd(term)) return 'past';
  return 'current';
}
/** The earliest term that has not ended (the first term a new plan may name). */
export function firstOpenTerm(today: string): string {
  const y = Number(today.slice(0, 4));
  for (let o = (y - 1) * 2; o < (y + 2) * 2; o++) if (termEnd(termOfOrd(o)) >= today) return termOfOrd(o);
  return termOfOrd((y + 2) * 2);
}
/** Terms a new plan may name, from the first open term to LAST_TERM. */
export function openTerms(today: string): string[] {
  const out: string[] = [];
  for (let o = termOrd(firstOpenTerm(today)); o <= termOrd(LAST_TERM); o++) out.push(termOfOrd(o));
  return out;
}

// ───────────── Commitment check
export interface PlanEntry { term: string; seats: number }
export interface CommitmentInput {
  id?: string | null;
  action?: 'create' | 'revise' | 'withdraw';
  area: string;
  kind: string;
  title_en: string;
  title_ar: string;
  summary_en: string;
  summary_ar: string;
  skill_ids: string[];
  level: number;
  plan: PlanEntry[];
  reason?: string | null;
}
export interface CommitCtx {
  /** areas of the current release */
  areas: string[];
  skills: Record<string, { area: string | null; lifecycle: string | null }>;
  today: string;
}
export type CommitProblem = 'area' | 'kind' | 'title' | 'summary' | 'skills' | 'level' | 'plan' | 'locked';
/** The plan entries that may no longer change on a revision: terms that have started (current or past). */
export const lockedTerms = (plan: PlanEntry[] | null | undefined, today: string): PlanEntry[] => (plan ?? []).filter((p) => termState(p.term, today) !== 'future');

export function commitmentProblem(c: Partial<CommitmentInput> | null | undefined, ctx: CommitCtx, locked: PlanEntry[] = []): CommitProblem | null {
  if (!c || typeof c !== 'object') return 'area';
  if (typeof c.area !== 'string' || !ctx.areas.includes(c.area)) return 'area';
  if (typeof c.kind !== 'string' || !(KINDS as readonly string[]).includes(c.kind)) return 'kind';
  const te = txt(c.title_en), ta = txt(c.title_ar);
  if (te.length < 5 || te.length > 160 || ta.length < 5 || ta.length > 160 || !AR.test(ta)) return 'title';
  const se = txt(c.summary_en), sa = txt(c.summary_ar);
  if (se.length < 10 || se.length > 600 || sa.length < 10 || sa.length > 600 || !AR.test(sa)) return 'summary';
  const ids = c.skill_ids;
  if (!Array.isArray(ids) || ids.length > 8 || new Set(ids).size !== ids.length) return 'skills';
  for (const id of ids) {
    const s = typeof id === 'string' ? ctx.skills[id] : undefined;
    if (!s || s.lifecycle === 'obsolete' || s.area === 'security') return 'skills';
  }
  if (!isInt(c.level) || c.level < 1 || c.level > 4) return 'level';
  const plan = c.plan;
  if (!Array.isArray(plan) || plan.length < 1 || plan.length > MAX_TERMS) return 'plan';
  const open = termOrd(firstOpenTerm(ctx.today));
  let prev = -1;
  for (const p of plan) {
    if (!p || typeof p !== 'object' || typeof p.term !== 'string' || !TERM_RE.test(p.term) || !isInt(p.seats) || p.seats < 1 || p.seats > MAX_SEATS) return 'plan';
    const o = termOrd(p.term);
    if (o <= prev || o > termOrd(LAST_TERM)) return 'plan';
    prev = o;
    if (o < open && !locked.some((l) => l.term === p.term)) return 'plan';
  }
  for (const l of locked) if (!plan.some((p) => p.term === l.term && p.seats === l.seats)) return 'locked';
  return null;
}

export interface DeliveryInput { commitment_id: string; term: string; enrolled: number; completed: number; note?: string | null }
export type DeliveryProblem = 'term' | 'future' | 'numbers';
export function deliveryProblem(d: Partial<DeliveryInput> | null | undefined, plan: PlanEntry[], today: string): DeliveryProblem | null {
  if (!d || typeof d.term !== 'string' || !plan.some((p) => p.term === d.term)) return 'term';
  if (termState(d.term, today) === 'future') return 'future';
  if (!isInt(d.enrolled) || !isInt(d.completed) || d.enrolled < 0 || d.enrolled > MAX_ENROLLED || d.completed < 0 || d.completed > d.enrolled) return 'numbers';
  return null;
}

// ───────────── Delivery status (computed on every commitment; never stored)
export type TermStatus = 'planned' | 'awaiting_report' | 'on_track' | 'at_risk' | 'behind' | 'delivered' | 'partly' | 'missed' | 'not_reported';
export type CommitStatus = 'withdrawn' | 'not_started' | 'on_track' | 'at_risk' | 'behind' | 'delivered';
export interface TermDelivery {
  term: string;
  seats: number;
  state: TermState;
  enrolled: number | null;
  completed: number | null;
  /** enrolled as a whole percentage of the planned seats */
  pct: number | null;
  status: TermStatus;
}
export interface CommitmentView {
  status: CommitStatus;
  terms: TermDelivery[];
  /** three separate totals: planned seats, enrolled and completed (never added together) */
  seats: number;
  enrolled: number;
  completed: number;
  reasons: Reason[];
}
const pctOf = (n: number, d: number) => (d > 0 ? Math.round((n * 100) / d) : 0);

export function termDelivery(p: PlanEntry, report: Row | undefined, today: string): TermDelivery {
  const state = termState(p.term, today);
  const enrolled = report && isInt(report.enrolled) ? report.enrolled : null;
  const completed = report && isInt(report.completed) ? report.completed : null;
  const pct = enrolled == null ? null : pctOf(enrolled, p.seats);
  let status: TermStatus;
  if (state === 'future') status = 'planned';
  else if (state === 'current') status = pct == null ? 'awaiting_report' : pct >= 90 ? 'on_track' : pct >= 60 ? 'at_risk' : 'behind';
  else status = pct == null ? 'not_reported' : pct >= 90 ? 'delivered' : pct >= 60 ? 'partly' : 'missed';
  return { term: p.term, seats: p.seats, state, enrolled, completed, pct, status };
}

export function commitmentView(c: Row, today: string): CommitmentView {
  const plan: PlanEntry[] = Array.isArray(c.plan) ? c.plan : [];
  const delivery: Row[] = Array.isArray(c.delivery) ? c.delivery : [];
  const terms = plan.map((p) => termDelivery(p, delivery.find((d) => d.term === p.term), today));
  const seats = terms.reduce((t, x) => t + x.seats, 0);
  const enrolled = terms.reduce((t, x) => t + (x.enrolled ?? 0), 0);
  const completed = terms.reduce((t, x) => t + (x.completed ?? 0), 0);
  const reasons: Reason[] = [];
  const r = (code: string, vars?: Reason['vars']): Reason => ({ code, key: `m36.reasons.${code}`, vars });
  let status: CommitStatus;
  if (c.status === 'withdrawn') {
    status = 'withdrawn';
    reasons.push(r('withdrawn'));
  } else {
    const bad = terms.filter((x) => x.status === 'missed' || x.status === 'not_reported' || x.status === 'behind');
    const warn = terms.filter((x) => x.status === 'partly' || x.status === 'at_risk');
    for (const x of bad) reasons.push(r(`term_${x.status}`, { term: x.term, pct: x.pct ?? 0, seats: x.seats }));
    for (const x of warn) reasons.push(r(`term_${x.status}`, { term: x.term, pct: x.pct ?? 0, seats: x.seats }));
    if (bad.length) status = 'behind';
    else if (warn.length) status = 'at_risk';
    else if (terms.length && terms.every((x) => x.state === 'past')) status = 'delivered';
    else if (terms.every((x) => x.state === 'future')) status = 'not_started';
    else status = 'on_track';
    if (status === 'delivered') reasons.push(r('all_delivered', { n: terms.length }));
    if (status === 'not_started') reasons.push(r('starts', { term: terms[0]?.term ?? '' }));
    if (status === 'on_track') {
      const cur = terms.find((x) => x.state === 'current');
      reasons.push(cur?.status === 'awaiting_report' ? r('awaiting', { term: cur.term }) : r('on_track', { n: terms.filter((x) => x.state !== 'future').length }));
    }
  }
  return { status, terms, seats, enrolled, completed, reasons };
}

// ───────────── Coverage of the released 2030 gap
export interface AreaCoverage {
  area: string;
  gap_plan: number | null;
  gap_low: number | null;
  gap_high: number | null;
  /** planned seats in terms up to the end of the coverage year, active commitments only */
  seats: number;
  completed: number;
  commitments: number;
  /** seats as a whole percentage of the planning-scenario gap; null when the gap is suppressed or zero */
  pct: number | null;
}
export function coverageByArea(demand: Row[], commitments: Row[], today: string): AreaCoverage[] {
  const rows = demand.filter((d) => Number(d.year) === COVERAGE_YEAR);
  const lastOrd = termOrd(`${COVERAGE_YEAR}S2`);
  return rows.map((d) => {
    const cs = commitments.filter((c) => c.area === d.area && c.status !== 'withdrawn');
    let seats = 0, completed = 0;
    for (const c of cs) {
      for (const p of (Array.isArray(c.plan) ? c.plan : []) as PlanEntry[]) if (termOrd(p.term) <= lastOrd) seats = seats + p.seats;
      for (const x of (Array.isArray(c.delivery) ? c.delivery : []) as Row[]) if (isInt(x.completed) && termState(String(x.term), today) !== 'future') completed = completed + x.completed;
    }
    const gp = d.gap_plan == null ? null : Number(d.gap_plan);
    return {
      area: String(d.area), gap_plan: gp, gap_low: d.gap_low == null ? null : Number(d.gap_low), gap_high: d.gap_high == null ? null : Number(d.gap_high),
      seats, completed, commitments: cs.length, pct: gp == null || gp === 0 ? null : pctOf(seats, gp),
    };
  });
}

/** Scenario names for reason variables (bilingual, picked per language by WhyThis). */
export const SCENARIO_TEXT: Record<Scenario, { en: string; ar: string }> = {
  baseline: { en: 'baseline', ar: 'الأساسي' },
  advance: { en: 'ADVANCE', ar: 'برنامج ADVANCE' },
  accelerated: { en: 'accelerated', ar: 'المتسارع' },
};
/** Explanation for one released area row (Why this?). */
export function demandReasons(d: Row, plan: string): Reason[] {
  const r = (code: string, vars?: Reason['vars']): Reason => ({ code, key: `m36.reasons.${code}`, vars });
  const out: Reason[] = [r('basis', { n: Number(d.skills_n ?? 0), year: Number(d.year) })];
  if (d.gap_plan == null) out.push(r('suppressed', { n: MIN_GROUP }));
  else if (Number(d.gap_plan) === 0) out.push(r('no_gap', { year: Number(d.year) }));
  else out.push(r('gap_plan', { n: Number(d.gap_plan), scenario: SCENARIO_TEXT[plan as Scenario] ?? SCENARIO_TEXT.baseline, year: Number(d.year) }));
  if (d.gap_low != null && d.gap_high != null && Number(d.gap_high) > Number(d.gap_low)) out.push(r('band', { lo: Number(d.gap_low), hi: Number(d.gap_high) }));
  if (Number(d.withheld_n ?? 0) > 0) out.push(r('withheld', { n: Number(d.withheld_n), min: MIN_GROUP }));
  return out;
}
