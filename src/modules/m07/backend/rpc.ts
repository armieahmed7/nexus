// M07 extension RPC signatures (owner: W3 · E3, F22 Handover 2030 board). Merged into Rpc through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { HandoverAggregate, Scenario } from '../handover';

export interface HandoverResult extends HandoverAggregate {
  /** As-of periods that have a cover plan (newest last). */
  periods: string[];
}

export interface M07Rpc {
  /**
   * F22: the suppressed Handover 2030 board for one as-of period ('2026-Q3'; empty = the latest plan) and an optional SIMULATED what-if
   * (OSSA end year 2028-2032, pipeline slip 0-24 months). Counts only; cells under 10 are null. HR, managers and auditors
   * (workforce_analytics Agg/R); observers are refused (they see only approved releases). Refusals are audited.
   */
  handoverAggregate(period: string, scenario?: Partial<Scenario> | null): Promise<Result<HandoverResult>>;
  /** F22: drafts an observer-safe release (observer_reports, status draft) from the baseline board; HR (observer_release W/A). */
  prepareHandoverRelease(period: string): Promise<Result<{ id: string }>>;
}
