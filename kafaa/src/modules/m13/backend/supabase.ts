// F37 (W5 · E5) SupabaseBackend mapping for the Dalil career-mode turn log. Installed by src/data/ext/supabase.ts.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { DalilTurnResult } from '../../../data/types';
import type { M13Rpc } from './rpc';

export function makeSupabaseM13(x: SupabaseExtCtx): M13Rpc {
  return {
    dalilCareerTurn: (p) => x.call<DalilTurnResult>('kafaa_dalil_career_turn', { p }, ['advisor_sessions', 'advisor_turns']),
  };
}
