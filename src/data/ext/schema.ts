// F01: table blocks of the M17-M27 modules, merged into SCHEMA by src/data/schema.ts. Import-free apart from .ts module files
// (node scripts load this through src/data/schema.ts). Each module owns src/modules/<m>/backend/schema.ts.
import { TABLES_M17 } from '../../modules/m17/backend/schema.ts';
import { TABLES_M18 } from '../../modules/m18/backend/schema.ts';
import { TABLES_M19 } from '../../modules/m19/backend/schema.ts';
import { TABLES_M20 } from '../../modules/m20/backend/schema.ts';
import { TABLES_M21 } from '../../modules/m21/backend/schema.ts';
import { TABLES_M22 } from '../../modules/m22/backend/schema.ts';
import { TABLES_M23 } from '../../modules/m23/backend/schema.ts';
import { TABLES_M24 } from '../../modules/m24/backend/schema.ts';
import { TABLES_M25 } from '../../modules/m25/backend/schema.ts';
import { TABLES_M26 } from '../../modules/m26/backend/schema.ts';
import { TABLES_M27 } from '../../modules/m27/backend/schema.ts';

export const EXT_TABLES = { ...TABLES_M17, ...TABLES_M18, ...TABLES_M19, ...TABLES_M20, ...TABLES_M21, ...TABLES_M22, ...TABLES_M23, ...TABLES_M24, ...TABLES_M25, ...TABLES_M26, ...TABLES_M27 };
