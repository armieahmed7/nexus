// M23 LocalBackend RPC implementations (owner: W3). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M23Rpc } from './rpc';

export function makeLocalM23(b: LocalBackend, h: LocalRpcHelpers): M23Rpc {
  void b;
  void h;
  return {};
}
