// M27 routes (Learning record store; owner: W4 engineer, features F30 (W4)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M27', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m27.routes.<id>.title|purpose in src/i18n/m27.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m27/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
