// M31 routes (Next-Gen Nuclear Readiness; owners: wave E E1 (FS38, FS39, FS40)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M31', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m31.routes.<id>.title|purpose in src/i18n/m31.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m31/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const OWN = { signedIn: true, grant: { res: 'skills_profile' as const, levels: ['Own' as const] } };
export const routes: RouteDef[] = [
  // FS wave E · E1: FS38 SMR delta overlay for every Barakah role
  { id: 'careers-next-gen', path: '/careers/next-gen', module: 'M31', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 13.5 }, parent: 'careers', spec: 'FS38 /careers/next-gen · SMR delta overlay public summary: role x technology grid, what changes and stays, skills, training, sources (no deployment decision implied)', component: lazy(() => import('./CareersNextGenPage')) },
  { id: 'my-next-gen', path: '/my/next-gen', module: 'M31', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'future', order: 23.5 }, parent: 'my', spec: 'FS38 /my/next-gen · my role x each ADVANCE technology: seven dimensions, change size, needs vs my levels, readiness, training that closes gaps', component: lazy(() => import('./MyNextGenPage')) },
  { id: 'workforce-next-gen', path: '/workforce/next-gen', module: 'M31', zone: 'staff', guard: { signedIn: true, grant: { res: 'workforce_strategy', levels: ['Agg', 'R'] } }, nav: { lens: 'my', section: 'workforce', order: 67.5 }, parent: 'workforce', spec: 'FS38 /workforce/next-gen · readiness per technology and job family (suppressed under 10)', component: lazy(() => import('./WorkforceNextGenPage')) },
  { id: 'admin-next-gen', path: '/admin/next-gen', module: 'M31', zone: 'admin', guard: { signedIn: true, grant: { res: 'frameworks', levels: ['W', 'A'] } }, nav: { lens: 'admin', section: 'admin', order: 7.1 }, parent: 'admin', spec: 'FS38 /admin/next-gen · maintain SMR deltas (frameworks W/A; versioned, audited, ledger on publish)', component: lazy(() => import('./AdminNextGenPage')) },
  // FS39 plant literacy explainer and reference-plant log
  { id: 'learn-plant-literacy', path: '/learn/plant-literacy', module: 'M31', zone: 'staff', guard: { signedIn: true }, nav: { lens: 'my', section: 'knowledge', order: 61.5 }, parent: 'learn', spec: 'FS39 /learn/plant-literacy · browser plant explainer: heat to grid, three safety functions, what-if scenarios (static, SIMULATED, offline)', component: lazy(() => import('./PlantLiteracyPage')) },
  { id: 'my-plant-log', path: '/my/plant-log', module: 'M31', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'growth', order: 21.8 }, parent: 'my', spec: 'FS39 /my/plant-log · reference-plant visits and simulator observations, host confirmation (maker-checker), evidence on confirmation only', component: lazy(() => import('./PlantLogPage')) },
  // FS40 digital-twin diagnosis drills
  { id: 'my-twin-drills', path: '/my/twin-drills', module: 'M31', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 18.7 }, parent: 'my', spec: 'FS40 /my/twin-drills · digital-twin diagnosis drills (synthetic SIMULATED trends, deterministic scoring, evidence <= L2)', component: lazy(() => import('./TwinDrillsPage')) },
  { id: 'my-twin-drill', path: '/my/twin-drills/:id', module: 'M31', zone: 'staff', guard: OWN, parent: 'my-twin-drills', spec: 'FS40 /my/twin-drills/:id · trends, check budget, diagnosis, conservative action, scored result with reasons', component: lazy(() => import('./TwinDrillPage')) },
  { id: 'training-twin-drills', path: '/training/twin-drills', module: 'M31', zone: 'staff', guard: { signedIn: true, grant: { res: 'secure_items', levels: ['W', 'A'] } }, nav: { lens: 'my', section: 'training', order: 70.7 }, parent: 'training', spec: 'FS40 /training/twin-drills · drill bank, keys and results (suppressed under 10); training manager authors drills', component: lazy(() => import('./TrainingTwinDrillsPage')) },
];
