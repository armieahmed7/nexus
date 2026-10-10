// M32 LocalBackend RPC implementations (owners: wave E E2 (FS41, FS42, FS43)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M32Rpc } from './rpc';

export function makeLocalM32(b: LocalBackend, h: LocalRpcHelpers): M32Rpc {
  void b;
  void h;
  return {};
}
