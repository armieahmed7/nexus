// M34 LocalBackend RPC implementations (owners: wave D E2 (FS29, FS30) and wave I E1 (FS78, FS79)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M34Rpc } from './rpc';

export function makeLocalM34(b: LocalBackend, h: LocalRpcHelpers): M34Rpc {
  void b;
  void h;
  return {};
}
