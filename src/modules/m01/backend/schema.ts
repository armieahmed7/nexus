// M01 tables added by FS05 (wave A · E4, fsAe4): future role profiles and 2030/2035 role horizons. Merged into SCHEMA by
// src/data/ext/schema.ts; `npm run gen` regenerates types, SQL and RLS. Same DSL as src/data/schema.ts; import-free apart from
// `import type`. Columns added to M01's own tables (job_roles.lifecycle, career_paths.kind) live in the M01 block of
// src/data/schema.ts.
//
// role_profile_versions: one row per role x horizon (now / 2030 / 2035) x version. Requirements are competency or skill
// levels with an importance and a "why" line; every row is a planning assumption ("no deployment decision implied").
//   read: published rows are public (is_public is kept equal to status = 'published' by the RPC); drafts and superseded
//         versions are read by holders of audit_log (admin, auditor) and sat (training manager, instructors: SAT review).
//   write: only rpc.saveRoleProfileVersion (training manager or admin; audited; NEXUS ledger on publish).
import type { TableDef } from '../../../data/schema';

export const TABLES_M01: Record<string, TableDef> = {
  role_profile_versions: {
    module: 'M01', label: 'Role profile versions for now, 2030 and 2035 (planning assumptions; FS05)',
    cols: {
      id: 'text pk', role_id: 'text ref:job_roles idx', horizon: 'text enum:now|2030|2035 idx', version: 'int =1',
      status: 'text enum:draft|published|superseded =\'draft\' idx', is_public: 'bool =false', path_only: 'bool =false',
      requirements: 'json =[]', drivers: 'text[] =[]', rationale_en: 'text', rationale_ar: 'text', sources: 'json =[]', as_of: 'date',
      supersedes_id: 'text?', superseded_by_id: 'text?', created_by: 'text?', created_at: 'ts =now', updated_at: 'ts =now',
      published_by: 'text?', published_at: 'ts?',
    },
    read: [{ res: 'public_content', where: 'is_public' }, { res: 'audit_log' }, { res: 'sat' }],
    write: { mode: 'rpc', res: 'frameworks' },
  },
};
