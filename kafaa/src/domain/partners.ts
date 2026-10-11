/**
 * [G4] M09 business rules shared by the pages, the LocalBackend RPCs (src/data/local/rpc.g4.ts) and, rule for rule,
 * the SQL RPCs in supabase/migrations/20261008134001_kafaa_g4_partners.sql. Pure functions, no imports from the UI.
 *
 * Kafa'a prepares suppliers; ENEC's procurement and quality functions qualify them. Nothing here is a registration,
 * a qualification or an award: the readiness summary is a hand-off document for ENEC's own supplier registration.
 */
import { isoDate, toDate, DAY } from './rules';

/** Supplier readiness path (spec "Supplier and contractor track", steps 1-5). The supplier completes the first five; ENEC's hand-off completes the last. */
export const READINESS_STEPS = ['orientation', 'quality', 'safety_culture', 'icv', 'self_assessment', 'handoff'] as const;
export type ReadinessStep = (typeof READINESS_STEPS)[number];
export const SUPPLIER_STEPS: ReadinessStep[] = ['orientation', 'quality', 'safety_culture', 'icv', 'self_assessment'];

/** Self-assessment areas, scored 1 (not in place) to 4 (embedded and audited). */
export const SELF_ASSESSMENT_AREAS = ['nqa1', 'cgd', 'cfsi', 'defect_reporting', 'safety_culture', 'business_continuity'] as const;
export type SelfAssessmentArea = (typeof SELF_ASSESSMENT_AREAS)[number];
export const SELF_ASSESSMENT_MAX = 4;

/**
 * Document checklist (Kafa'a concept checklist; ENEC's registration defines the actual requirements).
 * `step` ties each document to the readiness step it evidences.
 */
export const DOC_CHECKLIST: { key: string; step: ReadinessStep; required: boolean }[] = [
  { key: 'trade_licence', step: 'orientation', required: true },
  { key: 'company_profile', step: 'orientation', required: true },
  { key: 'qa_manual', step: 'quality', required: true },
  { key: 'nqa1_programme', step: 'quality', required: true },
  { key: 'cgd_procedure', step: 'quality', required: true },
  { key: 'cfsi_procedure', step: 'quality', required: true },
  { key: 'iso9001', step: 'quality', required: false },
  { key: 'asme_certificate', step: 'quality', required: false },
  { key: 'defect_reporting_procedure', step: 'safety_culture', required: true },
  { key: 'safety_culture_statement', step: 'safety_culture', required: true },
  { key: 'icv_certificate', step: 'icv', required: true },
  { key: 'business_continuity_plan', step: 'self_assessment', required: false },
];
export const DOC_KEYS = DOC_CHECKLIST.map((d) => d.key);

export interface StepRow { step_key: string; status: string; updated_at?: string | null; self_assessment?: unknown }
export interface DocRow { doc_key: string; status: string; required: boolean; file_name?: string | null; sha256?: string | null; reviewed_at?: string | null }
export interface IcvRow { baseline: number; target: number; target_year: number; status: string; certificate_valid_to?: string | null; certificate_file?: string | null; levers?: unknown }

export interface ReadinessState {
  stepsDone: number;
  stepsTotal: number;
  missingSteps: string[];
  docsRequired: number;
  docsReady: number;
  missingDocs: string[];
  rejectedDocs: string[];
  icvReady: boolean;
  /** 0-100, for the progress ring. */
  pct: number;
  /** All conditions met to submit the case for ENEC review. */
  ready: boolean;
}

/** Rule M09-R1: a case can be submitted only when the five supplier steps are done, every required document is uploaded (or accepted) and none is rejected, and the ICV plan is no longer a draft. */
export function readinessState(steps: StepRow[], docs: DocRow[], icv: IcvRow | null | undefined): ReadinessState {
  const done = new Set(steps.filter((s) => s.status === 'done').map((s) => s.step_key));
  const missingSteps = SUPPLIER_STEPS.filter((s) => !done.has(s));
  // Required documents come from the checklist, not from the rows: a document with no row is missing.
  const byKey = new Map(docs.map((d) => [d.doc_key, d]));
  const required = DOC_CHECKLIST.filter((d) => d.required);
  const missingDocs = required.filter((d) => !['uploaded', 'accepted'].includes(byKey.get(d.key)?.status ?? 'missing')).map((d) => d.key);
  const rejectedDocs = docs.filter((d) => d.status === 'rejected').map((d) => d.doc_key);
  const icvReady = !!icv && icv.status !== 'draft';
  const docsReady = required.length - missingDocs.length;
  const units = SUPPLIER_STEPS.length + required.length + 1;
  const got = SUPPLIER_STEPS.length - missingSteps.length + docsReady + (icvReady ? 1 : 0);
  return {
    stepsDone: SUPPLIER_STEPS.length - missingSteps.length,
    stepsTotal: SUPPLIER_STEPS.length,
    missingSteps,
    docsRequired: required.length,
    docsReady,
    missingDocs,
    rejectedDocs,
    icvReady,
    pct: Math.round((got / units) * 100),
    ready: missingSteps.length === 0 && missingDocs.length === 0 && rejectedDocs.length === 0 && icvReady,
  };
}

