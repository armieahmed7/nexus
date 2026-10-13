// M36 routes (Skills Ecosystem; owners: wave G E3 (FS64, FS65) and wave I E4 (FS82, FS83)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M36', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m36.routes.<id>.title|purpose in src/i18n/m36.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m36/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips feature="FSnn" /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
// FS wave G · E3 (FS64, FS65), resource `ecosystem`:
//  - ECO_ANY: every ecosystem reader (staff R, partners and universities R/OwnOrg, HR, admin, auditor): the released regional demand and
//    the suppressed pledges ledger.
//  - ECO_ORG: organisation work (partners and universities OwnOrg; HR Agg; admin A; auditors read through anyRole): their commitments and
//    pledges; rows themselves are OwnOrg by RLS (a partner sees only its own organisation).
//  - RELEASE: workforce_strategy Agg/W/A (HR, the training manager previews); releasing needs workforce_strategy A + ecosystem W (RPC).
// FS wave I · E4 (FS82, FS83), resource `ecosystem` (no new grant):
//  - STAFF_OWN: ENEC staff (ecosystem Own): my micro-grants, my consortium place.
//  - GR_READ: the programme figures (staff ecosystem Own, HR W/A, auditors through anyRole); partners have no internal programme pages.
//  - GR_HR: the HR console (workforce_strategy W/A: the HR analyst and the HR director; auditors read through anyRole).
//  - CC_ANY: the cohort workspace (every ecosystem reader: staff, partners, universities, HR, admin, auditors); rows are RLS-filtered.
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const ECO_ANY = { signedIn: true, grant: { res: 'ecosystem' as const, levels: ['R' as const, 'Agg' as const, 'W' as const, 'A' as const, 'OwnOrg' as const, 'OrgW' as const] } };
const ECO_ORG = { signedIn: true, anyRole: ['auditor' as const], grant: { res: 'ecosystem' as const, levels: ['OwnOrg' as const, 'OrgW' as const, 'Agg' as const, 'A' as const] } };
const RELEASE = { signedIn: true, grant: { res: 'workforce_strategy' as const, levels: ['Agg' as const, 'W' as const, 'A' as const] } };
const STAFF_OWN = { signedIn: true, grant: { res: 'ecosystem' as const, levels: ['Own' as const] } };
const GR_READ = { signedIn: true, anyRole: ['auditor' as const], grant: { res: 'ecosystem' as const, levels: ['Own' as const, 'W' as const, 'A' as const] } };
const GR_HR = { signedIn: true, anyRole: ['auditor' as const], grant: { res: 'workforce_strategy' as const, levels: ['W' as const, 'A' as const] } };

