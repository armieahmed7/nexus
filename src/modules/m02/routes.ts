// M02 routes (owner: G1). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'competencies', path: '/competencies', module: 'M02', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 13 }, parent: 'careers', spec: "§5 /competencies · M02", component: lazy(() => import('./CompetenciesPage')) },
  { id: 'verify', path: '/verify', module: 'M02', zone: 'public', guard: {}, parent: 'home', spec: "§5 /verify", component: lazy(() => import('./VerifyPage')) },
  { id: 'my-quals', path: '/my/quals', module: 'M02', zone: 'staff', guard: { signedIn: true, grant: { res: 'qual_records', levels: ['Own'] } }, nav: { lens: 'my', section: 'me', order: 10 }, parent: 'my', spec: "§5 /my/quals · M02", component: lazy(() => import('./MyQualsPage')) },
  { id: 'team', path: '/team', module: 'M02', zone: 'staff', guard: { signedIn: true, anyRole: ['manager'] }, nav: { lens: 'my', section: 'team', order: 30 }, parent: 'my', spec: "§5 /team · M02", component: lazy(() => import('./TeamPage')) },
  { id: 'team-quals', path: '/team/quals', module: 'M02', zone: 'staff', guard: { signedIn: true, anyRole: ['manager'] }, nav: { lens: 'my', section: 'team', order: 31 }, parent: 'team', spec: "§5 /team/quals · M02", component: lazy(() => import('./TeamQualsPage')) },
  { id: 'training-quals', path: '/training/quals', module: 'M02', zone: 'staff', guard: { signedIn: true, anyRole: ['instructor', 'training_manager'] }, nav: { lens: 'my', section: 'training', order: 45 }, parent: 'training', spec: "M02 qualification standards", component: lazy(() => import('./TrainingQualsPage')) },
  { id: 'training-quals-standard', path: '/training/quals/:standard', module: 'M02', zone: 'staff', guard: { signedIn: true, anyRole: ['instructor', 'training_manager'] }, parent: 'training-quals', spec: "M02 /training/quals/:standard", component: lazy(() => import('./TrainingQualsStandardPage')) },
];
