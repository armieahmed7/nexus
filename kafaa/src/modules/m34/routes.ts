// M34 routes (Recognition (RPL, NQF, credits); owners: wave D E2 (FS29, FS30) and wave I E1 (FS78, FS79)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M34', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m34.routes.<id>.title|purpose in src/i18n/m34.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m34/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const OWN = { signedIn: true, grant: { res: 'recognition' as const, levels: ['Own' as const] } };
const ASSESS = { signedIn: true, grant: { res: 'recognition' as const, levels: ['A' as const, 'R' as const] } };

export const routes: RouteDef[] = [
  // FS wave D · E2 (FS29 recognition of prior learning; FS30 NQF levels and learning credits)
  { id: 'recognition', path: '/recognition', module: 'M34', zone: 'public', guard: {}, nav: { lens: 'public', section: 'learn', order: 33 }, parent: 'learn', spec: 'PLAN FS29/FS30 · how RPL works (request, evidence, two assessors, credit), indicative NQF levels, credits and stacks; not an authority', component: lazy(() => import('./RecognitionPage')) },
  { id: 'my-recognition', path: '/my/recognition', module: 'M34', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 18.8 }, parent: 'my', spec: 'PLAN FS29 · my RPL requests, start a request, attestations asked of me', component: lazy(() => import('./MyRecognitionPage')) },
  { id: 'my-rpl', path: '/my/recognition/rpl/:id', module: 'M34', zone: 'staff', guard: { signedIn: true }, parent: 'my-recognition', spec: 'PLAN FS29 · one RPL request: evidence pack from my records, attestations, submit, decision, RPL statement and NQC-ready export', component: lazy(() => import('./RplRequestPage')) },
  { id: 'my-credits', path: '/my/credits', module: 'M34', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 18.9 }, parent: 'my', spec: 'PLAN FS30 · my credit ledger, indicative NQF levels and 30-credit stacks toward an indicative award', component: lazy(() => import('./MyCreditsPage')) },
  { id: 'rpl-queue', path: '/recognition/review', module: 'M34', zone: 'admin', guard: ASSESS, nav: { lens: 'admin', section: 'admin', order: 6.85 }, parent: 'admin', spec: 'PLAN FS29 · assessor queue: recommend, confirm (second assessor), decided; open a request for a contractor', component: lazy(() => import('./RplQueuePage')) },
  { id: 'rpl-review', path: '/recognition/review/:id', module: 'M34', zone: 'admin', guard: ASSESS, parent: 'rpl-queue', spec: 'PLAN FS29 · review an evidence pack with advisory reasons; maker-checker decision; statement and export', component: lazy(() => import('./RplReviewPage')) },
  { id: 'admin-credit-tags', path: '/admin/credit-tags', module: 'M34', zone: 'admin', guard: { signedIn: true, anyRole: ['admin', 'training_manager', 'instructor', 'auditor'] }, nav: { lens: 'admin', section: 'admin', order: 6.86 }, parent: 'admin', spec: 'PLAN FS30 · tag courses, pathways and micro-credentials with an indicative NQF level and credits; coverage; ledger refresh', component: lazy(() => import('./CreditTagsPage')) },
];
