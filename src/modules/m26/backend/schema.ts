// M26 tables (owner: W4 · E2 · F27 SAT analysis workbench, F29 Accreditation-readiness self-evaluation).
// Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Keep this file import-free except for `import type` (node scripts load it directly).
//
// Read rules. Everything is training-staff data on the `sat` resource (instructors R/W, training_manager R/W/A, auditor R).
// Nobody else reads these tables, except two own-row branches:
//  - dif_ratings: a subject-matter expert (an F21 `sme_profiles` row, not a platform role) who answered the DIF survey reads
//    their own ratings (`own_profile` Own on rater_person_id) — the survey itself comes from rpc.difSurvey.
// Restricted tasks (security, safeguards and cyber roles) are placeholders: the SQL trigger kafaa_sat_task_guard and the
// LocalBackend RPCs force their titles to the generic "Restricted task — managed outside Kafa'a" text, so no title, DIF rating,
// objective link or change ever describes one.
// All writes go through SECURITY DEFINER RPCs (write mode `rpc`).
import type { TableDef } from '../../../data/schema';

type RR = TableDef['read'];
const SAT: RR = [{ res: 'sat' }];

export const TABLES_M26: Record<string, TableDef> = {
  // ───────────── F27 SAT analysis workbench: job and task analysis to training matrix
  jta_analyses: {
    module: 'M26', label: 'Job analysis of a role (SAT analysis phase): draft, DIF survey open, approved (F27)',
    cols: {
      id: 'text pk', role_id: 'text ref:job_roles uniq', status: 'text enum:draft|survey|approved =\'draft\' idx', version: 'int =1',
      owner_id: 'text? ref:people', survey_opened_on: 'date?', approved_by: 'text?', approved_on: 'date?', restricted: 'bool =false',
      notes_en: 'text =\'\'', notes_ar: 'text =\'\'', history: 'json =[]', updated_at: 'ts =now',
    },
    read: SAT,
    write: { mode: 'rpc', res: 'sat' },
  },
  jta_tasks: {
    module: 'M26', label: 'Task inventory of a role: from qualification cards and the job analysis; restricted tasks are placeholders (F27)',
    cols: {
      id: 'text pk', role_id: 'text ref:job_roles idx', code: 'text', title_en: 'text', title_ar: 'text',
      duty_en: 'text =\'\'', duty_ar: 'text =\'\'', source: 'text enum:qual_card|jta_survey|oe|change =\'jta_survey\'',
      task_item_id: 'text? ref:task_items', standard_id: 'text? ref:qual_standards', critical: 'bool =false', restricted: 'bool =false',
      status: 'text enum:active|retired =\'active\' idx', decision: 'text enum:pending|train|no_train|overtrain =\'pending\' idx',
      decision_by: 'text?', decision_on: 'date?', decision_note: 'text?', override: 'bool =false',
      version: 'int =1', created_by: 'text?', created_at: 'ts =now', changed_at: 'ts =now', sort: 'int =0',
    },
    read: SAT,
    write: { mode: 'rpc', res: 'sat' },
  },
  dif_ratings: {
    module: 'M26', label: 'DIF survey rating of a task by a subject-matter expert: difficulty, importance, frequency 1-5 (F27)',
    cols: {
      id: 'text pk', task_id: 'text ref:jta_tasks idx', rater_person_id: 'text ref:people idx', d: 'int', i: 'int', f: 'int',
      note: 'text =\'\'', rater_kind: 'text enum:sme|instructor|developer =\'sme\'', rated_on: 'date', active: 'bool =true',
    },
    read: [{ res: 'sat' }, { res: 'own_profile', person: 'rater_person_id' }],
    write: { mode: 'rpc', res: 'sat' },
  },
  sat_objectives: {
    module: 'M26', label: 'Learning objective: terminal or enabling, from a course or written in the SAT design phase (F27)',
    cols: {
      id: 'text pk', code: 'text', kind: 'text enum:terminal|enabling =\'terminal\'', text_en: 'text', text_ar: 'text',
      course_id: 'text? ref:courses idx', module_id: 'text? ref:course_modules', competency_id: 'text? ref:competencies', role_id: 'text? ref:job_roles',
      source: 'text enum:course|sat =\'course\'', status: 'text enum:active|retired =\'active\'', created_by: 'text?', updated_at: 'ts =now',
    },
    read: SAT,
    write: { mode: 'rpc', res: 'sat' },
  },
  task_objectives: {
    module: 'M26', label: 'Task-to-training link: task -> learning objective -> course, module or JPM (F27)',
    cols: {
      id: 'text pk', task_id: 'text ref:jta_tasks idx', objective_ref: 'text ref:sat_objectives idx', course_id: 'text? ref:courses', module_id: 'text? ref:course_modules',
      jpm_id: 'text? ref:jpms', active: 'bool =true', linked_by: 'text?', linked_at: 'ts =now',
    },
    read: SAT,
    write: { mode: 'rpc', res: 'sat' },
  },
  sat_changes: {
    module: 'M26', label: 'SAT change: a task changed or was retired; lists the affected courses, standards, JPMs and items (metadata only) (F27)',
    cols: {
      id: 'text pk', task_id: 'text ref:jta_tasks idx', role_id: 'text ref:job_roles', kind: 'text enum:modified|retired', trigger: 'text enum:task_change|effectiveness|oe|regulatory =\'task_change\'',
      summary: 'text', before: 'json ={}', after: 'json ={}', impact: 'json ={}', status: 'text enum:open|closed =\'open\' idx',
      opened_by: 'text ref:people', opened_by_name: 'text =\'\'', opened_by_name_ar: 'text =\'\'', opened_at: 'ts =now', closed_at: 'ts?',
    },
    read: SAT,
    write: { mode: 'rpc', res: 'sat' },
  },
  sat_change_items: {
    module: 'M26', label: 'Review item of a SAT change: one per affected course and qualification standard (F27)',
    cols: {
      id: 'text pk', change_id: 'text ref:sat_changes idx', kind: 'text enum:course|standard', ref_id: 'text', title_en: 'text =\'\'', title_ar: 'text =\'\'',
      status: 'text enum:open|updated|revised|no_change =\'open\' idx', note: 'text =\'\'', revision_id: 'text?', closed_by: 'text?', closed_at: 'ts?', sort: 'int =0',
    },
    read: SAT,
    write: { mode: 'rpc', res: 'sat' },
  },

  // ───────────── F29 Accreditation-readiness self-evaluation
  accr_criteria: {
    module: 'M26', label: 'Accreditation-readiness criterion: generic, paraphrased SAT-based objective sourced to public IAEA SAT guidance (F29)',
    cols: {
      id: 'text pk', code: 'text uniq', area: 'text enum:performance|environment|process|instructors|examinations idx',
      phase: 'text? enum:analysis|design|development|implementation|evaluation', title_en: 'text', title_ar: 'text', guidance_en: 'text', guidance_ar: 'text',
      evidence_kinds: 'text[] =[]', sources: 'json =[]', sort: 'int =0',
    },
    read: SAT,
    write: { mode: 'none' },
  },
  accr_programmes: {
    module: 'M26', label: 'Training programme in the accreditation-readiness scope: its roles, standards and courses (F29)',
    cols: {
      id: 'text pk ref:programmes', role_ids: 'text[] =[]', standard_ids: 'text[] =[]', course_ids: 'text[] =[]', owner_role: 'text =\'training\'', active: 'bool =true', sort: 'int =0',
    },
    read: SAT,
    write: { mode: 'none' },
  },
  accr_selfevals: {
    module: 'M26', label: 'Self-evaluation of a programme for a half-year cycle; finalised by the training manager, never by its sole author (F29)',
    cols: {
      id: 'text pk', programme_id: 'text ref:accr_programmes idx', cycle: 'text idx', status: 'text enum:draft|finalised =\'draft\' idx',
      opened_by: 'text ref:people', opened_on: 'date', finalised_by: 'text?', finalised_by_name: 'text =\'\'', finalised_by_name_ar: 'text =\'\'', finalised_at: 'ts?',
      readiness: 'int?', rated: 'int =0', gaps: 'int =0', authors: 'text[] =[]', summary_en: 'text =\'\'', summary_ar: 'text =\'\'', updated_at: 'ts =now',
    },
    read: SAT,
    write: { mode: 'rpc', res: 'sat' },
  },
  accr_assessments: {
    module: 'M26', label: 'Self-rating of one criterion for a programme with evidence links, and a gap owner and due date when not met (F29)',
    cols: {
      id: 'text pk', selfeval_id: 'text ref:accr_selfevals idx', programme_id: 'text ref:accr_programmes idx', criterion_id: 'text ref:accr_criteria idx',
      rating: 'int', evidence: 'json =[]', gap_en: 'text =\'\'', owner_role: 'text? enum:training_manager|programme_lead|instructors|quality|line_management|hr',
      due_on: 'date?', note: 'text =\'\'', rated_by: 'text ref:people', rated_by_name: 'text =\'\'', rated_by_name_ar: 'text =\'\'', rated_at: 'ts =now', history: 'json =[]',
    },
    read: SAT,
    write: { mode: 'rpc', res: 'sat' },
  },
};
