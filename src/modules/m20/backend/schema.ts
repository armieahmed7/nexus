// M20 tables (owner: W1 · F08 Opportunity Marketplace). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly).
//
// Read rules: every staff role holds R on `opportunities`, and an R grant reads every row whose `where` column is true.
//  - opportunities: `listed` is false for drafts, so drafts are visible only to their poster (Own on posted_by).
//  - applications and saves: `open_read` is always false, so staff R never reads other people's applications; the applicant,
//    the poster, the applicant's line manager and the person who must release them read a row through their own id (Own).
//    Platform admins and auditors (R on audit_log) read every application (the card's "auditor R"). HR sees aggregates only,
//    through rpc.opportunityStats (suppressed below MIN_GROUP_SIZE).
import type { TableDef } from '../../../data/schema';

export const TABLES_M20: Record<string, TableDef> = {
  opportunities: {
    module: 'M20', label: 'Opportunity marketplace: short stretch assignments posted by managers (F08)',
    cols: {
      id: 'text pk', posted_by: 'text ref:people idx', org_id: 'text? ref:organisations', family_id: 'text? ref:job_families idx', host_role_id: 'text? ref:job_roles', host_team: 'text?',
      kind: 'text enum:project|outage_support|shadowing|oe_review|knowledge_capture|outreach|research idx',
      title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text',
      skills_needed: 'text[] =[]', skills_gained: 'text[] =[]', hours_week: 'int', start_on: 'date', end_on: 'date', seats: 'int =1', seats_taken: 'int =0',
      location_type: 'text enum:office|site_non_protected|remote', eligible_families: 'text[] =[]', priority_flags: 'text[] =[]',
      status: 'text enum:draft|open|closed|filled =\'open\' idx', listed: 'bool =true',
      created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'opportunities', person: 'posted_by', where: 'listed' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'opportunities' },
  },
  opportunity_applications: {
    module: 'M20', label: 'Application to an opportunity: release by the line manager, selection, completion sign-off (F08)',
    cols: {
      id: 'text pk', opportunity_id: 'text ref:opportunities idx', person_id: 'text ref:people idx', note: 'text =\'\'',
      status: 'text enum:applied|released|declined_release|selected|not_selected|completed|withdrawn =\'applied\' idx',
      history: 'json =[]',
      // denormalised at apply time (readers may not be able to read the people rows)
      applicant_name: 'text =\'\'', applicant_name_ar: 'text =\'\'', applicant_role_id: 'text?', applicant_family_id: 'text?',
      poster_id: 'text ref:people idx', line_manager_id: 'text? ref:people idx', releaser_id: 'text? ref:people idx', skip_level: 'bool =false',
      released_by: 'text?', released_at: 'ts?', decided_by: 'text?', decided_at: 'ts?', completed_at: 'ts?',
      outcome_note: 'text?', outcome_levels: 'json ={}', evidence_ids: 'text[] =[]',
      open_read: 'bool =false', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [
      { res: 'opportunities', person: 'person_id', where: 'open_read' },
      { res: 'opportunities', person: 'poster_id', where: 'open_read' },
      { res: 'opportunities', person: 'releaser_id', where: 'open_read' },
      { res: 'opportunities', person: 'line_manager_id', where: 'open_read' },
      { res: 'audit_log' },
    ],
    write: { mode: 'rpc', res: 'opportunities' },
  },
  opportunity_saves: {
    module: 'M20', label: 'Saved (bookmarked) opportunities per person (F08)',
    cols: { id: 'text pk', person_id: 'text ref:people idx', opportunity_id: 'text ref:opportunities idx', saved: 'bool =true', open_read: 'bool =false', updated_at: 'ts =now' },
    read: [{ res: 'opportunities', person: 'person_id', where: 'open_read' }],
    write: { mode: 'rpc', res: 'opportunities' },
  },
};
