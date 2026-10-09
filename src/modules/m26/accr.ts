// F29 Accreditation-readiness self-evaluation: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder and
// (mirrored in SQL) supabase/migrations/20261009142001_kafaa_w4e2_sat.sql. Import-free apart from types.
//
//  - Ratings: 1 not met, 2 partly met, 3 largely met, 4 met. A rating of 1 or 2 is a gap: it needs an owner and a due date.
//  - readiness = round half up of 100 x sum(rating - 1) / (3 x criteria), unrated criteria count 0 (exact integer arithmetic).
//  - Maker-checker: a self-evaluation cannot be finalised by its sole author (the distinct people who rated its criteria).
//  - Evidence facts: what Kafa'a holds for a programme, by kind (F27 traceability, F25 effectiveness, M05 item analysis,
//    F31/M02 instructor qualifications, M02 sign-off timeliness, M04 programme records). suggestFor(criterion) returns the facts
//    of the kinds the criterion asks for, or a single { kind: 'none' } marker ("no evidence found").
//  - Every report and export carries DEMO_NOTICE: a readiness self-check, never an accreditation decision.
import type { Reason } from '../../domain/engines/types';

export const RATINGS = [1, 2, 3, 4] as const;
export type Rating = (typeof RATINGS)[number];
export const RATING_KEY: Record<number, string> = { 1: 'not_met', 2: 'partly', 3: 'largely', 4: 'met' };
export const AREAS = ['performance', 'environment', 'process', 'instructors', 'examinations'] as const;
export const PHASES = ['analysis', 'design', 'development', 'implementation', 'evaluation'] as const;
export const EVIDENCE_KINDS = ['traceability', 'effectiveness', 'item_analysis', 'instructor_quals', 'signoff_timeliness', 'programme_records'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export const OWNER_ROLES = ['training_manager', 'programme_lead', 'instructors', 'quality', 'line_management', 'hr'] as const;
export const MAX_EVIDENCE = 8;
export const GAP_MAX = 500;
export const DEMO_NOTICE = { en: 'Demo / not an accreditation decision', ar: 'عرض تجريبي / ليس قرار اعتماد' };

export const ACCR_MSG = {
  not_signed_in: 'Sign in to use the accreditation-readiness workbench',
  forbidden: 'Only training staff with SAT rights can do this',
  forbidden_finalise: 'Only the training manager finalises a self-evaluation',
  programme_not_found: 'Programme not in the accreditation-readiness scope',
  selfeval_not_found: 'Self-evaluation not found',
  criterion_not_found: 'Criterion not found',
  not_draft: 'This self-evaluation is finalised; open the next cycle to change ratings',
  rating_invalid: 'Rate the criterion from 1 (not met) to 4 (met)',
  evidence_invalid: 'Attach up to 8 evidence links of the known kinds',
  gap_owner: 'A gap (rating 1 or 2) needs an owner and a due date between today and one year from today',
  gap_long: 'Keep the gap description and note under 500 characters',
  draft_exists: 'A draft self-evaluation for this programme is already open',
  cycle_done: 'This programme already has a finalised self-evaluation for the current cycle',
  incomplete: 'Rate every criterion before finalising',
  gaps_unowned: 'Every gap needs an owner and a due date before finalising',
  maker_checker: 'A self-evaluation cannot be finalised by its sole author; another member of training staff must rate at least one criterion',
} as const;

export const isGap = (r: number) => r <= 2;
export const validRating = (r: unknown): r is Rating => typeof r === 'number' && Number.isInteger(r) && r >= 1 && r <= 4;

/** Half-year cycle of an ISO date: 2026-10-08 -> 2026-H2. */
export function cycleOf(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${y}-H${m <= 6 ? 1 : 2}`;
}

/** Readiness 0-100 (integer, half up): unrated criteria count 0. */
export function readiness(ratings: number[], criteriaTotal: number): number {
  if (criteriaTotal <= 0) return 0;
  const pts = ratings.reduce((s, r) => s + (r - 1), 0);
  return Math.floor((200 * pts + 3 * criteriaTotal) / (6 * criteriaTotal));
}

export interface AssessmentLite { criterion_id: string; rating: number; owner_role: string | null; due_on: string | null; rated_by: string }
export interface SelfEvalState { rated: number; total: number; gaps: number; unowned: number; readiness: number; complete: boolean; authors: string[] }

export function selfEvalState(assessments: AssessmentLite[], criteriaTotal: number): SelfEvalState {
  const gaps = assessments.filter((a) => isGap(a.rating));
  return {
    rated: assessments.length, total: criteriaTotal, gaps: gaps.length, unowned: gaps.filter((a) => !a.owner_role || !a.due_on).length,
    readiness: readiness(assessments.map((a) => a.rating), criteriaTotal), complete: assessments.length >= criteriaTotal,
    authors: [...new Set(assessments.map((a) => a.rated_by))].sort(),
  };
}

/** Maker-checker: true when the finaliser would be the only person who rated the self-evaluation. */
export const soleAuthor = (authors: string[], finaliser: string) => authors.length > 0 && authors.every((a) => a === finaliser);

export interface EvidenceLink { kind: EvidenceKind; ref: string; route: string; label_en: string; label_ar: string }
export function validEvidence(xs: unknown): xs is EvidenceLink[] {
  return Array.isArray(xs) && xs.length <= MAX_EVIDENCE && xs.every((e) => !!e && typeof e === 'object'
    && (EVIDENCE_KINDS as readonly string[]).includes((e as EvidenceLink).kind) && typeof (e as EvidenceLink).ref === 'string' && (e as EvidenceLink).ref.length > 0 && (e as EvidenceLink).ref.length <= 120
    && typeof (e as EvidenceLink).route === 'string' && (e as EvidenceLink).route.startsWith('/') && (e as EvidenceLink).route.length <= 200
    && typeof (e as EvidenceLink).label_en === 'string' && (e as EvidenceLink).label_en.length <= 200 && typeof (e as EvidenceLink).label_ar === 'string' && (e as EvidenceLink).label_ar.length <= 200);
}

/** A fact Kafa'a holds for a programme. `m` carries the numbers the label is built from (counts only, never people). */
export interface EvidenceFact { kind: EvidenceKind; ref: string; route: string; m: Record<string, number> }
export type Suggestion = EvidenceFact | { kind: 'none'; ref: ''; route: ''; m: Record<string, never> };
export const NONE: Suggestion = { kind: 'none', ref: '', route: '', m: {} };

export function suggestFor(evidenceKinds: string[], facts: EvidenceFact[]): Suggestion[] {
  const xs = facts.filter((f) => evidenceKinds.includes(f.kind));
  return xs.length ? xs : [NONE];
}

/** Bilingual label of a fact (stored with the rating so the report reads the same later). */
export function factLabel(f: EvidenceFact): { en: string; ar: string } {
  const m = f.m;
  switch (f.kind) {
    case 'traceability':
      return { en: `Job analysis ${f.ref}: ${m.covered}/${m.selected} training tasks covered, ${m.gaps} gaps, ${m.orphans} orphan objectives`, ar: `تحليل الوظيفة ${f.ref}: ${m.covered}/${m.selected} مهام تدريب مغطاة، ${m.gaps} فجوات، ${m.orphans} أهداف يتيمة` };
    case 'effectiveness':
      return m.l3 != null
        ? { en: `Training effectiveness: ${m.l3} L3 observations on ${m.courses} courses`, ar: `فاعلية التدريب: ${m.l3} ملاحظات من المستوى 3 على ${m.courses} دورات` }
        : { en: `Course evaluation forms on file for ${m.with_form}/${m.courses} courses`, ar: `نماذج تقييم الدورات متوفرة لـ ${m.with_form}/${m.courses} دورات` };
    case 'item_analysis':
      return { en: `Item bank: ${m.items} approved items on programme competencies, ${m.released} released attempts`, ar: `بنك الأسئلة: ${m.items} سؤالًا معتمدًا على كفاءات البرنامج، ${m.released} محاولات منشورة` };
    case 'instructor_quals':
      return m.tracks != null
        ? { en: `Instructor pipeline: ${m.tracks} instructor tracks; ${m.evaluators} current evaluators on ${m.standards} standards`, ar: `مسار المدربين: ${m.tracks} مسارات؛ ${m.evaluators} مقيّمون حاليون على ${m.standards} معايير` }
        : { en: `${m.evaluators} current evaluators on ${m.standards} standards; ${m.instructors} qualified instructors`, ar: `${m.evaluators} مقيّمون حاليون على ${m.standards} معايير؛ ${m.instructors} مدربون مؤهلون` };
    case 'signoff_timeliness':
      return { en: `Task sign-offs in the last 12 months: ${m.evaluations}, ${m.acknowledged} acknowledged by a supervisor`, ar: `اعتمادات المهام خلال 12 شهرًا: ${m.evaluations}، منها ${m.acknowledged} أقرّها مشرف` };
    case 'programme_records':
      return { en: `Training records in the last 12 months: ${m.records} completions (${m.passed} passed), ${m.sessions} sessions`, ar: `سجلات التدريب خلال 12 شهرًا: ${m.records} إتمامًا (${m.passed} نجاحًا)، ${m.sessions} جلسات` };
  }
}

export function toLink(f: EvidenceFact): EvidenceLink {
  const l = factLabel(f);
  return { kind: f.kind, ref: f.ref, route: f.route, label_en: l.en, label_ar: l.ar };
}

/** Reasons for a programme's readiness ("Why this?"). */
export function readinessReasons(s: SelfEvalState): Reason[] {
  const r: Reason[] = [{ code: 'accr_readiness', key: 'm26.reasons.accr_readiness', vars: { pct: s.readiness, rated: s.rated, total: s.total } }];
  if (s.gaps) r.push({ code: 'accr_gaps', key: 'm26.reasons.accr_gaps', vars: { n: s.gaps } });
  if (s.rated < s.total) r.push({ code: 'accr_unrated', key: 'm26.reasons.accr_unrated', vars: { n: s.total - s.rated } });
  return r;
}

export const addDaysIso = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
