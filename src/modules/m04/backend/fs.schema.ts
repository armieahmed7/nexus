// M04 extension tables for FS wave C · E2 (FS19 Future-skills course pack, FS20 Future-skills academies and cohorts). Merged into
// TABLES_M04 (backend/schema.ts) and from there into SCHEMA through src/data/ext/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Import-free except for `import type` (node scripts load it directly).
// Live DDL, RLS and RPCs: supabase/migrations/20261010232001_kafaa_fs32_course_pack_academies.sql. Rules: src/modules/m04/{fsPack,academy}.ts.
//
// Reads: the pack metadata, skill links, academies and cohorts are public reference rows (no people). Members and capstones follow the
// M04 enrolment rule (training: the person Own; training R/W/A all rows) plus the named mentor and reviewer (own_profile on their
// column). Writes: RPCs only (kafaa_fsc_* and kafaa_acad_*).
import type { TableDef } from '../../../data/schema';

const PUB: TableDef['read'] = [{ res: 'public_content' }];
const PEOPLE: TableDef['read'] = [{ res: 'training', person: 'person_id' }, { res: 'own_profile', person: 'mentor_person_id' }, { res: 'own_profile', person: 'reviewer_person_id' }];

export const TABLES_M04_FS: Record<string, TableDef> = {
  course_pack_items: {
    module: 'M04', label: 'FS19 future-skills course pack: theme, core or cross-over, hour envelope and the copy and link check result per course',
    cols: {
      id: 'text pk', course_id: 'text ref:courses uniq', pack: "text ='fs19'", theme: 'text enum:data_ai|digital_plant|advanced_reactor|green|human|cyber idx', kind: "text enum:core|crossover ='core'",
      crossover_of: 'text? ref:courses', for_industries: 'text[] =[]', weeks: 'int', weekly_hours: 'num', simulated: 'bool =true', no_decision: 'bool =false',
      copy_check: "text enum:passed|failed|pending ='pending'", copy_problems: 'json =[]', copy_checked_at: 'ts?', benchmark_ids: 'text[] =[]', sort: 'int =0',
    },
    read: PUB, write: { mode: 'rpc', res: 'training' },
  },
  course_skill_links: {
    module: 'M04', label: 'FS19 course objective linked to a skill at a stated level (1-3); also the course\'s evidence key on that skill',
    cols: {
      id: 'text pk', course_id: 'text ref:courses idx', skill_id: 'text ref:skills idx', level: 'int', objective_n: 'int =1',
      objective_en: 'text', objective_ar: 'text', active: 'bool =true', updated_by: 'text? ref:people', updated_at: 'ts =now',
    },
    read: PUB, write: { mode: 'rpc', res: 'training' },
  },
  academies: {
    module: 'M04', label: 'FS20 future-skills academy on the module + project + mentor template (Nordic NNTP pattern)',
    cols: {
      id: 'text pk', programme_id: 'text ref:programmes', code: 'text uniq', name_en: 'text', name_ar: 'text', tagline_en: 'text', tagline_ar: 'text',
      theme: 'text enum:data_ai|digital_plant|advanced_reactor|green', module_course_ids: 'text[] =[]', project_en: 'text', project_ar: 'text',
      deliverable_en: 'text', deliverable_ar: 'text', artefact_kind: 'text enum:automation|analysis|twin_validation|study|role_delta',
      mentor_role_en: 'text', mentor_role_ar: 'text', reviewer_role_en: 'text', reviewer_role_ar: 'text', criteria_en: 'text', criteria_ar: 'text',
      weeks: 'int', weekly_hours: 'num', capacity: 'int =16', capstone_skills: 'json =[]', no_decision: 'bool =false', simulated: 'bool =true',
      benchmark_ids: 'text[] =[]', sources: 'json =[]', sort: 'int =0',
    },
    read: PUB, write: { mode: 'none' },
  },
  academy_cohorts: {
    module: 'M04', label: 'FS20 academy cohort (intake): dates, capacity and status',
    cols: {
      id: 'text pk', academy_id: 'text ref:academies idx', code: 'text uniq', label_en: 'text', label_ar: 'text', starts_on: 'date', ends_on: 'date',
      nominations_close_on: 'date?', status: "text enum:planned|nominating|running|completed ='planned' idx", capacity: 'int =16', sort: 'int =0',
    },
    read: PUB, write: { mode: 'rpc', res: 'training' },
  },
  academy_members: {
    module: 'M04', label: 'FS20 academy nomination and place: who nominated, the decision, mentor and reviewer, alumni date',
    cols: {
      id: 'text pk', cohort_id: 'text ref:academy_cohorts idx', academy_id: 'text ref:academies idx', person_id: 'text ref:people idx',
      status: "text enum:nominated|accepted|declined|active|completed|withdrawn ='nominated' idx", source: 'text enum:self|manager|programme',
      nominated_by: 'text ref:people', nominated_at: 'ts =now', note: 'text?', decided_by: 'text? ref:people', decided_at: 'ts?', decision_note: 'text?',
      mentor_person_id: 'text? ref:people idx', reviewer_person_id: 'text? ref:people idx', completed_on: 'date?',
    },
    read: PEOPLE, write: { mode: 'rpc', res: 'training' },
  },
  cohort_capstones: {
    module: 'M04', label: 'FS20 capstone project: the built artefact, the reviewer\'s sign-off and the F01 evidence it wrote',
    cols: {
      id: 'text pk', member_id: 'text ref:academy_members uniq', cohort_id: 'text ref:academy_cohorts idx', academy_id: 'text ref:academies', person_id: 'text ref:people idx',
      mentor_person_id: 'text? ref:people', reviewer_person_id: 'text ref:people idx', artefact_kind: 'text enum:automation|analysis|twin_validation|study|role_delta',
      title: "text =''", summary: "text =''", lang: "text enum:en|ar ='en'", status: "text enum:draft|submitted|signed_off|returned ='draft' idx",
      result: 'text? enum:merit|pass|not_yet', feedback: 'text?', submitted_at: 'ts?', reviewed_at: 'ts?', evidence_ids: 'text[] =[]', updated_at: 'ts =now',
    },
    read: PEOPLE, write: { mode: 'rpc', res: 'training' },
  },
};
