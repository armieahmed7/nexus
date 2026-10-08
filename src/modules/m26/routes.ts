// M26 routes (SAT and accreditation workbench; owner: W4 engineer, features F27, F29 (W4)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M26', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m26.routes.<id>.title|purpose in src/i18n/m26.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m26/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [];
