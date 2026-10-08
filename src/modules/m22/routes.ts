// M22 routes (Leadership and communities; owner: W2 engineer, features F16, F17 (W2)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M22', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m22.routes.<id>.title|purpose in src/i18n/m22.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m22/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
