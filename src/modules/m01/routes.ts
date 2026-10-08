// M01 routes (owner: G1). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'careers', path: '/careers', module: 'M01', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 10 }, parent: 'home', spec: "§5 /careers · M01", component: lazy(() => import('./CareersPage')) },
  { id: 'careers-role', path: '/careers/roles/:slug', module: 'M01', zone: 'public', guard: {}, parent: 'careers', spec: "§5 /careers/roles/:slug · M01", component: lazy(() => import('./CareersRolePage')) },
  { id: 'careers-paths', path: '/careers/paths', module: 'M01', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 11 }, parent: 'careers', spec: "§5 /careers/paths · M01", component: lazy(() => import('./CareersPathsPage')) },
  { id: 'careers-jobs', path: '/careers/jobs', module: 'M01', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 12 }, parent: 'careers', spec: "§5 /careers/jobs · M01", component: lazy(() => import('./CareersJobsPage')) },
];
