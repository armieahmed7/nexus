// F01: installs the M17-M27 LocalBackend RPCs on LocalRpc (src/data/local/rpc.ts). Each module owns src/modules/<m>/backend/local.ts.
import type { LocalBackend } from '../local/LocalBackend';
import type { LocalRpcHelpers } from './types';
import type { ExtRpc } from './rpc';
import { makeLocalM02 } from '../../modules/m02/backend/local'; // W4E5 (F31)
import { makeLocalM04 } from '../../modules/m04/backend/local'; // W2E3 (F13)
import { makeLocalM07 } from '../../modules/m07/backend/local'; // W3E3 (F22)
import { makeLocalM13 } from '../../modules/m13/backend/local'; // W5E5 (F37)
import { makeLocalDigest } from '../../shell/digest/backend/local'; // W5E5 (F36)
import { makeLocalM16 } from '../../modules/m16/backend/local'; // W3E5 (F24); its setEngineWeights replaces the W0 one (spread after makeW0LocalRpc)
import { makeLocalM17 } from '../../modules/m17/backend/local';
import { makeLocalM18 } from '../../modules/m18/backend/local';
import { makeLocalM19 } from '../../modules/m19/backend/local';
import { makeLocalM20 } from '../../modules/m20/backend/local';
import { makeLocalM21 } from '../../modules/m21/backend/local';
import { makeLocalM22 } from '../../modules/m22/backend/local';
import { makeLocalM23 } from '../../modules/m23/backend/local';
import { makeLocalM24 } from '../../modules/m24/backend/local';
import { makeLocalM25 } from '../../modules/m25/backend/local';
import { makeLocalM26 } from '../../modules/m26/backend/local';
import { makeLocalM27 } from '../../modules/m27/backend/local';

export function makeExtLocalRpc(b: LocalBackend, h: LocalRpcHelpers): ExtRpc {
  return { ...makeLocalM02(b, h), ...makeLocalM13(b, h), ...makeLocalDigest(b, h), ...makeLocalM04(b, h), ...makeLocalM07(b, h), ...makeLocalM16(b, h), ...makeLocalM17(b, h), ...makeLocalM18(b, h), ...makeLocalM19(b, h), ...makeLocalM20(b, h), ...makeLocalM21(b, h), ...makeLocalM22(b, h), ...makeLocalM23(b, h), ...makeLocalM24(b, h), ...makeLocalM25(b, h), ...makeLocalM26(b, h), ...makeLocalM27(b, h) };
}
