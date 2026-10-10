// M28 RPC signatures (owners: wave B E1 (FS07, FS08) and wave H E1 (FS70, FS71, FS72)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// Migration: supabase/migrations/20261010221001_kafaa_fs21_skills_crosswalk.sql (PLAN.md section 2).
import type { Result } from '../../../data/types';
import type { AlignmentInput } from '../crosswalk';

export interface SaveAlignmentResult { id: string; status: string; version: number }
export interface SkillGoalResult { id: string; skill_id: string; status: 'active' | 'removed'; target_level: number }

export interface M28Rpc {
  /** FS08: create or edit a crosswalk alignment (frameworks W/A). An edit bumps the version and makes the row indicative again
   *  (review cleared); `publish` lists it publicly. Refusals: not_signed_in, forbidden, not_found, invalid (+ AL_MSG text), retired. Audited. */
  saveAlignment(input: AlignmentInput): Promise<Result<SaveAlignmentResult>>;
  /** FS08: mark a published alignment as reviewed (frameworks W/A; the reviewer is not the last editor: maker_checker). Audited. */
  reviewAlignment(id: string): Promise<Result<{ id: string; reviewed_on: string }>>;
  /** FS08: retire an alignment with a reason (never deleted; hidden from the public crosswalk). Audited. */
  retireAlignment(id: string, reason: string): Promise<Result<{ id: string }>>;
  /** FS07: add (active = true, target level 1-4) or remove a skill goal for the signed-in person (skills_profile Own). Audited. */
  setSkillGoal(skillId: string, targetLevel: number, active: boolean): Promise<Result<SkillGoalResult>>;
}
