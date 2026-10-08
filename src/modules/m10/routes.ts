// M10 routes (owner: G3). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'universities', path: '/universities', module: 'M10', zone: 'public', guard: {}, nav: { lens: 'public', section: 'partners', order: 52 }, parent: 'partners', spec: "§5 /universities · M10", component: lazy(() => import('./UniversitiesPage')) },
  { id: 'research', path: '/research', module: 'M10', zone: 'public', guard: {}, nav: { lens: 'public', section: 'partners', order: 53 }, parent: 'universities', spec: "§5 /research · M10", component: lazy(() => import('./ResearchPage')) },
  { id: 'partner-university', path: '/partner/university', module: 'M10', zone: 'partner', guard: { signedIn: true, anyRole: ['university'] }, nav: { lens: 'partner', section: 'partner', order: 6 }, parent: 'partner', spec: "§5 /partner/university", component: lazy(() => import('./PartnerUniversityPage')) },
  { id: 'partner-research', path: '/partner/research', module: 'M10', zone: 'partner', guard: { signedIn: true, anyRole: ['partner_user', 'partner_admin', 'university'] }, nav: { lens: 'partner', section: 'partner', order: 7 }, parent: 'partner', spec: "§5 /partner/research", component: lazy(() => import('./PartnerResearchPage')) },
  // [G3] research screening authority: curate challenges, screening sign-off, decide proposals (admin A, auditor R)
  { id: 'admin-research', path: '/admin/research', module: 'M10', zone: 'admin', guard: { signedIn: true, grant: { res: 'research', levels: ['A', 'R'] } }, nav: { lens: 'admin', section: 'admin', order: 9 }, parent: 'admin', spec: "M10 research screening (proposals screened before any public mention)", component: lazy(() => import('./AdminResearchPage')) },
];
