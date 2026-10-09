// M06 extension tables (owner: W5 · E3, F34 Student-to-career journey). Merged into SCHEMA through src/data/ext/schema.ts.
// Same DSL as src/data/schema.ts. Keep this file import-free except for `import type` (node scripts load it directly).
//
//   journey_questions  the 10-question interest explorer (public reference data). Each option names the job families it points
//                      to and, for the study-length question, the programme route. Deterministic and non-scoring: the explorer
//                      shows which answers point where, never a score.
//   journey_facts      every programme fact on the journey board, each with its public source and an as-of date (public).
//   student_journeys   a signed-in student's saved journey (interests json, milestones json, stage, route): Own only, written
//                      by rpc.saveStudentJourney. Anonymous visitors store nothing. HR sees aggregates only (>= 10) through
//                      rpc.journeyAggregate; the always-false open_read column keeps the applications R/A grants from reading rows.
//   student_portfolio  the starter portfolio: a synthetic Mustaqbali starter credential (rpc.issueStarterCredentials, HR director)
//                      and experiences. Own only; same open_read rule. Never a FANR certification.
import type { TableDef } from '../../../data/schema';

const PUBLIC_TALENT = [{ res: 'talent_content' }];
const OWN_ONLY = [{ res: 'applications', person: 'person_id', where: 'open_read' }];

export const TABLES_M06: Record<string, TableDef> = {
  journey_questions: {
    module: 'M06', label: 'Student journey interest explorer: 10 questions mapping answers to job families (public, non-scoring) (F34)',
    cols: { id: 'text pk', sort: 'int', prompt_en: 'text', prompt_ar: 'text', hint_en: 'text =\'\'', hint_ar: 'text =\'\'', options: 'json =[]' },
    read: PUBLIC_TALENT as TableDef['read'], write: { mode: 'none' },
  },
  journey_facts: {
    module: 'M06', label: 'Student journey board facts, each with a public source and an as-of date (F34)',
    cols: {
      id: 'text pk', step: 'text enum:explore|mustaqbali|route|first_role idx', programme_id: 'text? ref:talent_programmes', role_id: 'text? ref:job_roles',
      text_en: 'text', text_ar: 'text', source_id: 'text ref:sources', as_of: 'date', precision: 'text enum:day|month|year =\'day\'', sort: 'int =0',
    },
    read: PUBLIC_TALENT as TableDef['read'], write: { mode: 'none' },
  },
  student_journeys: {
    module: 'M06', label: 'Saved student journey: interests, stage, route and readiness checklist (own rows only; HR aggregate >= 10) (F34)',
    cols: {
      id: 'text pk', person_id: 'text ref:people uniq', stage: 'text? enum:school|finishing_school|university|graduate', route: 'text? ref:talent_programmes',
      interests: 'json ={}', milestones: 'json ={}', saved_at: 'ts =now', updated_at: 'ts =now', cleared_at: 'ts?', open_read: 'bool =false',
    },
    read: OWN_ONLY as TableDef['read'], write: { mode: 'rpc', res: 'applications' },
  },
  student_portfolio: {
    module: 'M06', label: 'Student starter portfolio: synthetic Mustaqbali starter credential and experiences (own rows only; not a FANR certification) (F34)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', kind: 'text enum:microcred|experience|practice|event', title_en: 'text', title_ar: 'text',
      issuer_en: 'text =\'\'', issuer_ar: 'text =\'\'', programme_id: 'text? ref:talent_programmes', microcred_def_id: 'text?',
      status: 'text enum:issued|in_progress =\'issued\'', issued_on: 'date?', evidence_en: 'text =\'\'', evidence_ar: 'text =\'\'',
      sample: 'bool =true', open_read: 'bool =false', created_at: 'ts =now',
    },
    read: OWN_ONLY as TableDef['read'], write: { mode: 'rpc', res: 'applications' },
  },
};
