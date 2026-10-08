// M09 routes (owner: G4). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'partners', path: '/partners', module: 'M09', zone: 'public', guard: {}, nav: { lens: 'public', section: 'partners', order: 50 }, parent: 'home', spec: "§5 /partners · M09", component: lazy(() => import('./PartnersPage')) },
  { id: 'partners-detail', path: '/partners/:slug', module: 'M09', zone: 'public', guard: {}, parent: 'partners', spec: "§5 /partners/:slug · M09", component: lazy(() => import('./PartnersDetailPage')) },
  { id: 'suppliers', path: '/suppliers', module: 'M09', zone: 'public', guard: {}, nav: { lens: 'public', section: 'partners', order: 51 }, parent: 'partners', spec: "§5 /suppliers · M09", component: lazy(() => import('./SuppliersPage')) },
  { id: 'partner', path: '/partner', module: 'M09', zone: 'partner', guard: { signedIn: true, anyRole: ['partner_user', 'partner_admin', 'university'] }, nav: { lens: 'partner', section: 'partner', order: 1 }, parent: 'home', spec: "§5 /partner", component: lazy(() => import('./PartnerPage')) },
  { id: 'partner-onboarding', path: '/partner/onboarding', module: 'M09', zone: 'partner', guard: { signedIn: true, anyRole: ['partner_user', 'partner_admin'] }, nav: { lens: 'partner', section: 'partner', order: 2 }, parent: 'partner', spec: "§5 /partner/onboarding", component: lazy(() => import('./PartnerOnboardingPage')) },
  { id: 'partner-academy', path: '/partner/academy', module: 'M09', zone: 'partner', guard: { signedIn: true, anyRole: ['partner_user', 'partner_admin'] }, nav: { lens: 'partner', section: 'partner', order: 3 }, parent: 'partner', spec: "§5 /partner/academy", component: lazy(() => import('./PartnerAcademyPage')) },
  { id: 'partner-workforce', path: '/partner/workforce', module: 'M09', zone: 'partner', guard: { signedIn: true, anyRole: ['partner_admin'] }, nav: { lens: 'partner', section: 'partner', order: 4 }, parent: 'partner', spec: "§5 /partner/workforce", component: lazy(() => import('./PartnerWorkforcePage')) },
  { id: 'partner-icv', path: '/partner/icv', module: 'M09', zone: 'partner', guard: { signedIn: true, anyRole: ['partner_user', 'partner_admin'] }, nav: { lens: 'partner', section: 'partner', order: 5 }, parent: 'partner', spec: "§5 /partner/icv", component: lazy(() => import('./PartnerIcvPage')) },
];
