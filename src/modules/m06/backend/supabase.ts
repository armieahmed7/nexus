// M06 extension SupabaseBackend RPC mappings (owner: W5 · E3, F34). Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { JourneyAggregate } from '../journey';
import type { M06Rpc, SaveJourneyResult } from './rpc';

export function makeSupabaseM06(x: SupabaseExtCtx): M06Rpc {
  return {
    saveStudentJourney: (input) => x.call<SaveJourneyResult>('kafaa_save_student_journey', { p_input: input ?? {} }, ['student_journeys']),
    journeyAggregate: () => x.call<JourneyAggregate>('kafaa_journey_aggregate', {}, []),
    issueStarterCredentials: () => x.call<{ issued: number }>('kafaa_issue_starter_credentials', {}, ['student_portfolio', 'notifications']),
  };
}
