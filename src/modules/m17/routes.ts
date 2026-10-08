// M17 routes (Skills Passport; owner: W1 engineer, features F03, F04 (W1) · F10, F11 (W2) · F32 (W5)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M17', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m17.routes.<id>.title|purpose in src/i18n/m17.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m17/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
