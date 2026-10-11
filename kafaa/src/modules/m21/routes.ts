// M21 routes (Future Me: personal ADVANCE readiness and horizon; owner W1 · E5, feature F09). Registered once by F01 in
// src/routes/registry.ts. Route ids are i18n keys (m21.routes.<id>.title|purpose) and are visited by the smoke suite automatically.
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'my-future', path: '/my/future', module: 'M21', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Own'] } }, nav: { lens: 'my', section: 'future', order: 21 }, parent: 'my', spec: 'BACKLOG F09 · /my/future', component: lazy(() => import('./MyFuturePage')) },
  { id: 'my-future-tech', path: '/my/future/:tech', module: 'M21', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Own'] } }, parent: 'my-future', spec: 'BACKLOG F09 · readiness for one technology family', component: lazy(() => import('./MyFutureTechPage')) },
  { id: 'workforce-future-interest', path: '/workforce/future/interest', module: 'M21', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Agg', 'A'] } }, nav: { lens: 'my', section: 'workforce', order: 68 }, parent: 'workforce-future', spec: 'BACKLOG F09 · interest aggregate (demand signal for F26)', component: lazy(() => import('./FutureDemandPage')) },
];
