// M34 tables (owners: wave D E2 (FS29, FS30) and wave I E1 (FS78, FS79)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
import type { TableDef } from '../../../data/schema';

export const TABLES_M34: Record<string, TableDef> = {
  // ───────────── FS wave D · E2 · FS29 Recognition of prior learning (ILO RPL, UAE NQF / NQC work-experience recognition, UK nuclear
  // skills passports). Rules: src/modules/m34/rpl.ts (SQL kafaa_rpl_*). A request is read by its person (own_profile Own) and by
  // recognition R/W/A (assessors, the HR director, auditors); evidence rows also by the supervisor named in an attestation. Written
  // only through rpc.submitRpl / attestRpl / decideRpl (maker-checker) / exportRpl. Kafa'a is never a licensing or regulatory authority.
  rpl_requests: {
    module: 'M34', label: 'RPL requests: target skill or micro-credential, narrative, maker-checker decision (full, partial, not yet), RPL statement (FS29)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', person_name: 'text =\'\'', person_name_ar: 'text =\'\'', person_kind: 'text enum:staff|contractor =\'staff\'', org_id: 'text?',
      target_kind: 'text enum:skill|credential', skill_id: 'text? ref:skills idx', microcred_def_id: 'text?', level: 'int?',
      target_title_en: 'text =\'\'', target_title_ar: 'text =\'\'', target_skill_ids: 'text[] =[]', narrative_en: 'text =\'\'', narrative_ar: 'text =\'\'',
      status: 'text enum:draft|submitted|recommended|decided|withdrawn =\'draft\' idx', opened_by: 'text', opened_role: 'text?', submitted_on: 'date?',
      outcome: 'text? enum:full|partial|not_yet', credited_level: 'int?', hours: 'int =0', nqf_level: 'int?', rationale_en: 'text?', rationale_ar: 'text?',
      recommended_by: 'text?', recommended_role: 'text?', recommended_on: 'date?', return_note: 'text?', return_count: 'int =0',
      decided_by: 'text?', decided_role: 'text?', decided_on: 'date?', rpl_statement_en: 'text?', rpl_statement_ar: 'text?', evidence_ids: 'text[] =[]',
      export_count: 'int =0', exported_at: 'ts?', withdrawn_on: 'date?', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'recognition' }], write: { mode: 'rpc', res: 'recognition' },
  },
  rpl_evidence: {
    module: 'M34', label: 'RPL evidence packs: OJT practice, simulator debriefs, qualification mirror (qualified or not), engagements, supervisor attestations (FS29)',
    cols: {
      id: 'text pk', request_id: 'text ref:rpl_requests idx', person_id: 'text ref:people idx',
      kind: 'text enum:ojt|simulator|qualification|engagement|attestation', ref_table: 'text?', ref_id: 'text?',
      title_en: 'text', title_ar: 'text', detail_en: 'text =\'\'', detail_ar: 'text =\'\'', observed_on: 'date?', mirror: 'bool =false',
      mirror_status: 'text? enum:qualified|not_qualified', skill_ids: 'text[] =[]',
      attester_id: 'text? ref:people idx', attester_role_en: 'text?', attester_role_ar: 'text?', request_note: 'text?',
      attestation_status: 'text? enum:requested|confirmed|declined', attestation_en: 'text?', attestation_ar: 'text?', attested_on: 'date?',
      target_title_en: 'text =\'\'', target_title_ar: 'text =\'\'', requester_name: 'text =\'\'', requester_name_ar: 'text =\'\'',
      active: 'bool =true', added_by: 'text', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'own_profile', person: 'attester_id' }, { res: 'recognition' }], write: { mode: 'rpc', res: 'recognition' },
  },
  // ───────────── FS wave D · E2 · FS30 NQF levels and learning credits (UAE NQF, SkillsFuture Level-Up / UK LLE, NST/NCS upkeep).
  // Rules: src/modules/m34/credits.ts (SQL kafaa_cr_*). Published tags and stacks are public reference data (always indicative);
  // framework owners (frameworks W/A) tag items through rpc.tagCredit. The ledger is the person's own (own_profile Own) plus
  // audit_log R; rebuilt only by rpc.syncCredits / the RPL decision (creditsFor TS = SQL), never deleted.
  credit_tags: {
    module: 'M34', label: 'Indicative NQF level and credits (1 credit = 10 notional hours) on courses, pathways and micro-credentials (FS30)',
    cols: {
      id: 'text pk', item_kind: 'text enum:course|pathway|microcred', item_id: 'text idx', title_en: 'text', title_ar: 'text',
      nqf_level: 'int', notional_hours: 'int', credits: 'num', indicative: 'bool =true', basis_en: 'text', basis_ar: 'text', stack_ids: 'text[] =[]',
      status: 'text enum:published|retired =\'published\' idx', listed: 'bool =true', source_url: 'text', as_of: 'date', version: 'int =1',
      updated_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'public_content', where: 'listed' }, { res: 'audit_log' }], write: { mode: 'rpc', res: 'frameworks' },
  },
  credit_stacks: {
    module: 'M34', label: '30-credit stacks toward an indicative external award with a partner university still to be agreed (FS30)',
    cols: {
      id: 'text pk', title_en: 'text', title_ar: 'text', award_en: 'text', award_ar: 'text', partner_en: 'text', partner_ar: 'text',
      summary_en: 'text', summary_ar: 'text', credits_required: 'int =30', nqf_level: 'int', min_item_nqf: 'int =1', rpl_max: 'int =10',
      skill_ids: 'text[] =[]', status: 'text enum:indicative =\'indicative\'', source_url: 'text', as_of: 'date', benchmark_ids: 'text[] =[]', sort: 'int =0',
    },
    read: [{ res: 'public_content' }], write: { mode: 'none' },
  },
  credit_ledger: {
    module: 'M34', label: 'Personal credit ledger: one row per completed tagged item and RPL credit; reversed, never deleted (FS30)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', item_kind: 'text enum:course|pathway|microcred|rpl', item_id: 'text', tag_id: 'text?',
      title_en: 'text', title_ar: 'text', completed_on: 'date', source_table: 'text', source_id: 'text', notional_hours: 'int', credits: 'num',
      nqf_level: 'int?', stack_ids: 'text[] =[]', status: 'text enum:counted|reversed =\'counted\' idx', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'audit_log' }], write: { mode: 'rpc', res: 'recognition' },
  },
};
