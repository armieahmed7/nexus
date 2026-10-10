// M11 RPC signatures (owner: FS wave A · E3, FS04 one future-skill keyspace and a computed radar). Merged into Rpc through
// src/data/ext/rpc.ts. Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name>
// (+ backend/supabase.ts). SQL: supabase/migrations/20261010213001_kafaa_fs13_keyspace.sql. Rules: src/modules/m11/keyspace.ts.
// FS04 also redefines the G4 RPC saveSkillGapPlan (same signature) so every plan carries the catalogue skill (sk_id).
import type { Result } from '../../../data/types';
import type { FutureRadar } from '../keyspace';

export type { FutureRadar, RadarCell, FamilyRow, FamilyCell } from '../keyspace';

export interface FutureSkillMapInput {
  key: string;
  key_kind: 'adv_skill' | 'radar' | 'gap_plan';
  sk_id: string;
  relation: 'transfers' | 'adapts' | 'new';
  need_level: number;
  primary_sk?: boolean;
  active?: boolean;
  note_en?: string;
  note_ar?: string;
}

export interface M11Rpc {
  /**
   * FS04 computed future-skills radar for one scenario: SIMULATED demand per radar key, and readiness computed from F01 person
   * skills (share of active staff at the target level on the key's catalogue skills), overall and per job family. Cells under 10
   * people are suppressed. HR analyst / CHCO office (workforce_analytics Agg) and auditors (R) only; others are refused (throws).
   */
  futureRadar(scenario: string): Promise<FutureRadar>;
  /**
   * FS04 admin edit of the future-skill keyspace (frameworks A): add or change one key -> catalogue skill row. Audited, no ledger.
   * Refusals: forbidden, invalid, not_found (unknown key or skill), security_restricted (security skills stay off the map),
   * conflict (the change would leave a key without an active catalogue skill).
   */
  saveFutureSkillMap(input: FutureSkillMapInput): Promise<Result<{ id: string }>>;
}
