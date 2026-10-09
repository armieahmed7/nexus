/**
 * M24 · F20 Knowledge Loss Risk Assessment (KLRA). Pure rules, import-free apart from types (the seed builder and the PGlite
 * validator load this file in node). SQL mirror: supabase/migrations/20261009132001_kafaa_w3e2_knowledge.sql
 * (kafaa_kc_propose, kafaa_kc_band, kafaa_kc_mitigation, kafaa_kc_heatmap_compute). Change both together.
 *
 * Method (IAEA NG-T-6.11 knowledge loss risk management): every position gets two factors on 1-5 scales.
 *  - Attrition risk factor: the highest of the retirement window band, the contract or secondment end band and KHNP OSSA
 *    cover (support ends with the programme in 2030). Only bands exist in the data: no birth date, age or exact date.
 *  - Position (knowledge) risk factor: criticality (critical_roles / regulated / qualified role), uniqueness (F11 single
 *    points of failure the holder carries), how codified the knowledge is (qualification standards, OE and published
 *    knowledge assets) and how hard the position is to replace (months to qualify a successor).
 *  - Total = attrition x position (1-25). High from the configurable threshold (16 by default), medium from 8.
 */
import type { Reason } from '../../domain/engines/types';

export const MIN_GROUP = 10;
export const DEFAULT_THRESHOLDS = { high: 16, medium: 8 } as const;
export const OSSA_END_YEAR = 2030;

export const DEPARTMENTS = ['operations', 'maintenance_engineering', 'rp_chem_ep', 'training_quality', 'corporate'] as const;
export type Department = (typeof DEPARTMENTS)[number];
/** Security, cyber and safeguards positions are out of KLRA scope: career path only, qualified / not qualified status only. */
export const EXCLUDED_FAMILIES = ['security', 'cyber', 'safeguards'];
const FAMILY_DEPT: Record<string, Department> = {
  operations: 'operations', outage: 'operations', 'fire-protection': 'operations',
  maintenance: 'maintenance_engineering', engineering: 'maintenance_engineering', 'nuclear-fuel': 'maintenance_engineering',
  'radiation-protection': 'rp_chem_ep', chemistry: 'rp_chem_ep', 'emergency-preparedness': 'rp_chem_ep', 'health-safety': 'rp_chem_ep', environment: 'rp_chem_ep',
  training: 'training_quality', quality: 'training_quality', oversight: 'training_quality', licensing: 'training_quality',
  corporate: 'corporate', 'supply-chain': 'corporate',
};
export const departmentOf = (familyId: string | null | undefined): Department | null =>
  familyId && EXCLUDED_FAMILIES.includes(familyId) ? null : FAMILY_DEPT[familyId ?? ''] ?? 'corporate';

export const BANDS = ['high', 'medium', 'low'] as const;
export type Band = (typeof BANDS)[number];
export const RETIREMENT_BANDS = ['within_2', '2_5', '5_plus', 'na'] as const;
export const CONTRACT_KINDS = ['permanent', 'fixed_term', 'secondment', 'ossa'] as const;
export const CONTRACT_END_BANDS = ['within_1', '1_2', '2_5', '5_plus', 'none'] as const;
export const CRITICALITY = ['critical', 'regulated', 'qualified', 'general'] as const;
export const ACTION_KINDS = ['capture', 'mentoring', 'successor', 'documentation', 'cross_training'] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];
export const OWNER_ROLES = ['km_owner', 'line_manager', 'training', 'hr', 'sme'] as const;
export const OPEN_ACTION = ['planned', 'in_progress'];

export interface Thresholds { high: number; medium: number }
export interface PositionLite {
  id: string; person_id?: string | null; family_id?: string | null; department: string; kind?: string;
  retirement_band: string; contract_kind: string; contract_end_band: string; criticality: string;
  spof_skill_ids: string[]; codified_base: number; replace_months: number;
}
export interface Drivers { retire: number; contract: number; ossa: number; crit: number; uniq: number; tacit: number; repl: number; codified_pct: number; spof: number; assets: number }
export interface Proposal { attrition: number; position: number; total: number; drivers: Drivers; reasons: Reason[] }

// ───────────── factor scales (1-5)
export const retireScore = (b: string) => (b === 'within_2' ? 5 : b === '2_5' ? 3 : 1);
export const contractScore = (kind: string, end: string) =>
  kind !== 'fixed_term' && kind !== 'secondment' ? 1 : end === 'within_1' ? 5 : end === '1_2' ? 4 : end === '2_5' ? 2 : 1;
