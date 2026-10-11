// M36 RPC signatures (owners: wave G E3 (FS64, FS65) and wave I E4 (FS82, FS83)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// Migration slot: supabase/migrations/202610102<w><e>NNN_kafaa_fs<w><e>_<topic>.sql (PLAN.md section 2).
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface M36Rpc {}
