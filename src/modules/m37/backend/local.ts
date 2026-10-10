// M37 LocalBackend RPC implementations (owners: wave G E2 (FS62, FS63) and wave H E2 (FS73, FS74)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M37Rpc } from './rpc';

export function makeLocalM37(b: LocalBackend, h: LocalRpcHelpers): M37Rpc {
  void b;
  void h;
  return {};
}
