// M24 routes (Knowledge continuity; owner: W3 engineer, features F20, F21 (W3)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M24', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m24.routes.<id>.title|purpose in src/i18n/m24.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m24/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
