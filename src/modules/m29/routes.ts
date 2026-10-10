// M29 routes (AI and Digital Fluency; owners: wave B E2 (FS09, FS10), wave D E5 (FS36, FS37) and wave I E2 (FS80)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M29', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m29.routes.<id>.title|purpose in src/i18n/m29.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m29/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
