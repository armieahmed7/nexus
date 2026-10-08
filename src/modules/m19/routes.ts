// M19 routes (Learning Coach; owner: W1 engineer, features F07 (W1) · F14 (W2)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M19', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m19.routes.<id>.title|purpose in src/i18n/m19.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m19/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  // F07 · personal feed, weekly goal and "Ask the coach" (staff: skills_profile Own)
  { id: 'my-coach', path: '/my/coach', module: 'M19', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Own'] } }, nav: { lens: 'my', section: 'growth', order: 19 }, parent: 'my', spec: 'BACKLOG F07 /my/coach', component: lazy(() => import('./MyCoachPage')) },
  // F07 · aggregated acceptance rates for HR (skills_profile Agg) and the training manager (A); counts only, suppressed under 10
  { id: 'coach-insights', path: '/my/coach/insights', module: 'M19', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Agg', 'A'] } }, nav: { lens: 'my', section: 'growth', order: 20 }, parent: 'my-coach', spec: 'BACKLOG F07 RBAC (HR aggregates)', component: lazy(() => import('./CoachInsightsPage')) },
];
