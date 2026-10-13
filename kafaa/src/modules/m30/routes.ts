// M30 routes (Role Transformation; owners: wave B E3 (FS11, FS12) and wave I E3 (FS81)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M30', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m30.routes.<id>.title|purpose in src/i18n/m30.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: sample params in src/modules/m30/smoke.json. Every page shows its <BenchmarkChips feature="FS11|FS12|FS81" /> (src/ui).
// Access (policy resource `transformation`): staff read role views (R); HR aggregates (Agg); the training manager and HR director edit
// maps (W/A). The public summary of a published map is public.
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const STAFF = { signedIn: true, grant: { res: 'transformation' as const, levels: ['R' as const, 'Own' as const] } };
const HR_OR_EDIT = { signedIn: true, grant: { res: 'transformation' as const, levels: ['Agg' as const, 'W' as const, 'A' as const] } };
const EDIT = { signedIn: true, grant: { res: 'transformation' as const, levels: ['W' as const, 'A' as const] } };
// FS81 (wave I · E3): transition plans are visible to the person (own) and to HR (transformation A) only; managers get nothing.
// Role-level ladder-rung alerts name no person: training manager (W), HR director (A) and HR analysts (Agg).
const HR_A = { signedIn: true, grant: { res: 'transformation' as const, levels: ['A' as const] } };

export const routes: RouteDef[] = [
  { id: 'my-role-2030', path: '/my/role-2030', module: 'M30', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'future', order: 22 }, parent: 'my', spec: 'PLAN FS11 · /my/role-2030: drivers, tasks that grow / shrink / are augmented, skills added, bridge curriculum, my time-to-ready, archetype, timeline', component: lazy(() => import('./MyRole2030Page')) },
  { id: 'my-role-2030-tasks', path: '/my/role-2030/tasks', module: 'M30', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'future', order: 23 }, parent: 'my-role-2030', spec: 'PLAN FS12 · task exposure view: AI-assisted, partly automatable, human core with the OECD reason; skills that complement AI', component: lazy(() => import('./TaskExposurePage')) },
  { id: 'careers-role-transformation', path: '/careers/roles/:slug/transformation', module: 'M30', zone: 'public', guard: {}, parent: 'careers-role', spec: 'PLAN FS11 · /careers/:role/transformation public summary (no numbers)', component: lazy(() => import('./CareersTransformationPage')) },
  { id: 'workforce-transformation', path: '/workforce/transformation', module: 'M30', zone: 'staff', guard: HR_OR_EDIT, nav: { lens: 'my', section: 'workforce', order: 69 }, parent: 'my', spec: 'PLAN FS11 · /workforce/transformation HR overview by family; FS12 exposure aggregate (suppressed under 10)', component: lazy(() => import('./WorkforceTransformationPage')) },
  { id: 'my-transition-plan', path: '/my/transition-plan', module: 'M30', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'future', order: 24 }, parent: 'my', spec: 'PLAN FS81 · my transition plan (SIMULATED HR): protected role, retraining, target role, ladder-rung practice, review dates; person and HR only', component: lazy(() => import('./MyTransitionPlanPage')) },
  { id: 'workforce-transition-plans', path: '/workforce/transition-plans', module: 'M30', zone: 'staff', guard: HR_A, nav: { lens: 'my', section: 'workforce', order: 69.5 }, parent: 'my', spec: 'PLAN FS81 · HR board of transition plans: create, activate (practice for every ladder-rung task), review dates', component: lazy(() => import('./WorkforceTransitionPlansPage')) },
  { id: 'workforce-transition-plan', path: '/workforce/transition-plans/:planId', module: 'M30', zone: 'staff', guard: HR_A, parent: 'workforce-transition-plans', spec: 'PLAN FS81 · one transition plan: edit, reviews, complete or withdraw', component: lazy(() => import('./TransitionPlanPage')) },
  { id: 'workforce-rung-alerts', path: '/workforce/rung-alerts', module: 'M30', zone: 'staff', guard: HR_OR_EDIT, nav: { lens: 'my', section: 'workforce', order: 69.6 }, parent: 'my', spec: 'PLAN FS81 · ladder-rung alerts by Mastery Builder role: junior tasks moving to tools and the simulator / OJT practice to add (no person)', component: lazy(() => import('./RungAlertsPage')) },
  { id: 'workforce-transformation-edit', path: '/workforce/transformation/:roleId', module: 'M30', zone: 'staff', guard: EDIT, parent: 'workforce-transformation', spec: 'PLAN FS11 · edit and publish a role transformation map (publishTransformation; copy check)', component: lazy(() => import('./TransformationEditPage')) },
];
