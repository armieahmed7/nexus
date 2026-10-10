// M28 routes (Skills Intelligence; owners: wave B E1 (FS07, FS08) and wave H E1 (FS70, FS71, FS72)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M28', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m28.routes.<id>.title|purpose in src/i18n/m28.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m28/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
