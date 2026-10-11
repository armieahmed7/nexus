// M31 routes (Next-Gen Nuclear Readiness; owners: wave E E1 (FS38, FS39, FS40)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M31', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m31.routes.<id>.title|purpose in src/i18n/m31.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m31/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