/** Status transitions a supplier may request through partnerOnboardingAction. */
export const SUPPLIER_TRANSITIONS: Record<'start' | 'submit' | 'withdraw', { from: string[]; to: string }> = {
  start: { from: ['invited', 'returned'], to: 'in_progress' },
  submit: { from: ['in_progress', 'returned'], to: 'submitted' },
  withdraw: { from: ['submitted'], to: 'in_progress' },
};

/** Reference printed on the readiness summary. Deterministic for a given organisation and date. */
export function summaryRef(orgId: string, date: string): string {
  const org = orgId.replace(/^org-/, '').toUpperCase().slice(0, 10);
  return `KFA-RS-${org}-${date.replace(/-/g, '')}`;
}

export interface ReadinessSummary {
  ref: string;
  generated_at: string;
  org_id: string;
  org_name_en: string;
  org_name_ar: string;
  steps: { key: string; status: string; updated_at: string | null }[];
  self_assessment: Record<string, number>;
  documents: { key: string; status: string; file_name: string | null; sha256: string | null }[];
  icv: { baseline: number; target: number; target_year: number; status: string; certificate_valid_to: string | null } | null;
  academy: { course_id: string; certificate_no: string; issued_on: string }[];
  disclaimer: string;
}
export const SUMMARY_DISCLAIMER =
  "Prepared by Kafa'a for ENEC supplier registration. Kafa'a prepares suppliers; ENEC's procurement and quality functions qualify them. This summary is not a registration, a qualification or an award.";

/** Rule M09-R2: the readiness summary the supplier takes to ENEC's registration process (built at submission, same fields in SQL). */
export function buildSummary(input: {
  org: { id: string; name_en: string; name_ar: string };
  steps: StepRow[];
  docs: DocRow[];
  icv: IcvRow | null | undefined;
  certificates: { course_id: string; id: string; issued_on: string }[];
  now?: Date;
}): ReadinessSummary {
  const now = input.now ?? new Date();
  const sa = input.steps.find((s) => s.step_key === 'self_assessment')?.self_assessment;
  const self: Record<string, number> = {};
  if (sa && typeof sa === 'object') for (const [k, v] of Object.entries(sa as Record<string, unknown>)) if (typeof v === 'number') self[k] = v;
  const order = (k: string) => READINESS_STEPS.indexOf(k as ReadinessStep);
  return {
    ref: summaryRef(input.org.id, isoDate(now)),
    generated_at: now.toISOString(),
    org_id: input.org.id,
    org_name_en: input.org.name_en,
    org_name_ar: input.org.name_ar,
    steps: [...input.steps].sort((a, b) => order(a.step_key) - order(b.step_key)).map((s) => ({ key: s.step_key, status: s.status, updated_at: s.updated_at ?? null })),
    self_assessment: self,
    documents: [...input.docs].sort((a, b) => DOC_KEYS.indexOf(a.doc_key) - DOC_KEYS.indexOf(b.doc_key)).map((d) => ({ key: d.doc_key, status: d.status, file_name: d.file_name ?? null, sha256: d.sha256 ?? null })),
    icv: input.icv ? { baseline: Number(input.icv.baseline), target: Number(input.icv.target), target_year: Number(input.icv.target_year), status: input.icv.status, certificate_valid_to: input.icv.certificate_valid_to ?? null } : null,
    academy: input.certificates.map((c) => ({ course_id: c.course_id, certificate_no: c.id, issued_on: c.issued_on })).sort((a, b) => a.course_id.localeCompare(b.course_id)),
    disclaimer: SUMMARY_DISCLAIMER,
  };
}

