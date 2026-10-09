// M20 RPC signatures (owner: W1 · F08). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// SQL: supabase/migrations/20261009114001_kafaa_w1e4_opportunities.sql. Rules: src/modules/m20/domain.ts.
import type { Result } from '../../../data/types';
import type { OpportunityInput, OppStats } from '../domain';
import type { HostInput, RotationBoard, RotationCandidate, ShadowInput, TemplateInput } from '../rotation';
import type { JoinInput, RequestInput, ReserveBoard, ReserveDesk } from '../reserve';

export type { OpportunityInput, OppStats, HostInput, RotationBoard, RotationCandidate, ShadowInput, TemplateInput, JoinInput, RequestInput, ReserveBoard, ReserveDesk };
export interface CohortInput { id?: string | null; template_id: string; name_en: string; name_ar: string; intake_on: string; status?: 'planned' | 'running' | 'completed' }

/** F15 Rotations and job shadowing (W2 · E4). SQL: supabase/migrations/20261009124001_kafaa_w2e4_rotations.sql. Rules: src/modules/m20/rotation.ts. */
export interface F15Rpc {
  /** F15: create or update a rotation programme template (HR programme owners: hr_analyst, hr_director, training_manager). Security, cyber and
   *  safeguards placements are refused (restricted_kind). Placements must add up to the programme duration. Audited. */
  saveRotationTemplate(input: TemplateInput): Promise<Result<{ id: string; status: string }>>;
  /** F15: create or update a cohort (GDP, GPO, DNT, cross-functional, HiPo intake) of a programme. Programme owners. Audited. */
  saveRotationCohort(input: CohortInput): Promise<Result<{ id: string }>>;
  /** F15: enrol a staff member: creates the placement plan (one placement per template step) with host, line manager and the
   *  sign-off route (host, or the host's line manager when the host is the person's own line manager). Programme owners. Ledger row. */
  enrolRotation(templateId: string, personId: string, cohortId: string | null, startOn: string): Promise<Result<{ enrolment_id: string; placement_ids: string[]; signers: string[] }>>;
  /** F15: mid-point check-in (the person or the host): a status per objective and a note. Audited. */
  placementCheckin(placementId: string, progress: Record<string, string>, note: string): Promise<Result<{ checkin_at: string }>>;
  /** F15: host sign-off of the objectives (levels 0..3 per objective) after the check-in; writes ojt evidence (basis evidenced) and
   *  recomputes the passport. maker_checker: never the person, never a line manager who is also the host. Ledger row. */
  signoffPlacement(placementId: string, levels: Record<string, number>, note: string): Promise<Result<{ evidence_ids: string[]; met: number; total: number }>>;
  /** F15: list (or unlist) myself as a shadowing host for up to six skills. Security, cyber and safeguards staff are refused. */
  setShadowHost(input: HostInput): Promise<Result<{ id: string; active: boolean }>>;
  /** F15: ask to shadow a listed host for 1 to 5 days; needs the host's and the line manager's consent. */
  requestShadow(input: ShadowInput): Promise<Result<{ id: string; line_manager_id: string; same_person: boolean }>>;
  /** F15: host or line manager consents (approve / decline with a reason); the requester withdraws; the host confirms completion
   *  (writes ojt evidence at level 1 per skill; ledger row). */
  decideShadow(requestId: string, decision: 'approve' | 'decline' | 'withdraw' | 'complete', note?: string): Promise<Result<{ status: string; evidence_ids?: string[] }>>;
  /** F15: HR programme board (Agg/A on opportunities, or auditors): cohort progress and objectives met, suppressed below 10 people. */
  rotationBoard(): Promise<RotationBoard | null>;
  /** F15: staff a programme owner may enrol (eligible / already enrolled for the programme, can host a placement). Programme owners only; null otherwise. */
  rotationCandidates(templateId: string | null): Promise<RotationCandidate[] | null>;
}

