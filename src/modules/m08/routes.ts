// M08 routes (owner: G5). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'safety-culture', path: '/safety-culture', module: 'M08', zone: 'public', guard: {}, nav: { lens: 'public', section: 'about', order: 40 }, parent: 'home', spec: "§5 /safety-culture · M08", component: lazy(() => import('./SafetyCulturePage')) },
  { id: 'speak-up', path: '/speak-up', module: 'M08', zone: 'public', guard: { noTelemetry: true }, nav: { lens: 'my', section: 'safety', order: 95 }, parent: 'home', spec: "§5 /speak-up · M08", component: lazy(() => import('./SpeakUpPage')) },
  { id: 'my-safety-culture', path: '/my/safety-culture', module: 'M08', zone: 'staff', guard: { signedIn: true, grant: { res: 'internal_content', levels: ['R'] } }, nav: { lens: 'my', section: 'safety', order: 20 }, parent: 'my', spec: "M08 /my/safety-culture", component: lazy(() => import('./MySafetyCulturePage')) },
  { id: 'oe', path: '/oe', module: 'M08', zone: 'staff', guard: { signedIn: true, grant: { res: 'internal_content', levels: ['R'] } }, nav: { lens: 'my', section: 'safety', order: 21 }, parent: 'my', spec: "§5 /oe · M08", component: lazy(() => import('./OePage')) },
  { id: 'admin-ecp', path: '/admin/ecp', module: 'M08', zone: 'admin', guard: { signedIn: true, anyRole: ['ecp_officer'] }, nav: { lens: 'admin', section: 'admin', order: 9 }, parent: 'admin', spec: "M08 ECP referral log [K]", component: lazy(() => import('./AdminEcpPage')) },
];
