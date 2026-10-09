// M20 tables (owners: W1 · F08 Opportunity Marketplace; W2 · F15 Rotations and shadowing). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
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

  // ───────────── F15 Rotations and job shadowing (W2 · E4). Same read pattern as F08: `listed` opens catalogue rows to staff R;
  // `open_read` (always false) keeps placements and shadow requests private to the people named on the row (Own), plus admins and
  // auditors (R on audit_log). HR sees the programme board only (rpc.rotationBoard, suppressed below MIN_GROUP_SIZE).
  rotation_templates: {
    module: 'M20', label: 'Rotation programme templates: placement sequence, durations, host role cards and skill objectives (F15)',
    cols: {
      id: 'text pk', programme: 'text enum:gdp|gpo|dnt|cross_functional|hipo idx', owner_id: 'text ref:people idx',
      title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', duration_min_months: 'int', duration_max_months: 'int',
      steps: 'json =[]', eligible_families: 'text[] =[]', sources: 'json =[]',
      status: 'text enum:draft|active|retired =\'active\' idx', listed: 'bool =true', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'opportunities', person: 'owner_id', where: 'listed' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'opportunities' },
  },
  rotation_cohorts: {
    module: 'M20', label: 'Rotation cohorts (GDP, GPO, DNT and cross-functional intakes; synthetic) (F15)',
    cols: {
      id: 'text pk', template_id: 'text ref:rotation_templates idx', programme: 'text enum:gdp|gpo|dnt|cross_functional|hipo', owner_id: 'text ref:people idx',
      name_en: 'text', name_ar: 'text', intake_on: 'date', status: 'text enum:planned|running|completed =\'running\'', listed: 'bool =true', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'opportunities', person: 'owner_id', where: 'listed' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'opportunities' },
  },
  rotation_placements: {
    module: 'M20', label: 'Placement plan per person: host, dates, objectives, mid-point check-in and host sign-off writing ojt evidence (F15)',
    cols: {
      id: 'text pk', enrolment_id: 'text idx', person_id: 'text ref:people idx', template_id: 'text ref:rotation_templates idx', cohort_id: 'text? ref:rotation_cohorts idx', seq: 'int',
      family_id: 'text ref:job_families', host_team_en: 'text', host_team_ar: 'text', host_role_id: 'text? ref:job_roles', host_manager_id: 'text ref:people idx', host_name: 'text =\'\'', host_name_ar: 'text =\'\'',
      line_manager_id: 'text? ref:people idx', signer_id: 'text? ref:people idx', skip_level: 'bool =false', starts_on: 'date', ends_on: 'date', site_induction: 'bool =false',
      objectives: 'json =[]', status: 'text enum:planned|active|signed_off|cancelled =\'planned\' idx',
      checkin: 'json?', checkin_at: 'ts?', checkin_by: 'text?', signed_off_by: 'text?', signed_off_at: 'ts?', outcome_note: 'text?', outcome_levels: 'json ={}', evidence_ids: 'text[] =[]',
      enrolled_by: 'text? ref:people idx', person_name: 'text =\'\'', person_name_ar: 'text =\'\'', person_role_id: 'text?', person_family_id: 'text?',
      open_read: 'bool =false', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [
      { res: 'opportunities', person: 'person_id', where: 'open_read' },
      { res: 'opportunities', person: 'host_manager_id', where: 'open_read' },
      { res: 'opportunities', person: 'signer_id', where: 'open_read' },
      { res: 'opportunities', person: 'line_manager_id', where: 'open_read' },
      { res: 'opportunities', person: 'enrolled_by', where: 'open_read' },
      { res: 'audit_log' },
    ],
    write: { mode: 'rpc', res: 'opportunities' },
  },
  shadow_hosts: {
    module: 'M20', label: 'Shadowing host directory: staff who offer 1 to 5 day shadowing on named skills (opt-in) (F15)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', name: 'text', name_ar: 'text', role_id: 'text? ref:job_roles', family_id: 'text? ref:job_families',
      skill_ids: 'text[] =[]', max_days_month: 'int =2', note_en: 'text?', note_ar: 'text?', site_induction: 'bool =false', active: 'bool =true', listed: 'bool =true', updated_at: 'ts =now',
    },
    read: [{ res: 'opportunities', person: 'person_id', where: 'listed' }],
    write: { mode: 'rpc', res: 'opportunities' },
  },
  shadow_requests: {
    module: 'M20', label: 'Job-shadowing requests (1 to 5 days) with host and line-manager consent; completion writes ojt evidence (F15)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', host_id: 'text ref:people idx', line_manager_id: 'text? ref:people idx', host_family_id: 'text?', host_role_id: 'text?',
      start_on: 'date', days: 'int', skill_ids: 'text[] =[]', purpose: 'text', status: 'text enum:requested|approved|declined|withdrawn|completed =\'requested\' idx',
      host_consent: 'bool?', manager_consent: 'bool?', host_note: 'text?', manager_note: 'text?', site_induction: 'bool =false',
      person_name: 'text =\'\'', person_name_ar: 'text =\'\'', person_role_id: 'text?', person_family_id: 'text?', host_name: 'text =\'\'', host_name_ar: 'text =\'\'',
      reflection: 'text?', completed_at: 'ts?', evidence_ids: 'text[] =[]', history: 'json =[]', open_read: 'bool =false', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [
      { res: 'opportunities', person: 'person_id', where: 'open_read' },
      { res: 'opportunities', person: 'host_id', where: 'open_read' },
      { res: 'opportunities', person: 'line_manager_id', where: 'open_read' },
      { res: 'audit_log' },
    ],
    write: { mode: 'rpc', res: 'opportunities' },
  },
};