/** Self-assessment average (1-4), null when nothing is scored. */
export function selfAssessmentScore(sa: Record<string, number> | null | undefined): number | null {
  const v = Object.values(sa ?? {}).filter((x) => typeof x === 'number' && x > 0);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

// ───────────── ICV (MoIAT National In-Country Value Programme; ENEC uses the score in tender evaluation)
export interface IcvLever { lever: string; en?: string; ar?: string; delta: number }
export interface IcvCheck {
  gap: number;
  leverTotal: number;
  covered: boolean;
  valid: boolean;
  problems: string[];
  certificate: 'missing' | 'valid' | 'expiring' | 'expired';
  daysToCertExpiry: number | null;
}
/** Rule M09-R3: a plan is valid when 0 <= baseline < target <= 100, the target year is this year to ten years out, and every lever is a positive number of points. It may be submitted only when the levers cover the gap and a certificate is on file. */
export function icvCheck(p: { baseline: number; target: number; target_year: number; levers?: unknown; certificate_valid_to?: string | null; certificate_file?: string | null }, now = new Date()): IcvCheck {
  const levers = (Array.isArray(p.levers) ? p.levers : []) as IcvLever[];
  const problems: string[] = [];
  const b = Number(p.baseline);
  const t = Number(p.target);
  const y = Number(p.target_year);
  const thisYear = now.getUTCFullYear();
  if (!(b >= 0 && b <= 100)) problems.push('baseline_range');
  if (!(t > b && t <= 100)) problems.push('target_range');
  if (!(y >= thisYear && y <= thisYear + 10)) problems.push('year_range');
  if (levers.length === 0) problems.push('no_levers');
  if (levers.some((l) => !(Number(l.delta) > 0) || !String(l.lever ?? '').trim())) problems.push('lever_invalid');
  const leverTotal = Math.round(levers.reduce((a, l) => a + (Number(l.delta) || 0), 0) * 10) / 10;
  const gap = Math.round((t - b) * 10) / 10;
  let certificate: IcvCheck['certificate'] = 'missing';
  let daysToCertExpiry: number | null = null;
  if (p.certificate_valid_to) {
    daysToCertExpiry = Math.round((toDate(p.certificate_valid_to).getTime() - toDate(isoDate(now)).getTime()) / DAY);
    certificate = daysToCertExpiry < 0 ? 'expired' : daysToCertExpiry <= 90 ? 'expiring' : 'valid';
  }
  return { gap, leverTotal, covered: leverTotal >= gap, valid: problems.length === 0, problems, certificate, daysToCertExpiry };
}
/** Submission adds two conditions to validity: the levers cover the gap and a certificate file and validity date are on file. */
export function icvSubmittable(p: Parameters<typeof icvCheck>[0], now = new Date()): { ok: boolean; problems: string[] } {
  const c = icvCheck(p, now);
  const problems = [...c.problems];
  if (!c.covered) problems.push('levers_short');
  if (!p.certificate_file || !p.certificate_valid_to) problems.push('certificate_missing');
  else if (c.certificate === 'expired') problems.push('certificate_expired');
  return { ok: problems.length === 0, problems };
}

// ───────────── Contractor equivalency
export interface MappingRow { task_id: string; covered: boolean; evidence?: number[]; note?: string }
export interface Coverage { total: number; covered: number; uncovered: string[]; criticalUncovered: string[]; complete: boolean }
/** Rule M09-R4: an "equivalent" decision needs every task item of the standard mapped to evidence and marked covered. */
export function equivalencyCoverage(tasks: { id: string; critical: boolean }[], mapping: MappingRow[] | null | undefined): Coverage {
  const m = new Map((mapping ?? []).map((x) => [x.task_id, x]));
  const uncovered = tasks.filter((t) => !m.get(t.id)?.covered).map((t) => t.id);
  const criticalUncovered = tasks.filter((t) => t.critical && !m.get(t.id)?.covered).map((t) => t.id);
  return { total: tasks.length, covered: tasks.length - uncovered.length, uncovered, criticalUncovered, complete: tasks.length > 0 && uncovered.length === 0 };
}
export const EVIDENCE_KINDS = ['certificate', 'training_record', 'reference', 'jpm_record', 'cv', 'other'] as const;

// ───────────── Supplier academy
/** Rule M09-R5: the knowledge check is scored on the server against answer keys; pass mark from the course (default 80). */
export function scoreCheck(keys: { check_id: string; answer: number }[], answers: { check_id: string; answer: number }[], passMark = 80): { correct: number; total: number; score: number; passed: boolean } {
  const given = new Map(answers.map((a) => [a.check_id, Number(a.answer)]));
  const correct = keys.filter((k) => given.get(k.check_id) === Number(k.answer)).length;
  const total = keys.length;
  const score = total ? Math.round((correct / total) * 100) : 0;
  return { correct, total, score, passed: total > 0 && score >= passMark };
}
/** Certificate validity: issued date plus the course validity in months (24 when the course gives none). */
export function certificateValidTo(issued: string, months: number | null | undefined): string {
  const d = toDate(issued);
  d.setUTCMonth(d.getUTCMonth() + (months ?? 24));
  return isoDate(d);
}
