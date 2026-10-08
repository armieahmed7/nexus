// M24 RPC signatures (owner: W3). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// Example: claimSkill(skillId: string, level: number, note: string): Promise<Result<{ id: string }>>;
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface M24Rpc {}
