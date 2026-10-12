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
//
// FS77 (FS wave H · E5) Student future-skills starter and intake baselines:
//   starter_lessons    the public AI-literacy starter and SMR orientation (talent_content R where listed): short lessons, key points,
//                      a non-scoring self-check (answer shown on the page; nothing stored for anonymous visitors), links to the FS09
//                      ladder and FS38/FS39 content, and https sources with an as-of date (secondary sources flagged).
//   induction_modules  the induction catalogue (public where listed): hours, refresher hours, mandatory flag (mandatory nuclear
//                      modules can never be skipped by a baseline).
//   intake_baselines   HR-set intake-year baselines (versioned rows ib-<year>-<scope>-v<n>, status draft|published|superseded): which
//                      modules a joiner of that intake already holds, partly holds or does not hold, with the basis of each claim.
//                      Public R for the published (listed) rows; drafts read by workforce_strategy (HR, admin, auditor) and sat
//                      (training staff). Writes only through rpc.saveIntakeBaseline (workforce_strategy W = HR).
//   induction_plans    one induction plan per joiner (ip-<person>), built by rpc.buildInductionPlan from the baseline for the joiner's
//                      intake year (programme-specific first, then all programmes; none = full induction). Read by the joiner
//                      (own_profile Own), HR (workforce_strategy) and training staff (sat).
import type { TableDef } from '../../../data/schema';

const PUBLIC_TALENT = [{ res: 'talent_content' }];
const OWN_ONLY = [{ res: 'applications', person: 'person_id', where: 'open_read' }];
const PUBLIC_LISTED = [{ res: 'talent_content', where: 'listed' }];

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

  // ───────────── FS77 (FS wave H · E5)
  starter_lessons: {
    module: 'M06', label: 'Student future-skills starter: AI-literacy and SMR orientation lessons with sourced points and a non-scoring self-check (public) (FS77)',
    cols: {
      id: 'text pk', track: 'text enum:ai|smr idx', sort: 'int =0', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text',
      points: 'json =[]', self_check: 'json ={}', links: 'json =[]', induction_module_id: 'text? ref:induction_modules', sources: 'json =[]', as_of: 'date', listed: 'bool =true',
    },
    read: PUBLIC_LISTED as TableDef['read'], write: { mode: 'none' },
  },
  induction_modules: {
    module: 'M06', label: 'Induction catalogue for new joiners: hours, refresher hours and whether the module is mandatory (public) (FS77)',
    cols: {
      id: 'text pk', sort: 'int =0', area: 'text enum:ai|digital|cyber|energy|smr|safety|radiation|site|company', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text',
      hours: 'num', refresh_hours: 'num =0', mandatory: 'bool =false', skill_ids: 'text[] =[]', listed: 'bool =true',
    },
    read: PUBLIC_LISTED as TableDef['read'], write: { mode: 'none' },
  },
  intake_baselines: {
    module: 'M06', label: 'Intake-year baseline set by HR: induction modules the joiners of one intake already hold, partly hold or do not hold, with the basis (versioned; public when published) (FS77)',
    cols: {
      id: 'text pk', intake_year: 'int idx', programme: 'text enum:all|dnt|energy-pioneers|gdp|gpo|direct', version: 'int =1', status: 'text enum:draft|published|superseded idx',
      entries: 'json =[]', note_en: 'text =\'\'', note_ar: 'text =\'\'', set_by: 'text?', set_at: 'ts =now', published_by: 'text?', published_at: 'ts?', listed: 'bool =false', sample: 'bool =true',
    },
    read: [{ res: 'talent_content', where: 'listed' }, { res: 'workforce_strategy' }, { res: 'sat' }] as TableDef['read'],
    write: { mode: 'rpc', res: 'workforce_strategy' },
  },
  induction_plans: {
    module: 'M06', label: 'Induction plan of one joiner, read from the baseline for their intake year: full, refresher or skip per module, with the hours saved (FS77)',
    cols: {
      id: 'text pk', person_id: 'text ref:people uniq', person_name: 'text =\'\'', programme: 'text enum:dnt|energy-pioneers|gdp|gpo|direct', intake_year: 'int idx',
      baseline_id: 'text? ref:intake_baselines', baseline_version: 'int?', items: 'json =[]', hours_total: 'num =0', hours_planned: 'num =0', hours_saved: 'num =0',
      revision: 'int =1', built_by: 'text?', built_at: 'ts =now', sample: 'bool =true',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'workforce_strategy' }, { res: 'sat' }] as TableDef['read'],
    write: { mode: 'rpc', res: 'workforce_strategy' },
  },
};
