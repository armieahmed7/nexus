// F37 (W5 · E5) M13 Dalil career mode RPC signature. Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts. Same three
// places as every RPC: this signature, backend/local.ts and SQL kafaa_dalil_career_turn in
// supabase/migrations/20261009155001_kafaa_w5e5_digest_dalil.sql (+ backend/supabase.ts).
// FS76 (fsHe4): setDalilIntent and dalilFutureTurn; SQL kafaa_set_dalil_intent / kafaa_dalil_future_turn in
// supabase/migrations/20261010284001_kafaa_fs84_dalil_future.sql; PGlite parity scripts/validate/fs84-dalil-future.mjs.
import type { DalilTurnInput, DalilTurnResult, Result } from '../../../data/types';

export type CareerTurnInput = Omit<DalilTurnInput, 'mode' | 'client_key'>;
/** FS76: a future-skills turn from a signed-in caller. `personal` marks an answer built from the caller's own records. */
export type FutureTurnInput = Omit<DalilTurnInput, 'mode' | 'client_key'> & { mode?: DalilTurnInput['mode']; personal?: boolean };

export interface M13Rpc {
  /** F37: log one career-mode turn (signed-in staff with a skills profile). Same guards as rpc.dalilTurn: kill switch, the shared
   *  hourly rate limit and concern redaction; sessions and turns carry mode `staff` and submode `career`. Audited. */
  dalilCareerTurn(p: CareerTurnInput): Promise<Result<DalilTurnResult>>;
  /** FS76: log one future-skills turn for a signed-in caller. Refuses `intent_disabled` when the AI owner switched the answer's intent off,
   *  and `personal_not_allowed` when a personal answer comes from anyone but staff with a skills profile. Staff turns are logged as career
   *  turns (rpc.dalilCareerTurn), everyone else's as a Dalil turn in their own mode (rpc.dalilTurn), so the kill switch, the shared hourly
   *  limit and concern redaction apply unchanged. Anonymous visitors log through rpc.dalilTurn (public mode) and never reach this RPC. */
  dalilFutureTurn(p: FutureTurnInput): Promise<Result<DalilTurnResult>>;
  /** FS76: switch one future-skills intent on or off (the AI owner: dalil_config A). A reason of 5 to 300 characters is required;
   *  refuses not_found, unchanged and invalid. Audited (`dalil.intent`) and written to the NEXUS ledger. */
  setDalilIntent(id: string, enabled: boolean, note: string): Promise<Result<{ id: string; enabled: boolean }>>;
}
