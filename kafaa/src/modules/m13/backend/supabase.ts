// F37 (W5 · E5) SupabaseBackend mapping for the Dalil career-mode turn log. Installed by src/data/ext/supabase.ts.
// FS76 (fsHe4): the future-skills turn log and the intent switch.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { DalilTurnResult } from '../../../data/types';
import type { M13Rpc } from './rpc';

export function makeSupabaseM13(x: SupabaseExtCtx): M13Rpc {
  return {
    dalilCareerTurn: (p) => x.call<DalilTurnResult>('kafaa_dalil_career_turn', { p }, ['advisor_sessions', 'advisor_turns']),
    dalilFutureTurn: (p) => x.call<DalilTurnResult>('kafaa_dalil_future_turn', { p }, ['advisor_sessions', 'advisor_turns']),
    setDalilIntent: (id, enabled, note) => x.call<{ id: string; enabled: boolean }>('kafaa_set_dalil_intent', { p_id: id, p_enabled: enabled, p_note: note }, ['dalil_intents']),
  };
}
