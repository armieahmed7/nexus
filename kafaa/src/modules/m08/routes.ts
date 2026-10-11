// M08 routes (owner: G5). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'safety-culture', path: '/safety-culture', module: 'M08', zone: 'public', guard: {}, nav: { lens: 'public', section: 'about', order: 40 }, parent: 'home', spec: "§5 /safety-culture · M08", component: lazy(() => import('./SafetyCulturePage')) },
  { id: 'speak-up', path: '/speak-up', module: 'M08', zone: 'public', guard: { noTelemetry: true }, nav: { lens: 'public', section: 'about', order: 41 }, parent: 'home', spec: "§5 /speak-up · M08", component: lazy(() => import('./SpeakUpPage')) },
  { id: 'my-safety-culture', path: '/my/safety-culture', module: 'M08', zone: 'staff', guard: { signedIn: true, grant: { res: 'internal_content', levels: ['R'] } }, nav: { lens: 'my', section: 'safety', order: 20 }, parent: 'my', spec: "M08 /my/safety-culture", component: lazy(() => import('./MySafetyCulturePage')) },
  // FS49 (wave E · E5): safety culture for an AI-augmented plant (staff) and the HU / safety-culture lead's console (internal_content W)
  { id: 'my-safety-culture-ai', path: '/my/safety-culture/ai', module: 'M08', zone: 'staff', guard: { signedIn: true, grant: { res: 'internal_content', levels: ['R'] } }, nav: { lens: 'my', section: 'safety', order: 20.5 }, parent: 'my-safety-culture', spec: 'FS49 /my/safety-culture/ai · AI-era HU tool cards, traits with AI examples, sourced lessons', component: lazy(() => import('./AiSafetyCulturePage')) },
  { id: 'admin-hu-tools', path: '/admin/hu-tools', module: 'M08', zone: 'admin', guard: { signedIn: true, grant: { res: 'internal_content', levels: ['W'] } }, nav: { lens: 'admin', section: 'admin', order: 9.5 }, parent: 'admin', spec: 'FS49 /admin/hu-tools · HU card and AI lesson content health, card editor', component: lazy(() => import('./HuToolsAdminPage')) },
  { id: 'oe', path: '/oe', module: 'M08', zone: 'staff', guard: { signedIn: true, grant: { res: 'internal_content', levels: ['R'] } }, nav: { lens: 'my', section: 'safety', order: 21 }, parent: 'my', spec: "§5 /oe · M08", component: lazy(() => import('./OePage')) },
  { id: 'admin-ecp', path: '/admin/ecp', module: 'M08', zone: 'admin', guard: { signedIn: true, anyRole: ['ecp_officer'] }, nav: { lens: 'admin', section: 'admin', order: 9 }, parent: 'admin', spec: "M08 ECP referral log [K]", component: lazy(() => import('./AdminEcpPage')) },
];
