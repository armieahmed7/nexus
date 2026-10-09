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
  // ───────────── W2 · E1 · F10 Skill check-ins (360) and F11 Team capability heatmap
  // F10 · A check-in asks the line manager (and up to two same-team peers) to confirm up to five self-rated skills.
  // `skills` holds [{skill_id, self_level, note, outcome?, final_level?, reason?}]. Readable by the person (Own), by managers
  // and instructors in scope (Scope) and by the addressed manager; never by peers (they read only their own rating rows).
  skill_checkins: {
    module: 'M17', label: 'Skill check-ins: self, manager and peer validation requests (F10)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', manager_id: 'text? ref:people idx', peer_ids: 'text[] =[]', skills: 'json =[]', message: 'text?',
      status: 'text enum:open|validated|adjusted|withdrawn =\'open\' idx', requested_at: 'ts =now', due_on: 'date',
      decided_by: 'text?', decided_at: 'ts?', decision_note: 'text?',
    },
    read: [{ res: 'skills_profile', person: 'person_id' }, { res: 'skills_profile', person: 'manager_id' }], write: { mode: 'rpc', res: 'skills_profile' },
  },
  // F10 · One row per rater x skill (self, manager, peer). Peers read and answer only the rows addressed to them; the person
  // and managers in scope read every row of the check-in. HR (Agg) reads none. Written only through the RPCs.
  skill_ratings: {
    module: 'M17', label: 'Check-in ratings per rater and skill: self, manager, peer (F10)',
    cols: {
      id: 'text pk', checkin_id: 'text ref:skill_checkins idx', subject_id: 'text ref:people idx', rater_person_id: 'text ref:people idx',
      rater_kind: 'text enum:self|manager|peer idx', skill_id: 'text ref:skills idx', level: 'int?', example: 'text?',
      status: 'text enum:pending|submitted|not_observed|closed =\'pending\' idx', requested_at: 'ts =now', at: 'ts?',
    },
    read: [{ res: 'skills_profile', person: 'subject_id' }, { res: 'skills_profile', person: 'rater_person_id' }], write: { mode: 'rpc', res: 'skills_profile' },
  },
  // F11 · Manager-set coverage minimum per group and skill ("at least 3 people at level >= 3"). team_id is a group key:
  // team:<people.team_id>, family:<people.job_family_id> or crew:profile (the crew profile used by the crew view).
  // Managers read targets through rpc.teamCoverage; the table itself is readable only with R/W/A (training manager).
  team_skill_targets: {
    module: 'M17', label: 'Team skill coverage targets set by managers (F11)',
    cols: {
      id: 'text pk', team_id: 'text idx', skill_id: 'text ref:skills idx', min_people: 'int =2', min_level: 'int =3', note: 'text?',
      active: 'bool =true', set_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'skills_profile' }], write: { mode: 'rpc', res: 'skills_profile' },
  },
  // ───────────── W5 · E1 · F32 Stackable micro-credentials
  // Versioned definitions (like qualification standards): criteria over F01 evidence (course, assessment, opportunity, skill,
  // manual), a validity period, and `stacks_into` (the code of a stacked credential this one counts towards). Readable as the
  // frameworks catalogue; changed only by framework owners through rpc.saveMicrocredDef / setMicrocredDefStatus.
  microcred_defs: {
    module: 'M17', label: 'Micro-credential definitions: criteria over skills evidence, validity, stacking; versioned (F32)',
    cols: {
      id: 'text pk', code: 'text idx', version: 'int =1', kind: 'text enum:micro|stack =\'micro\'', area: 'text', level: 'text enum:foundation|practitioner|advanced =\'foundation\'',
      title_en: 'text', title_ar: 'text', summary_en: 'text =\'\'', summary_ar: 'text =\'\'', criteria: 'json =[]', stacks_into: 'text? idx', alignment: 'json =[]',
      role_ids: 'text[] =[]', validity_months: 'int =24', hours: 'int?', status: 'text enum:draft|current|superseded|retired =\'draft\' idx',
      effective_date: 'date?', supersedes_id: 'text?', change_reason: 'text?', sort: 'int =0',
      updated_by: 'text?', updated_at: 'ts =now', published_by: 'text?', published_at: 'ts?',
    },
    read: [{ res: 'frameworks' }], write: { mode: 'rpc', res: 'frameworks' },
  },
  // F32 · Awards: requested (manual criteria wait for a training manager), awarded (signed Open Badges 3.0-shaped credential,
  // F04 issuer), declined, revoked or superseded by a renewal. Holders read their own; managers their scope; the training
  // manager (A) all. Public verification only through rpc.verifyMicrocred (initials, never a name).
  microcred_awards: {
    module: 'M17', label: 'Micro-credential awards with the evidence snapshot and the signed credential (F32)',
    cols: {
      id: 'text pk', def_id: 'text ref:microcred_defs idx', def_code: 'text idx', def_version: 'int =1', person_id: 'text ref:people idx', holder_initials: 'text =\'\'',
      status: 'text enum:pending_approval|awarded|declined|revoked|superseded =\'pending_approval\' idx', requested_at: 'ts =now', issued_on: 'date?', valid_to: 'date?',
      evidence: 'json =[]', component_award_ids: 'text[] =[]', credential: 'json ={}', key_id: 'text? enum:key-1|key-offline', public_slug: 'text? uniq',
      renewed_from: 'text?', decided_by: 'text?', decided_at: 'ts?', decision_note: 'text?', revoked_at: 'ts?', revoke_reason: 'text?', created_at: 'ts =now',
    },
    read: [{ res: 'skills_profile', person: 'person_id' }], write: { mode: 'rpc', res: 'skills_profile' },
  },
};
