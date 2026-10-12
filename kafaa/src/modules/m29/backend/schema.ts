// M29 tables (owners: wave B E2 (FS09, FS10), wave D E5 (FS36, FS37) and wave I E2 (FS80)). FS36/FS37 tables: ai_systems, ai_system_users, ai_drills, ai_drill_keys, ai_drill_attempts. FS80 tables: automations, automation_adoptions. Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
import type { TableDef } from '../../../data/schema';

const PUBLIC = [{ res: 'public_content' }];

export const TABLES_M29: Record<string, TableDef> = {
  // ───────────── FS09 AI Fluency Ladder (wave B · E2)
  ai_rungs: {
    module: 'M29', label: 'AI fluency ladder cell: one rung (Aware, Practitioner, Builder, Assurer) x one UNESCO dimension, with plant examples and the literacy skills that evidence it (FS09)',
    cols: {
      id: 'text pk', rung: 'int', rung_key: 'text enum:aware|practitioner|builder|assurer', dimension: 'text enum:mindset|ethics|techniques|design idx',
      name_en: 'text', name_ar: 'text', essence_en: 'text', essence_ar: 'text', descriptor_en: 'text', descriptor_ar: 'text', example_en: 'text', example_ar: 'text',
      skill_ids: 'text[] =[]', min_level: 'int', learning: 'json =[]', sources: 'json =[]', sort: 'int =0',
    },
    read: PUBLIC,
    write: { mode: 'none' },
  },
  ai_skill_tracks: {
    module: 'M29', label: 'Whether an AI or digital skill counts as AI literacy (everyone, raises the rung) or AI engineering (specialists, shown apart) (FS09)',
    cols: { id: 'text pk', skill_id: 'text ref:skills uniq', track: 'text enum:literacy|engineering idx', rationale_en: 'text', rationale_ar: 'text', sort: 'int =0' },
    read: PUBLIC,
    write: { mode: 'none' },
  },
  ai_role_targets: {
    module: 'M29', label: 'AI fluency target per job family: a rung plus optional cells from a higher rung, and the fitness-check score the family aims for (FS09/FS10)',
    cols: {
      id: 'text pk', family_id: 'text ref:job_families uniq', rung: 'int', plus_cells: 'text[] =[]', fitness_target: 'int',
      rationale_en: 'text', rationale_ar: 'text', sort: 'int =0',
    },
    read: PUBLIC,
    write: { mode: 'none' },
  },
  ai_org_targets: {
    module: 'M29', label: 'Dated organisation AI-fluency target set by leadership: a demo parameter shown beside the measured value, never a claim (FS09)',
    cols: {
      id: 'text pk', metric: 'text enum:practitioner_or_above|above_basic', pct: 'num', due_on: 'date', basis_en: 'text', basis_ar: 'text',
      set_by_en: 'text', set_by_ar: 'text', benchmark_ids: 'text[] =[]', sources: 'json =[]', as_of: 'date',
    },
    read: [{ res: 'ai_literacy', special: 'agg_ok' }],
    write: { mode: 'none' },
  },

  // ───────────── FS10 AI and Digital Fitness Check (wave B · E2)
  fitness_areas: {
    module: 'M29', label: 'Fitness-check area: the five DigComp areas and the four AI dimensions, with weight and the skills its evidence goes to (FS10)',
    cols: {
      id: 'text pk', framework: 'text enum:digcomp|ai', code: 'text', name_en: 'text', name_ar: 'text', summary_en: 'text', summary_ar: 'text',
      weight: 'num =1', skill_ids: 'text[] =[]', dimension: 'text? enum:mindset|ethics|techniques|design', sources: 'json =[]', sort: 'int =0',
    },
    read: PUBLIC,
    write: { mode: 'none' },
  },
  fitness_items: {
    module: 'M29', label: 'Fitness-check item bank (EN/AR, difficulty 1-3, answer key): read by training staff only, served to takers without the key by the RPCs (FS10)',
    cols: {
      id: 'text pk', area_id: 'text ref:fitness_areas idx', difficulty: 'int', stem_en: 'text', stem_ar: 'text', options_en: 'text[] =[]', options_ar: 'text[] =[]',
      correct: 'int', explain_en: 'text =\'\'', explain_ar: 'text =\'\'', status: 'text enum:active|retired =\'active\' idx', version: 'int =1', sort: 'int =0',
      updated_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'secure_items' }],
    write: { mode: 'rpc', res: 'ai_literacy' },
  },
  fitness_attempts: {
    module: 'M29', label: 'One person\'s fitness-check attempt in a quarter: answers in order, area levels, score, band and the capped evidence it wrote (FS10)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', period: 'text idx', attempt_no: 'int', status: 'text enum:in_progress|completed =\'in_progress\' idx',
      started_at: 'ts =now', completed_at: 'ts?', responses: 'json =[]', current_item_id: 'text?', item_count: 'int =0', area_levels: 'json ={}',
      score: 'int?', band: 'text? enum:limited|basic|above_basic|advanced', reasons: 'json =[]', evidence: 'json =[]',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'ai_literacy' },
  },

  // ───────────── FS36 AI-literacy register (wave D E5)
  ai_systems: {
    module: 'M29', label: 'AI-literacy register entry: one AI system (synthetic example), ENEC as provider or deployer, approved-use class, maturity label, owner role card, literacy measures and sources (FS36)',
    cols: {
      id: 'text pk', name_en: 'text', name_ar: 'text', purpose_en: 'text', purpose_ar: 'text', ai_role: 'text enum:provider|deployer', use_class: 'text enum:information|decision_support|automation',
      maturity: 'text enum:planned|partial|full idx', simulated: 'bool =true', owner_person_id: 'text ref:people idx', owner_en: 'text', owner_ar: 'text', oversight_en: 'text', oversight_ar: 'text',
      measures: 'json =[]', sources: 'json =[]', benchmark_ids: 'text[] =[]', status: 'text enum:draft|published|retired =\'draft\' idx', listed: 'bool =false', version: 'int =1', review_due: 'date?',
      as_of: 'date', sort: 'int =0', updated_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'ai_literacy', where: 'listed' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'ai_literacy' },
  },
  ai_system_users: {
    module: 'M29', label: 'A user group of an AI system: job families (or all staff), provider or deployer side, the FS09 rung it needs and extra cells (FS36)',
    cols: {
      id: 'text pk', system_id: 'text ref:ai_systems idx', label_en: 'text', label_ar: 'text', family_ids: 'text[] =[]', all_staff: 'bool =false', side: 'text enum:provider|deployer',
      required_rung: 'int', required_cells: 'text[] =[]', rationale_en: 'text =\'\'', rationale_ar: 'text =\'\'', active: 'bool =true', listed: 'bool =false', sort: 'int =0',
    },
    read: [{ res: 'ai_literacy', where: 'listed' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'ai_literacy' },
  },

  // ───────────── FS37 Governed AI sandbox drills (wave D E5)
  ai_drills: {
    module: 'M29', label: 'Sandbox drill: a synthetic controlled procedure, an AI-styled summary in segments and a challenge protocol (no answers; the key is in ai_drill_keys) (FS37)',
    cols: {
      id: 'text pk', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', scenario_en: 'text', scenario_ar: 'text', difficulty: 'int', level: 'int',
      skill_id: 'text ref:skills idx', doc: 'json ={}', output: 'json ={}', protocol: 'json =[]', est_minutes: 'int =10', synthetic: 'bool =true', sources: 'json =[]',
      status: 'text enum:draft|published|retired =\'draft\' idx', listed: 'bool =false', version: 'int =1', sort: 'int =0', updated_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'ai_literacy', where: 'listed' }, { res: 'secure_items' }],
    write: { mode: 'rpc', res: 'ai_literacy' },
  },
  ai_drill_keys: {
    module: 'M29', label: 'Answer key of a sandbox drill: the planted errors (segment, kind, step) and the protocol answers; training staff only (FS37)',
    cols: { id: 'text pk', drill_id: 'text ref:ai_drills uniq', errors: 'json =[]', protocol: 'json =[]', pass_pct: 'int =70' },
    read: [{ res: 'secure_items' }],
    write: { mode: 'rpc', res: 'ai_literacy' },
  },
  ai_drill_attempts: {
    module: 'M29', label: 'One person\'s submitted sandbox drill: flags, protocol answers, score, pass, level and the capped evidence it wrote (FS37)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', drill_id: 'text ref:ai_drills idx', drill_version: 'int', attempt_no: 'int', flags: 'json =[]', answers: 'json =[]',
      points: 'int', max_points: 'int', pct: 'int', found: 'int', errors: 'int', false_flags: 'int', critical_ok: 'bool', passed: 'bool', level: 'int =0',
      feedback: 'json ={}', reasons: 'json =[]', evidence: 'json =[]', submitted_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'ai_literacy' },
  },

  // ───────────── FS80 Automation and agent gallery with builder credit (wave I E2)
  // Metadata only: no code, file or link column; `metadata_only` is checked true in SQL. Read: staff (ai_literacy R) see listed (approved)
  // entries; the builder sees their own entries in every status (Own; the always-false open_read keeps R holders out of unlisted rows);
  // admins (AI governance) and auditors read every entry through audit_log R. Adoption rows: the adopter (Own) and audit_log R only; the
  // builder sees the counter on the entry, never who adopted. Builder and owner names are copied onto the entry (like the FS36 register's
  // owner_en/_ar) because staff cannot read other people's rows.
  automations: {
    module: 'M29', label: 'Automation or agent gallery entry (metadata only, never run by Kafa\'a): purpose, data used, accountable owner, human check, how to use, the AI-system register row it runs on, governance decision and adoption counter (FS80)',
    cols: {
      id: 'text pk', title_en: 'text', title_ar: 'text', kind: 'text enum:workflow|agent|template|report idx', purpose_en: 'text', purpose_ar: 'text',
      data_used_en: 'text', data_used_ar: 'text', data_classes: 'text[] =[]', system_id: 'text ref:ai_systems idx', builder_person_id: 'text ref:people idx', owner_person_id: 'text ref:people idx',
      builder_en: 'text', builder_ar: 'text', owner_en: 'text', owner_ar: 'text', family_id: 'text?', oversight_en: 'text', oversight_ar: 'text', benefit_en: 'text', benefit_ar: 'text', how_en: 'text', how_ar: 'text', min_rung: 'int =1',
      status: 'text enum:draft|submitted|returned|approved|rejected|retired =\'draft\' idx', listed: 'bool =false', version: 'int =1', metadata_only: 'bool =true',
      adoption_count: 'int =0', first_adopted_on: 'date?', builder_level: 'int =0', submitted_at: 'ts?', decided_by: 'text?', decided_at: 'ts?', decision_note: 'text =\'\'',
      history: 'json =[]', open_read: 'bool =false', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'ai_literacy', where: 'listed' }, { res: 'ai_literacy', person: 'builder_person_id', where: 'open_read' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'ai_literacy' },
  },
  automation_adoptions: {
    module: 'M29', label: 'One person\'s recorded reuse of an approved gallery entry (one row per person and entry; the builder never adopts their own) (FS80)',
    cols: {
      id: 'text pk', automation_id: 'text ref:automations idx', person_id: 'text ref:people idx', family_id: 'text?', adopted_on: 'date', note: 'text =\'\'', open_read: 'bool =false', created_at: 'ts =now',
    },
    read: [{ res: 'ai_literacy', person: 'person_id', where: 'open_read' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'ai_literacy' },
  },
};
