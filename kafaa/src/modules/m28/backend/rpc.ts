// M28 RPC signatures (owners: wave B E1 (FS07, FS08) and wave H E1 (FS70, FS71, FS72)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// Migration: supabase/migrations/20261010221001_kafaa_fs21_skills_crosswalk.sql (PLAN.md section 2).
import type { Result } from '../../../data/types';
import type { AlignmentInput } from '../crosswalk';
import type { PulseSummary, RisingResult } from '../signals';
import type { BadgeResult, TechInput } from '../technologies';
import type { SuggestResponse } from '../suggestions';

export interface SaveAlignmentResult { id: string; status: string; version: number }
export interface SkillGoalResult { id: string; skill_id: string; status: 'active' | 'removed'; target_level: number }

// FS wave H · E1 (FS70, FS71, FS72). SQL: supabase/migrations/20261010281001_kafaa_fs81_skill_signals.sql; PGlite: scripts/validate/fs81-skill-signals.mjs.
export interface PulseInput { share_pct: number; team_size?: number | null }
export interface TagInput { technology_id: string; ref_table: 'opportunities' | 'role_profile_versions'; ref_id: string; active: boolean }
export interface SuggestionStats { people: number | null; open: number | null; confirmed: number | null; rejected: number | null; not_me: number | null; expired: number | null; confirm_rate: number | null; suppressed: boolean }

export interface M28Rpc {
  /** FS70: compute the Skills on the Rise list of a quarter (2025-Q1 to the current quarter) for review before publishing (workforce_strategy
   *  Agg/R/W/A). Read-only; signals under 10 suppressed; a refusal is audited. TS = SQL (kafaa_rs_compute). */
  computeSkillSignals(quarter: string): Promise<Result<RisingResult>>;
  /** FS70: publish the list of an ended quarter (HR analyst or HR director: workforce_strategy W/A). Recomputed server-side; a published
   *  quarter is kept and never overwritten (refusal `published`). Audit + ledger. */
  publishSkillSignals(quarter: string, summaryEn?: string | null, summaryAr?: string | null): Promise<Result<{ id: string; quarter: string; now: number; growing: number }>>;
  /** FS70: a line manager (transformation Scope) answers this year's pulse while it is open (15 Sep to 15 Dec); answering again updates
   *  the answer. Audited, no ledger. */
  submitManagerPulse(input: PulseInput): Promise<Result<{ id: string; year: number; share_pct: number }>>;
  /** FS70: the pulse of a year as an aggregate (workforce_strategy Agg/R/W/A or transformation Agg): nothing under 10 responses,
   *  bands and families under 10 suppressed. TS = SQL (kafaa_mp_summary). */
  managerPulseSummary(year: number): Promise<Result<PulseSummary>>;
  /** FS71: add or edit a generic technology tag (frameworks W/A); brand names refused (`invalid`, brand). Versioned, audited. */
  saveTechnology(input: TechInput): Promise<Result<{ id: string; version: number }>>;
  /** FS71: tag (or untag) an opportunity or a role-profile version with a technology (frameworks W/A); the family, role and date come
   *  from the source server-side. Audited. */
  tagTechnology(input: TagInput): Promise<Result<{ id: string; active: boolean }>>;
  /** FS71: the badges of a quarter from the published criteria, for review (frameworks W/A). TS = SQL (kafaa_ht_compute). */
  computeTechnologyBadges(quarter: string): Promise<Result<BadgeResult>>;
  /** FS71: publish the badges of an ended quarter (frameworks W/A); kept per quarter, never overwritten. Audit + ledger. */
  publishTechnologyBadges(quarter: string): Promise<Result<{ quarter: string; hot: number; roles: number }>>;
  /** FS72: recompute my suggestions for today (skills_profile Own): new and changed ones open, ones no longer backed expire; rejected and
   *  "not me" stay hidden for 180 days. Own rows only. Audited, no ledger. TS = SQL (kafaa_ssg_candidates). */
  refreshSkillSuggestions(): Promise<Result<{ open: number; added: number; expired: number }>>;
  /** FS72: answer one of my open suggestions: confirm (writes my claimed evidence, kind rating, ref_table skill_suggestions, then my skill
   *  states), reject or not_me (hidden for 180 days). Someone else's suggestion reads as not found. Audited, no ledger. */
  respondSuggestion(id: string, response: SuggestResponse): Promise<Result<{ id: string; status: string; evidence_id: string | null; suppressed_until: string | null }>>;
  /** FS72: store this week's fairness snapshot of the suggestions surface (integrations A: admin, AI governance). Audit + ledger. */
  runSuggestionFairness(asOf?: string | null): Promise<Result<{ period: string; as_of: string; rows: number; flagged: number; suppressed: number }>>;
  /** FS72: counts of suggestions by status as an aggregate (skills_profile Agg/A, workforce_strategy Agg/R/W/A, integrations R/A);
   *  every count under 10 suppressed; never a person. */
  suggestionStats(): Promise<Result<SuggestionStats>>;

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
