// M36 LocalBackend RPC implementations (owners: wave G E3 (FS64, FS65) and wave I E4 (FS82, FS83)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M36Rpc } from './rpc';

export function makeLocalM36(b: LocalBackend, h: LocalRpcHelpers): M36Rpc {
  void b;
  void h;
  return {};
}
