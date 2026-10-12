// F36 (W5 · E5) Personal weekly digest and nudges: tables owned by the shell digest (module M14, the personal area). Merged
// into SCHEMA by src/data/ext/schema.ts; `npm run gen` regenerates types, SQL and RLS. Same DSL as src/data/schema.ts; import type only.
//  - digest_runs: one row per person and period (weekly, fortnightly or monthly), the items shown and the notification written.
//    Read: the person only (notifications Own). Admins see aggregates through rpc.digestStats (suppressed below 10).
//  - digest_prefs: the person's nudge settings (on or off, frequency, quiet hours, muted kinds). Read: the person only.
// Both change only through RPCs (buildDigest, setDigestPrefs): server-side checks, audited.
//  - digest_nudge_rules (FS75, wave H): the published method of the future-skills nudges (one row per topic: what triggers it, the
//    window, where it links, the feature and benchmarks behind it). Public reference rows, seeded only (no write path); the rule
//    itself lives in src/shell/digest/future.ts = SQL kafaa_dg_future, and tests/unit/fs83-digest-nudges.test.ts pins the windows here.
import type { TableDef } from '../../../data/schema';

export const TABLES_DIGEST: Record<string, TableDef> = {
  digest_runs: {
    module: 'M14', label: 'Personal digest per period: up to 7 items with deep links and reasons, and the notification written (F36)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', period: 'text idx', frequency: 'text enum:weekly|fortnightly|monthly =\'weekly\'', as_of: 'date',
      items: 'json =[]', item_count: 'int =0', notification_id: 'text?', coach_hint: 'bool =false', built_at: 'ts =now',
    },
    read: [{ res: 'notifications', person: 'person_id' }],
    write: { mode: 'rpc', res: 'notifications' },
  },
  digest_prefs: {
    module: 'M14', label: 'Nudge settings per person: on or off, frequency, quiet hours (Abu Dhabi time), muted kinds (F36)',
    cols: {
      id: 'text pk', person_id: 'text ref:people uniq', enabled: 'bool =true', frequency: 'text enum:weekly|fortnightly|monthly =\'weekly\'',
      quiet_start: 'int?', quiet_end: 'int?', muted_kinds: 'text[] =[]', updated_at: 'ts =now',
    },
    read: [{ res: 'notifications', person: 'person_id' }],
    write: { mode: 'rpc', res: 'notifications' },
  },
  digest_nudge_rules: {
    module: 'M14', label: 'Published method of the future-skills digest nudges: trigger, window, link, source feature and benchmarks per topic (FS75)',
    cols: {
      id: 'text pk', topic: 'text enum:decay|goal|ai_literacy|role_profile|rising_skill|future_gig|pathway|fellowship uniq', kind: 'text enum:future|approval',
      name_en: 'text', name_ar: 'text', rule_en: 'text', rule_ar: 'text', window_days: 'int?', link: 'text', source_feature: 'text', benchmark_ids: 'text[] =[]',
      since: 'date', sort: 'int =0',
    },
    read: [{ res: 'public_content' }],
    write: { mode: 'none' },
  },
};
