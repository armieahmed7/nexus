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

  // ───────────── FS58 Adaptive problem-solving practice (wave F · E5)
  aps_scenarios: {
    module: 'M33', label: 'Adaptive problem-solving practice scenario (PIAAC-style, EN/AR): the first plan, then one or more mid-task changes revealed only after the earlier choice; per stage the facts to judge and 3-4 options with expert effectiveness 0-3, a why each and the debrief; training staff read the key, takers get stages without it (FS58)',
    cols: {
      id: 'text pk', code: 'text uniq', theme: 'text enum:outage_schedule|conflicting_data|supply_delay|staffing_change|weather_logistics|procedure_revision|digital_tool_outage|priority_conflict idx',
      title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', context_en: 'text', context_ar: 'text',
      core_skill_ids: 'text[] =[]', skill_ids: 'text[] =[]', difficulty: 'int =2', est_minutes: 'int =10', stages: 'json =[]', sources: 'json =[]',
      status: 'text enum:draft|published|retired =\'draft\' idx', version: 'int =1', sort: 'int =0', updated_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'secure_items' }],
    write: { mode: 'rpc', res: 'secure_items' },
  },
  aps_attempts: {
    module: 'M33', label: 'One person\'s adaptive problem-solving practice run: the stages answered (choice, facts picked, effectiveness), points, the 0-100 practice score, band and dimensions. Own only: never a manager, HR, talent review or a qualification (FS58)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', scenario_id: 'text ref:aps_scenarios idx', scenario_version: 'int =1', attempt_no: 'int', period: 'text idx',
      status: 'text enum:in_progress|completed|abandoned =\'in_progress\' idx', stage_ids: 'text[] =[]', responses: 'json =[]', points: 'int?', max_points: 'int?', score: 'int?',
      band: 'text? enum:emerging|developing|adaptive|strategic', dims: 'json ={}', reasons: 'json =[]', started_at: 'ts =now', completed_at: 'ts?',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'skills_profile' },
  },

  // ───────────── FS59 Role-play practice library with saved feedback (wave F · E5)
  roleplay_scenarios: {
    module: 'M33', label: 'ENEC-authored role-play practice scenario (EN/AR): the setting, the counterpart, 3-5 turns with hints and example answers, and the published deterministic rubric (criteria with what each looks for and a tip); staff read published ones (listed), training staff all (FS59)',
    cols: {
      id: 'text pk', code: 'text uniq', kind: 'text enum:pre_job_brief|shift_turnover|raise_concern|regulator_interview|knowledge_transfer|ai_peer_coaching idx',
      title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', setting_en: 'text', setting_ar: 'text', counterpart_en: 'text', counterpart_ar: 'text',
      role_en: 'text', role_ar: 'text', core_skill_ids: 'text[] =[]', skill_ids: 'text[] =[]', level: 'int =1', pass_pct: 'int =70', est_minutes: 'int =15',
      turns: 'json =[]', rubric: 'json =[]', sources: 'json =[]', status: 'text enum:draft|published|retired =\'draft\' idx', listed: 'bool =false',
      version: 'int =1', sort: 'int =0', updated_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'internal_content', where: 'listed' }, { res: 'secure_items' }],
    write: { mode: 'rpc', res: 'secure_items' },
  },
  roleplay_sessions: {
    module: 'M33', label: 'One person\'s role-play practice session: the rubric ticks and word count per turn and the summary (never the answer text); the review request to a named reviewer and, once validated, the evidence written. Own only; the named reviewer sees a requested session through the review queue RPC (FS59)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', scenario_id: 'text ref:roleplay_scenarios idx', scenario_version: 'int =1', period: 'text idx',
      status: 'text enum:in_progress|completed =\'in_progress\' idx', turns: 'json =[]', passed: 'int?', total: 'int?', pct: 'int?', ready: 'bool =false', reasons: 'json =[]',
      started_at: 'ts =now', completed_at: 'ts?', review_status: 'text enum:none|requested|validated|declined|withdrawn =\'none\' idx', reviewer_id: 'text? ref:people idx',
      review_context: 'text?', requested_at: 'ts?', reviewed_by: 'text?', reviewed_at: 'ts?', review_note: 'text?', level: 'int =0', evidence_ids: 'text[] =[]',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'skills_profile' },
  },
};
