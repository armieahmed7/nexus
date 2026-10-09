// M04 extension tables (owner: W2 · E3, F13 Mentoring 2.0). Merged into SCHEMA through src/data/ext/schema.ts; `npm run gen`
// regenerates types, SQL and RLS. Same DSL as src/data/schema.ts (where the M04 mentors / mentoring_requests blocks live).
// Keep this file import-free except for `import type` (node scripts load it directly).
// Live DDL, RLS and RPCs: supabase/migrations/20261009123001_kafaa_w2e3_mentoring_refreshers.sql.
//
// Privacy: agreements and shared session logs are readable only by the two people in the pair (own_profile Own on either person
// column; nobody holds R, W, A or Scope on own_profile, so not managers, HR, the training manager or admins). Private session
// notes live in their own table because row-level security works on rows: each note is readable by its author only. The training
// manager sees the programme only as aggregates (rpc.mentoringProgramme, suppressed under 10 pairs).
import type { TableDef } from '../../../data/schema';

const PAIR = [{ res: 'own_profile', person: 'person_id' }, { res: 'own_profile', person: 'mentor_person_id' }];

export const TABLES_M04: Record<string, TableDef> = {
  mentoring_agreements: {
    module: 'M04', label: 'Mentoring agreement: skill goals, cadence and duration, close-out ratings (F13; the pair only)',
    cols: {
      id: 'text pk', request_id: 'text ref:mentoring_requests uniq', mentor_id: 'text ref:mentors idx', person_id: 'text ref:people idx', mentor_person_id: 'text ref:people idx',
      mentoring_type: 'text enum:career|knowledge_transfer|leadership|reverse|peer_onboarding idx', goals: 'json =[]',
      cadence: 'text enum:weekly|fortnightly|monthly', starts_on: 'date', ends_on: 'date',
      status: 'text enum:proposed|active|closing|closed|declined =\'proposed\' idx', proposed_by: 'text ref:people', proposed_at: 'ts =now', responded_at: 'ts?', decline_note: 'text?',
      mentee_ratings: 'json?', mentor_ratings: 'json?', mentee_note: 'text?', mentor_note: 'text?', mentee_closed_at: 'ts?', mentor_closed_at: 'ts?', closed_at: 'ts?',
      attainment_pct: 'num?', validated_skill_ids: 'text[] =[]', validated_claim_ids: 'text[] =[]', updated_at: 'ts =now',
    },
    read: PAIR as TableDef['read'], write: { mode: 'rpc', res: 'own_profile' },
  },
  mentoring_sessions: {
    module: 'M04', label: 'Mentoring session log: date, minutes, skills touched and a shared note (F13; the pair only)',
    cols: {
      id: 'text pk', agreement_id: 'text ref:mentoring_agreements idx', person_id: 'text ref:people idx', mentor_person_id: 'text ref:people idx',
      held_on: 'date', minutes: 'int =60', skill_ids: 'text[] =[]', topics: 'text =\'\'', note_shared: 'text =\'\'', logged_by: 'text ref:people', logged_at: 'ts =now',
    },
    read: PAIR as TableDef['read'], write: { mode: 'rpc', res: 'own_profile' },
  },
  mentoring_private_notes: {
    module: 'M04', label: 'Private mentoring session note: readable by its author only (F13)',
    cols: {
      id: 'text pk', session_id: 'text ref:mentoring_sessions idx', agreement_id: 'text ref:mentoring_agreements idx', author_person_id: 'text ref:people idx',
      note: 'text', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'author_person_id' }], write: { mode: 'rpc', res: 'own_profile' },
  },
};
