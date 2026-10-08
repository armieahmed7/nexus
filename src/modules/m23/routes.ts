// M23 routes (Talent review and succession; owner: W3 engineer, features F18, F19 (W3)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M23', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m23.routes.<id>.title|purpose in src/i18n/m23.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m23/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
