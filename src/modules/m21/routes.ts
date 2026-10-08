// M21 routes (Future Me (personal ADVANCE readiness and horizon); owner: W1 engineer, features F09 (W1)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M21', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m21.routes.<id>.title|purpose in src/i18n/m21.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m21/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
