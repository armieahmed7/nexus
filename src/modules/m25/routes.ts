// M25 routes (Training effectiveness and needs; owner W4 · E1, features F25 Kirkpatrick effectiveness and F26 Training needs forecast).
// Registered once by F01 in src/routes/registry.ts. Route ids are i18n keys (m25.routes.<id>.title|purpose) and are visited by the
// smoke suite automatically; param routes take their sample params from smoke.json.
// Access (learning_analytics): the scorecard and the needs forecast for aggregate holders (instructors, managers, HR: Agg; training
// manager: A; auditors: R); L3 observations for managers (W, own team), the training manager (A) and auditors (R); the learner's
// L1 feedback for every employee (Own).
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const LA = 'learning_analytics' as const;
const AGG = { signedIn: true, grant: { res: LA, levels: ['Agg' as const, 'R' as const, 'A' as const] } };
const L3 = { signedIn: true, grant: { res: LA, levels: ['W' as const, 'A' as const, 'R' as const] } };
const OWN = { signedIn: true, grant: { res: LA, levels: ['Own' as const] } };

export const routes: RouteDef[] = [
  { id: 'training-effectiveness', path: '/training/effectiveness', module: 'M25', zone: 'staff', guard: AGG, nav: { lens: 'my', section: 'training', order: 48.5 }, parent: 'training', spec: 'BACKLOG F25 · /training/effectiveness (Kirkpatrick L1-L4 scorecard, committee pack, redesign flags)', component: lazy(() => import('./EffectivenessPage')) },
  { id: 'training-effectiveness-course', path: '/training/effectiveness/:courseId', module: 'M25', zone: 'staff', guard: AGG, parent: 'training-effectiveness', spec: 'BACKLOG F25 · one course: L1 items, L2 gain (released attempts), L3 transfer, L4 SAMPLE KPIs', component: lazy(() => import('./EffectivenessCoursePage')) },
  { id: 'training-observations', path: '/training/observations', module: 'M25', zone: 'staff', guard: L3, nav: { lens: 'my', section: 'training', order: 48.6 }, parent: 'my', spec: 'BACKLOG F25 · L3 supervisor observations 60-90 days after qualifying courses', component: lazy(() => import('./ObservationsPage')) },
  { id: 'my-learning-feedback', path: '/my/learning/feedback', module: 'M25', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'me', order: 12.5 }, parent: 'my-learning', spec: 'BACKLOG F25 · L1 post-course form (anonymous to instructors)', component: lazy(() => import('./MyFeedbackPage')) },
  { id: 'training-needs', path: '/training/needs', module: 'M25', zone: 'staff', guard: AGG, nav: { lens: 'my', section: 'training', order: 48.7 }, parent: 'training', spec: 'BACKLOG F26 · /training/needs (demand per course per quarter vs capacity, drafts, SIMULATED intake)', component: lazy(() => import('./NeedsPage')) },
];