export const ossaScore = (kind: string) => (kind === 'ossa' ? 4 : 1);
export const critScore = (c: string) => (c === 'critical' ? 5 : c === 'regulated' ? 4 : c === 'qualified' ? 3 : 2);
export const uniqScore = (spof: number) => (spof >= 2 ? 5 : spof === 1 ? 4 : 1);
/** Each published knowledge asset tied to the position codifies 15 more points of its know-how (cap 100). */
export const codifiedPct = (base: number, assets: number) => Math.min(100, Math.max(0, Math.trunc(base)) + 15 * Math.max(0, Math.trunc(assets)));
export const tacitScore = (pct: number) => (pct < 20 ? 5 : pct < 40 ? 4 : pct < 60 ? 3 : pct < 80 ? 2 : 1);
export const replScore = (months: number) => (months >= 48 ? 5 : months >= 24 ? 4 : months >= 12 ? 3 : months >= 6 ? 2 : 1);
/** Position factor: weighted 3/3/2/2 (criticality, uniqueness, tacitness, replacement), rounded half up to 1-5. */
export const positionOf = (crit: number, uniq: number, tacit: number, repl: number) => Math.min(5, Math.max(1, Math.floor((crit * 3 + uniq * 3 + tacit * 2 + repl * 2 + 5) / 10)));

const R = (code: string, vars: Record<string, string | number> = {}, weight?: number): Reason => ({ code, key: `m24.reasons.${code}`, vars, ...(weight != null ? { weight } : {}) });

/** The deterministic proposal for one position (the assessor confirms it or adjusts it with a note). */
export function proposeFactors(p: PositionLite, assetsPublished = 0): Proposal {
  const retire = retireScore(p.retirement_band);
  const contract = contractScore(p.contract_kind, p.contract_end_band);
  const ossa = ossaScore(p.contract_kind);
  const spof = (p.spof_skill_ids ?? []).length;
  const crit = critScore(p.criticality);
  const uniq = uniqScore(spof);
  const pct = codifiedPct(p.codified_base, assetsPublished);
  const tacit = tacitScore(pct);
  const repl = replScore(p.replace_months);
  const attrition = Math.max(retire, contract, ossa);
  const position = positionOf(crit, uniq, tacit, repl);
  const reasons: Reason[] = [];
  if (p.retirement_band !== 'na') reasons.push(R(`retire_${p.retirement_band}`, {}, retire));
  if ((p.contract_kind === 'fixed_term' || p.contract_kind === 'secondment') && p.contract_end_band !== 'none') reasons.push(R(`contract_${p.contract_end_band}`, {}, contract));
  if (p.contract_kind === 'ossa') reasons.push(R('ossa_cover', { year: OSSA_END_YEAR }, ossa));
  reasons.push(R(`crit_${p.criticality}`, {}, crit));
  reasons.push(spof > 0 ? R('spof', { n: spof }, uniq) : R('no_spof', {}, uniq));
  reasons.push(R('codified', { pct }, tacit));
  reasons.push(R('replace', { months: Math.trunc(p.replace_months) }, repl));
  if (assetsPublished > 0) reasons.push(R('assets', { n: Math.trunc(assetsPublished) }));
  return { attrition, position, total: attrition * position, drivers: { retire, contract, ossa, crit, uniq, tacit, repl, codified_pct: pct, spof, assets: Math.trunc(assetsPublished) }, reasons };
}
/** Reasons stored on an assessment: the proposal's reasons plus, when the assessor changed a factor, an "adjusted" reason. */
export function assessmentReasons(prop: Proposal, attrition: number, position: number): Reason[] {
  return attrition === prop.attrition && position === prop.position ? prop.reasons : [...prop.reasons, R('adjusted', { pa: prop.attrition, pp: prop.position, a: attrition, p: position })];
}
export const validFactor = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5;
export const validThresholds = (high: unknown, medium: unknown) =>
  typeof high === 'number' && typeof medium === 'number' && Number.isInteger(high) && Number.isInteger(medium) && medium >= 2 && high <= 25 && medium < high;

export function bandOf(total: number, t: Thresholds): Band {
  return total >= t.high ? 'high' : total >= t.medium ? 'medium' : 'low';
}

