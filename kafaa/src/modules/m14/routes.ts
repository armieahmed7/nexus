// M14 routes (owner: G5). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'my', path: '/my', module: 'M14', zone: 'staff', guard: { signedIn: true }, nav: { lens: 'my', section: 'me', order: 1 }, parent: 'home', spec: "§5 /my", component: lazy(() => import('./MyPage')) },
  { id: 'my-profile', path: '/my/profile', module: 'M14', zone: 'staff', guard: { signedIn: true }, nav: { lens: 'my', section: 'me', order: 90 }, parent: 'my', spec: "§5 /my/profile", component: lazy(() => import('./MyProfilePage')) },
  { id: 'my-settings', path: '/my/settings', module: 'M14', zone: 'staff', guard: { signedIn: true }, nav: { lens: 'my', section: 'me', order: 91 }, parent: 'my', spec: "§5 /my/settings", component: lazy(() => import('./MySettingsPage')) },
  { id: 'admin-access', path: '/admin/access', module: 'M14', zone: 'admin', guard: { signedIn: true, anyRole: ['admin', 'auditor', 'partner_admin'] }, nav: { lens: 'admin', section: 'admin', order: 2 }, parent: 'admin', spec: "§5 /admin/access", component: lazy(() => import('./AdminAccessPage')) },
  { id: 'sign-in', path: '/sign-in', module: 'M14', zone: 'public', guard: {}, parent: 'home', spec: "M14 sign-in", component: lazy(() => import('./SignInPage')) },
];
