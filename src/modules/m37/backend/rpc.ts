// M37 RPC signatures (owners: wave G E2 (FS62, FS63) and wave H E2 (FS73, FS74)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// Migration slot: supabase/migrations/202610102<w><e>NNN_kafaa_fs<w><e>_<topic>.sql (PLAN.md section 2).
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface M37Rpc {}
