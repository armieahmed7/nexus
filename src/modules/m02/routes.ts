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
  // W4E5 (F31 Instructor and SME pipeline)
  { id: 'training-instructors', path: '/training/instructors', module: 'M02', zone: 'staff', guard: { signedIn: true, grant: { res: 'sat', levels: ['R', 'W', 'A'] } }, nav: { lens: 'my', section: 'training', order: 45 }, parent: 'training', spec: 'F31 instructor and SME pipeline', component: lazy(() => import('./InstructorsPage')) },
  { id: 'training-instructor', path: '/training/instructors/:trackId', module: 'M02', zone: 'staff', guard: { signedIn: true, grant: { res: 'sat', levels: ['R', 'W', 'A'] } }, parent: 'training-instructors', spec: 'F31 instructor track', component: lazy(() => import('./InstructorTrackPage')) },
  { id: 'my-instructor', path: '/my/instructor', module: 'M02', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Own'] } }, nav: { lens: 'my', section: 'growth', order: 22 }, parent: 'my', spec: 'F31 my instructor track', component: lazy(() => import('./MyInstructorPage')) },
  { id: 'team-instructors', path: '/team/instructors', module: 'M02', zone: 'staff', guard: { signedIn: true, anyRole: ['manager'] }, nav: { lens: 'my', section: 'team', order: 34 }, parent: 'team', spec: 'F31 grow instructors from the team', component: lazy(() => import('./TeamInstructorsPage')) },
  // W5E1 (F38 OJT practice logbook)
  { id: 'my-ojt', path: '/my/ojt', module: 'M02', zone: 'staff', guard: { signedIn: true, grant: { res: 'qual_records', levels: ['Own'] } }, nav: { lens: 'my', section: 'growth', order: 23 }, parent: 'my', spec: 'F38 OJT practice logbook', component: lazy(() => import('./OjtLogbookPage')) },
  { id: 'team-ojt', path: '/team/ojt', module: 'M02', zone: 'staff', guard: { signedIn: true, grant: { res: 'qual_records', levels: ['Scope'] } }, nav: { lens: 'my', section: 'team', order: 35 }, parent: 'team', spec: 'F38 team practice readiness', component: lazy(() => import('./TeamOjtPage')) },
];
