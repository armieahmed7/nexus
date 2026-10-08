// M20 routes (Opportunities (marketplace, rotations, alumni); owner: W1 engineer, features F08 (W1) · F15 (W2) · F23 (W3)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M20', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m20.routes.<id>.title|purpose in src/i18n/m20.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m20/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  // F08 Opportunity Marketplace
  { id: 'opportunities', path: '/opportunities', module: 'M20', zone: 'staff', guard: { signedIn: true, grant: { res: 'opportunities', levels: ['R'] } }, nav: { lens: 'my', section: 'opportunities', order: 40 }, parent: 'my', spec: 'BACKLOG F08 /opportunities', component: lazy(() => import('./MarketplacePage')) },
  { id: 'opportunities-my', path: '/opportunities/my', module: 'M20', zone: 'staff', guard: { signedIn: true, grant: { res: 'opportunities', levels: ['Own'] } }, nav: { lens: 'my', section: 'opportunities', order: 41 }, parent: 'opportunities', spec: 'BACKLOG F08 apply, release, selection, sign-off', component: lazy(() => import('./MyOpportunitiesPage')) },
  { id: 'opportunities-manage', path: '/opportunities/manage', module: 'M20', zone: 'staff', guard: { signedIn: true, grant: { res: 'opportunities', levels: ['W', 'A'] } }, nav: { lens: 'my', section: 'opportunities', order: 42 }, parent: 'opportunities', spec: 'BACKLOG F08 release approval (maker-checker), selection, outcome sign-off', component: lazy(() => import('./ManageOpportunitiesPage')) },
  { id: 'opportunities-post', path: '/opportunities/post', module: 'M20', zone: 'staff', guard: { signedIn: true, grant: { res: 'opportunities', levels: ['W'] } }, nav: { lens: 'my', section: 'opportunities', order: 43 }, parent: 'opportunities', spec: 'BACKLOG F08 post an opportunity', component: lazy(() => import('./PostOpportunityPage')) },
  { id: 'opportunities-insights', path: '/opportunities/insights', module: 'M20', zone: 'staff', guard: { signedIn: true, anyRole: ['auditor'], grant: { res: 'opportunities', levels: ['Agg', 'A'] } }, nav: { lens: 'my', section: 'opportunities', order: 44 }, parent: 'opportunities', spec: 'BACKLOG F08 HR oversight (aggregates, suppressed below 10)', component: lazy(() => import('./OpportunityInsightsPage')) },
  { id: 'opportunity', path: '/opportunities/:id', module: 'M20', zone: 'staff', guard: { signedIn: true, grant: { res: 'opportunities', levels: ['R'] } }, parent: 'opportunities', spec: 'BACKLOG F08 opportunity detail and apply', component: lazy(() => import('./OpportunityPage')) },
];
