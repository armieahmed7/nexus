// M35 routes (Workforce Strategy and Disclosure; owners: wave F E1 (FS50, FS51) and wave G E1 (FS60, FS61)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M35', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m35.routes.<id>.title|purpose in src/i18n/m35.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m35/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
