// M28 tables (owners: wave B E1 (FS07, FS08) and wave H E1 (FS70, FS71, FS72)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
import type { TableDef } from '../../../data/schema';

export const TABLES_M28: Record<string, TableDef> = {};
