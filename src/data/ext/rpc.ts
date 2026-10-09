// F01: RPC signatures of the M17-M27 modules, merged into Rpc (src/data/types.ts). Each module owns src/modules/<m>/backend/rpc.ts.
import type { M02Rpc } from '../../modules/m02/backend/rpc'; // W4E5 (F31): M02 instructor and SME pipeline RPCs
import type { M04Rpc } from '../../modules/m04/backend/rpc'; // W2E3 (F13): M04 mentoring extension RPCs
import type { M07Rpc } from '../../modules/m07/backend/rpc'; // W3E3 (F22): M07 handover board RPCs
import type { M09Rpc } from '../../modules/m09/backend/rpc'; // W5E2 (F33): contractor passport RPCs
import type { M16Rpc } from '../../modules/m16/backend/rpc'; // W3E5 (F24): AI transparency RPCs (also redefines F02 setEngineWeights)
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

export interface ExtRpc extends M02Rpc, M04Rpc, M07Rpc, M09Rpc, M16Rpc, M17Rpc, M18Rpc, M19Rpc, M20Rpc, M21Rpc, M22Rpc, M23Rpc, M24Rpc, M25Rpc, M26Rpc, M27Rpc {}
