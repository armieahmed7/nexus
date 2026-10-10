// M35 tables (owners: wave F E1 (FS50, FS51) and wave G E1 (FS60, FS61)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
import type { TableDef } from '../../../data/schema';

export const TABLES_M35: Record<string, TableDef> = {};
