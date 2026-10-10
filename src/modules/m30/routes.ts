// M30 routes (Role Transformation; owners: wave B E3 (FS11, FS12) and wave I E3 (FS81)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M30', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m30.routes.<id>.title|purpose in src/i18n/m30.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m30/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
