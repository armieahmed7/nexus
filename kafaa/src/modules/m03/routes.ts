// M03 routes (owner: G1). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'licensing', path: '/licensing', module: 'M03', zone: 'public', guard: {}, nav: { lens: 'public', section: 'learn', order: 32 }, parent: 'home', spec: "§5 /licensing · M03", component: lazy(() => import('./LicensingPage')) },
  { id: 'my-licence', path: '/my/licence', module: 'M03', zone: 'staff', guard: { signedIn: true, anyRole: ['licensed_operator'] }, nav: { lens: 'my', section: 'me', order: 11 }, parent: 'my', spec: "§5 /my/licence · M03", component: lazy(() => import('./MyLicencePage')) },
  { id: 'licensing-candidates', path: '/licensing/candidates', module: 'M03', zone: 'staff', guard: { signedIn: true, anyRole: ['licensing_coord'] }, nav: { lens: 'my', section: 'licensing', order: 50 }, parent: 'licensing', spec: "§5 /licensing/* · M03", component: lazy(() => import('./LicensingCandidatesPage')) },
  { id: 'licensing-validity', path: '/licensing/validity', module: 'M03', zone: 'staff', guard: { signedIn: true, anyRole: ['licensing_coord'] }, nav: { lens: 'my', section: 'licensing', order: 51 }, parent: 'licensing', spec: "M03 /licensing/validity", component: lazy(() => import('./LicensingValidityPage')) },
  { id: 'licensing-calendar', path: '/licensing/calendar', module: 'M03', zone: 'staff', guard: { signedIn: true, anyRole: ['licensing_coord'] }, nav: { lens: 'my', section: 'licensing', order: 52 }, parent: 'licensing', spec: "M03 /licensing/calendar", component: lazy(() => import('./LicensingCalendarPage')) },
];
