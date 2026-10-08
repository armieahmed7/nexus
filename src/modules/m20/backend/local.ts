// M20 LocalBackend RPC implementations (owner: W1). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M20Rpc } from './rpc';

export function makeLocalM20(b: LocalBackend, h: LocalRpcHelpers): M20Rpc {
  void b;
  void h;
  return {};
}
