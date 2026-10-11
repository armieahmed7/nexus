// M13 routes (owner: G5). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'ask', path: '/ask', module: 'M13', zone: 'public', guard: {}, nav: { lens: 'public', section: 'ask', order: 60 }, parent: 'home', spec: "§5 /ask · M13", component: lazy(() => import('./AskPage')) },
  // W5E5 (F36): digest and nudge aggregates (the digest itself lives in the shell; admins see suppressed aggregates only)
  { id: 'admin-digest', path: '/admin/digest', module: 'M13', zone: 'admin', guard: { signedIn: true, anyRole: ['admin', 'auditor'] }, nav: { lens: 'admin', section: 'admin', order: 6 }, parent: 'admin', spec: 'BACKLOG F36', component: lazy(() => import('./AdminDigestPage')) },
  { id: 'admin-dalil', path: '/admin/dalil', module: 'M13', zone: 'admin', guard: { signedIn: true, anyRole: ['admin', 'editor', 'auditor'] }, nav: { lens: 'admin', section: 'admin', order: 5 }, parent: 'admin', spec: "§5 /admin/dalil", component: lazy(() => import('./AdminDalilPage')) },
];
