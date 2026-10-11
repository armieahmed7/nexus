// M24 RPC signatures (owner: W3 · E2 · F20 KLRA, F21 Knowledge capture studio). Merged into Rpc (src/data/types.ts) through
// src/data/ext/rpc.ts. Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> in
// supabase/migrations/20261009132001_kafaa_w3e2_knowledge.sql (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { Reason } from '../../../domain/engines/types';
import type { Band, Drivers, Heatmap, Mitigation, Thresholds } from '../klra';
import type { KeyPoint } from '../capture';
import type { Suggestion } from '../enrich';

export type { Heatmap, Thresholds, Mitigation, Band, Drivers, Suggestion, KeyPoint };

/** A position as the KLRA RPCs return it: bands only (never a birth date, an age or an exact date). */
export interface KlraPosition {
  id: string; person_id: string | null; role_id: string | null; family_id: string | null; department: string; kind: string;
  title_en: string; title_ar: string; holder_en: string; holder_ar: string; retirement_band: string; contract_kind: string; contract_end_band: string;
  criticality: string; spof_skill_ids: string[]; codified_base: number; replace_months: number; feed_as_of: string;
}
export interface KlraAction {
  id: string; assessment_id: string; position_id: string; period: string; kind: string; owner_role: string; due_on: string; status: string;
  note: string; ref_table: string | null; ref_id: string | null; outcome: string | null; created_at: string; closed_at: string | null; overdue: boolean;
}
export interface KlraAssessment {
  id: string; period: string; position_id: string; department: string; attrition_factor: number; position_factor: number; total: number;
  proposed_attrition: number; proposed_position: number; adjusted: boolean; note: string | null; reasons: Reason[]; drivers: Drivers;
  assessed_by_name: string; assessed_by_name_ar: string; assessed_at: string;
}
export interface KlraRow extends KlraAssessment { band: Band; mitigation: Mitigation; position: KlraPosition; actions: KlraAction[] }
export interface KlraRegister {
  mode: 'all' | 'scope' | 'agg' | 'none'; period: string; current: string; periods: string[]; quarter_end: string; thresholds: Thresholds;
  rows: KlraRow[]; pending: KlraPosition[];
}
export interface KlraPositionDetail {
  position: KlraPosition; thresholds: Thresholds; current: string;
  proposal: { attrition: number; position: number; total: number; drivers: Drivers; reasons: Reason[] };
  history: KlraRow[]; assets: { id: string; title_en: string; title_ar: string; status: string }[]; sessions: { id: string; title: string; status: string; planned_on: string }[];
}
export interface AssessInput { position_id: string; attrition_factor: number; position_factor: number; note?: string }
export interface MitigationInput { assessment_id: string; kind: string; owner_role: string; due_on: string; note?: string }

export interface SmeInput { kind: string; skill_ids: string[]; availability: string; departing_band: string; listed: boolean; headline?: string }
export interface PlanCaptureInput {
  sme_id: string; interviewer_id?: string | null; template: string; planned_on: string; title: string; lang?: 'en' | 'ar';
  skill_ids?: string[]; standard_ids?: string[]; position_id?: string | null; action_id?: string | null;
}
export interface RecordCaptureInput { status: 'held' | 'transcribed' | 'cancelled'; held_on?: string | null; transcript?: string | null; notes?: string | null }
export interface CaptureSessionView {
  id: string; sme_id: string; interviewer_id: string; created_by: string; template: string; title: string; lang: string; status: string;
  planned_on: string; held_on: string | null; duration_min: number; skill_ids: string[]; standard_ids: string[]; position_id: string | null; action_id: string | null;
  transcript: string; transcript_words: number; notes: string; asset_id: string | null; asset_status: string | null;
  sme_name: string; sme_name_ar: string; interviewer_name: string; interviewer_name_ar: string; created_at: string; updated_at: string;
}
export interface CaptureBoard { mode: 'all' | 'mine'; can_plan: boolean; sessions: CaptureSessionView[] }
export interface AssetInput {
  id?: string | null; session_id?: string | null; title_en: string; title_ar: string; summary_en: string; summary_ar: string; body: string; body_lang?: 'en' | 'ar';
  key_points: KeyPoint[]; skill_ids: string[]; standard_ids: string[]; system_family: string; suggestions?: Suggestion[]; submit: boolean;
}
export interface ReviewInput {
  asset_id: string; kind: 'technical' | 'security'; outcome: 'pass' | 'changes'; note?: string;
  checks?: { accurate?: boolean; deidentified?: boolean; no_security?: boolean }; decisions?: Record<string, 'accepted' | 'rejected'>;
}
export interface ReviewView { id: string; reviewer_id: string; reviewer_name: string; reviewer_name_ar: string; kind: string; outcome: string; note: string; checks: Record<string, boolean>; created_at: string; superseded: boolean }
export interface QueueAsset {
  id: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string; body: string; body_lang: string; key_points: KeyPoint[];
  skill_ids: string[]; standard_ids: string[]; oe_ids: string[]; course_ids: string[]; system_family: string; status: string; suggestions: Suggestion[];
  author_id: string; sme_id: string; author_name: string; author_name_ar: string; sme_name: string; sme_name_ar: string; template: string | null;
  source_session_id: string | null; version: number; submitted_at: string | null; reviews: ReviewView[];
}
export interface ReviewQueue { can_review: boolean; can_publish: boolean; items: QueueAsset[] }


