// M27 RPC signatures (owner: W4 · E4, F30 Learning record store). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// SQL: supabase/migrations/20261009144001_kafaa_w4e4_lrs.sql. Profile and emitters: src/modules/m27/xapi.ts.
import type { Result } from '../../../data/types';
import type { LrsAggregate, ObjectType, Source, StatementRow, Verb } from '../xapi';
export type { LrsAggregate, LrsCell, LrsTop } from '../xapi';

export interface StatementQuery {
  /** A person id; omitted = every person the caller may read (own, scope or all). */
  actor?: string;
  id?: string;
  verb?: Verb;
  object_type?: ObjectType;
  object_id?: string;
  source?: Source;
  /** Inclusive UTC dates (YYYY-MM-DD) on the experience time. */
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}
export interface PersonLabel { id: string; name: string; name_ar: string; role_id: string | null }
export interface StatementPage { rows: StatementRow[]; total: number; people: PersonLabel[]; scope: 'own' | 'scope' | 'all' }

export interface M27Rpc {
  /**
   * F30 admin test console: store one xAPI 2.0 statement about the caller after checking it against the Kafa'a profile (account
   * actor, registered verb, Kafa'a activity IRI, no response text, no secure item id). Platform admins (integrations A) only;
   * audited, no ledger. Refusals: not_signed_in, forbidden, schema_error, not_self, conflict. The emitters write statements themselves.
   */
  storeStatement(statement: unknown): Promise<Result<{ id: string }>>;
  /**
   * F30 statement explorer: statements the caller may read (own; Scope = instructors and managers for people in scope; R = auditors),
   * filtered. Reading someone else's statements is audited. Refusals: not_signed_in, forbidden, aggregate_only, invalid, not_in_scope.
   */
  queryStatements(q?: StatementQuery): Promise<Result<StatementPage>>;
  /** F30 own data right: every statement about the caller, for a JSON lines download. Audited, no ledger. */
  exportStatements(): Promise<Result<{ rows: StatementRow[]; count: number }>>;
  /** F30 analytics (feeds F25/F26): counts by month, verb, source and activity type; cells under 10 people suppressed. lrs Agg or R. */
  lrsAggregate(): Promise<LrsAggregate>;
}
