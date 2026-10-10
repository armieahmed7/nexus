// M28 LocalBackend RPC implementations (owners: wave B E1 (FS07, FS08) and wave H E1 (FS70, FS71, FS72)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M28Rpc } from './rpc';

export function makeLocalM28(b: LocalBackend, h: LocalRpcHelpers): M28Rpc {
  void b;
  void h;
  return {};
}
