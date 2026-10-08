// M01 routes (owner: G1). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'careers', path: '/careers', module: 'M01', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 10 }, parent: 'home', spec: "§5 /careers · M01", component: lazy(() => import('./CareersPage')) },
  { id: 'careers-role', path: '/careers/roles/:slug', module: 'M01', zone: 'public', guard: {}, parent: 'careers', spec: "§5 /careers/roles/:slug · M01", component: lazy(() => import('./CareersRolePage')) },
  { id: 'careers-paths', path: '/careers/paths', module: 'M01', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 11 }, parent: 'careers', spec: "§5 /careers/paths · M01", component: lazy(() => import('./CareersPathsPage')) },
  // [G1] path-to-role planner and role comparison (public)
  { id: 'careers-plan', path: '/careers/plan', module: 'M01', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 11.5 }, parent: 'careers', spec: "M01 path to role planner", component: lazy(() => import('./CareersPlanPage')) },
  { id: 'careers-compare', path: '/careers/compare', module: 'M01', zone: 'public', guard: {}, parent: 'careers', spec: "M01 compare roles", component: lazy(() => import('./CareersComparePage')) },
  { id: 'careers-jobs', path: '/careers/jobs', module: 'M01', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 12 }, parent: 'careers', spec: "§5 /careers/jobs · M01", component: lazy(() => import('./CareersJobsPage')) },
];
