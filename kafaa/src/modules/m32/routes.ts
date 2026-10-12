// M32 routes (Energy Transition Skills; owners: wave E E2 (FS41, FS42, FS43)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M32', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m32.routes.<id>.title|purpose in src/i18n/m32.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m32/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips feature="FSnn" /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
// M32 has no policy resource of its own (handover 3.7): public pages are open, staff pages use internal_content R (like M19 pathways),
// my progress skills_profile Own, the HR view skills_profile Agg.
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const OWN = { signedIn: true, grant: { res: 'skills_profile' as const, levels: ['Own' as const] } };
const STAFF = { signedIn: true, grant: { res: 'internal_content' as const, levels: ['R' as const] } };
export const routes: RouteDef[] = [
  // FS wave E · E2: FS41 CleanEnergyComp, FS42 energy-system integration pathway, FS43 ESG and GHG literacy for managers
  { id: 'skills-clean-energy', path: '/skills/clean-energy', module: 'M32', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 11.95 }, parent: 'skills', spec: 'FS41 /skills/clean-energy · CleanEnergyComp: 12 competences in four GreenComp-method areas, outcomes EN/AR, FS02 skills, learning items, role targets for every job family', component: lazy(() => import('./CleanEnergyPage')) },
  { id: 'skills-clean-energy-competence', path: '/skills/clean-energy/:id', module: 'M32', zone: 'public', guard: {}, parent: 'skills-clean-energy', spec: 'FS41 · one CleanEnergyComp competence: outcomes side by side in EN and AR, skills, learning items, focus families, sources', component: lazy(() => import('./CecCompetencePage')) },
  { id: 'my-clean-energy', path: '/my/clean-energy', module: 'M32', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 18.8 }, parent: 'my', spec: 'FS41 /my/clean-energy · my CleanEnergyComp level per competence and overall against my family target, with reasons, what to grow next and MC-CLEAN-ENERGY', component: lazy(() => import('./MyCleanEnergyPage')) },
  { id: 'workforce-clean-energy', path: '/workforce/clean-energy', module: 'M32', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Agg'] } }, nav: { lens: 'my', section: 'workforce', order: 67.5 }, parent: 'workforce', spec: 'FS41 · CleanEnergyComp across the workforce by level, area and family (Agg, suppressed under 10)', component: lazy(() => import('./WorkforceCleanEnergyPage')) },
  { id: 'learn-energy-transition', path: '/learn/energy-transition', module: 'M32', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'growth', order: 21.7 }, parent: 'my', spec: 'FS42/FS43 /learn/energy-transition · value chains (hydrogen, process heat, grid), the energy-system pathway and the ESG and GHG track for managers', component: lazy(() => import('./EnergyTransitionPage')) },
  { id: 'learn-esg-managers', path: '/learn/energy-transition/esg-managers', module: 'M32', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'growth', order: 21.75 }, parent: 'learn-energy-transition', spec: 'FS43 · ESG and GHG literacy for managers: under 10 hours with a stated weekly cost, sourced content, the MC-CLEAN-ENERGY credential route', component: lazy(() => import('./EsgManagersPage')) },
  { id: 'learn-energy-chain', path: '/learn/energy-transition/:chainId', module: 'M32', zone: 'staff', guard: STAFF, parent: 'learn-energy-transition', spec: 'FS42 · one value chain: stages, sourced facts with as-of dates, skills, lanes, the awareness-to-practitioner pathway', component: lazy(() => import('./ValueChainPage')) },
];
