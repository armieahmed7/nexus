// M32 tables (owners: wave E E2 (FS41, FS42, FS43)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
// M32 has no policy resource of its own (handover 3.7): public framework rows read through skills_taxonomy R (every role, incl. anonymous);
// the FS42/FS43 staff explainers and tracks through internal_content R (staff, like the M19 pathways they point at). Nothing is written
// through the API: reference rows only (write mode none); my progress is computed by RPC from F01 person skill states.
import type { TableDef } from '../../../data/schema';

const PUBLIC = [{ res: 'skills_taxonomy' }];
const STAFF = [{ res: 'internal_content' }];

export const TABLES_M32: Record<string, TableDef> = {
  // ───────────── FS41 CleanEnergyComp (wave E · E2)
  cec_competences: {
    module: 'M32', label: 'CleanEnergyComp competence (12 in four GreenComp-method areas): EN/AR description, nuclear angle, learning outcomes, the FS02 skills that evidence it, learning items, the Jahiz New Economy group and Net Zero 2050 tag, sources (FS41)',
    cols: {
      id: 'text pk', code: 'text uniq', area: 'text enum:values|complexity|futures|acting idx', name_en: 'text', name_ar: 'text', summary_en: 'text', summary_ar: 'text',
      plant_en: 'text', plant_ar: 'text', outcomes: 'json =[]', greencomp_area: 'text', skill_ids: 'text[] =[]', learning: 'json =[]',
      jahiz_group: 'text =\'new_economy\'', net_zero: 'bool =true', benchmark_ids: 'text[] =[]', sources: 'json =[]',
      status: 'text enum:active|retired =\'active\'', version: 'int =1', as_of: 'date', sort: 'int =0',
    },
    read: PUBLIC,
    write: { mode: 'none' },
  },
  cec_role_targets: {
    module: 'M32', label: 'CleanEnergyComp target level (1 Aware, 2 Practitioner, 3 Advocate) for each job family, with its focus competences and the reason (FS41)',
    cols: {
      id: 'text pk', family_id: 'text ref:job_families idx', level: 'int', focus_ids: 'text[] =[]', rationale_en: 'text', rationale_ar: 'text',
    },
    read: PUBLIC,
    write: { mode: 'none' },
  },
  // ───────────── FS42 Energy-system integration (wave E · E2)
  value_chains: {
    module: 'M32', label: 'Energy-system value chain explainer (hydrogen, process heat, grid): stages with the role nuclear could play, sourced facts with as-of dates, skills, horizon lanes, pathways; concept only, no ENEC project claims (FS42)',
    cols: {
      id: 'text pk', code: 'text uniq', name_en: 'text', name_ar: 'text', summary_en: 'text', summary_ar: 'text', stages: 'json =[]', facts: 'json =[]',
      skill_ids: 'text[] =[]', lane_ids: 'text[] =[]', pathway_ids: 'text[] =[]', cec_ids: 'text[] =[]', benchmark_ids: 'text[] =[]', sources: 'json =[]',
      status: 'text enum:active|retired =\'active\'', as_of: 'date', sort: 'int =0',
    },
    read: STAFF,
    write: { mode: 'none' },
  },
  // ───────────── FS42 / FS43 tracks over M19 pathways (wave E · E2)
  transition_tracks: {
    module: 'M32', label: 'Energy-transition learning track: the FS17 pathway it runs on (M19 rows), audience, the matching micro-credential, the hour cap (FS43: under 10 hours), value chains and sources (FS42, FS43)',
    cols: {
      id: 'text pk', feature: 'text enum:FS42|FS43', pathway_id: 'text ref:pathways idx', credential_code: 'text?', max_hours: 'num?',
      audience_en: 'text', audience_ar: 'text', summary_en: 'text', summary_ar: 'text', chain_ids: 'text[] =[]', benchmark_ids: 'text[] =[]', sources: 'json =[]', sort: 'int =0',
    },
    read: STAFF,
    write: { mode: 'none' },
  },
};
