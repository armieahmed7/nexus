// M28 tables (owners: wave B E1 (FS07, FS08) and wave H E1 (FS70, FS71, FS72)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
//
// FS08 (wave B · E1) · International crosswalk:
//   skill_frameworks  the external frameworks Kafa'a aligns to (ESCO, O*NET, SFIA 9, SkillsFuture, DigComp, UNESCO AI, GreenComp,
//                     NICE, IAEA, UAE NQF, Lightcast): owner, version, code kind, level scale, source and as-of date. Public; write none.
//   skill_alignments  one row per skill x external entry: code (only when copied from the source; else label-level, "code pending
//                     review"), EN/AR label, match type, level map, source URL, as-of date, review state. Published rows are public
//                     (listed = status published); drafts and retired rows are read by framework owners (sat: instructors and the
//                     training manager), admins and auditors (audit_log). Writes only through rpc.saveAlignment/reviewAlignment/
//                     retireAlignment (frameworks W/A; audited; maker-checker on review). Never deleted: retired instead.
// FS07 (wave B · E1) · Skills Catalogue Explorer:
//   skill_goals       "Add to my goals" from a skill page: own rows only (own_profile), written by rpc.setSkillGoal (skills_profile
//                     Own). Hand-off source for FS33 "Skills I want to grow" (wave D).
import type { TableDef } from '../../../data/schema';

export const TABLES_M28: Record<string, TableDef> = {
  skill_frameworks: {
    module: 'M28', label: 'External skills frameworks the crosswalk aligns to: owner, version, code kind, level scale, source (FS08)',
    cols: {
      id: 'text pk', short: 'text', name_en: 'text', name_ar: 'text', owner_en: 'text', owner_ar: 'text', version_label: 'text =\'\'',
      kind: 'text enum:skills|occupations|competences|qualifications|reference', code_label_en: 'text =\'\'', code_label_ar: 'text =\'\'',
      codes_copied: 'bool =false', level_scale_en: 'text =\'\'', level_scale_ar: 'text =\'\'', scope_en: 'text =\'\'', scope_ar: 'text =\'\'',
      url: 'text', benchmark_id: 'text? idx', as_of: 'date', sort: 'int =0',
    },
    read: [{ res: 'public_content' }], write: { mode: 'none' },
  },
  skill_alignments: {
    module: 'M28', label: 'Skill crosswalk: one external framework entry per row, match type, level map, source and review state (FS08)',
    cols: {
      id: 'text pk', skill_id: 'text ref:skills idx', framework: 'text ref:skill_frameworks idx', external_code: 'text?',
      label_en: 'text', label_ar: 'text', label_ar_official: 'bool =false', external_meta: 'json ={}',
      match_type: 'text enum:exact|close|broad|partial idx', level_map: 'json ={}', note_en: 'text =\'\'', note_ar: 'text =\'\'',
      source_url: 'text', as_of: 'date', status: 'text enum:draft|published|retired =\'draft\' idx', listed: 'bool =false',
      reviewed_by: 'text?', reviewed_role: 'text?', reviewed_on: 'date?', retired_reason: 'text?', retired_on: 'date?',
      version: 'int =1', created_by: 'text?', created_at: 'ts =now', updated_by: 'text?', updated_at: 'ts =now', sort: 'int =0',
    },
    read: [{ res: 'public_content', where: 'listed' }, { res: 'audit_log' }, { res: 'sat' }],
    write: { mode: 'rpc', res: 'frameworks' },
  },
  skill_goals: {
    module: 'M28', label: 'Skills a person wants to grow, added from the skills explorer (FS07; hand-off to FS33)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', skill_id: 'text ref:skills idx', target_level: 'int =2',
      status: 'text enum:active|removed =\'active\' idx', source: 'text =\'skills_explorer\'', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'skills_profile' },
  },
};