export const routes: RouteDef[] = [
  // FS64 Regional skills plan for Al Dhafra
  { id: 'ecosystem-regional-plan', path: '/ecosystem/regional-plan', module: 'M36', zone: 'partner', guard: ECO_ANY, nav: { lens: 'partner', section: 'partner', order: 8 }, parent: 'home', spec: 'FS64 /ecosystem/regional-plan · released, suppressed regional skill demand for Al Dhafra (SIMULATED, from a released FS51 forecast): demand and gap bands per area for 2028, 2030 and 2035, withheld skills, the provider\'s own commitments against the 2030 gap', component: lazy(() => import('./RegionalPlanPage')) },
  { id: 'ecosystem-commitments', path: '/ecosystem/regional-plan/commitments', module: 'M36', zone: 'partner', guard: ECO_ORG, nav: { lens: 'my', section: 'workforce', order: 68.6 }, parent: 'ecosystem-regional-plan', spec: 'FS64 · provider commitments: planned cohorts and course changes per term with delivery status (own organisation for providers; every provider and the coverage of each area\'s 2030 gap for HR); commit provision (OrgW, audited + ledger)', component: lazy(() => import('./CommitmentsPage')) },
  { id: 'ecosystem-commitment', path: '/ecosystem/regional-plan/commitments/:id', module: 'M36', zone: 'partner', guard: ECO_ORG, parent: 'ecosystem-commitments', spec: 'FS64 · one commitment: terms and delivery status, delivery reports (provider), revise / withdraw (provider), acknowledge / query (HR), history', component: lazy(() => import('./CommitmentPage')) },
  { id: 'ecosystem-demand-release', path: '/ecosystem/regional-plan/release', module: 'M36', zone: 'staff', guard: RELEASE, parent: 'ecosystem-regional-plan', spec: 'FS64 · release a released FS51 forecast to providers as suppressed regional aggregates: preview against the current release, note EN/AR, HR director confirms (audit + ledger)', component: lazy(() => import('./DemandReleasePage')) },
  // FS65 Skills pledges ledger
  { id: 'ecosystem-pledges', path: '/ecosystem/pledges', module: 'M36', zone: 'staff', guard: ECO_ANY, nav: { lens: 'my', section: 'future', order: 24.5 }, parent: 'home', spec: 'FS65 /ecosystem/pledges · the skills pledges ledger: pledged, started and completed as three separate tiles and columns, by skill area, organisation type and target year; small counts suppressed', component: lazy(() => import('./PledgesPage')) },
  { id: 'ecosystem-pledges-register', path: '/ecosystem/pledges/register', module: 'M36', zone: 'partner', guard: ECO_ORG, parent: 'ecosystem-pledges', spec: 'FS65 · our pledges: each pledge with its organisation, skill area and date, progress snapshots, register a pledge and record progress (OrgW own organisation; HR for ENEC entities)', component: lazy(() => import('./PledgeRegisterPage')) },
  // FS82 Rolling mobility micro-grants (wave I · E4)
  { id: 'my-grants', path: '/my/grants', module: 'M36', zone: 'staff', guard: STAFF_OWN, nav: { lens: 'my', section: 'growth', order: 30.5 }, parent: 'home', spec: 'FS82 /my/grants · rolling bi-monthly mobility micro-grants (SIMULATED budgets): the round open now and the schedule, my eligibility (early career), apply (conference, short course, site visit, exchange), my applications with decisions, and the promised output (report or presentation) that HR accepts as evidence', component: lazy(() => import('./MyGrantsPage')) },
  { id: 'ecosystem-grants', path: '/ecosystem/grants', module: 'M36', zone: 'staff', guard: GR_READ, nav: { lens: 'my', section: 'opportunities', order: 40.5 }, parent: 'home', spec: 'FS82 · the micro-grant programme: rounds and their windows, applications, approvals, outputs and budgets (SIMULATED), every count of 1-9 suppressed', component: lazy(() => import('./GrantsProgrammePage')) },
  { id: 'workforce-grants', path: '/workforce/grants', module: 'M36', zone: 'staff', guard: GR_HR, nav: { lens: 'my', section: 'workforce', order: 68.7 }, parent: 'ecosystem-grants', spec: 'FS82 · HR console: decide closed rounds within the SIMULATED budget (HR director, audited), review outputs (accept = evidence, or return), schedule the next round, file for a placement student with a consent reference', component: lazy(() => import('./GrantsConsolePage')) },
  // FS83 UAE energy consortium trainee cohort (wave I · E4)
  { id: 'ecosystem-consortium', path: '/ecosystem/consortium', module: 'M36', zone: 'public', guard: {}, nav: { lens: 'public', section: 'pathways', order: 22 }, parent: 'home', spec: 'FS83 /ecosystem/consortium · the UAE energy consortium trainee cohort (ENEC with synthetic partner organisations): shared modules hosted in turn, a joint project and a mentor from another employer, cross-site visits, SIMULATED shared budget, sources', component: lazy(() => import('./ConsortiumPage')) },
  { id: 'ecosystem-consortium-cohort', path: '/ecosystem/consortium/:id', module: 'M36', zone: 'partner', guard: ECO_ANY, parent: 'ecosystem-consortium', spec: 'FS83 · one cohort: our trainees (each partner sees only its own), nominations and HR decisions, cross-site visits, the host queue (only the host confirms; evidence after confirmation), suppressed figures', component: lazy(() => import('./ConsortiumCohortPage')) },
  { id: 'my-consortium', path: '/my/consortium', module: 'M36', zone: 'staff', guard: STAFF_OWN, nav: { lens: 'my', section: 'growth', order: 30.6 }, parent: 'home', spec: 'FS83 /my/consortium · my place in the consortium cohort: modules, project team, mentor from another employer, my cross-site visits and the evidence written when the host confirms', component: lazy(() => import('./MyConsortiumPage')) },
];
