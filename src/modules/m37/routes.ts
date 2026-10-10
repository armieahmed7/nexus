// M37 routes (National Alignment; owners: wave G E2 (FS62, FS63) and wave H E2 (FS73, FS74)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M37', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m37.routes.<id>.title|purpose in src/i18n/m37.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m37/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
