// M11 extension tables (owner: FS wave A · E3, FS04 one future-skill keyspace). Merged into SCHEMA through src/data/ext/schema.ts.
// Same DSL as src/data/schema.ts. Keep this file import-free except for `import type` (node scripts load it directly).
//
//   future_skill_map   the one future-skill keyspace: every ADVANCE skill (adv_skills `as-*`), every radar key (future_skills.skill_key)
//                      and every gap-plan key resolves to at least one catalogue skill (`sk-*`, F01) with a relation (transfers, adapts,
//                      new) and the level a person needs on it. Taxonomy reference data: readable like frameworks (public R); changed
//                      only by an admin through rpc.saveFutureSkillMap (audited). Rows are never removed (active = false instead).
// The M11 columns added by FS04 to future_skills, adv_skills and skill_gap_plans live in the M11 block of src/data/schema.ts.
import type { TableDef } from '../../../data/schema';

export const TABLES_M11: Record<string, TableDef> = {
  future_skill_map: {
    module: 'M11', label: 'One future-skill keyspace: ADVANCE, radar and gap-plan keys resolved to catalogue skills (FS04)',
    cols: {
      id: 'text pk', key: 'text idx', key_kind: 'text enum:adv_skill|radar|gap_plan idx', sk_id: 'text ref:skills idx',
      relation: 'text enum:transfers|adapts|new', need_level: 'int =2', primary_sk: 'bool =false', active: 'bool =true',
      note_en: 'text =\'\'', note_ar: 'text =\'\'', sort: 'int =0', updated_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'frameworks' }], write: { mode: 'rpc', res: 'frameworks' },
  },
};
