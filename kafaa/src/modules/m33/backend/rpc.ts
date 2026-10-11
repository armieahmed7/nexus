// M33 RPC signatures (owners: wave C E5 (FS25, FS26) and wave F E5 (FS58, FS59)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// FS25/FS26 SQL: supabase/migrations/20261010235001_kafaa_fs35_core_skills.sql.
import type { Result } from '../../../data/types';
import type { CoreProfile, CoreStats } from '../coreSkills';
import type { SjtFeedback, SjtItemInput, SjtItemView, SjtStats } from '../sjt';
import type { Reason } from '../../../domain/engines/types';

// ── FS26
export interface SjtResult { attempt_id: string; period: string; score: number; by_skill: Record<string, { n: number; sum: number }>; reasons: Reason[]; item_count: number }
export interface SjtStep {
  attempt_id: string;
  done: boolean;
  answered: number;
  total: number;
  item: SjtItemView | null;
  /** The expert key, notes and rationale for the item just answered (null on start). */
  feedback: SjtFeedback | null;
  result: SjtResult | null;
  resumed?: boolean;
}
export interface SjtContext {
  period: string;
  in_progress: string | null;
  completed: number;
  bank: { core_skill_id: string; items: number }[];
  enec_avg: number | null;
  enec_n: number | null;
}

export interface M33Rpc {
  /** FS25: my level per core skill from my skill evidence, my family target, the status, evidence, reasons and my practice signal (skills_profile Own). Null without Own. */
  coreSkillsMine(): Promise<CoreProfile | null>;
  /** FS25: share of staff meeting their family target per core skill, cluster and family (skills_profile Agg; under 10 suppressed). Null without Agg. */
  coreSkillsStats(): Promise<CoreStats | null>;
  /** FS26: start (or resume) a practice set of up to 8 items, mixed or for one core skill (skills_profile Own). Items come without the key. */
  startSjt(input?: { core_skill_id?: string | null }): Promise<Result<SjtStep>>;
  /** FS26: answer the item on screen; returns the expert key, notes and rationale, then the next item or, after the last, the result.
   *  Development only: never writes skill evidence and never gates anything. */
  submitSjt(input: { attempt_id: string; item_id: string; choice: number }): Promise<Result<SjtStep>>;
  /** FS26: what my practice page needs: an open set, my completed sets, the bank size per core skill and the ENEC average (suppressed under 10). */
  sjtContext(): Promise<SjtContext | null>;
  /** FS26: participation and average practice score by quarter and core skill (skills_profile Agg; under 10 suppressed; never a person). */
  sjtStats(): Promise<SjtStats | null>;
  /** FS26: add, edit or retire a practice item (secure_items A: the training manager). Both languages, four responses with a key, notes and rationale. */
  saveSjtItem(input: SjtItemInput): Promise<Result<{ id: string; version: number; status: string }>>;
}
