// M22 tables (owner: W2). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly).
import type { TableDef } from '../../../data/schema';

export const TABLES_M22: Record<string, TableDef> = {};
