// M06 extension SupabaseBackend RPC mappings (owner: W5 · E3, F34). Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { JourneyAggregate } from '../journey';
import type { BuildInductionPlanResult, M06Rpc, SaveIntakeBaselineResult, SaveJourneyResult } from './rpc';
import type { Joiner } from '../starter';

export function makeSupabaseM06(x: SupabaseExtCtx): M06Rpc {
  return {
    saveStudentJourney: (input) => x.call<SaveJourneyResult>('kafaa_save_student_journey', { p_input: input ?? {} }, ['student_journeys']),
    journeyAggregate: () => x.call<JourneyAggregate>('kafaa_journey_aggregate', {}, []),
    issueStarterCredentials: () => x.call<{ issued: number }>('kafaa_issue_starter_credentials', {}, ['student_portfolio', 'notifications']),
    // FS77 (fsHe5)
    saveIntakeBaseline: (input) => x.call<SaveIntakeBaselineResult>('kafaa_save_intake_baseline', { p: input ?? {} }, ['intake_baselines']),
    buildInductionPlan: (input) => x.call<BuildInductionPlanResult>('kafaa_build_induction_plan', { p: input ?? {} }, ['induction_plans', 'notifications']),
    inductionJoiners: () => x.call<Joiner[]>('kafaa_induction_joiners', {}, []),
  };
}
