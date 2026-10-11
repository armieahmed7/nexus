// M26 routes (SAT and accreditation workbench; owner W4 · E2, features F27 SAT analysis workbench and F29 Accreditation readiness).
// Registered once by F01 in src/routes/registry.ts. Route ids are i18n keys (m26.routes.<id>.title|purpose) and are visited by the
// smoke suite automatically; param routes take their sample params from smoke.json.
// Access: the workbench is for training staff (`sat`: instructors R/W, the training manager R/W/A, auditors R). The DIF survey page
// is open to any signed-in person: it shows a survey only to a subject-matter expert (F21 SME profile) whose role's survey is open.
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const SAT = { signedIn: true, grant: { res: 'sat' as const, levels: ['R' as const, 'W' as const, 'A' as const] } };

export const routes: RouteDef[] = [
  { id: 'training-sat', path: '/training/sat', module: 'M26', zone: 'staff', guard: SAT, nav: { lens: 'my', section: 'quality', order: 62 }, parent: 'my', spec: 'BACKLOG F27 · /training/sat (job analyses, DIF rule, coverage, changes)', component: lazy(() => import('./SatPage')) },
  { id: 'training-sat-role', path: '/training/sat/roles/:roleId', module: 'M26', zone: 'staff', guard: SAT, parent: 'training-sat', spec: 'BACKLOG F27 · job analysis of a role: task inventory, DIF survey, decisions, task-to-training matrix', component: lazy(() => import('./SatRolePage')) },
  { id: 'training-sat-task', path: '/training/sat/tasks/:taskId', module: 'M26', zone: 'staff', guard: SAT, parent: 'training-sat', spec: 'BACKLOG F27 · task: DIF ratings, training decision, objectives and links, change impact', component: lazy(() => import('./SatTaskPage')) },
  { id: 'training-sat-changes', path: '/training/sat/changes', module: 'M26', zone: 'staff', guard: SAT, nav: { lens: 'my', section: 'quality', order: 63 }, parent: 'training-sat', spec: 'BACKLOG F27 · SAT changes and their review items (courses, standards via reviseStandard)', component: lazy(() => import('./SatChangesPage')) },
  { id: 'training-sat-report', path: '/training/sat/roles/:roleId/report', module: 'M26', zone: 'staff', guard: SAT, parent: 'training-sat-role', spec: 'BACKLOG F27 · traceability report export (EN/AR)', component: lazy(() => import('./SatReportPage')) },
  { id: 'training-sat-future', path: '/training/sat/future', module: 'M26', zone: 'staff', guard: SAT, nav: { lens: 'my', section: 'quality', order: 65 }, parent: 'training-sat', spec: 'PLAN FS06 · task layer: OECD AI capability needs, exposure, change horizon, technology driver, task-to-skill links', component: lazy(() => import('./SatFuturePage')) },
  { id: 'training-sat-survey', path: '/training/sat/survey', module: 'M26', zone: 'staff', guard: { signedIn: true }, parent: 'my', spec: 'BACKLOG F27 · DIF survey for subject-matter experts (F21 SME profile)', component: lazy(() => import('./DifSurveyPage')) },
  { id: 'training-accreditation', path: '/training/accreditation', module: 'M26', zone: 'staff', guard: SAT, nav: { lens: 'my', section: 'quality', order: 64 }, parent: 'my', spec: 'BACKLOG F29 · /training/accreditation (programmes, readiness trend, gaps, criteria library)', component: lazy(() => import('./AccrPage')) },
  { id: 'training-accreditation-selfeval', path: '/training/accreditation/:selfEvalId', module: 'M26', zone: 'staff', guard: SAT, parent: 'training-accreditation', spec: 'BACKLOG F29 · self-evaluation: ratings, suggested evidence, gaps, maker-checker finalisation', component: lazy(() => import('./SelfEvalPage')) },
  { id: 'training-accreditation-report', path: '/training/accreditation/:selfEvalId/report', module: 'M26', zone: 'staff', guard: SAT, parent: 'training-accreditation-selfeval', spec: 'BACKLOG F29 · self-evaluation report (EN/AR, demo / not an accreditation decision)', component: lazy(() => import('./AccrReportPage')) },
];
