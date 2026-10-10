// M34 routes (Recognition (RPL, NQF, credits); owners: wave D E2 (FS29, FS30) and wave I E1 (FS78, FS79)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M34', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m34.routes.<id>.title|purpose in src/i18n/m34.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m34/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
