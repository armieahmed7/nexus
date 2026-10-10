// M31 LocalBackend RPC implementations (owners: wave E E1 (FS38, FS39, FS40)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M31Rpc } from './rpc';

export function makeLocalM31(b: LocalBackend, h: LocalRpcHelpers): M31Rpc {
  void b;
  void h;
  return {};
}
