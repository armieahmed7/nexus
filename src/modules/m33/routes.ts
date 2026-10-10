// M33 routes (Human Skills Studio; owners: wave C E5 (FS25, FS26) and wave F E5 (FS58, FS59)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M33', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m33.routes.<id>.title|purpose in src/i18n/m33.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m33/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
