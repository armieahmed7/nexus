// M19 tables (owner: W1 · E3, F07 Learning Coach). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly).
// Both tables are private to the person (own_profile: Own only, nobody holds Scope or R on it). HR sees aggregated
// acceptance rates only, through rpc.coachInsights (suppressed below MIN_GROUP_SIZE).
import type { TableDef } from '../../../data/schema';

export const TABLES_M19: Record<string, TableDef> = {
  coach_feedback: {
    module: 'M19', label: 'Learning Coach feedback per person and suggestion: saved, dismissed (hidden 90 days), enrolled (F07)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', item_kind: 'text enum:course|practice|ojt|mentor|opportunity|reading|refresher idx', item_id: 'text',
      signal: 'text enum:saved|dismissed|enrolled|cleared', competency_ids: 'text[] =[]', at: 'ts =now', hidden_until: 'date?',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
  learning_goals: {
    module: 'M19', label: 'Weekly learning goal in hours and coach focus roles: optional and private, no streaks (F07)',
    cols: { id: 'text pk', person_id: 'text ref:people uniq', hours_per_week: 'num =0', focus_role_ids: 'text[] =[]', updated_at: 'ts =now' },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'direct', res: 'own_profile', own: true },
  },
  // W2 · E3 · F14 Knowledge refreshers: one Leitner state per person and practice item (written only by rpc.submitRefresher; an SQL
  // trigger refuses any item that is not an approved practice-bank item). Private: own rows only. Instructors see item difficulty
  // only as aggregates through rpc.refresherItemStats (suppressed under 10 people).
  refresh_state: {
    module: 'M19', label: 'Knowledge refresher state per person and practice item: Leitner box 1-5, due date, counts (F14; private)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', item_id: 'text ref:items idx', competency_id: 'text? ref:competencies', box: 'int =1', due_on: 'date',
      last_result: 'text? enum:correct|wrong', last_at: 'ts?', attempts: 'int =0', correct: 'int =0', created_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
  refresh_prefs: {
    module: 'M19', label: 'Knowledge refresher cadence: five questions a day or a week, or paused (F14; private, no streaks)',
    cols: { id: 'text pk', person_id: 'text ref:people uniq', cadence: 'text enum:daily|weekly|paused =\'weekly\'', updated_at: 'ts =now' },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'direct', res: 'own_profile', own: true },
  },
};
