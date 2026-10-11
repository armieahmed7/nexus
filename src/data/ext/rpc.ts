// F01: RPC signatures of the M17-M27 modules, merged into Rpc (src/data/types.ts). Each module owns src/modules/<m>/backend/rpc.ts.
import type { M01Rpc } from '../../modules/m01/backend/rpc'; // FS05 (fsAe4): role profile versions
import type { M02Rpc } from '../../modules/m02/backend/rpc'; // W4E5 (F31): M02 instructor and SME pipeline RPCs
import type { M04Rpc } from '../../modules/m04/backend/rpc'; // W2E3 (F13): M04 mentoring extension RPCs
import type { M05Rpc } from '../../modules/m05/backend/rpc'; // FS wave C E3 (FS21/FS22): adaptive assessment, performance tasks, integrity
import type { M06Rpc } from '../../modules/m06/backend/rpc'; // W5E3 (F34): M06 student journey RPCs
import type { M07Rpc } from '../../modules/m07/backend/rpc'; // W3E3 (F22): M07 handover board RPCs
import type { M09Rpc } from '../../modules/m09/backend/rpc'; // W5E2 (F33): contractor passport RPCs
import type { M11Rpc } from '../../modules/m11/backend/rpc'; // FS wave A E3 (FS04): computed future-skills radar, keyspace edits
import type { M16Rpc } from '../../modules/m16/backend/rpc'; // W3E5 (F24): AI transparency RPCs (also redefines F02 setEngineWeights)
import type { M13Rpc } from '../../modules/m13/backend/rpc'; // W5E5 (F37): Dalil career-mode turn log
import type { DigestRpc } from '../../shell/digest/backend/rpc'; // W5E5 (F36): personal digest
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
// FS01 (future skills, wave A): M28-M37 module RPCs
import type { M28Rpc } from '../../modules/m28/backend/rpc';
import type { M29Rpc } from '../../modules/m29/backend/rpc';
import type { M30Rpc } from '../../modules/m30/backend/rpc';
import type { M31Rpc } from '../../modules/m31/backend/rpc';
import type { M32Rpc } from '../../modules/m32/backend/rpc';
import type { M33Rpc } from '../../modules/m33/backend/rpc';
import type { M34Rpc } from '../../modules/m34/backend/rpc';
import type { M35Rpc } from '../../modules/m35/backend/rpc';
import type { M36Rpc } from '../../modules/m36/backend/rpc';
import type { M37Rpc } from '../../modules/m37/backend/rpc';

export interface ExtRpc extends M01Rpc, M02Rpc, M13Rpc, DigestRpc, M04Rpc, M05Rpc, M06Rpc, M07Rpc, M09Rpc, M11Rpc, M16Rpc, M17Rpc, M18Rpc, M19Rpc, M20Rpc, M21Rpc, M22Rpc, M23Rpc, M24Rpc, M25Rpc, M26Rpc, M27Rpc,
  M28Rpc, M29Rpc, M30Rpc, M31Rpc, M32Rpc, M33Rpc, M34Rpc, M35Rpc, M36Rpc, M37Rpc {}
