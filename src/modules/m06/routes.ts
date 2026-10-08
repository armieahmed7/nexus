// M06 routes (owner: G3). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'pathways', path: '/pathways', module: 'M06', zone: 'public', guard: {}, nav: { lens: 'public', section: 'pathways', order: 20 }, parent: 'home', spec: "§5 /pathways · M06", component: lazy(() => import('./PathwaysPage')) },
  { id: 'pathways-programme', path: '/pathways/:programme', module: 'M06', zone: 'public', guard: {}, parent: 'pathways', spec: "§5 /pathways/:programme · M06", component: lazy(() => import('./PathwaysProgrammePage')) },
  { id: 'apply', path: '/apply/:programme', module: 'M06', zone: 'public', guard: {}, parent: 'pathways-programme', spec: "§5 /apply/:programme · M06", component: lazy(() => import('./ApplyPage')) },
  { id: 'my-applications', path: '/my/applications', module: 'M06', zone: 'staff', guard: { signedIn: true, grant: { res: 'applications', levels: ['Own'] } }, nav: { lens: 'my', section: 'me', order: 16 }, parent: 'my', spec: "M06 /my/applications", component: lazy(() => import('./MyApplicationsPage')) },
  // [G3] HR / editor management of vacancies, events, internships and programme intake (talent_content W/A)
  { id: 'workforce-talent', path: '/workforce/talent', module: 'M06', zone: 'staff', guard: { signedIn: true, grant: { res: 'talent_content', levels: ['W', 'A'] } }, nav: { lens: 'my', section: 'workforce', order: 67 }, parent: 'workforce', spec: "M06 vacancies, events and internships (talent content)", component: lazy(() => import('./TalentContentPage')) },
  { id: 'workforce-applications', path: '/workforce/applications', module: 'M06', zone: 'staff', guard: { signedIn: true, grant: { res: 'applications', levels: ['Agg', 'A', 'R'] } }, nav: { lens: 'my', section: 'workforce', order: 66 }, parent: 'workforce', spec: "M06 /pipeline HR funnel", component: lazy(() => import('./WorkforceApplicationsPage')) },
];
