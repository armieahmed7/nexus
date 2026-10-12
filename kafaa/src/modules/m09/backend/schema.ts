// M09 extension tables (owner: W5 · E2, F33 Contractor and supplier skills passport). Merged into SCHEMA through src/data/ext/schema.ts.
// Same DSL as src/data/schema.ts. Keep this file import-free except for `import type` (node scripts load it directly).
//
//   contract_role_targets   the ENEC role profiles a contractor organisation is contracted to staff, with a headcount band. Set by
//                           ENEC (partner_org A, rpc.setContractRoleTarget); read by the organisation (partner_org OwnOrg) and ENEC
//                           evaluators (equivalency R/A).
//   task_skill_links        reference map: which Kafa'a skills (and level) evidence each task of a qualification standard. Used by the
//                           equivalency pre-check (rpc.equivalencyPrecheck). Readable like the task list (frameworks, public R).
//   contractor_engagements  SIMULATED mirror of ENEC's contractor work history: past engagements with the skills an ENEC supervisor
//                           signed off. Read by the person (own_profile Own), their partner admin (equivalency OwnOrg) and ENEC
//                           evaluators (equivalency R/A). Signed-off engagements become `ojt` evidence on the passport.
// The passport itself is F01's person_skills / skill_evidence, whose read rules gained org scope for contractors (W5E2, F33).
//
//   prearrival_shares       [FS69 · fsGe5] a contractor's pre-arrival share: the FS32 share link (kafaa_record_shares: token, items,
//                           expiry, revocation) plus the qualification standard and mobilisation date the ENEC evaluator checks before
//                           arrival, how it was created (self, or on behalf by an evaluator with the consent reference) and the last
//                           check summary (counts only, from the shared items). Read by the contractor (own_profile Own), their partner
//                           admin (equivalency OwnOrg) and ENEC evaluators and auditors (equivalency A/R). The shared items themselves
//                           reach the evaluator only through rpc.prearrivalShare / rpc.precheckFromShare.
import type { TableDef } from '../../../data/schema';

export const TABLES_M09: Record<string, TableDef> = {
  contract_role_targets: {
    module: 'M09', label: 'ENEC role profiles a contractor organisation is contracted to staff, with a headcount band (F33)',
    cols: {
      id: 'text pk', org_id: 'text ref:organisations idx', role_id: 'text ref:job_roles idx', headcount_band: 'text enum:1-4|5-9|10-24|25+',
      contract_ref: 'text =\'\'', scope_en: 'text =\'\'', scope_ar: 'text =\'\'', valid_from: 'date?', valid_to: 'date?', active: 'bool =true idx',
      set_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'partner_org', org: 'org_id' }, { res: 'equivalency' }], write: { mode: 'rpc', res: 'partner_org' },
  },
  task_skill_links: {
    module: 'M09', label: 'Skills (and level) that evidence each task of a qualification standard; used by the equivalency pre-check (F33)',
    cols: {
      id: 'text pk', standard_id: 'text ref:qual_standards idx', task_id: 'text ref:task_items idx', skill_id: 'text ref:skills idx',
      need_level: 'int', sort: 'int =0',
    },
    read: [{ res: 'frameworks' }], write: { mode: 'none' },
  },
  contractor_engagements: {
    module: 'M09', label: 'SIMULATED mirror of contractor work history at ENEC with supervisor skill sign-offs (F33)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', org_id: 'text ref:organisations idx', ref_code: 'text', title_en: 'text', title_ar: 'text',
      role_id: 'text? ref:job_roles', started_on: 'date', ended_on: 'date?', status: 'text enum:in_progress|signed_off idx',
      supervisor_role_en: 'text =\'\'', supervisor_role_ar: 'text =\'\'', skills: 'json =[]', source: 'text enum:mirror =\'mirror\'', created_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'equivalency', org: 'org_id' }], write: { mode: 'none' },
  },
  // [FS69 · fsGe5]
  prearrival_shares: {
    module: 'M09', label: 'Contractor pre-arrival shares: an FS32 share link checked against a qualification standard before mobilisation (FS69)',
    cols: {
      id: 'text pk', share_id: 'text ref:record_shares uniq', person_id: 'text ref:people idx', org_id: 'text ref:organisations idx',
      standard_id: 'text ref:qual_standards idx', mobilise_on: 'date', created_via: 'text enum:self|on_behalf', created_by: 'text',
      consent_ref: 'text =\'\'', note: 'text =\'\'', checked_by: 'text?', checked_at: 'ts?', check_summary: 'json?', created_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'equivalency', org: 'org_id' }], write: { mode: 'rpc', res: 'equivalency' },
  },
};
