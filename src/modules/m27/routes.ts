// M27 routes (Learning record store; owner W4 · E4, feature F30). Registered once by F01 in src/routes/registry.ts.
// Route ids are i18n keys (m27.routes.<id>.title|purpose in src/i18n/m27.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: sample params in src/modules/m27/smoke.json.
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'my-learning-record', path: '/my/learning-record', module: 'M27', zone: 'staff', guard: { signedIn: true, grant: { res: 'lrs', levels: ['Own'] } }, nav: { lens: 'my', section: 'me', order: 13 }, parent: 'my', spec: 'BACKLOG F30 · my xAPI statements, timeline and JSON lines export', component: lazy(() => import('./MyLearningRecordPage')) },
  { id: 'training-lrs', path: '/training/lrs', module: 'M27', zone: 'staff', guard: { signedIn: true, grant: { res: 'lrs', levels: ['Scope', 'Agg', 'R'] } }, nav: { lens: 'my', section: 'training', order: 50 }, parent: 'training', spec: 'BACKLOG F30 · statement explorer, analytics and emitters', component: lazy(() => import('./LrsExplorerPage')) },
  { id: 'training-lrs-person', path: '/training/lrs/people/:personId', module: 'M27', zone: 'staff', guard: { signedIn: true, grant: { res: 'lrs', levels: ['Scope', 'R'] } }, parent: 'training-lrs', spec: 'BACKLOG F30 · timeline per person (scope)', component: lazy(() => import('./LrsPersonPage')) },
  { id: 'training-lrs-statement', path: '/training/lrs/statements/:statementId', module: 'M27', zone: 'staff', guard: { signedIn: true, grant: { res: 'lrs', levels: ['Own', 'Scope', 'R'] } }, parent: 'training-lrs', spec: 'BACKLOG F30 · one statement with provenance and xAPI JSON', component: lazy(() => import('./LrsStatementPage')) },
  { id: 'training-lrs-adapters', path: '/training/lrs/adapters', module: 'M27', zone: 'staff', guard: { signedIn: true, anyRole: ['admin', 'auditor', 'training_manager', 'instructor', 'hr_analyst'] }, parent: 'training-lrs', spec: 'BACKLOG F30 · adapters page (SIMULATED external LRS)', component: lazy(() => import('./LrsAdaptersPage')) },
  { id: 'training-lrs-console', path: '/training/lrs/console', module: 'M27', zone: 'staff', guard: { signedIn: true, grant: { res: 'integrations', levels: ['A'] } }, parent: 'training-lrs', spec: 'BACKLOG F30 · admin test console for storeStatement', component: lazy(() => import('./LrsConsolePage')) },
];
