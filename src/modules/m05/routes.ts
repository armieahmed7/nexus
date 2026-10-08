// M05 routes (owner: G2). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'learn-practice', path: '/learn/practice', module: 'M05', zone: 'public', guard: {}, nav: { lens: 'public', section: 'learn', order: 31 }, parent: 'learn', spec: "M05 practice tier", component: lazy(() => import('./LearnPracticePage')) },
  { id: 'learn-practice-quiz', path: '/learn/practice/:form', module: 'M05', zone: 'public', guard: {}, parent: 'learn-practice', spec: "M05 practice tier", component: lazy(() => import('./LearnPracticeQuizPage')) },
  { id: 'my-assessments', path: '/my/assessments', module: 'M05', zone: 'staff', guard: { signedIn: true, anyRole: ['employee'] }, nav: { lens: 'my', section: 'me', order: 13 }, parent: 'my', spec: "§5 /my/assessments · M05", component: lazy(() => import('./MyAssessmentsPage')) },
  { id: 'training-jpm', path: '/training/jpm', module: 'M05', zone: 'staff', guard: { signedIn: true, grant: { res: 'signoff', levels: ['A'] } }, nav: { lens: 'my', section: 'training', order: 46 }, parent: 'training', spec: "M05 JPM evaluator", component: lazy(() => import('./TrainingJpmPage')) },
  { id: 'training-items', path: '/training/items', module: 'M05', zone: 'staff', guard: { signedIn: true, grant: { res: 'secure_items', levels: ['W'] } }, nav: { lens: 'my', section: 'training', order: 47 }, parent: 'training', spec: "M05 item bank", component: lazy(() => import('./TrainingItemsPage')) },
  { id: 'training-assessments', path: '/training/assessments', module: 'M05', zone: 'staff', guard: { signedIn: true, grant: { res: 'secure_items', levels: ['W'] } }, nav: { lens: 'my', section: 'training', order: 48 }, parent: 'training', spec: "M05 proctor console", component: lazy(() => import('./TrainingAssessmentsPage')) },
];
