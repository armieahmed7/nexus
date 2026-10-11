// F30 (wave 4 · E4) Learning record store seed: the xAPI statements the Kafa'a emitters would have stored for every seeded
// learning record (course completions, refresher answers, opportunity and rotation completions, job shadowing, JPMs,
// mentoring sessions, knowledge-asset use), built with the same rules as the live emitters (src/modules/m27/xapi.ts =
// kafaa_xapi_source_rows() in SQL; the PGlite check proves they are identical). Plus the SIMULATED outbound connector row for
// /admin/integrations. Runs last (FINALIZE_LAST) so records added by other builders' finalize steps are included.
// Synthetic people only; statements identify people by Kafa'a account id, never by email; no secure item id anywhere.
import { backfill, XAPI_HOME } from '../../../src/modules/m27/xapi.ts';

export const FINALIZE_LAST = true;

export default function build() {}

export function finalize(T) {
  T.xapi_statements = backfill(T);
  T.integrations = (T.integrations ?? []).filter((i) => i.id !== 'int-lrs');
  T.integrations.push({
    id: 'int-lrs', name: 'External learning record store (xAPI 2.0)', system_kind: 'LRS', domain: 'xAPI statements forwarded from the Kafa\'a store',
    direction: 'out', last_success: '2026-10-08T00:00:00Z', threshold_hours: 24, status: 'disabled', records: T.xapi_statements.length, errors: 0,
    schedule: 'Not connected (SIMULATED)',
    notes: `Adapter described in Training > Learning record store > Adapters. No public endpoint in the demo; statements stay in Kafa'a (${XAPI_HOME} accounts, no email).`,
  });
}
