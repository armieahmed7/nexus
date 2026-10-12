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
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const ECO_ANY = { signedIn: true, grant: { res: 'ecosystem' as const, levels: ['R' as const, 'Agg' as const, 'W' as const, 'A' as const, 'OwnOrg' as const, 'OrgW' as const] } };
const ECO_ORG = { signedIn: true, anyRole: ['auditor' as const], grant: { res: 'ecosystem' as const, levels: ['OwnOrg' as const, 'OrgW' as const, 'Agg' as const, 'A' as const] } };
const RELEASE = { signedIn: true, grant: { res: 'workforce_strategy' as const, levels: ['Agg' as const, 'W' as const, 'A' as const] } };

export const routes: RouteDef[] = [
  // FS64 Regional skills plan for Al Dhafra
  { id: 'ecosystem-regional-plan', path: '/ecosystem/regional-plan', module: 'M36', zone: 'partner', guard: ECO_ANY, nav: { lens: 'partner', section: 'partner', order: 8 }, parent: 'home', spec: 'FS64 /ecosystem/regional-plan · released, suppressed regional skill demand for Al Dhafra (SIMULATED, from a released FS51 forecast): demand and gap bands per area for 2028, 2030 and 2035, withheld skills, the provider\'s own commitments against the 2030 gap', component: lazy(() => import('./RegionalPlanPage')) },
  { id: 'ecosystem-commitments', path: '/ecosystem/regional-plan/commitments', module: 'M36', zone: 'partner', guard: ECO_ORG, nav: { lens: 'my', section: 'workforce', order: 68.6 }, parent: 'ecosystem-regional-plan', spec: 'FS64 · provider commitments: planned cohorts and course changes per term with delivery status (own organisation for providers; every provider and the coverage of each area\'s 2030 gap for HR); commit provision (OrgW, audited + ledger)', component: lazy(() => import('./CommitmentsPage')) },
  { id: 'ecosystem-commitment', path: '/ecosystem/regional-plan/commitments/:id', module: 'M36', zone: 'partner', guard: ECO_ORG, parent: 'ecosystem-commitments', spec: 'FS64 · one commitment: terms and delivery status, delivery reports (provider), revise / withdraw (provider), acknowledge / query (HR), history', component: lazy(() => import('./CommitmentPage')) },
  { id: 'ecosystem-demand-release', path: '/ecosystem/regional-plan/release', module: 'M36', zone: 'staff', guard: RELEASE, parent: 'ecosystem-regional-plan', spec: 'FS64 · release a released FS51 forecast to providers as suppressed regional aggregates: preview against the current release, note EN/AR, HR director confirms (audit + ledger)', component: lazy(() => import('./DemandReleasePage')) },
  // FS65 Skills pledges ledger
  { id: 'ecosystem-pledges', path: '/ecosystem/pledges', module: 'M36', zone: 'staff', guard: ECO_ANY, nav: { lens: 'my', section: 'future', order: 24.5 }, parent: 'home', spec: 'FS65 /ecosystem/pledges · the skills pledges ledger: pledged, started and completed as three separate tiles and columns, by skill area, organisation type and target year; small counts suppressed', component: lazy(() => import('./PledgesPage')) },
  { id: 'ecosystem-pledges-register', path: '/ecosystem/pledges/register', module: 'M36', zone: 'partner', guard: ECO_ORG, parent: 'ecosystem-pledges', spec: 'FS65 · our pledges: each pledge with its organisation, skill area and date, progress snapshots, register a pledge and record progress (OrgW own organisation; HR for ENEC entities)', component: lazy(() => import('./PledgeRegisterPage')) },
];
