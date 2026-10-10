// M29 tables (owners: wave B E2 (FS09, FS10), wave D E5 (FS36, FS37) and wave I E2 (FS80)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
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
};
