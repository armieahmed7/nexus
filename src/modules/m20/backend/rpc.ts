// M20 RPC signatures (owner: W1 · F08). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// SQL: supabase/migrations/20261009114001_kafaa_w1e4_opportunities.sql. Rules: src/modules/m20/domain.ts.
import type { Result } from '../../../data/types';
import type { OpportunityInput, OppStats } from '../domain';

export type { OpportunityInput, OppStats };

export interface M20Rpc {
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
