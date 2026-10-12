// M25 routes (Training effectiveness and needs; owner W4 · E1, features F25 Kirkpatrick effectiveness and F26 Training needs forecast).
// Registered once by F01 in src/routes/registry.ts. Route ids are i18n keys (m25.routes.<id>.title|purpose) and are visited by the
// smoke suite automatically; param routes take their sample params from smoke.json.
// FS56/FS57 (wave F · E4): skill change, coverage and the backlog for the same aggregate audience; only the training manager (A) recomputes,
// syncs and decides.
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
  // FS56 / FS57 (FS wave F · E4): which learning moves skills; curriculum coverage per role and the gap-filling backlog.
  { id: 'training-skill-change', path: '/training/skill-change', module: 'M25', zone: 'staff', guard: AGG, nav: { lens: 'my', section: 'training', order: 48.55 }, parent: 'training', spec: 'PLAN FS56 · F01 level before and 90 days after each course and pathway, matched comparison, suppressed under 10, linked to Kirkpatrick L3', component: lazy(() => import('./SkillChangePage')) },
  { id: 'training-coverage', path: '/training/coverage', module: 'M25', zone: 'staff', guard: AGG, nav: { lens: 'my', section: 'training', order: 48.8 }, parent: 'training', spec: 'PLAN FS57 · 0-100 curriculum coverage per role (now and 2030), uncovered skills, in-memory what-if', component: lazy(() => import('./CoveragePage')) },
  { id: 'training-coverage-backlog', path: '/training/coverage/backlog', module: 'M25', zone: 'staff', guard: AGG, parent: 'training-coverage', spec: 'PLAN FS57 · gap-filling backlog over the FS17 gaps: owner, date, build / partner / buy', component: lazy(() => import('./BacklogPage')) },
  { id: 'training-needs', path: '/training/needs', module: 'M25', zone: 'staff', guard: AGG, nav: { lens: 'my', section: 'training', order: 48.7 }, parent: 'training', spec: 'BACKLOG F26 · /training/needs (demand per course per quarter vs capacity, drafts, SIMULATED intake)', component: lazy(() => import('./NeedsPage')) },
];
