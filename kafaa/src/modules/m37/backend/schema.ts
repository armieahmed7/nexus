// M37 tables (owners: wave G E2 (FS62, FS63) and wave H E2 (FS73, FS74)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
//
// RBAC (FS wave G · E2; logged in the CONTRACT changelog): the FS01 resource national_alignment (all staff R, hr_analyst R/Agg,
// hr_director R/W, admin R/W/A; auditors R; never public, partners or observers). The three tables hold no person-level data (tags,
// links and role mappings), so the read rule is a plain national_alignment R/W/A read. Writes only through RPCs: FS62 saveNationalTag and
// setTagLink (W: HR director, admin); FS63 saveRoleOccupation (W) and verifyOccupationCode / clearOccupationCode (A: admin only).
// Measures (people counts) never live in these tables: the report RPC computes them from the data (national_alignment Agg/W/A).
//
// FS wave H · E2 (FS73, FS74; logged in the CONTRACT changelog):
//  - pipeline_mirror (FS73): a SIMULATED, de-identified HR mirror of hires into the critical and future roles (no person id, no name):
//    role, nationality group (reporting only), hire, leave and authorisation dates. Nobody reads a row directly (always-false open_read on
//    workforce_strategy); the only reader is the FS73 aggregate RPC emiratiPipeline (anyRole hr_analyst, hr_director, auditor), which
//    suppresses every count under 10. Seed only (write none): it mirrors the HR system, Kafa'a never edits it.
//  - wallet_targets (FS74): the dated organisation target for the core-five Future Skills Wallet, a leadership setting with who set it,
//    when, and its history. Read national_alignment R/W/A (staff see the target their wallet counts toward); written only through
//    setWalletTarget (workforce_strategy A: the HR director). The measured counter is computed by the RPCs, never stored.
import type { TableDef } from '../../../data/schema';

const NA = [{ res: 'national_alignment' as const }];

export const TABLES_M37: Record<string, TableDef> = {
  // ───────────── FS62 National-strategy alignment layer (wave G · E2)
  national_tags: {
    module: 'M37', label: 'National-strategy tag (NES 2031, We the UAE 2031, National AI Strategy 2031, Net Zero 2050, Jahiz groups, UAE Centennial 2071) with its pillars, goals or groups: EN/AR name and summary, horizon, sources with tiers (the most official first), derivation rule; never a typed total (FS62)',
    cols: {
      id: 'text pk', strategy: 'text enum:nes_2031|we_uae_2031|ai_2031|net_zero_2050|jahiz|centennial_2071 idx', parent_id: 'text? ref:national_tags idx',
      kind: 'text enum:strategy|pillar|goal|group', code: 'text uniq', name_en: 'text', name_ar: 'text', summary_en: 'text', summary_ar: 'text',
      horizon_year: 'int?', owner_en: 'text?', owner_ar: 'text?', sources: 'json =[]', source_scope: 'text enum:direct|indirect =\'direct\'',
      source_note_en: 'text?', source_note_ar: 'text?', derive: 'text? enum:future_group|cec_net_zero', future_group: 'text?',
      status: 'text enum:active|retired =\'active\' idx', sort: 'int =0', version: 'int =1', benchmark_ids: 'text[] =[]',
      created_by: 'text', created_at: 'ts =now', updated_by: 'text?', updated_at: 'ts =now',
    },
    read: NA,
    write: { mode: 'rpc', res: 'national_alignment' },
  },
  tag_links: {
    module: 'M37', label: 'Curated link from a national tag to a skill, competence, programme, pathway, credential or target row, with an EN/AR note; deactivated, never removed (FS62). Jahiz-group and Net Zero links derived from data are computed, not stored',
    cols: {
      id: 'text pk', tag_id: 'text ref:national_tags idx', target_table: 'text idx', target_id: 'text idx', note_en: 'text', note_ar: 'text',
      active: 'bool =true', created_by: 'text', created_at: 'ts =now', updated_by: 'text?', updated_at: 'ts =now',
    },
    read: NA,
    write: { mode: 'rpc', res: 'national_alignment' },
  },
  // ───────────── FS63 MoHRE occupation and skill-level mapping (wave G · E2)
  role_occupations: {
    module: 'M37', label: 'Current job role mapped to a national occupation label and indicative skill level (1-5); the MoHRE code is stored only when verified from an official source (else "code pending review"); Kafa\'a is not a MoHRE system (FS63)',
    cols: {
      id: 'text pk', role_id: 'text ref:job_roles uniq', label_en: 'text', label_ar: 'text', mohre_code: 'text?',
      code_status: 'text enum:pending_review|verified =\'pending_review\' idx', code_source: 'json?', verified_by: 'text?', verified_on: 'date?',
      skill_level: 'int', level_basis: 'text enum:education_rule|reviewed =\'education_rule\'', education_basis: 'text?', rationale_en: 'text?', rationale_ar: 'text?',
      history: 'json =[]', version: 'int =1', updated_by: 'text', updated_at: 'ts =now',
    },
    read: NA,
    write: { mode: 'rpc', res: 'national_alignment' },
  },
  // ───────────── FS73 Emirati pipeline by competency (wave H · E2)
  pipeline_mirror: {
    module: 'M37', label: 'SIMULATED, de-identified HR mirror of hires into critical and future roles: role, nationality group (reporting only), hire, leave and authorisation dates; read only by the suppressed FS73 aggregate (FS73)',
    cols: {
      id: 'text pk', role_id: 'text ref:job_roles idx', nationality_flag: 'text enum:uae|other', hired_on: 'date', left_on: 'date?', authorised_on: 'date?',
      source: 'text =\'SIMULATED HR mirror\'', simulated: 'bool =true', open_read: 'bool =false',
    },
    read: [{ res: 'workforce_strategy', where: 'open_read' }],
    write: { mode: 'none' },
  },
  // ───────────── FS74 Future Skills Wallet target (wave H · E2)
  wallet_targets: {
    module: 'M37', label: 'Dated organisation target for the core-five Future Skills Wallet: a leadership setting shown with who set it and when, with its history; a parameter, never a claim (FS74)',
    cols: {
      id: 'text pk', metric: 'text enum:core_five_complete', pct: 'int', due_on: 'date', note_en: 'text', note_ar: 'text',
      set_by: 'text ref:people', set_by_role: 'text', set_at: 'ts =now', status: 'text enum:active|superseded =\'active\' idx', version: 'int =1',
      history: 'json =[]', benchmark_ids: 'text[] =[]', sources: 'json =[]',
    },
    read: NA,
    write: { mode: 'rpc', res: 'workforce_strategy' },
  },
};
