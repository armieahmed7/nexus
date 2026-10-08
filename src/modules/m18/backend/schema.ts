// M18 tables (owner: W1 engineer 2, F05 Career Navigator and F06 Career Roadmap). Merged into SCHEMA by src/data/schema.ts;
// `npm run gen` regenerates types, SQL and RLS. Same DSL as src/data/schema.ts. Keep this file import-free except `import type`.
// Both tables are the person's own (direct writes on rows where person_id = me). A line manager (skills_profile Scope) reads a
// row only when the person shares it: shared_person_id is set to person_id while shared (the SQL trigger
// kafaa_career_share_sync keeps it in step), so the Scope rule matches nothing for unshared rows.
import type { TableDef } from '../../../data/schema';

export const TABLES_M18: Record<string, TableDef> = {
  career_targets: {
    module: 'M18', label: 'Career Navigator shortlist: up to three target roles per person, optionally shared with the line manager (F05)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', role_id: 'text ref:job_roles', rank: 'int =1', shared: 'bool =false', shared_person_id: 'text? idx',
      active: 'bool =true', note: 'text?', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'skills_profile', person: 'shared_person_id', where: 'shared' }],
    write: { mode: 'direct', res: 'own_profile', own: true },
  },
  roadmaps: {
    module: 'M18', label: 'Career roadmap scenario towards a target role, with its computed timeline (F06)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', target_role_id: 'text ref:job_roles', name: 'text =\'\'', scenario: 'json ={}', plan: 'json =[]',
      earliest_on: 'date?', end_on: 'date?', shared: 'bool =false', shared_person_id: 'text? idx', active: 'bool =true',
      sent_plan_id: 'text?', sent_at: 'ts?', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'skills_profile', person: 'shared_person_id', where: 'shared' }],
    write: { mode: 'direct', res: 'own_profile', own: true },
  },
};
