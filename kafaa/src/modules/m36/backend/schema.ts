// M36 tables (owners: wave G E3 (FS64, FS65) and wave I E4 (FS82, FS83)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
//
// RBAC (FS wave G · E3; logged in the CONTRACT changelog). Resource `ecosystem` (staff R/Own; partner_user R/OwnOrg; partner_admin and
// university R/OwnOrg/OrgW; HR R/Agg/W, HR director A; admin R/A; auditor R). Caveat from src/auth/policy.ts: R on `ecosystem` would read
// every row of a table whose rule names it, and every staff role and every partner holds R. So:
//  - regional_demand (FS64): ONLY released, suppressed aggregates are stored (built by rpc.releaseRegionalDemand from a released FS51
//    forecast; cells of 1-9 people-equivalents are null). Readable by ecosystem R/W/A where `released` (every stored row), plus
//    workforce_strategy holders (HR, training manager, admin, auditor). No person-level data, no levels, no supply, no assumptions.
//  - provider_commitments (FS64), pledges and pledge_progress (FS65): one organisation's rows. The always-false `open_read` column stops
//    the ecosystem R branch, so a partner or university reads ONLY its own organisation's rows (OwnOrg); HR, admins and auditors read all
//    rows through workforce_strategy R/W/A (hr_analyst W, hr_director W/A, admin R, auditor R; the training manager holds only Agg and
//    reads none). ENEC staff with ecosystem R see the suppressed aggregate ledger (rpc.pledgeLedger), never the rows.
//  - Writes only through the RPCs: releaseRegionalDemand (workforce_strategy A + ecosystem W), commitProvision /
//    reportCommitmentDelivery (ecosystem OrgW, own organisation), reviewCommitment (ecosystem W), registerPledge / recordPledgeProgress
//    (OrgW for the own organisation; ecosystem W for the ENEC entities). Every call writes an audit row.
import type { TableDef } from '../../../data/schema';

type RR = TableDef['read'];
/** One organisation's rows: OwnOrg (never the R branch: open_read is always false) + HR / admin / auditor through workforce_strategy. */
const ORG_ROWS = (org: string): RR => [{ res: 'ecosystem', org, where: 'open_read' }, { res: 'workforce_strategy' }];

export const TABLES_M36: Record<string, TableDef> = {
  // ───────────── FS64 Regional skills plan for Al Dhafra
  regional_demand: {
    module: 'M36', label: 'Released regional skill demand for Al Dhafra (SIMULATED): per catalogue area and horizon year, the working-level demand and gap bands across the three FS51 scenarios and the planning-scenario gap, cells of 1-9 suppressed; built only by rpc.releaseRegionalDemand from a released FS51 forecast (FS64)',
    cols: {
      id: 'text pk', release_id: 'text idx', forecast_id: 'text ref:skill_forecasts', forecast_name: 'text', cycle: 'int', region: 'text =\'al_dhafra\'',
      scenario: 'text enum:baseline|advance|accelerated', area: 'text idx', year: 'int',
      demand_low: 'int?', demand_high: 'int?', gap_low: 'int?', gap_high: 'int?', gap_plan: 'int?', skills_n: 'int =0', withheld_n: 'int =0', skill_ids: 'text[] =[]',
      suppressed: 'bool =false', note_en: 'text =\'\'', note_ar: 'text =\'\'', status: 'text enum:current|superseded =\'current\' idx', released: 'bool =true',
      released_by: 'text', released_at: 'ts =now', simulated: 'bool =true',
    },
    read: [{ res: 'ecosystem', where: 'released' }, { res: 'workforce_strategy', special: 'agg_ok' }],
    write: { mode: 'rpc', res: 'ecosystem' },
  },
  provider_commitments: {
    module: 'M36', label: 'A provider\'s commitment against the released regional demand: planned cohorts or course changes per academic term, delivery reported each term, ENEC acknowledgement; one organisation\'s rows (FS64)',
    cols: {
      id: 'text pk', org_id: 'text ref:organisations idx', org_name_en: 'text', org_name_ar: 'text', org_kind: 'text', release_id: 'text', area: 'text idx',
      kind: 'text enum:cohort|course_change|new_course|apprenticeship', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text',
      skill_ids: 'text[] =[]', level: 'int', plan: 'json =[]', delivery: 'json =[]', status: 'text enum:active|withdrawn =\'active\' idx',
      withdrawn_reason: 'text?', hr_status: 'text enum:pending|acknowledged|queried =\'pending\'', hr_note: 'text?', hr_by: 'text?', hr_at: 'ts?',
      version: 'int =1', history: 'json =[]', created_by: 'text', created_at: 'ts =now', updated_by: 'text?', updated_at: 'ts =now',
      open_read: 'bool =false', sample: 'bool =false',
    },
    read: ORG_ROWS('org_id'),
    write: { mode: 'rpc', res: 'ecosystem' },
  },

  // ───────────── FS65 Skills pledges ledger
  pledges: {
    module: 'M36', label: 'A numeric upskilling pledge by one organisation: people x skill area x target date; pledged, started and completed are never merged (FS65)',
    cols: {
      id: 'text pk', org_id: 'text ref:organisations idx', org_name_en: 'text', org_name_ar: 'text', org_kind: 'text', area: 'text idx', people: 'int',
      target_date: 'date', pledged_on: 'date', title_en: 'text', title_ar: 'text', department_en: 'text?', department_ar: 'text?',
      status: 'text enum:active|withdrawn =\'active\' idx', created_by: 'text', created_at: 'ts =now', updated_at: 'ts =now', open_read: 'bool =false', sample: 'bool =false',
    },
    read: ORG_ROWS('org_id'),
    write: { mode: 'rpc', res: 'ecosystem' },
  },
  pledge_progress: {
    module: 'M36', label: 'A dated progress snapshot of a pledge: people started and people completed, cumulative and never decreasing (FS65)',
    cols: {
      id: 'text pk', pledge_id: 'text ref:pledges idx', org_id: 'text ref:organisations idx', as_of: 'date', started: 'int', completed: 'int',
      note_en: 'text?', note_ar: 'text?', reported_by: 'text', reported_at: 'ts =now', open_read: 'bool =false',
    },
    read: ORG_ROWS('org_id'),
    write: { mode: 'rpc', res: 'ecosystem' },
  },
};
