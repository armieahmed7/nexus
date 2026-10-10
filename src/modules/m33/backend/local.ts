// M33 LocalBackend RPC implementations (owners: wave C E5 (FS25, FS26) and wave F E5 (FS58, FS59)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M33Rpc } from './rpc';

export function makeLocalM33(b: LocalBackend, h: LocalRpcHelpers): M33Rpc {
  void b;
  void h;
  return {};
}
