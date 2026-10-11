// M33 routes (Human Skills Studio; owners: wave C E5 (FS25, FS26) and wave F E5 (FS58, FS59)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M33', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m33.routes.<id>.title|purpose in src/i18n/m33.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m33/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const OWN = { signedIn: true, grant: { res: 'skills_profile' as const, levels: ['Own' as const] } };
export const routes: RouteDef[] = [
  // FS wave C · E5: FS25 Nuclear Critical Core Skills, FS26 Situational judgement practice
  { id: 'learn-core-skills', path: '/learn/core-skills', module: 'M33', zone: 'public', guard: {}, nav: { lens: 'public', section: 'learn', order: 46 }, parent: 'learn', spec: 'FS25 /learn/core-skills · 16 Nuclear Critical Core Skills in three clusters, benchmark mappings, the inclusion rule and the candidates not added', component: lazy(() => import('./CoreSkillsPage')) },
  { id: 'learn-core-skill', path: '/learn/core-skills/:id', module: 'M33', zone: 'public', guard: {}, parent: 'learn-core-skills', spec: 'FS25 /learn/core-skills/:id · one core skill: levels, mappings, INPO trait, catalogue skills, development and assessment routes, family targets', component: lazy(() => import('./CoreSkillPage')) },
  { id: 'my-core-skills', path: '/my/core-skills', module: 'M33', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 18.6 }, parent: 'my', spec: 'FS25 /my/core-skills · my evidence per core skill against my family target, with reasons and routes', component: lazy(() => import('./MyCoreSkillsPage')) },
  { id: 'my-core-practice', path: '/my/core-skills/practice', module: 'M33', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 18.7 }, parent: 'my-core-skills', spec: 'FS26 /my/core-skills/practice · situational judgement practice with expert key and rationale, trend over time (development only)', component: lazy(() => import('./PracticePage')) },
  { id: 'workforce-core-skills', path: '/workforce/core-skills', module: 'M33', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Agg'] } }, nav: { lens: 'my', section: 'workforce', order: 67 }, parent: 'workforce', spec: 'FS25/FS26 /workforce/core-skills · core skills against targets and practice participation (Agg, suppressed under 10)', component: lazy(() => import('./WorkforceCoreSkillsPage')) },
  { id: 'training-sjt-items', path: '/training/sjt/items', module: 'M33', zone: 'staff', guard: { signedIn: true, grant: { res: 'secure_items', levels: ['W', 'A'] } }, nav: { lens: 'my', section: 'training', order: 71 }, parent: 'training', spec: 'FS26 /training/sjt/items · situational judgement item bank (training manager writes; instructors read)', component: lazy(() => import('./SjtItemsPage')) },
];
