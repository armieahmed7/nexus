// M20 routes (Opportunities (marketplace, rotations, alumni); owner: W1 engineer, features F08 (W1) · F15 (W2) · F23 (W3)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M20', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m20.routes.<id>.title|purpose in src/i18n/m20.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m20/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
