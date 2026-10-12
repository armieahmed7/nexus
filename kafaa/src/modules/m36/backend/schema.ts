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
//
// RBAC (FS wave I · E4: FS82 mobility micro-grants, FS83 consortium trainee cohort; logged in the CONTRACT changelog; no new resource
// or grant):
//  - grant_rounds: internal_content R (ENEC staff, HR, auditors; partners none). Budgets SIMULATED. Written by rpc.scheduleGrantRound
//    (ecosystem W/A + workforce_strategy W/A: the HR analyst and the HR director).
//  - grant_applications: own rows (own_profile Own on person_id; a placement student filed on their behalf reads their own too) and HR,
//    admins and auditors through workforce_strategy R/W/A; no ecosystem R branch (staff never read other people's applications; the
//    training manager holds workforce_strategy Agg only and reads none). Written by applyGrant / withdrawGrant / submitGrantOutput (own),
//    decideGrant (HR A = ecosystem A + workforce_strategy W/A: the HR director) and reviewGrantOutput (ecosystem W/A + workforce_strategy W/A).
//  - consortium_cohorts: public where `listed` (talent_content R: graduates and applicants read the cohort design) plus workforce_strategy.
//    No person ids (mentors are role cards); partners are synthetic organisations, labelled.
//  - consortium_members, consortium_visits: the always-false open_read stops the ecosystem R branch, so a partner reads ONLY its own
//    organisation's trainees and their visits (OwnOrg on org_id = the trainee's employer); an ENEC trainee reads their own rows
//    (own_profile Own on person_id); HR, admins and auditors read all (workforce_strategy R/W/A). Hosts see the visits they host only
//    through rpc.consortiumHostVisits (trainee code, visiting organisation, date, hours; never a member row).
import type { TableDef } from '../../../data/schema';

type RR = TableDef['read'];
/** One organisation's rows: OwnOrg (never the R branch: open_read is always false) + HR / admin / auditor through workforce_strategy. */
const ORG_ROWS = (org: string): RR => [{ res: 'ecosystem', org, where: 'open_read' }, { res: 'workforce_strategy' }];