// ───────────── FS44 Expert lecture library + FS45 Localisation countdown (wave E · E3). Local: backend/local.fs44.ts; SQL:
// supabase/migrations/20261010253001_kafaa_fs53_lectures_localisation.sql (kafaa_save_lecture ... kafaa_set_localisation_status).
export interface LectureChapter { at: number; en: string; ar: string }
export interface LectureInput {
  id?: string | null; speaker_id?: string | null; title_en: string; title_ar: string; abstract_en: string; abstract_ar: string; format: string; lang: 'en' | 'ar';
  delivered_on: string; duration_min: number; skill_ids: string[]; system_family: string; chapters?: LectureChapter[]; recording_code?: string | null;
  position_id?: string | null; submit: boolean;
}
export interface ContributionView {
  id: string; person_id: string; person_name: string; person_name_ar: string; kind: string; contributor_role: string; ref_table: string; ref_id: string;
  title_en: string; title_ar: string; skill_ids: string[]; evidence_skill_ids: string[]; level: number; status: string; submitted_on: string;
  decided_on: string | null; decided_by_name: string; decided_by_name_ar: string; note: string | null; evidence_ids: string[];
  source_status: string; source_date: string | null; position_linked: boolean; reasons: Reason[];
}
export interface LectureReview {
  id: string; title_en: string; title_ar: string; abstract_en: string; abstract_ar: string; speaker_id: string; speaker_name: string; speaker_name_ar: string; created_by: string;
  format: string; lang: string; delivered_on: string; duration_min: number; skill_ids: string[]; position_id: string | null; position_title_en: string; position_title_ar: string;
  system_family: string; chapters: LectureChapter[]; recording_code: string | null;
}
export interface ContributionQueue {
  can_decide: boolean; review: LectureReview[]; pending: ContributionView[]; decided: ContributionView[];
  stats: { pending: number; validated: number; rejected: number; people: number; evidence: number };
}
export interface LocInstructor { track_id: string; person_id: string; name: string; name_ar: string; state: string; tenths: number }
export interface LocBoardItem {
  id: string; programme_id: string | null; programme_code: string | null; programme_en: string; programme_ar: string; title_en: string; title_ar: string; scope: string;
  partner_org_id: string; partner_en: string; partner_ar: string; partner_role_en: string; partner_role_ar: string; standard_ids: string[]; discipline: string;
  instructors_needed: number; baseline_on: string; target_on: string; status: string; status_note: string; status_at: string | null; history: unknown[];
  readiness: { needed: number; ready_now: number; pipeline: number; lapsed: number; tenths: number; pct: number; gap: number };
  risk: { level: string; overdue: boolean; days_left: number; regressed: boolean; reasons: Reason[] };
  instructors: LocInstructor[] | null;
}
export interface LocBoard {
  can_edit: boolean; can_see_people: boolean; today: string; deadline: string; items: LocBoardItem[];
  summary: { items: number; transferred: number; overdue: number; high: number; medium: number; low: number; avg_pct: number; days_to_2030: number; by_year: { year: number; items: number; transferred: number }[] };
}
export interface LocOverdue { today: string; items: { id: string; title_en: string; title_ar: string; partner_en: string; partner_ar: string; programme_id: string | null; target_on: string; days_overdue: number; pct: number; status: string }[] }
export interface LocStatusInput { status: string; target_on?: string | null; note?: string }

