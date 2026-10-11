// FS wave C · E2 RPC signatures (FS19 Future-skills course pack, FS20 Future-skills academies and cohorts). Merged into M04Rpc
// (backend/rpc.ts) and from there into Rpc through src/data/ext/rpc.ts. Every RPC exists three times and they agree: this signature,
// backend/fs.local.ts and SQL kafaa_<name> (supabase/migrations/20261010232001_kafaa_fs32_course_pack_academies.sql) + backend/supabase.ts.
import type { Result } from '../../../data/types';
import type { CopyProblem } from '../fsPack';
import type { CapstoneResult, StatsOut } from '../academy';

export interface PackLinkInput { skill_id: string; level: number; objective_en: string; objective_ar: string }
export interface PackLinksResult { course_id: string; links: number; copy_check: 'passed' | 'failed'; problems: CopyProblem[] }
export interface PackCheckResult { checked: number; passed: number; failed: { course_id: string; problems: CopyProblem[] }[] }
export interface NominateInput { cohort_id: string; person_id?: string | null; note?: string | null }
export interface DecideInput { member_id: string; decision: 'accept' | 'decline'; mentor_person_id?: string | null; reviewer_person_id?: string | null; note?: string | null }
export interface CapstoneInput { member_id: string; title: string; summary: string; artefact_kind?: string | null; lang?: 'en' | 'ar'; submit: boolean }
export interface SignoffInput { capstone_id: string; result: CapstoneResult; feedback?: string | null }
export interface SignoffResult { capstone_id: string; status: 'signed_off' | 'returned'; result: CapstoneResult; member_status: string; evidence: { skill_id: string; level: number }[] }
export interface Nominee { person_id: string; self: boolean }

export interface M04FsRpc {
  /** FS19: the training staff (training W) set a pack course's skill links (1-8, level 1-3, EN/AR objective); the links become the
   *  course's evidence keys on those skills and the copy and link check runs again. Security skills are refused. Audited. */
  saveCourseSkills(courseId: string, links: PackLinkInput[]): Promise<Result<PackLinksResult>>;
  /** FS19: run the copy and link check on every pack course and store the result (training W). Audited. */
  checkCoursePack(): Promise<Result<PackCheckResult>>;
  /** FS20: nominate myself, someone in my team (I am their line manager) or, as programme owner, anyone, for a cohort open to
   *  nominations. One open nomination or place per academy. Audited. */
  nominateAcademy(input: NominateInput): Promise<Result<{ id: string; status: 'nominated' }>>;
  /** FS20: the programme owner (training W + A) accepts (naming a mentor and a reviewer, enrolling the member in the module courses)
   *  or declines a nomination. Acceptance is a ledger event. */
  decideAcademyNomination(input: DecideInput): Promise<Result<{ id: string; status: string; enrolled: number }>>;
  /** FS20: the member saves or submits their capstone (title, summary, artefact kind); plant-security wording is refused. Audited. */
  saveCapstone(input: CapstoneInput): Promise<Result<{ id: string; status: string }>>;
  /** FS20: the named reviewer signs a submitted capstone off (merit or pass: F01 ojt evidence + skills recompute + alumni) or returns
   *  it (not yet, with feedback). Never the member. Ledger kafaa.academy.capstone_signoff. */
  signoffCapstone(input: SignoffInput): Promise<Result<SignoffResult>>;
  /** FS20: cohort and academy statistics, every figure suppressed under 10 people. Anyone may read (aggregates only). */
  academyStats(): Promise<StatsOut>;
  /** FS20: people the caller may nominate: themselves (staff) and the people whose line manager they are; everyone for the programme owner. */
  academyNominees(): Promise<Nominee[]>;
}
