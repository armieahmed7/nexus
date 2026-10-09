// F37 (W5 · E5) M13 Dalil career mode RPC signature. Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts. Same three
// places as every RPC: this signature, backend/local.ts and SQL kafaa_dalil_career_turn in
// supabase/migrations/20261009155001_kafaa_w5e5_digest_dalil.sql (+ backend/supabase.ts).
import type { DalilTurnInput, DalilTurnResult, Result } from '../../../data/types';

export type CareerTurnInput = Omit<DalilTurnInput, 'mode' | 'client_key'>;

export interface M13Rpc {
  /** F37: log one career-mode turn (signed-in staff with a skills profile). Same guards as rpc.dalilTurn: kill switch, the shared
   *  hourly rate limit and concern redaction; sessions and turns carry mode `staff` and submode `career`. Audited. */
  dalilCareerTurn(p: CareerTurnInput): Promise<Result<DalilTurnResult>>;
}
