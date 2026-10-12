// M35 routes (Workforce Strategy and Disclosure; owners: wave F E1 (FS50, FS51) and wave G E1 (FS60, FS61)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M35', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m35.routes.<id>.title|purpose in src/i18n/m35.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m35/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips feature="FSnn" /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
// FS wave F · E1: every page needs workforce_strategy (hr_analyst Agg/W, hr_director Agg/W/A, training_manager Agg, admin R, auditor R);
// never public, no staff grant. Writes are RPCs with their own checks (W drafts, A adopts, reviews and releases).
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const WS = { signedIn: true, grant: { res: 'workforce_strategy' as const, levels: ['Agg' as const, 'R' as const, 'W' as const, 'A' as const] } };
export const routes: RouteDef[] = [
  // FS50 Critical Future-Skills Register
  { id: 'workforce-critical-skills', path: '/workforce/critical-skills', module: 'M35', zone: 'staff', guard: WS, nav: { lens: 'my', section: 'workforce', order: 68.1 }, parent: 'workforce', spec: 'FS50 /workforce/critical-skills · register of critical future skills: owner, target level, people-equivalent targets, KPIs, build/buy/borrow/bot decision with rationale, FS04 gap plans; computed progress (suppressed under 10); quarterly review state', component: lazy(() => import('./CriticalSkillsPage')) },
  { id: 'workforce-critical-skill', path: '/workforce/critical-skills/:id', module: 'M35', zone: 'staff', guard: WS, parent: 'workforce-critical-skills', spec: 'FS50 · one critical skill: progress, level mix, KPIs, trajectory against the released FS51 forecast, decision history, gap plans, quarterly reviews (HR director: audit + ledger)', component: lazy(() => import('./CriticalSkillPage')) },
  // FS51 Three-scenario skill forecasting bands
  { id: 'workforce-skill-forecasts', path: '/workforce/skill-forecasts', module: 'M35', zone: 'staff', guard: WS, nav: { lens: 'my', section: 'workforce', order: 68.2 }, parent: 'workforce', spec: 'FS51 /workforce/skill-forecasts · baseline, ADVANCE and accelerated bands per skill and level mix to 2035 (SIMULATED), visible assumptions with reset, methodology banner, suppressed and not-yet-modelled lists, saved versions', component: lazy(() => import('./SkillForecastsPage')) },
  { id: 'workforce-skill-forecast', path: '/workforce/skill-forecasts/skills/:skillId', module: 'M35', zone: 'staff', guard: WS, parent: 'workforce-skill-forecasts', spec: 'FS51 · one skill: fan chart by level, level mix per scenario, reasons, generations', component: lazy(() => import('./SkillForecastPage')) },
  { id: 'workforce-skill-forecast-versions', path: '/workforce/skill-forecasts/versions', module: 'M35', zone: 'staff', guard: WS, parent: 'workforce-skill-forecasts', spec: 'FS51 · annual refresh with saved versions (MATCH pattern): release (HR director, ledger), supersession, comparison blocked across methods', component: lazy(() => import('./ForecastVersionsPage')) },
  { id: 'workforce-skill-generations', path: '/workforce/skill-forecasts/generations', module: 'M35', zone: 'staff', guard: WS, parent: 'workforce-skill-forecasts', spec: 'FS51 · long-horizon generations view of the plant operating life (to the end of the 60-year licences), SIMULATED', component: lazy(() => import('./GenerationsPage')) },
  { id: 'workforce-skill-forecast-method', path: '/workforce/skill-forecasts/method', module: 'M35', zone: 'staff', guard: WS, parent: 'workforce-skill-forecasts', spec: 'FS51 · definitions, method, assumptions and ranges, not-yet-modelled list and sources', component: lazy(() => import('./ForecastMethodPage')) },
];
