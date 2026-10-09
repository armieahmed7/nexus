// F01: RPC signatures of the M17-M27 modules, merged into Rpc (src/data/types.ts). Each module owns src/modules/<m>/backend/rpc.ts.
import type { M04Rpc } from '../../modules/m04/backend/rpc'; // W2E3 (F13): M04 mentoring extension RPCs
import type { M17Rpc } from '../../modules/m17/backend/rpc';
import type { M18Rpc } from '../../modules/m18/backend/rpc';
import type { M19Rpc } from '../../modules/m19/backend/rpc';
import type { M20Rpc } from '../../modules/m20/backend/rpc';
import type { M21Rpc } from '../../modules/m21/backend/rpc';
import type { M22Rpc } from '../../modules/m22/backend/rpc';
import type { M23Rpc } from '../../modules/m23/backend/rpc';
import type { M24Rpc } from '../../modules/m24/backend/rpc';
import type { M25Rpc } from '../../modules/m25/backend/rpc';
import type { M26Rpc } from '../../modules/m26/backend/rpc';
import type { M27Rpc } from '../../modules/m27/backend/rpc';

export interface ExtRpc extends M04Rpc, M17Rpc, M18Rpc, M19Rpc, M20Rpc, M21Rpc, M22Rpc, M23Rpc, M24Rpc, M25Rpc, M26Rpc, M27Rpc {}
