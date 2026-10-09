// M26 RPC signatures (owner: W4 · E2 · F27 SAT analysis workbench, F29 Accreditation-readiness self-evaluation). Merged into Rpc
// (src/data/types.ts) through src/data/ext/rpc.ts. Every RPC exists three times and they must agree: this signature,
// backend/local.ts and SQL kafaa_<name> in supabase/migrations/20261009142001_kafaa_w4e2_sat.sql (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { Decision, Impact, Proposal } from '../sat';
import type { EvidenceFact, EvidenceLink } from '../accr';

export type { Impact, EvidenceFact, EvidenceLink };

export interface SaveTaskInput { id?: string | null; role_id: string; title_en: string; title_ar: string; duty_en?: string; duty_ar?: string; critical?: boolean }
export interface SaveObjectiveInput { id?: string | null; kind: 'terminal' | 'enabling'; text_en: string; text_ar: string; course_id?: string | null; module_id?: string | null; competency_id?: string | null; role_id?: string | null }
export interface LinkInput { task_id: string; objective_ref: string; course_id?: string | null; module_id?: string | null; jpm_id?: string | null; active?: boolean }
export interface ChangeInput { task_id: string; kind: 'modified' | 'retired'; summary: string; title_en?: string | null; title_ar?: string | null; trigger?: 'task_change' | 'effectiveness' | 'oe' | 'regulatory' }
export interface SurveyTask { id: string; role_id: string; code: string; title_en: string; title_ar: string; duty_en: string; duty_ar: string; critical: boolean; mine: { d: number; i: number; f: number; note: string } | null; raters: number }
export interface DifSurvey { open: boolean; role_id: string | null; tasks: SurveyTask[] }

export interface RateCriterionInput {
  selfeval_id: string; criterion_id: string; rating: number; evidence: EvidenceLink[]; gap_en?: string; owner_role?: string | null; due_on?: string | null; note?: string;
}
export interface AccrEvidence { programme_id: string; today: string; facts: EvidenceFact[] }

export interface M26Rpc {
  // ── F27 SAT analysis workbench
  /** Add a task to a role's inventory (or edit the title of a task not yet linked to training). Security, safeguards and cyber roles are refused. sat W. */
  saveJtaTask(input: SaveTaskInput): Promise<Result<{ id: string }>>;
  /** DIF survey: rate a task's difficulty, importance and frequency (1-5). Training staff (sat W), or a subject-matter expert (F21 SME profile) who holds this role while the survey is open. */
  rateDif(taskId: string, d: number, i: number, f: number, note?: string): Promise<Result<{ id: string; proposal: Proposal }>>;
  /** The training manager records train / no-train / overtrain; a decision that differs from the DIF rule needs a reason. Ledger row. */
  decideTraining(taskId: string, decision: Decision, note?: string): Promise<Result<{ decision: Decision; override: boolean }>>;
  /** Write (or edit) a learning objective in the design phase. sat W. */
  saveObjective(input: SaveObjectiveInput): Promise<Result<{ id: string }>>;
  /** Link (or unlink with active = false) a task to a learning objective and the course, module or JPM that delivers it. sat W. */
  linkObjective(input: LinkInput): Promise<Result<{ id: string; active: boolean }>>;
  /** What a change to this task would touch: courses, standards, JPMs and assessment items (metadata only). sat R. */
  satImpact(taskId: string): Promise<Impact | null>;
  /** Record a task change (or retirement): lists the impact and opens one review item per affected course and standard. Ledger row. */
  openSatChange(input: ChangeInput): Promise<Result<{ id: string; items: number; impact: Impact }>>;
  /** Close a review item: a course as updated or no change, a standard as revised (after rpc.reviseStandard) or no change. The change closes with its last item (ledger row). */
  resolveSatChangeItem(itemId: string, outcome: 'updated' | 'revised' | 'no_change', note?: string): Promise<Result<{ status: string; change_status: string; revision_id: string | null }>>;
  /** Move a job analysis draft -> survey (sat W) -> approved (training manager; every task decided; ledger row). */
  setAnalysisStatus(roleId: string, status: 'draft' | 'survey' | 'approved'): Promise<Result<{ status: string }>>;
  /** The open DIF survey for my own role, when I am a subject-matter expert (F21 SME profile) or training staff. */
  difSurvey(): Promise<DifSurvey>;
  // ── F29 accreditation readiness
  /** Open the current half-year self-evaluation for a programme. sat W. */
  openSelfEval(programmeId: string): Promise<Result<{ id: string; cycle: string }>>;
  /** Rate one criterion with evidence links; a gap (1 or 2) needs an owner and a due date. sat W, draft only. */
  rateCriterion(input: RateCriterionInput): Promise<Result<{ id: string; readiness: number; gaps: number }>>;
  /** Finalise (maker-checker: never by its sole author). Training manager; every criterion rated and every gap owned. Ledger row. */
  finaliseSelfEval(selfEvalId: string): Promise<Result<{ status: string; readiness: number; gaps: number }>>;
  /** Evidence Kafa'a holds for a programme (counts only), to suggest links per criterion. sat R. Null when not visible. */
  accrEvidence(programmeId: string): Promise<AccrEvidence | null>;
}
