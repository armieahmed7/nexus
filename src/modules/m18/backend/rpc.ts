// M18 RPC signatures (owner: W1 engineer 2). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
import type { Result } from '../../../data/types';
import type { CareerReadiness } from '../career';

export interface RoadmapToPlanResult {
  plan_id: string;
  plan_created: boolean;
  created: number;
  existing: number;
}
export interface M18Rpc {
  /** F05: per-role readiness %, gates and reasons for a person (read-only; same computation in SQL and TS). Self, or a line manager in scope when the person shares a shortlist or roadmap. */
  careerReadiness(personId: string, roleIds: string[]): Promise<Result<CareerReadiness[]>>;
  /** F06: write a saved roadmap's development blocks into the person's development plan (draft plan created when none is open). Own roadmap only; idempotent; audited and ledgered. */
  roadmapToPlan(roadmapId: string): Promise<Result<RoadmapToPlanResult>>;
}