// ───────────── quarters (UTC, same as src/domain/rules quarterOf / quarterEnd)
export const quarterOfIso = (iso: string) => `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
export function quarterEndIso(q: string): string {
  const [y, n] = q.split('-Q').map(Number);
  return new Date(Date.UTC(y, n * 3, 0)).toISOString().slice(0, 10);
}
export function prevQuarter(q: string): string {
  const [y, n] = q.split('-Q').map(Number);
  return n === 1 ? `${y - 1}-Q4` : `${y}-Q${n - 1}`;
}
export const validPeriod = (q: unknown) => typeof q === 'string' && /^20\d{2}-Q[1-4]$/.test(q);
export function addDaysIso(d: string, n: number): string {
  const x = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

// ───────────── mitigation
export type Mitigation = 'not_required' | 'planned' | 'done' | 'needed' | 'overdue';
export interface ActionLite { id?: string; assessment_id: string; status: string; due_on: string; kind?: string }
/**
 * A high-risk row needs at least one mitigation action before its quarter closes. Without one it reads "needed" until the
 * quarter end, then "overdue". With actions it reads "planned" (any open) or "done" (all closed as done).
 */
export function mitigationState(band: Band, period: string, actions: ActionLite[], today: string): Mitigation {
  const live = actions.filter((a) => a.status !== 'cancelled');
  if (live.length) return live.some((a) => OPEN_ACTION.includes(a.status)) ? 'planned' : 'done';
  if (band !== 'high') return 'not_required';
  return today > quarterEndIso(period) ? 'overdue' : 'needed';
}
export const actionOverdue = (a: Pick<ActionLite, 'status' | 'due_on'>, today: string) => OPEN_ACTION.includes(a.status) && String(a.due_on).slice(0, 10) < today;

// ───────────── department heatmap (aggregates, every cell under 10 suppressed)
export interface Cell { n: number | null; suppressed: boolean }
export interface HeatmapDept { id: Department; n: Cell; high: Cell; medium: Cell; low: Cell; mitigated: Cell }
export interface Heatmap {
  period: string; min_group: number; thresholds: Thresholds; departments: HeatmapDept[]; total: { n: Cell; high: Cell; medium: Cell; low: Cell; mitigated: Cell };
  trend: { period: string; n: Cell; high: Cell }[]; excluded: string[];
}
export const cell = (n: number, min = MIN_GROUP): Cell => (n >= min ? { n, suppressed: false } : { n: null, suppressed: true });
export interface AssessLite { id: string; period: string; department: string; total: number }
export function computeHeatmap(assessments: AssessLite[], actions: ActionLite[], t: Thresholds, period: string): Heatmap {
  const acts = new Map<string, number>();
  for (const a of actions) if (a.status !== 'cancelled') acts.set(a.assessment_id, (acts.get(a.assessment_id) ?? 0) + 1);
  const rows = assessments.filter((a) => a.period === period);
  const count = (xs: AssessLite[]) => {
    const b = (x: AssessLite) => bandOf(x.total, t);
    const hi = xs.filter((x) => b(x) === 'high');
    return { n: cell(xs.length), high: cell(hi.length), medium: cell(xs.filter((x) => b(x) === 'medium').length), low: cell(xs.filter((x) => b(x) === 'low').length), mitigated: cell(hi.filter((x) => acts.has(x.id)).length) };
  };
  const periods = [...new Set(assessments.map((a) => a.period))].sort();
  return {
    period, min_group: MIN_GROUP, thresholds: { high: t.high, medium: t.medium },
    departments: DEPARTMENTS.map((d) => ({ id: d, ...count(rows.filter((r) => r.department === d)) })),
    total: count(rows),
    trend: periods.map((p) => {
      const xs = assessments.filter((a) => a.period === p);
      return { period: p, n: cell(xs.length), high: cell(xs.filter((x) => bandOf(x.total, t) === 'high').length) };
    }),
    excluded: [...EXCLUDED_FAMILIES],
  };
}

// ───────────── scope of a position (mirror of kafaa_in_scope for positions without a person, e.g. OSSA cover)
export interface AssignmentLite { role: string; scope_type: string; scope_value?: string | null; status: string; expires_at?: string | null }
export interface PosAttrs { entity_id?: string | null; family_id?: string | null; team_id?: string | null; crew?: string | null }
export function coversPosition(a: AssignmentLite, p: PosAttrs): boolean {
  switch (a.scope_type) {
    case 'all': return true;
    case 'entity': return !!p.entity_id && p.entity_id === a.scope_value;
    case 'family': return !!p.family_id && p.family_id === a.scope_value;
    case 'team': return !!p.team_id && p.team_id === a.scope_value;
    case 'crew': return !!p.crew && p.crew === a.scope_value;
    default: return false;
  }
}

// ───────────── refusal messages (same text in SQL)
export const KLRA_MSG = {
  not_signed_in: 'Sign in to use the knowledge loss risk assessment',
  forbidden: 'Only the knowledge-management owner or a department head for this position can do this',
  forbidden_owner: 'Only the knowledge-management owner can do this',
  not_found: 'Position not found',
  assessment_not_found: 'Assessment not found',
  action_not_found: 'Mitigation action not found',
  closed_period: 'Assess the current quarter only; earlier quarters are closed',
  factors: 'Each factor is a whole number from 1 to 5',
  note_required: 'Explain in at least 10 characters why you changed the proposed factors',
  note_long: 'Keep the note under 500 characters',
  thresholds: 'Thresholds are whole numbers: medium from 2, high up to 25, and medium below high',
  kind: 'Choose capture, mentoring, successor, documentation or cross-training',
  owner: 'Choose who owns the action',
  due: 'Set a due date between today and one year from today',
  duplicate: 'An open action of this kind already exists for this position',
  not_open: 'This action is already closed',
  outcome: 'Close the action as done or cancelled',
  cancel_note: 'Give a reason of at least 5 characters when you cancel an action',
  inactive: 'This position is no longer in the register',
} as const;
