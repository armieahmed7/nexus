// M36 routes (Skills Ecosystem; owners: wave G E3 (FS64, FS65) and wave I E4 (FS82, FS83)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M36', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m36.routes.<id>.title|purpose in src/i18n/m36.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m36/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
