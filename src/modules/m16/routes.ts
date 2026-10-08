// M16 routes (owner: G5). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'admin', path: '/admin', module: 'M16', zone: 'admin', guard: { signedIn: true, anyRole: ['admin', 'auditor', 'editor', 'training_manager', 'ecp_officer'] }, nav: { lens: 'admin', section: 'admin', order: 1 }, parent: 'home', spec: "§5 /admin/*", component: lazy(() => import('./AdminPage')) },
  { id: 'admin-frameworks', path: '/admin/frameworks', module: 'M16', zone: 'admin', guard: { signedIn: true, anyRole: ['admin', 'training_manager', 'auditor'] }, nav: { lens: 'admin', section: 'admin', order: 3 }, parent: 'admin', spec: "§5 /admin/frameworks", component: lazy(() => import('./AdminFrameworksPage')) },
  { id: 'admin-content', path: '/admin/content', module: 'M16', zone: 'admin', guard: { signedIn: true, anyRole: ['admin', 'editor', 'auditor'] }, nav: { lens: 'admin', section: 'admin', order: 4 }, parent: 'admin', spec: "§5 /admin/content", component: lazy(() => import('./AdminContentPage')) },
  { id: 'admin-integrations', path: '/admin/integrations', module: 'M16', zone: 'admin', guard: { signedIn: true, anyRole: ['admin', 'auditor'] }, nav: { lens: 'admin', section: 'admin', order: 6 }, parent: 'admin', spec: "§5 /admin/integrations", component: lazy(() => import('./AdminIntegrationsPage')) },
  { id: 'admin-nexus', path: '/admin/nexus', module: 'M16', zone: 'admin', guard: { signedIn: true, anyRole: ['admin', 'auditor'] }, nav: { lens: 'admin', section: 'admin', order: 7 }, parent: 'admin', spec: "§12 NEXUS integration points", component: lazy(() => import('./AdminNexusPage')) },
  { id: 'admin-audit', path: '/admin/audit', module: 'M16', zone: 'admin', guard: { signedIn: true, anyRole: ['admin', 'auditor'] }, nav: { lens: 'admin', section: 'admin', order: 8 }, parent: 'admin', spec: "§5 /admin/audit", component: lazy(() => import('./AdminAuditPage')) },
];
