// M19 routes (Learning Coach; owner: W1 engineer, features F07 (W1) · F14 (W2)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M19', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m19.routes.<id>.title|purpose in src/i18n/m19.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m19/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
