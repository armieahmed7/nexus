// M07 · F35 Skills supply-and-demand outlook RPC signatures (owner: W5 · E4). M07Rpc extends this interface.
// Every RPC exists three times and they must agree: this signature, backend/outlook.local.ts and SQL kafaa_<name>
// (supabase/migrations/20261009154001_kafaa_w5e4_skills_outlook.sql), mapped in backend/supabase.ts.
import type { Result } from '../../../data/types';
import type { OutlookParams, OutlookResult } from '../outlook';

export interface OutlookSaveInput {
  /** Update an outlook I saved (draft or withdrawn); null or absent saves a new one. */
  id?: string | null;
  name: string;
  params: Partial<OutlookParams>;
}
export interface ReleasedOutlook {
  id: string;
  name: string;
  summary_en: string;
  summary_ar: string;
  results: OutlookResult;
  released_at: string;
}

export interface M07OutlookRpc {
  /**
   * F35: the SIMULATED skills supply-and-demand outlook for the given assumptions (missing keys take the baseline). Aggregate only:
   * a skill family with fewer than 10 measured holders or role holders returns its key and `suppressed` only. HR analysts, the HR
   * director and auditors (workforce_analytics Agg/R); line managers read released outlooks, observers and staff are refused.
   * Refusals: not_signed_in, forbidden, invalid, not_found (unknown staffing scenario); refusals are audited.
   */
  computeOutlook(params: Partial<OutlookParams> | null): Promise<Result<OutlookResult>>;
  /** F35: saves an outlook (name gets "(SIMULATED)"); results are recomputed on the server. HR analyst or HR director (saveScenario rules). */
  saveOutlook(input: OutlookSaveInput): Promise<Result<{ id: string; name: string }>>;
  /** F35: the HR director releases a saved outlook to line managers; name and summaries must pass publicTextIsClean (M11). Ledger. */
  releaseOutlook(id: string, summaryEn: string, summaryAr: string): Promise<Result<{ id: string }>>;
  /** F35: the HR director withdraws a released outlook (reason 5+ characters). Ledger. */
  withdrawOutlook(id: string, reason: string): Promise<Result<{ id: string }>>;
  /** F35: released outlooks (aggregate results only) for line managers, HR and auditors; observers and staff refused. */
  releasedOutlooks(): Promise<Result<ReleasedOutlook[]>>;
}