/** FS82/FS83 personal rows: the person (own_profile Own) + HR / admin / auditor through workforce_strategy. */
const OWN_ROWS: RR = [{ res: 'own_profile', person: 'person_id' }, { res: 'workforce_strategy' }];
/** FS83 trainee rows: the trainee, the trainee's employer (OwnOrg; open_read is always false) and HR / admin / auditor. */
const TRAINEE_ROWS: RR = [{ res: 'own_profile', person: 'person_id' }, { res: 'ecosystem', org: 'org_id', where: 'open_read' }, { res: 'workforce_strategy' }];

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

  // ───────────── FS82 Rolling mobility micro-grants (wave I · E4)
  grant_rounds: {
    module: 'M36', label: 'A bi-monthly mobility micro-grant round: window from the day after the previous deadline to its own deadline (10th of an even month), decisions 14 days later; budget and maximum award SIMULATED (FS82)',
    cols: {
      id: 'text pk', opens_on: 'date', closes_on: 'date uniq', decide_by: 'date', budget: 'int', max_award: 'int', currency: 'text =\'AED\'', note: 'text?',
      simulated: 'bool =true', created_by: 'text', created_at: 'ts =now', sample: 'bool =false',
    },
    read: [{ res: 'internal_content' }],
    write: { mode: 'rpc', res: 'ecosystem' },
  },
  grant_applications: {
    module: 'M36', label: 'A mobility micro-grant application: activity, purpose, dates, cost lines (SIMULATED AED), the skill it builds and the promised output; the HR decision; the output (report or presentation) and its review; own rows + HR (FS82)',
    cols: {
      id: 'text pk', round_id: 'text ref:grant_rounds idx', person_id: 'text ref:people idx', initials: 'text =\'\'', job_role_id: 'text?', years: 'int?', basis: 'text enum:early_career|placement', kind: 'text enum:conference|short_course|site_visit|exchange',
      title: 'text', purpose: 'text', destination: 'text', starts_on: 'date', ends_on: 'date', costs: 'json =[]', amount: 'int', skill_id: 'text ref:skills', output_kind: 'text enum:report|presentation',
      status: 'text enum:submitted|approved|declined|withdrawn =\'submitted\' idx', awarded: 'int?', decided_by: 'text?', decided_at: 'ts?', decision_note: 'text?',
      output_status: 'text enum:none|submitted|accepted|returned =\'none\'', output: 'json ={}', output_reviewed_by: 'text?', output_reviewed_at: 'ts?', output_note: 'text?',
      evidence: 'json =[]', profile_evidence: 'bool =false', on_behalf: 'bool =false', consent_ref: 'text?', created_by: 'text', created_at: 'ts =now', updated_at: 'ts =now', sample: 'bool =false',
    },
    read: OWN_ROWS,
    write: { mode: 'rpc', res: 'ecosystem' },
  },

  // ───────────── FS83 UAE energy consortium trainee cohort (wave I · E4)
  consortium_cohorts: {
    module: 'M36', label: 'A multi-employer trainee cohort (ENEC with synthetic partner organisations): partner sites and seats, shared modules hosted in turn, a project, cross-employer mentors (role cards), SIMULATED shared budget; builds on an FS20 academy (FS83)',
    cols: {
      id: 'text pk', code: 'text uniq', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', intake_year: 'int', academy_id: 'text ref:academies',
      nominations_close_on: 'date', starts_on: 'date', ends_on: 'date', partners: 'json =[]', modules: 'json =[]', project_en: 'text', project_ar: 'text',
      deliverable_en: 'text', deliverable_ar: 'text', mentors: 'json =[]', skills: 'text[] =[]', budget: 'json =[]', currency: 'text =\'AED\'',
      sources: 'json =[]', simulated: 'bool =true', synthetic: 'bool =true', listed: 'bool =true', sort: 'int =0',
    },
    read: [{ res: 'talent_content', where: 'listed' }, { res: 'workforce_strategy' }],
    write: { mode: 'none' },
  },
  consortium_members: {
    module: 'M36', label: 'A consortium trainee: ENEC staff (person) or a partner trainee (pseudonymous code only), employer, discipline, nomination and HR decision, cross-employer mentor and project team; trainee + own employer + HR (FS83)',
    cols: {
      id: 'text pk', cohort_id: 'text ref:consortium_cohorts idx', org_id: 'text ref:organisations idx', person_id: 'text? ref:people idx', initials: 'text?', trainee_code: 'text',
      discipline: 'text enum:mechanical|electrical|chemical|operations|instrumentation|environmental|digital', status: 'text enum:nominated|accepted|declined|withdrawn|completed =\'nominated\' idx',
      nominated_by: 'text', nominated_at: 'ts =now', decided_by: 'text?', decided_at: 'ts?', decision_note: 'text?', mentor_id: 'text?', team: 'text?', open_read: 'bool =false', sample: 'bool =false',
    },
    read: TRAINEE_ROWS,
    write: { mode: 'rpc', res: 'ecosystem' },
  },
  consortium_visits: {
    module: 'M36', label: 'A cross-site visit by a consortium trainee to another member organisation: logged, then confirmed or declined by the host only; confirmation writes evidence on the host site\'s focus skill (F01 for ENEC staff) (FS83)',
    cols: {
      id: 'text pk', cohort_id: 'text ref:consortium_cohorts idx', member_id: 'text ref:consortium_members idx', org_id: 'text ref:organisations idx', person_id: 'text? ref:people idx',
      trainee_code: 'text', host_org_id: 'text ref:organisations idx', module_id: 'text?', visit_on: 'date', hours: 'num', note: 'text =\'\'', skill_id: 'text ref:skills',
      status: 'text enum:logged|confirmed|declined|withdrawn =\'logged\' idx', logged_by: 'text', logged_via: 'text enum:self|employer|programme', confirmed_via: 'text? enum:host|enec_host|on_behalf',
      host_ref: 'text?', decided_by: 'text?', decided_at: 'ts?', decline_reason: 'text?', level: 'int =0', evidence: 'json =[]', profile_evidence: 'bool =false',
      created_at: 'ts =now', open_read: 'bool =false', sample: 'bool =false',
    },
    read: TRAINEE_ROWS,
    write: { mode: 'rpc', res: 'ecosystem' },
  },
};
