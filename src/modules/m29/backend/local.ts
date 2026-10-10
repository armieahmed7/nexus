// M29 LocalBackend RPC implementations (owners: wave B E2 (FS09, FS10), wave D E5 (FS36, FS37) and wave I E2 (FS80)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M29Rpc } from './rpc';

export function makeLocalM29(b: LocalBackend, h: LocalRpcHelpers): M29Rpc {
  void b;
  void h;
  return {};
}
