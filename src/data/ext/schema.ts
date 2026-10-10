// F01: table blocks of the M17-M27 modules, merged into SCHEMA by src/data/schema.ts. Import-free apart from .ts module files
// (node scripts load this through src/data/schema.ts). Each module owns src/modules/<m>/backend/schema.ts.
import { TABLES_M02 } from '../../modules/m02/backend/schema.ts'; // W4E5 (F31): M02 instructor and SME pipeline tables
import { TABLES_M04 } from '../../modules/m04/backend/schema.ts'; // W2E3 (F13): M04 mentoring extension tables
import { TABLES_M06 } from '../../modules/m06/backend/schema.ts'; // W5E3 (F34): M06 student journey tables
import { TABLES_M07 } from '../../modules/m07/backend/schema.ts'; // W3E3 (F22): M07 handover board tables
import { TABLES_M09 } from '../../modules/m09/backend/schema.ts'; // W5E2 (F33): M09 contractor passport tables
import { TABLES_M16 } from '../../modules/m16/backend/schema.ts'; // W3E5 (F24): AI transparency tables
import { TABLES_DIGEST } from '../../shell/digest/backend/schema.ts'; // W5E5 (F36): personal digest tables
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
// FS01 (future skills, wave A): M28-M37 module tables
import { TABLES_M28 } from '../../modules/m28/backend/schema.ts';
import { TABLES_M29 } from '../../modules/m29/backend/schema.ts';
import { TABLES_M30 } from '../../modules/m30/backend/schema.ts';
import { TABLES_M31 } from '../../modules/m31/backend/schema.ts';
import { TABLES_M32 } from '../../modules/m32/backend/schema.ts';
import { TABLES_M33 } from '../../modules/m33/backend/schema.ts';
import { TABLES_M34 } from '../../modules/m34/backend/schema.ts';
import { TABLES_M35 } from '../../modules/m35/backend/schema.ts';
import { TABLES_M36 } from '../../modules/m36/backend/schema.ts';
import { TABLES_M37 } from '../../modules/m37/backend/schema.ts';

export const EXT_TABLES = { ...TABLES_M02, ...TABLES_M04, ...TABLES_M06, ...TABLES_M07, ...TABLES_M09, ...TABLES_M16, ...TABLES_DIGEST, ...TABLES_M17, ...TABLES_M18, ...TABLES_M19, ...TABLES_M20, ...TABLES_M21, ...TABLES_M22, ...TABLES_M23, ...TABLES_M24, ...TABLES_M25, ...TABLES_M26, ...TABLES_M27, ...TABLES_M28, ...TABLES_M29, ...TABLES_M30, ...TABLES_M31, ...TABLES_M32, ...TABLES_M33, ...TABLES_M34, ...TABLES_M35, ...TABLES_M36, ...TABLES_M37 };
