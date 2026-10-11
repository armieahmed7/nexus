// M27 SupabaseBackend RPC mappings (owner: W4 · E4, F30). Installed by src/data/ext/supabase.ts.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { LrsAggregate, M27Rpc, StatementPage } from './rpc';
import type { StatementRow } from '../xapi';

export function makeSupabaseM27(x: SupabaseExtCtx): M27Rpc {
  return {
    storeStatement: (statement) => x.call<{ id: string }>('kafaa_store_statement', { p: statement ?? null }, ['xapi_statements', 'audit_events']),
    queryStatements: (q = {}) => x.call<StatementPage>('kafaa_query_statements', { p: q }, []),
    exportStatements: () => x.call<{ rows: StatementRow[]; count: number }>('kafaa_export_statements', {}, []),
    lrsAggregate: () => x.rpc<LrsAggregate>('kafaa_lrs_aggregate'),
  };
}
