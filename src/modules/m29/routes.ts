// M29 routes (AI and Digital Fluency; owners: wave B E2 (FS09, FS10), wave D E5 (FS36, FS37) and wave I E2 (FS80)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M29', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m29.routes.<id>.title|purpose in src/i18n/m29.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m29/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const OWN = { signedIn: true, grant: { res: 'ai_literacy' as const, levels: ['Own' as const] } };
export const routes: RouteDef[] = [
  // FS wave B · E2: FS09 AI Fluency Ladder, FS10 AI and Digital Fitness Check
  { id: 'learn-ai-fluency', path: '/learn/ai-fluency', module: 'M29', zone: 'public', guard: {}, nav: { lens: 'public', section: 'learn', order: 45 }, parent: 'learn', spec: 'FS09 /learn/ai-fluency · AI Fluency Ladder: rungs, dimensions, plant examples, role targets', component: lazy(() => import('./LadderPage')) },
  { id: 'my-ai-fluency', path: '/my/ai-fluency', module: 'M29', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 18.3 }, parent: 'my', spec: 'FS09 /my/ai-fluency · My AI fluency rung, reasons, next step and family target', component: lazy(() => import('./MyFluencyPage')) },
  { id: 'my-ai-fitness', path: '/my/ai-fluency/check', module: 'M29', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 18.4 }, parent: 'my-ai-fluency', spec: 'FS10 /my/ai-fluency/check · AI and Digital Fitness Check (adaptive, quarterly)', component: lazy(() => import('./FitnessCheckPage')) },
  { id: 'workforce-ai-fluency', path: '/workforce/ai-fluency', module: 'M29', zone: 'staff', guard: { signedIn: true, grant: { res: 'ai_literacy', levels: ['Agg'] } }, nav: { lens: 'my', section: 'workforce', order: 66 }, parent: 'workforce', spec: 'FS09/FS10 /workforce/ai-fluency · % of staff above basic, rungs and targets (suppressed under 10)', component: lazy(() => import('./WorkforceFluencyPage')) },
  { id: 'training-ai-fitness-items', path: '/training/ai-fitness/items', module: 'M29', zone: 'staff', guard: { signedIn: true, grant: { res: 'secure_items', levels: ['W', 'A'] } }, nav: { lens: 'my', section: 'training', order: 70 }, parent: 'training', spec: 'FS10 /training/ai-fitness/items · Fitness-check item bank (training manager writes)', component: lazy(() => import('./ItemBankPage')) },
];
