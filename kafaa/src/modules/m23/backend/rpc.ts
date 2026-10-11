// M23 RPC signatures (owner: W3 · E1 · F18 Talent review, F19 Succession planning). Merged into Rpc (src/data/types.ts) through
// src/data/ext/rpc.ts. Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name>
// in supabase/migrations/20261009131001_kafaa_w3e1_talent.sql (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type {
  Anchor, CycleStatus, DevAction, EvidenceSnapshot, FlagCode, HardGate, Readiness, Reason, SlateFlag, SuccessionAggregates, TalentAggregates,
} from '../domain';

export type { TalentAggregates, SuccessionAggregates };

export interface CycleSummary {
  id: string; code: string; title_en: string; title_ar: string; period: string; family_ids: string[]; status: CycleStatus;
  opened_on: string; due_on: string | null; members: number; in_view: number; placed_in_view: number; calibrated_in_view: number;
  locked_at: string | null; calibrated_at: string | null;
}
export interface PlacementView {
  id: string; perf: number; potential: number; anchors: Partial<Record<Anchor, number>>; box: number; hipo: boolean; perf_record: number | null;
  evidence_index: number; evidence_snapshot: EvidenceSnapshot | Record<string, never>; placed_by: string; placed_by_name: string; placed_by_name_ar: string; placed_at: string;
  calibrated: boolean; calibrated_at: string | null; note: string | null; actions: DevAction[]; status: 'placed' | 'locked'; history: unknown[];
}
export interface BoardMember {
  person_id: string; name: string; name_ar: string; role_id: string | null; family_id: string | null; crew: string | null; team_id: string | null;
  perf_rating: { period: string; rating: number } | null; suggested_perf: number | null;
  evidence: EvidenceSnapshot; index: number; flags: FlagCode[]; can_place: boolean; placement: PlacementView | null;
}
export interface TalentBoard {
  cycle: {
    id: string; code: string; title_en: string; title_ar: string; period: string; family_ids: string[]; status: CycleStatus; opened_on: string; due_on: string | null;
    calibration_started_at: string | null; calibrated_by: string | null; calibrated_name: string | null; calibrated_at: string | null;
    locked_by: string | null; locked_name: string | null; locked_at: string | null; lock_note: string | null;
  };
  view: 'all' | 'scope';
  members_total: number;
  placed_total: number;
  cuts: { low: number; high: number } | null;
  can: { place: boolean; calibrate: boolean; lock: boolean; lock_blocker: null | 'maker_checker' | 'not_calibrated' | 'locked' };
  members: BoardMember[];
}
export interface PlaceInput {
  cycle_id: string; person_id: string; perf: number; anchors: Partial<Record<Anchor, number>>; note?: string | null; actions?: DevAction[];
}
export interface CalibrationChange { person_id: string; perf: number; potential: number; note: string }

export interface SuccessorView {
  id: string; person_id: string | null; cover_source: 'internal' | 'khnp' | 'contractor'; cover_label_en: string; cover_label_ar: string;
  readiness: Readiness | null; computed_readiness: Readiness | null; readiness_pct: number | null; months: number | null; gates: HardGate[];
  gaps: { competency_id: string; have: number; need: number; importance: string }[]; emergency: boolean; actions: DevAction[]; note: string | null;
  status: 'proposed' | 'confirmed' | 'withdrawn'; slates: number; person_name: string; person_name_ar: string; person_role_id: string | null;
  confirmed_at: string | null; proposed_at: string;
}
export interface SlateView {
  id: string; role_id: string; period: string; status: 'draft' | 'proposed' | 'confirmed'; entity_id: string | null; family_id: string | null;
  critical: boolean; leadership: boolean; incumbent_en: string; incumbent_ar: string; target_bench: number; confirmed_at: string | null; confirmed_name: string | null;
  flags: SlateFlag[]; successors: SuccessorView[]; rolled_up: { period: string; at: string } | null;
}
export interface SuccessionBoard {
  view: 'all' | 'function';
  can: { edit: boolean; rollup: boolean };
  slates: SlateView[];
  aggregates: SuccessionAggregates | null;
}
export interface Candidate {
  person_id: string; name: string; name_ar: string; role_id: string | null; relation: 'peer' | 'feeder' | 'other';
  readiness: Readiness; pct: number | null; months: number | null; gates: HardGate[]; gates_met: boolean;
  gaps: { competency_id: string; have: number; need: number; importance: string }[]; reasons: Reason[]; slates: number; on_slate: boolean;
}
export interface SuccessorInput {
  slate_id: string; person_id?: string | null; cover_source?: 'internal' | 'khnp' | 'contractor'; cover_label_en?: string; cover_label_ar?: string;
  readiness?: Readiness | null; emergency?: boolean; note?: string | null; actions?: DevAction[];
}

export interface M23Rpc {
  // ── F18 Talent review
  /** Review cycles the caller may see (HR director: all; managers and HR BP: cycles with people in their scope), with counts. */
  talentCycles(): Promise<Result<CycleSummary[]>>;
  /** The board of one cycle: members in the caller's view (never themselves), live evidence, placement, outlier flags. Audited read. */
  talentBoard(cycleId: string): Promise<Result<TalentBoard>>;
  /** A line manager places someone in their scope (open cycle). Snapshots the evidence; refuses `cycle_locked`. Audited. */
  placeTalent(input: PlaceInput): Promise<Result<{ id: string; box: number; potential: number; hipo: boolean; flags: FlagCode[] }>>;
  /** HR facilitator: start calibration, apply adjustments (each with a reason) and optionally finish. Refuses `cycle_locked`. Audited. */
  calibrateCycle(cycleId: string, changes: CalibrationChange[], finish: boolean): Promise<Result<{ status: CycleStatus; changed: number; calibrated: boolean }>>;
  /** HR director locks a calibrated cycle (maker-checker): publishes development priorities and the HiPo pool. Audited and ledgered. */
  lockCycle(cycleId: string, note: string): Promise<Result<{ status: CycleStatus; priorities: number; hipo: number }>>;
  /** HR aggregates of placements (one cycle or all): every cell under 10 suppressed, women and Emirati splits included. Audited. */
  talentAggregates(cycleId: string | null): Promise<Result<TalentAggregates>>;
  // ── F19 Succession
  /** Slates the caller may see (HR: all; executives: their function) with successors, flags and (Agg/R/A) aggregates. */
  successionBoard(): Promise<Result<SuccessionBoard>>;
  /** Candidates for a slate (people in the role and in feeder roles) with computed readiness, hard gates and reasons. */
  successionCandidates(slateId: string): Promise<Result<Candidate[]>>;
  /** HR director proposes or updates a successor (or names external emergency cover). Ready now needs every hard gate met. Audited. */
  proposeSuccessor(input: SuccessorInput): Promise<Result<{ id: string; readiness: Readiness | null; computed: Readiness | null }>>;
  /** HR director withdraws a successor from an unconfirmed slate (reason required). Audited. */
  withdrawSuccessor(id: string, note: string): Promise<Result<{ status: string }>>;
  /** HR director confirms a slate (re-checks hard gates). Audited and ledgered. */
  confirmSlate(slateId: string, note: string): Promise<Result<{ status: string; successors: number }>>;
  /** HR director rolls confirmed slates of critical roles up into M07 critical_roles counts for the period. Audited and ledgered. */
  rollupBench(period: string): Promise<Result<{ period: string; roles: number; skipped: string[] }>>;
}
