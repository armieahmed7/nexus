// M35 LocalBackend RPC implementations (owners: wave F E1 (FS50, FS51) and wave G E1 (FS60, FS61)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M35Rpc } from './rpc';

export function makeLocalM35(b: LocalBackend, h: LocalRpcHelpers): M35Rpc {
  void b;
  void h;
  return {};
}
