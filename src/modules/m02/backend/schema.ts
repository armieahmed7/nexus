// M02 extension tables (owner: W4 · E5, F31 Instructor and SME qualification pipeline). Merged into SCHEMA through src/data/ext/schema.ts.
// Same DSL as src/data/schema.ts. Keep this file import-free except for `import type` (node scripts load it directly).
//
//   instructor_tracks        one row per person on the instructor track: SME nomination -> initial training -> co-teach (2) -> solo
//                            -> ready -> qualified -> annual currency. Names are copied onto the row (no people read needed).
//   instructor_observations  observed deliveries (F25 L3 mechanics: checklist items rated met / partly / not met, critical items),
//                            append-only, written by instructors (sat W) through rpc.recordInstructorObservation.
//   teaching_hours           delivery hours (fed by attended M04 sessions, or the scheduling-system mirror) and continuing development.
// Read: the person (own_profile Own), line managers and instructors in scope (qual_records Scope), instructors, the training manager
// and auditors (sat R/W/A). Writes only through the M02 RPCs (write mode rpc).
import type { TableDef } from '../../../data/schema';

const READ = [{ res: 'own_profile', person: 'person_id' }, { res: 'qual_records', person: 'person_id' }, { res: 'sat' }];

export const TABLES_M02: Record<string, TableDef> = {
  instructor_tracks: {
    module: 'M02', label: 'Instructor and SME qualification track: nomination, initial training, observed deliveries, qualification and annual currency (F31)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', person_name: 'text =\'\'', person_name_ar: 'text =\'\'',
      route: 'text enum:sme|asip =\'sme\'', discipline: 'text =\'\'', standard_ids: 'text[] =[]', skill_ids: 'text[] =[]',
      stage: 'text enum:nominated|initial_training|co_teach|solo|ready|qualified =\'nominated\' idx',
      status: 'text enum:active|qualified|lapsed|withdrawn|declined =\'active\' idx',
      started_on: 'date', nominated_by: 'text? ref:people', nomination_kind: 'text enum:self|manager|training_manager =\'self\'', motivation: 'text?',
      accepted_on: 'date?', accepted_by: 'text? ref:people', initial_done_on: 'date?',
      qualified_on: 'date?', first_qualified_on: 'date?', qualified_by: 'text? ref:people',
      currency_due: 'date?', currency_status: 'text? enum:current|due|at_risk|lapsed', lapsed_on: 'date?', decision_note: 'text?',
      created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: READ as TableDef['read'], write: { mode: 'rpc', res: 'sat' },
  },
  instructor_observations: {
    module: 'M02', label: 'Observed instructor delivery (co-teach, solo or currency) with a checklist score; append-only (F31)',
    cols: {
      id: 'text pk', track_id: 'text ref:instructor_tracks idx', person_id: 'text ref:people idx', observer_person_id: 'text ref:people idx',
      observer_name: 'text =\'\'', observer_name_ar: 'text =\'\'', kind: 'text enum:co_teach|solo|currency', observed_on: 'date',
      items: 'json =[]', score: 'int', result: 'text enum:pass|fail', session_id: 'text? ref:sessions', course_id: 'text? ref:courses', note: 'text?',
      created_at: 'ts =now',
    },
    read: READ as TableDef['read'], write: { mode: 'rpc', res: 'sat' },
  },
  teaching_hours: {
    module: 'M02', label: 'Instructor teaching hours (from attended M04 sessions or the scheduling-system mirror) and continuing development (F31)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', track_id: 'text? ref:instructor_tracks idx', kind: 'text enum:delivery|cpd',
      source: 'text enum:session|mirror|self =\'mirror\'', session_id: 'text? ref:sessions', course_id: 'text? ref:courses', delivered_on: 'date idx', hours: 'num',
      note: 'text?', recorded_by: 'text?', created_at: 'ts =now',
    },
    read: READ as TableDef['read'], write: { mode: 'rpc', res: 'sat' },
  },
};
