// M11 routes (owner: G4). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'future', path: '/future', module: 'M11', zone: 'public', guard: {}, nav: { lens: 'public', section: 'learn', order: 33 }, parent: 'home', spec: "§5 /future · M11", component: lazy(() => import('./FuturePage')) },
  { id: 'workforce-future', path: '/workforce/future', module: 'M11', zone: 'staff', guard: { signedIn: true, anyRole: ['hr_analyst', 'hr_director', 'auditor'] }, nav: { lens: 'my', section: 'workforce', order: 67 }, parent: 'workforce', spec: "M11 future-skills radar", component: lazy(() => import('./WorkforceFuturePage')) },
];
