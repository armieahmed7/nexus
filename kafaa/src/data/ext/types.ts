// F01: helper types handed to the M17-M27 backend files (src/modules/<m>/backend/{local,supabase}.ts).
import type { Result, Table } from '../types';

/** Audit/ledger helpers shared with LocalRpc: refuse() writes a refused audit row; done() writes the ledger (when ledgerAction is set) and an ok audit row. */
export interface LocalRpcHelpers {
  refuse<T = unknown>(action: string, table: string | null, entity: string | null, code: string, message: string, role?: string | null): Promise<Result<T>>;
  done<T>(action: string, table: string, entity: string | null, reason: string | null, role: string | null, ledgerAction: string | null, ledgerReason: string, message: string, data?: T, tables?: string[]): Promise<Result<T>>;
}

export interface SupabaseExtCtx {
  /** Call a Result-returning SQL RPC; on ok the listed tables refetch. */
  call<T>(fn: string, args: Record<string, unknown>, touched?: Table[]): Promise<Result<T>>;
  /** Call a SQL function that returns plain data (reads); throws on error. */
  rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T>;
}
