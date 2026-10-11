// M05 extension tables (owner: FS wave C · E3, FS21 Adaptive future-skills assessment + FS22 Performance tasks and integrity
// reports). Merged into SCHEMA through src/data/ext/schema.ts; `npm run gen` regenerates types, SQL and RLS. Same DSL as
// src/data/schema.ts (where the G2 M05 items / attempts blocks live; those are not changed). Keep this file import-free except for
// `import type` (node scripts load it directly). Live DDL, checks, RLS and RPCs: supabase/migrations/20261010233001_kafaa_fs33_assessment.sql.
//
// Access (existing policy resources only):
//  - banks and performance tasks (with their published rubric): every staff role reads them (internal_content R);
//  - adaptive items and the task answer keys: training staff only (secure_items: instructor W, training manager W/A), served to
//    takers without the key by the RPCs;
//  - adaptive attempts: my own; assessors and managers in scope (skills_profile Own/Scope, the same people who see the skill
//    states they feed); the training manager all (skills_profile A);
//  - task attempts: my own; assessors (signoff A: instructors, training manager);
//  - integrity reports: my own; assessors (signoff A); auditors (audit_log R).
import type { TableDef } from '../../../data/schema';

const STAFF_READ = [{ res: 'internal_content' }];

export const TABLES_M05: Record<string, TableDef> = {
  // ───────────── FS21 Adaptive future-skills assessment
  adaptive_banks: {
    module: 'M05', label: 'Adaptive future-skills item bank: the skills it evidences, criterion or developmental mode, the standard, stop rule and the credentials it gates (FS21)',
    cols: {
      id: 'text pk', code: 'text uniq', name_en: 'text', name_ar: 'text', summary_en: 'text', summary_ar: 'text', fs_area: 'text idx',
      skill_ids: 'text[] =[]', safety_related: 'bool =false', mode: 'text enum:criterion|normative', cut_level: 'int =2',
      max_items: 'int =20', min_items: 'int =8', stable_window: 'int =4', evidence_cap: 'int =3', retake_days: 'int =14',
      gates: 'text[] =[]', benchmark_ids: 'text[] =[]', sources: 'json =[]', status: 'text enum:active|retired =\'active\' idx', version: 'int =1', sort: 'int =0',
      updated_by: 'text?', updated_at: 'ts =now',
    },
    read: STAFF_READ,
    write: { mode: 'none' },
  },
  adaptive_items: {
    module: 'M05', label: 'Adaptive item (EN/AR, calibrated difficulty 1.00-4.99 whose whole part is the level, facet, skill, answer key): training staff only (FS21)',
    cols: {
      id: 'text pk', bank_id: 'text ref:adaptive_banks idx', skill_id: 'text ref:skills', facet: 'text', level: 'int', difficulty: 'num',
      stem_en: 'text', stem_ar: 'text', options_en: 'text[] =[]', options_ar: 'text[] =[]', correct: 'int', explain_en: 'text =\'\'', explain_ar: 'text =\'\'',
      p_value: 'num?', calib_n: 'int =0', status: 'text enum:active|retired =\'active\' idx', version: 'int =1', sort: 'int =0',
      updated_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'secure_items' }],
    write: { mode: 'rpc', res: 'secure_items' },
  },
  adaptive_attempts: {
    module: 'M05', label: 'One adaptive attempt: answers in order with the served level and time, estimate, standard met or percentile, evidence, integrity link (FS21)',
    cols: {
      id: 'text pk', bank_id: 'text ref:adaptive_banks idx', bank_version: 'int =1', person_id: 'text ref:people idx', attempt_no: 'int', form: 'int =0',
      mode: 'text enum:criterion|normative', status: 'text enum:in_progress|completed =\'in_progress\' idx', started_at: 'ts =now', completed_at: 'ts?',
      responses: 'json =[]', current_item_id: 'text?', item_count: 'int =0', stop: 'text? enum:stable|max|exhausted', estimate: 'int?',
      meets: 'bool?', percentile: 'int?', norm_n: 'int?', reasons: 'json =[]', evidence: 'json =[]', gating: 'bool =false', integrity_id: 'text?', counts: 'bool =true',
    },
    read: [{ res: 'skills_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'skills_profile' },
  },

  // ───────────── FS22 Performance tasks and integrity reports
  performance_tasks: {
    module: 'M05', label: 'Scenario performance task on SIMULATED plant data: brief, trend set, decision options and the published rubric (FS22)',
    cols: {
      id: 'text pk', code: 'text uniq', title_en: 'text', title_ar: 'text', brief_en: 'text', brief_ar: 'text', role_en: 'text =\'\'', role_ar: 'text =\'\'',
      fs_area: 'text idx', skill_ids: 'text[] =[]', evidence_level: 'int =2', minutes: 'int =20', min_minutes: 'int =5',
      data: 'json ={}', decisions: 'json =[]', checks: 'json =[]', rubric: 'json =[]', rubric_version: 'int =1', pass_pct: 'int =65',
      gates: 'text[] =[]', simulated: 'bool =true', benchmark_ids: 'text[] =[]', sources: 'json =[]', status: 'text enum:active|retired =\'active\' idx', sort: 'int =0',
    },
    read: STAFF_READ,
    write: { mode: 'none' },
  },
  perf_task_keys: {
    module: 'M05', label: 'Answer key of a performance task (anomaly window, decision points, assessor notes): training staff only (FS22)',
    cols: {
      id: 'text pk', task_id: 'text ref:performance_tasks uniq', series: 'text', from_idx: 'int', to_idx: 'int', decision_points: 'json =[]',
      notes_en: 'text =\'\'', notes_ar: 'text =\'\'',
    },
    read: [{ res: 'secure_items' }],
    write: { mode: 'none' },
  },
  task_attempts: {
    module: 'M05', label: 'A person\'s performance-task attempt: answer, resubmissions, auto and assessor rubric scores, result, evidence, integrity link (FS22)',
    cols: {
      id: 'text pk', task_id: 'text ref:performance_tasks idx', person_id: 'text ref:people idx', attempt_no: 'int', rubric_version: 'int',
      status: 'text enum:in_progress|submitted|scored =\'in_progress\' idx', started_at: 'ts =now', submitted_at: 'ts?', answer: 'json ={}', resubmissions: 'int =0',
      auto_scores: 'json ={}', scores: 'json ={}', total: 'int?', max: 'int?', passed: 'bool?', critical_failed: 'bool =false',
      scored_by: 'text? ref:people', scored_at: 'ts?', comment: 'text?', gating: 'bool =false', integrity_id: 'text?', evidence: 'json =[]', counts: 'bool =true',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'signoff' }],
    write: { mode: 'rpc', res: 'signoff' },
  },
  integrity_reports: {
    module: 'M05', label: 'Integrity report on an attempt that gates a credential: time on task, fast answers, retakes, resubmissions, item exposure, flags, review (FS22)',
    cols: {
      id: 'text pk', kind: 'text enum:adaptive|task idx', attempt_id: 'text uniq', person_id: 'text ref:people idx', ref_id: 'text', gates: 'text[] =[]',
      created_at: 'ts =now', time_on_task_s: 'int', items: 'int =0', fast_items: 'int =0', median_item_s: 'int?', retakes: 'int =0', resubmissions: 'int =0', repeat_items: 'int =0',
      exposure_max: 'num?', exposure_mean: 'num?', exposure_n: 'int =0', flags: 'text[] =[]', status: 'text enum:clear|review idx',
      decision: 'text? enum:accepted|voided', reviewed_by: 'text? ref:people', reviewed_at: 'ts?', review_note: 'text?',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'signoff' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'signoff' },
  },
};
