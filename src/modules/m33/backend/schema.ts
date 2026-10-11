// M33 tables (owners: wave C E5 (FS25, FS26) and wave F E5 (FS58, FS59)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
import type { TableDef } from '../../../data/schema';

const PUBLIC = [{ res: 'public_content' }];

export const TABLES_M33: Record<string, TableDef> = {
  // ───────────── FS25 Nuclear Critical Core Skills (wave C · E5)
  core_skills: {
    module: 'M33', label: 'Nuclear critical core skill (16 in three SkillsFuture clusters), written for a nuclear plant, with benchmark mappings, INPO traits, linked catalogue skills, level descriptors and its own development and assessment routes (FS25)',
    cols: {
      id: 'text pk', code: 'text uniq', cluster: 'text enum:thinking_critically|interacting_with_others|staying_relevant idx',
      name_en: 'text', name_ar: 'text', summary_en: 'text', summary_ar: 'text', plant_en: 'text', plant_ar: 'text',
      descriptors: 'json =[]', mappings: 'json =[]', benchmark_ids: 'text[] =[]', trait_ids: 'text[] =[]', skill_ids: 'text[] =[]',
      development: 'json =[]', assessment: 'json =[]', dev_approach_en: 'text', dev_approach_ar: 'text', assess_approach_en: 'text', assess_approach_ar: 'text',
      outcome_en: 'text =\'\'', outcome_ar: 'text =\'\'', sources: 'json =[]', status: 'text enum:active|retired =\'active\'', version: 'int =1', as_of: 'date', sort: 'int =0',
    },
    read: PUBLIC,
    write: { mode: 'none' },
  },
  core_skill_targets: {
    module: 'M33', label: 'Core-skill target level (1 Foundation, 2 Proficient, 3 Role model) for each job family and core skill, with the reason (FS25)',
    cols: {
      id: 'text pk', family_id: 'text ref:job_families idx', core_skill_id: 'text ref:core_skills idx', level: 'int', rationale_en: 'text', rationale_ar: 'text',
    },
    read: PUBLIC,
    write: { mode: 'none' },
  },
  core_skill_candidates: {
    module: 'M33', label: 'Candidate core skills considered and not added under the inclusion rule (merged, treated as an outcome or not added), with the reason and source (FS25)',
    cols: {
      id: 'text pk', name_en: 'text', name_ar: 'text', decision: 'text enum:merged|outcome|not_added idx', merged_into: 'text? ref:core_skills',
      has_development: 'bool =false', has_assessment: 'bool =false', reason_en: 'text', reason_ar: 'text', benchmark_ids: 'text[] =[]', sources: 'json =[]', sort: 'int =0',
    },
    read: PUBLIC,
    write: { mode: 'none' },
  },

  // ───────────── FS26 Situational judgement practice (wave C · E5)
  sjt_items: {
    module: 'M33', label: 'Situational judgement practice item (EN/AR): a plant scenario, four responses with expert effectiveness 0-3 and a why for each, and the expert rationale; read by training staff, served to takers without the key (FS26)',
    cols: {
      id: 'text pk', core_skill_id: 'text ref:core_skills idx',
      theme: 'text enum:conservative_decisions|questioning|raising_concerns|teamwork_pressure|procedure_use|learning_change|working_across_cultures|digital_judgement idx',
      stem_en: 'text', stem_ar: 'text', options_en: 'text[] =[]', options_ar: 'text[] =[]', expert_key: 'json =[]', notes_en: 'text[] =[]', notes_ar: 'text[] =[]',
      rationale_en: 'text', rationale_ar: 'text', status: 'text enum:active|retired =\'active\' idx', version: 'int =1', sort: 'int =0',
      updated_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'secure_items' }],
    write: { mode: 'rpc', res: 'secure_items' },
  },
  sjt_attempts: {
    module: 'M33', label: 'One person\'s situational judgement practice set: the items, answers with expert effectiveness, score and tally per core skill. Own only: never read by managers, HR or talent review (FS26)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', period: 'text idx', attempt_no: 'int', core_skill_id: 'text? ref:core_skills',
      status: 'text enum:in_progress|completed =\'in_progress\' idx', item_ids: 'text[] =[]', responses: 'json =[]', score: 'int?', by_skill: 'json ={}',
      reasons: 'json =[]', started_at: 'ts =now', completed_at: 'ts?',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'skills_profile' },
  },
};
