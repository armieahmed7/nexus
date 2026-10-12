// M07 · FS52 AI and automation exposure in the skills outlook: RPC signature (owner: FS wave F · E2). M07Rpc extends this interface.
// Every RPC exists three times and they must agree: this signature, backend/automation.local.ts and SQL kafaa_outlook_automation
// (supabase/migrations/20261010262001_kafaa_fs62_outlook_automation.sql), mapped in backend/supabase.ts.
import type { Result } from '../../../data/types';
import type { AutomationProfile, OutlookParams } from '../outlook';

export interface M07AutomationRpc {
  /**
   * FS52: the automation profile beside the SIMULATED skills outlook for the given assumptions (any adoption, 0 included): FS06 task
   * exposure per skill family (task counts, not people; families suppressed exactly as in the outlook), the automation share of demand
   * in 2030 and at the horizon, the horizon demand taken out at the chosen adoption and at 60 %, and the tornado's automation bar.
   * Same access as computeOutlook (HR analysts, the HR director and auditors); refusals not_signed_in, forbidden, invalid, not_found
   * (unknown staffing scenario) are audited.
   */
  outlookAutomation(params: Partial<OutlookParams> | null): Promise<Result<AutomationProfile>>;
}
