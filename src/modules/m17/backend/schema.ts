// M17 tables (owner: W1 · w1e1, features F03 Skills Passport and F04 Credential Wallet). Merged into SCHEMA by src/data/schema.ts;
// `npm run gen` regenerates types, SQL and RLS. Same DSL as src/data/schema.ts. Table names must not start with "kafaa_".
// Keep this file import-free except for `import type` (node scripts load it directly).
// Live DDL, RLS and RPCs: supabase/migrations/20261009111001_kafaa_w1e1_passport.sql (self-contained, additive).
import type { TableDef } from '../../../data/schema';

export const TABLES_M17: Record<string, TableDef> = {
  // F03 · "Add a claim": a self-rated level with a note. It stays `claimed` until a manager or peer validates it (F10).
  // Each claim also writes one recorded skill_evidence row (kind rating, basis claimed), so the skill state reflects it.
  skill_claims: {
    module: 'M17', label: 'Self-claimed skill levels with a note (F03); claimed until validated (F10)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', skill_id: 'text ref:skills idx', level: 'int', note: 'text', evidence_url: 'text?',
      status: 'text enum:claimed|validated|rejected|superseded =\'claimed\' idx', created_at: 'ts =now',
      decided_by: 'text?', decided_at: 'ts?', decision_note: 'text?',
    },
    read: [{ res: 'skills_profile', person: 'person_id' }], write: { mode: 'rpc', res: 'skills_profile' },
  },
  // F04 · Open Badges 3.0-shaped credentials wrapping a Kafa'a internal course certificate or course completion, signed
  // with Ed25519 (src/modules/m17/issuer.ts). Holders read their own; the public verifies only through rpc.verifyBadge,
  // which returns holder initials, never a name. Expiry is computed from valid_to and the source certificate.
  badges: {
    module: 'M17', label: 'Signed Open Badges 3.0-shaped credentials for Kafa\'a course certificates and completions (F04); public verify via RPC',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', source_table: 'text enum:certificates|training_records', source_id: 'text idx',
      course_id: 'text ref:courses idx', holder_initials: 'text', achievement: 'json ={}', credential: 'json ={}',
      issued_on: 'date', valid_to: 'date?', status: 'text enum:active|revoked =\'active\' idx', key_id: 'text enum:key-1|key-offline =\'key-1\'',
      public_slug: 'text uniq', revoked_at: 'ts?', revoke_reason: 'text?', created_at: 'ts =now',
    },
    read: [{ res: 'skills_profile', person: 'person_id' }], write: { mode: 'rpc', res: 'skills_profile' },
  },
};
