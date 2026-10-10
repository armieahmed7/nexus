// F01: installs the M17-M27 Supabase RPC mappings on SupabaseBackend.rpc. Each module owns src/modules/<m>/backend/supabase.ts.
import type { SupabaseExtCtx } from './types';
import type { ExtRpc } from './rpc';
import { makeSupabaseM01 } from '../../modules/m01/backend/supabase'; // FS05 (fsAe4)
import { makeSupabaseM02 } from '../../modules/m02/backend/supabase'; // W4E5 (F31)
import { makeSupabaseM04 } from '../../modules/m04/backend/supabase'; // W2E3 (F13)
import { makeSupabaseM06 } from '../../modules/m06/backend/supabase'; // W5E3 (F34)
import { makeSupabaseM07 } from '../../modules/m07/backend/supabase'; // W3E3 (F22)
import { makeSupabaseM09 } from '../../modules/m09/backend/supabase'; // W5E2 (F33)
import { makeSupabaseM16 } from '../../modules/m16/backend/supabase'; // W3E5 (F24)
import { makeSupabaseM13 } from '../../modules/m13/backend/supabase'; // W5E5 (F37)
import { makeSupabaseDigest } from '../../shell/digest/backend/supabase'; // W5E5 (F36)
import { makeSupabaseM17 } from '../../modules/m17/backend/supabase';
import { makeSupabaseM18 } from '../../modules/m18/backend/supabase';
import { makeSupabaseM19 } from '../../modules/m19/backend/supabase';
import { makeSupabaseM20 } from '../../modules/m20/backend/supabase';
import { makeSupabaseM21 } from '../../modules/m21/backend/supabase';
import { makeSupabaseM22 } from '../../modules/m22/backend/supabase';
import { makeSupabaseM23 } from '../../modules/m23/backend/supabase';
import { makeSupabaseM24 } from '../../modules/m24/backend/supabase';
import { makeSupabaseM25 } from '../../modules/m25/backend/supabase';
import { makeSupabaseM26 } from '../../modules/m26/backend/supabase';
import { makeSupabaseM27 } from '../../modules/m27/backend/supabase';

export function makeExtSupabaseRpc(x: SupabaseExtCtx): ExtRpc {
  return { ...makeSupabaseM01(x), ...makeSupabaseM02(x), ...makeSupabaseM13(x), ...makeSupabaseDigest(x), ...makeSupabaseM04(x), ...makeSupabaseM06(x), ...makeSupabaseM07(x), ...makeSupabaseM09(x), ...makeSupabaseM16(x), ...makeSupabaseM17(x), ...makeSupabaseM18(x), ...makeSupabaseM19(x), ...makeSupabaseM20(x), ...makeSupabaseM21(x), ...makeSupabaseM22(x), ...makeSupabaseM23(x), ...makeSupabaseM24(x), ...makeSupabaseM25(x), ...makeSupabaseM26(x), ...makeSupabaseM27(x) };
}