/** F23 Alumni and expert reserve (W3 · E4). SQL: supabase/migrations/20261009134001_kafaa_w3e4_reserve.sql. Rules: src/modules/m20/reserve.ts. */
export interface F23Rpc {
  /** F23 consent RPC. consent = true joins (or updates) my reserve membership: availability, hours a month, preferred engagements,
   *  expert-finder opt-in; my F01 skill state is frozen into the snapshot. consent = false withdraws: I am hidden everywhere at once,
   *  open engagements end, my stories are unlisted and deletion is scheduled after six months. Staff only; security, cyber and
   *  safeguards roles are refused (restricted_kind); contact details are refused (contact_data). Audited, ledger row. */
  joinReserve(input: JoinInput): Promise<Result<{ id: string; status: string; erase_after: string | null; skills: number }>>;
  /** F23: a manager (W) asks the reserve for short help (mentor, capture interview, instructor, reviewer). Waits for HR approval
   *  (pending_hr) before any alumnus sees it. Security, cyber, safeguards and protected-area work is refused. Audited. */
  requestReserve(input: RequestInput): Promise<Result<{ id: string; status: string }>>;
  /** F23: HR approves (opens the request to alumni; ledger) or declines (reason) a pending request; the poster or HR closes it.
   *  maker_checker: HR never approves their own request. */
  decideReserveRequest(requestId: string, decision: 'approve' | 'decline' | 'close', note?: string): Promise<Result<{ status: string }>>;
  /** F23: an active member expresses interest in an open request (or accepts an HR invitation). */
  reserveInterest(requestId: string, note?: string): Promise<Result<{ id: string; status: string }>>;
  /** F23: HR invites a matched member to an open request. */
  inviteReserve(requestId: string, alumniId: string, note?: string): Promise<Result<{ id: string; status: string }>>;
  /** F23: HR approves an interested member ("handed to HR"; the poster now sees the alumnus; ledger) or declines; the poster or HR
   *  confirms completion (ledger); the alumnus withdraws. */
  decideReserveEngagement(engagementId: string, decision: 'approve' | 'decline' | 'complete' | 'withdraw', note?: string): Promise<Result<{ status: string }>>;
  /** F23: the alumni board for the signed-in member: HR-approved open requests (never the poster's identity) and my engagements. Null when I am not a member. */
  reserveBoard(): Promise<ReserveBoard | null>;
  /** F23: the HR reserve desk (hr_analyst, hr_director): active members, all requests and engagements, erasures due, suppressed stats. Null otherwise. */
  reserveDesk(): Promise<ReserveDesk | null>;
}

export interface M20Rpc extends F15Rpc, F23Rpc {
  /** F08: post an opportunity (draft or open). Managers and the training manager (W). Security, cyber, safeguards and
   *  protected-area work is refused (restricted_kind) and audited. */
  postOpportunity(input: OpportunityInput): Promise<Result<{ id: string; status: string }>>;
  /** F08: open, close or reopen an opportunity (poster, or the training manager). Closing ends pending applications. */
  setOpportunityStatus(id: string, status: 'open' | 'closed'): Promise<Result<{ status: string }>>;
  /** F08: apply with a short note. Routes the release to the line manager (or the skip-level manager when the line manager is the poster). */
  applyOpportunity(opportunityId: string, note: string): Promise<Result<{ id: string; releaser_id: string; skip_level: boolean }>>;
  /** F08: line-manager release (maker-checker: the poster can never release). Decline needs a reason. */
  releaseDecision(applicationId: string, decision: 'release' | 'decline', note?: string): Promise<Result<{ status: string }>>;
  /** F08: poster selects (only after release: release_required) or does not select. Ledger row. */
  selectApplicant(applicationId: string, decision: 'selected' | 'not_selected', note?: string): Promise<Result<{ status: string; filled: boolean }>>;
  /** F08: poster signs off the outcome; writes ojt skill evidence (basis evidenced) per skill gained and recomputes the passport. Ledger row. */
  completeOpportunity(applicationId: string, levels: Record<string, number>, note: string): Promise<Result<{ evidence_ids: string[] }>>;
  /** F08: the applicant withdraws (before completion). */
  withdrawOpportunityApplication(applicationId: string): Promise<Result<{ status: string }>>;
  /** F08: save or unsave an opportunity for later (own bookmarks). */
  saveOpportunity(opportunityId: string, saved: boolean): Promise<Result<{ saved: boolean }>>;
  /** F08: HR oversight aggregates (Agg/A on opportunities, or auditors). Family cells suppressed below 10 applicants. Null when not permitted. */
  opportunityStats(): Promise<OppStats | null>;
}
