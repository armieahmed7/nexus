// M10 extension RPC signatures (owner: FS wave G · E4, FS66 + FS67). Merged into Rpc through src/data/ext/rpc.ts (one-line hook, FS66).
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { DecisionInput, HireInput, ProgrammeCoverage, ProgrammeInput } from '../alignment';
import type { FellowshipInput, FwStats, MsAction } from '../fellowship';

export interface M10Rpc {
  /** FS66: a university saves its own programme (draft, returned or endorsed: an endorsed programme goes back to draft as a new version);
   *  `submit: true` sends it for review. The university (ecosystem OrgW on its own organisation) or a partnerships admin (partner_org A).
   *  Audited; no ledger. */
  saveProgramme(input: ProgrammeInput): Promise<Result<{ id: string; status: string; version: number; coverage: ProgrammeCoverage }>>;
  /** FS66: a framework owner (frameworks A), never the submitter, endorses or returns a submitted programme. Endorsing needs the three
   *  computed and the three reviewer criteria; it writes validated evidence for waiting graduates whose graduation date it covers.
   *  Ledger kafaa.programme.endorse / kafaa.programme.return. */
  endorseProgramme(id: string, input: DecisionInput): Promise<Result<{ id: string; status: string; evidence: number; graduates: number }>>;
  /** FS66: HR (applications A) records the hire of a programme graduate; evidence is written only when the programme is endorsed and the
   *  graduation date is inside the endorsement window. Ledger kafaa.programme.graduate_hire. */
  recordGraduateHire(input: HireInput): Promise<Result<{ id: string; status: string; evidence: number }>>;
  /** FS67: HR (ecosystem A) awards a fellowship; its five milestones are created from the kind's template. Ledger kafaa.fellowship.award. */
  saveFellowship(input: FellowshipInput): Promise<Result<{ id: string; milestones: number }>>;
  /** FS67: submit (fellow, or the university for its own milestones), sign off or return (named supervisor or HR, never the submitter).
   *  The last required sign-off completes the fellowship. Sign-offs are ledgered (kafaa.fellowship.milestone). */
  updateMilestone(id: string, action: MsAction, note?: string): Promise<Result<{ id: string; status: string; fellowship_status: string }>>;
  /** FS67: HR withdraws an active fellowship with a reason (it stays in the completion denominator). Ledger kafaa.fellowship.withdraw. */
  withdrawFellowship(id: string, reason: string): Promise<Result<{ id: string }>>;
  /** FS67: completion statistics from milestones (suppressed under 10) for anyone holding ecosystem R/Agg/W/A. */
  fellowshipStats(): Promise<Result<FwStats>>;
}
