// M04 · F28 Simulator scenario library RPC signatures (owner: W4 · E3). Merged into M04Rpc (backend/rpc.ts), then into Rpc.
// Every RPC exists three times and they agree: this signature, backend/simulator.local.ts and SQL kafaa_<name>
// (supabase/migrations/20261009143001_kafaa_w4e3_simulator.sql) + backend/supabase.ts.
import type { Result } from '../../../data/types';
import type { Dimension, PlanItemInput, ScenarioInput, XapiStatement } from '../scenarios';

export interface DebriefInput {
  slot_id: string;
  scenario_id: string;
  cycle_id?: string | null;
  /** Crew members on the debrief (each must be in the crew booked in the slot); only those present get evidence. */
  attendance: { person_id: string; present: boolean }[];
  /** Instructor ratings of the four team competencies, 1..5. */
  ratings: Record<Dimension, number>;
  /** Crew self-ratings (optional; all four or none). */
  self_ratings?: Record<Dimension, number> | null;
  strengths?: string;
  improvements?: string;
  /** The crew's own self-critique, captured in the debrief. */
  critique?: string;
  /** Language the notes are written in (stored in the *_en or *_ar columns). */
  lang?: 'en' | 'ar';
}
export interface DebriefResult { id: string; present: number; absent: number; evidence: number; statements: number }
export interface SimDebriefView {
  id: string; slot_id: string; scenario_id: string; cycle_id: string | null; crew: string; simulator: string; held_on: string; instructor_person_id: string;
  ratings: Record<Dimension, number>; self_ratings: Record<Dimension, number> | null;
  strengths_en: string | null; strengths_ar: string | null; improvements_en: string | null; improvements_ar: string | null; critique_en: string | null; critique_ar: string | null;
  scenario: { id: string; code: string; title_en: string; title_ar: string; category: string };
  members: { person_id: string; position: string; present: boolean; evidence: number }[];
  /** 'kafaa': recorded with recordDebrief (writes evidence); 'import': history from the training records system (no evidence). */
  source: 'kafaa' | 'import';
  /** The caller is a crew member on this debrief. */
  mine: boolean;
}
export type { XapiStatement };

export interface M04SimRpc {
  /** F28: create or revise a training scenario (instructors, training manager: sat W). purpose = exam is refused (exam_content);
   *  free text is content-checked. A revision of an approved scenario goes back to review. Audited. */
  saveSimScenario(input: ScenarioInput): Promise<Result<{ id: string; status: string; revision: number }>>;
  /** F28: the training manager (sat A) approves or returns a scenario in review (never their own revision), or retires one. Ledger on approve and retire. */
  reviewSimScenario(scenarioId: string, decision: 'approve' | 'return' | 'retire', note?: string): Promise<Result<{ id: string; status: string }>>;
  /** F28: set the scenarios planned in each segment of a COCT/LOCT cycle (sat W); optionally submit for approval. Returns the gap count. */
  planCycle(cycleId: string, items: PlanItemInput[], submit?: boolean): Promise<Result<{ cycle_id: string; status: string; items: number; gaps: number }>>;
  /** F28: the training manager approves a submitted cycle (not their own plan); approving with coverage gaps needs a reason. Ledger. */
  approveCycle(cycleId: string, gapNote?: string): Promise<Result<{ cycle_id: string; status: string; gaps: number }>>;
  /** F28: record a crew debrief for a booked, started slot (sat W). Writes F01 evidence (ojt, evidenced) for crew members present
   *  in the slot only, xAPI-shaped statements on the debrief for the F30 emitter, notifications, audit and ledger. */
  recordDebrief(input: DebriefInput): Promise<Result<DebriefResult>>;
  /** F28: debriefs the caller may see: all for simulator instructors, the training manager and auditors (sat); otherwise the
   *  debriefs the caller was on (Own) or, for managers and instructors, crew members in their scope. Read only. */
  simDebriefs(): Promise<SimDebriefView[]>;
}
