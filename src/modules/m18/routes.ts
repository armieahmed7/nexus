// M18 routes (Career Navigator; owner: W1 engineer, features F05, F06 (W1) · F12 (W2)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M18', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m18.routes.<id>.title|purpose in src/i18n/m18.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m18/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
