// M30 LocalBackend RPC implementations (owners: wave B E3 (FS11, FS12) and wave I E3 (FS81)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M30Rpc } from './rpc';

export function makeLocalM30(b: LocalBackend, h: LocalRpcHelpers): M30Rpc {
  void b;
  void h;
  return {};
}