export interface Fs44Rpc {
  /** Save a lecture draft or submit it for publication (staff for their own talks; the KM owner on behalf of a speaker). The KLRA position
   *  is linked automatically from the speaker's own positions. Security-restricted topics are refused (`security_restricted`). Audited. */
  saveLecture(input: LectureInput): Promise<Result<{ id: string; status: string; position_id: string | null }>>;
  /** KM owner (knowledge A) publishes a submitted lecture (never their own); re-screens it; opens the speaker's contribution. Ledger row. */
  publishLecture(id: string): Promise<Result<{ status: string; contribution_id: string | null }>>;
  /** The speaker or the KM owner withdraws a submitted or published lecture with a reason. Ledger row when it was published. */
  withdrawLecture(id: string, reason: string): Promise<Result<{ status: string }>>;
  /** KM owner: open a pending contribution for every published lecture and knowledge asset that has none yet. Audited. */
  syncContributions(): Promise<Result<{ created: number; ids: string[] }>>;
  /** Contributions to validate (KM owner) or to read (auditors). Null for everyone else. */
  contributionQueue(): Promise<ContributionQueue | null>;
  /** KM owner validates (writes F01 evidence and recomputes the person's skills) or rejects (with a reason) a contribution; never their own. */
  validateContribution(id: string, decision: 'validate' | 'reject', note?: string): Promise<Result<{ status: string; evidence_ids: string[] }>>;
  /** The localisation countdown with computed readiness and risk (staff; instructor names only for SAT readers). Null for everyone else. */
  localisationBoard(): Promise<LocBoard | null>;
  /** Items past their target date and not yet transferred (the F22 handover board panel). Null without knowledge R. */
  localisationOverdue(): Promise<LocOverdue | null>;
  /** Training manager sets an item's status and, with a reason, its target date (no later than 2030-12-31). Ledger row. */
  setLocalisationStatus(id: string, input: LocStatusInput): Promise<Result<{ status: string; target_on: string }>>;
}

export interface M24Rpc extends Fs44Rpc {
  // ── F20 KLRA
  /** The register for a quarter: KM owner (knowledge A) every position, a department head (Scope) their scope, HR (Agg) none (mode 'agg'). */
  klraRegister(period?: string | null): Promise<KlraRegister>;
  /** Department x risk band counts for a quarter, every cell under 10 suppressed. knowledge A, Scope or Agg; null otherwise. */
  klraHeatmap(period?: string | null): Promise<Heatmap | null>;
  /** One position: the current proposal with reasons, every quarter's assessment and actions, linked capture sessions and assets. Null when not visible. */
  klraPosition(positionId: string): Promise<KlraPositionDetail | null>;
  /** Assess (or re-assess) a position for the current quarter. A changed factor needs a note. Audited. */
  assessPosition(input: AssessInput): Promise<Result<{ id: string; total: number; band: Band }>>;
  /** KM owner: assess every position not yet assessed this quarter with the proposed factors. Ledger row. */
  reassessQuarter(period?: string | null): Promise<Result<{ period: string; created: number; skipped: number }>>;
  /** Plan a mitigation action (capture, mentoring, successor, documentation, cross-training) with an owner and a due date. Audited. */
  planMitigation(input: MitigationInput): Promise<Result<{ id: string }>>;
  /** Close an action as done or cancelled (cancel needs a reason). Audited. */
  closeAction(id: string, outcome: 'done' | 'cancelled', note?: string): Promise<Result<{ status: string }>>;
  /** KM owner: set the medium and high thresholds on the 1-25 total. Audited, ledger row. */
  setKlraThresholds(high: number, medium: number): Promise<Result<Thresholds>>;
  // ── F21 capture studio
  /** Opt in (or update) my SME profile: skills, availability, capture window band, listed in the directory or not. */
  setSmeProfile(input: SmeInput): Promise<Result<{ id: string; listed: boolean }>>;
  /** Plan a structured capture interview with an SME (interviewers, KM owner, or the SME's department head). */
  planCapture(input: PlanCaptureInput): Promise<Result<{ id: string }>>;
  /** Mark a session held or cancelled, or upload its transcript text (screened). SME, interviewer or KM owner. */
  recordCapture(id: string, input: RecordCaptureInput): Promise<Result<{ status: string; words: number }>>;
  /** Capture sessions I take part in (all of them for the KM owner). */
  captureBoard(): Promise<CaptureBoard>;
  /** Save a knowledge asset draft or submit it for review. Security, safeguards and cyber content and contact details are refused with guidance. */
  submitAsset(input: AssetInput): Promise<Result<{ id: string; status: string }>>;
  /** Assets waiting for review with their current reviews (interviewers and the KM owner). */
  reviewQueue(): Promise<ReviewQueue>;
  /** Technical review (accept or reject each suggestion) or security and content check. Never the author or the SME. */
  reviewAsset(input: ReviewInput): Promise<Result<{ id: string; status: string }>>;
  /** KM owner publishes after a technical pass and a security pass by two different people other than the author. Ledger row. */
  publishAsset(id: string): Promise<Result<{ status: string; action_closed: string | null }>>;
  /** KM owner or the author withdraws a published asset (it leaves search at the next refresh). Ledger row. */
  withdrawAsset(id: string, reason: string): Promise<Result<{ status: string }>>;
  /** KM owner attaches a published asset to qualification standards as "read before requalification". Audited. */
  attachAssetRequal(id: string, standardIds: string[]): Promise<Result<{ requal_standard_ids: string[] }>>;
  /** Mark a published asset as used (once per person); "used by N" shows from 10 people. */
  markAssetUsed(id: string): Promise<Result<{ used_by: number }>>;
}
