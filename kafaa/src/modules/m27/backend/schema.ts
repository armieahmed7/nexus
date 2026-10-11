// M27 tables (owner: W4 · E4, F30 Learning record store). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly).
//
// xapi_statements  minimal xAPI 2.0-shaped statement store (IEEE 9274.1.1-2023): actor = a Kafa'a person id (account, never an
//                  email/mbox), verb, object (course, scenario, task, refresher, opportunity ...), result, context, timestamp.
//                  Append-only: rows are written by the Kafa'a emitters (SQL triggers on the source tables, mirrored by the
//                  LocalBackend) and by rpc.storeStatement (admin test console); never updated or removed.
//                  Read: the person (lrs Own), instructors and managers in scope (lrs Scope), auditors (lrs R). Analytics (lrs Agg)
//                  get suppressed aggregates through rpc.lrsAggregate only.
import type { TableDef } from '../../../data/schema';

export const TABLES_M27: Record<string, TableDef> = {
  xapi_statements: {
    module: 'M27', label: 'xAPI statement (learning record store; append-only; actor by Kafa\'a account, no email) (F30)',
    cols: {
      id: 'text pk', actor_person_id: 'text ref:people idx',
      verb: 'text enum:completed|passed|failed|answered|attended|experienced|attempted|progressed idx',
      object_type: 'text enum:course|module|scenario|task|refresher|opportunity|rotation|shadowing|jpm|mentoring|knowledge_asset|activity idx',
      object_id: 'text idx', object_name: 'json ={}', result: 'json?', context: 'json ={}',
      occurred_at: 'ts idx', stored_at: 'ts =now',
      source: 'text enum:m04_course|f14_refresher|f08_opportunity|f15_rotation|f15_shadowing|m05_jpm|f13_mentoring|f21_knowledge|f28_simulator|f38_ojt|console idx',
      source_ref: 'text', stored_by: 'text?', version: 'text =\'2.0.0\'',
    },
    read: [{ res: 'lrs', person: 'actor_person_id' }],
    write: { mode: 'append' },
  },
};
