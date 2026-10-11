// M30 routes (Role Transformation; owners: wave B E3 (FS11, FS12) and wave I E3 (FS81)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M30', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m30.routes.<id>.title|purpose in src/i18n/m30.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: sample params in src/modules/m30/smoke.json. Every page shows its <BenchmarkChips feature="FS11|FS12" /> (src/ui).
// Access (policy resource `transformation`): staff read role views (R); HR aggregates (Agg); the training manager and HR director edit
// maps (W/A). The public summary of a published map is public.
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const STAFF = { signedIn: true, grant: { res: 'transformation' as const, levels: ['R' as const, 'Own' as const] } };
const HR_OR_EDIT = { signedIn: true, grant: { res: 'transformation' as const, levels: ['Agg' as const, 'W' as const, 'A' as const] } };
const EDIT = { signedIn: true, grant: { res: 'transformation' as const, levels: ['W' as const, 'A' as const] } };

export const routes: RouteDef[] = [
  { id: 'my-role-2030', path: '/my/role-2030', module: 'M30', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'future', order: 22 }, parent: 'my', spec: 'PLAN FS11 · /my/role-2030: drivers, tasks that grow / shrink / are augmented, skills added, bridge curriculum, my time-to-ready, archetype, timeline', component: lazy(() => import('./MyRole2030Page')) },
  { id: 'my-role-2030-tasks', path: '/my/role-2030/tasks', module: 'M30', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'future', order: 23 }, parent: 'my-role-2030', spec: 'PLAN FS12 · task exposure view: AI-assisted, partly automatable, human core with the OECD reason; skills that complement AI', component: lazy(() => import('./TaskExposurePage')) },
  { id: 'careers-role-transformation', path: '/careers/roles/:slug/transformation', module: 'M30', zone: 'public', guard: {}, parent: 'careers-role', spec: 'PLAN FS11 · /careers/:role/transformation public summary (no numbers)', component: lazy(() => import('./CareersTransformationPage')) },
  { id: 'workforce-transformation', path: '/workforce/transformation', module: 'M30', zone: 'staff', guard: HR_OR_EDIT, nav: { lens: 'my', section: 'workforce', order: 69 }, parent: 'my', spec: 'PLAN FS11 · /workforce/transformation HR overview by family; FS12 exposure aggregate (suppressed under 10)', component: lazy(() => import('./WorkforceTransformationPage')) },
  { id: 'workforce-transformation-edit', path: '/workforce/transformation/:roleId', module: 'M30', zone: 'staff', guard: EDIT, parent: 'workforce-transformation', spec: 'PLAN FS11 · edit and publish a role transformation map (publishTransformation; copy check)', component: lazy(() => import('./TransformationEditPage')) },
];
