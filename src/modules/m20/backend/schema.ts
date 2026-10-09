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
  // ───────────── F23 Alumni and expert reserve (W3 · E4). Members read their own row; staff R reads a member only while they
  // opted into the expert finder (`finder_visible`, false once consent is withdrawn). Requests and engagements are private to
  // the people named on the row (`open_read` always false); the poster reads an engagement only after HR hands it over
  // (`poster_read_id`). Alumni see requests through rpc.reserveBoard (HR-approved requests only), HR through rpc.reserveDesk.
  // No contact data is stored anywhere (no email, phone or address column; free text with contact details is refused).
  alumni: {
    module: 'M20', label: 'Alumni and expert reserve: opt-in members (departed staff, ended partner secondments, pre-departure staff) with a frozen skill snapshot (F23)',
    cols: {
      id: 'text pk', person_id: 'text? ref:people idx', kind: 'text enum:alumni|partner_alumni|pre_departure idx', name: 'text', name_ar: 'text',
      former_role_id: 'text? ref:job_roles', former_family_id: 'text? ref:job_families idx', former_org: 'text? ref:organisations',
      departed_on: 'date?', departure_reason: 'text enum:retired|secondment_ended|moved_on|planned', departed_band: 'text enum:departing|lt_1y|y1_3|y3_5|gt_5y', years_service: 'int?',
      skill_snapshot: 'json =[]', snapshot_on: 'date',
      availability: 'text enum:open|limited|outage_only|paused =\'open\'', hours_month: 'int =8', engagement_prefs: 'text[] =[]',
      finder_optin: 'bool =false', finder_visible: 'bool =false', headline_en: 'text?', headline_ar: 'text?',
      consent_on: 'date?', consent_version: 'text =\'1\'', status: 'text enum:active|withdrawn =\'active\' idx', withdrawn_on: 'date?', erase_after: 'date?',
      created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'opportunities', person: 'person_id', where: 'finder_visible' }],
    write: { mode: 'rpc', res: 'opportunities' },
  },
  reserve_requests: {
    module: 'M20', label: 'Reserve requests: short mentoring, capture-interview, instructor or reviewer help from the reserve; HR approves before alumni see them (F23)',
    cols: {
      id: 'text pk', posted_by: 'text ref:people idx', poster_name: 'text =\'\'', poster_name_ar: 'text =\'\'', family_id: 'text? ref:job_families idx', host_team_en: 'text', host_team_ar: 'text',
      engagement: 'text enum:mentor|capture_interview|instructor|reviewer idx', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text',
      skills_needed: 'text[] =[]', hours_total: 'int', seats: 'int =1', seats_taken: 'int =0', interest_count: 'int =0',
      location_type: 'text enum:remote|office|site_non_protected', start_on: 'date', end_on: 'date',
      status: 'text enum:pending_hr|open|filled|closed|declined =\'pending_hr\' idx', hr_by: 'text? ref:people', hr_at: 'ts?', hr_note: 'text?',
      open_read: 'bool =false', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'opportunities', person: 'posted_by', where: 'open_read' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'opportunities' },
  },
  reserve_engagements: {
    module: 'M20', label: 'Reserve engagements: interest or HR invitation, HR approval ("handed to HR"), completion. No contract, payment or contact data (F23)',
    cols: {
      id: 'text pk', request_id: 'text ref:reserve_requests idx', alumni_id: 'text ref:alumni idx', person_id: 'text? ref:people idx', poster_id: 'text ref:people idx', poster_read_id: 'text? ref:people idx',
      status: 'text enum:invited|interested|handed_to_hr|declined|withdrawn|completed =\'interested\' idx', engagement: 'text enum:mentor|capture_interview|instructor|reviewer',
      alumni_name: 'text =\'\'', alumni_name_ar: 'text =\'\'', note: 'text?', hr_by: 'text? ref:people', hr_at: 'ts?', hr_note: 'text?', outcome_note: 'text?', completed_at: 'ts?',
      history: 'json =[]', open_read: 'bool =false', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [
      { res: 'opportunities', person: 'person_id', where: 'open_read' },
      { res: 'opportunities', person: 'poster_read_id', where: 'open_read' },
      { res: 'audit_log' },
    ],
    write: { mode: 'rpc', res: 'opportunities' },
  },
  alumni_stories: {
    module: 'M20', label: 'Alumni stories: consented, synthetic and labelled; hidden when the alumnus withdraws consent (F23)',
    cols: {
      id: 'text pk', alumni_id: 'text ref:alumni idx', engagement: 'text enum:mentor|capture_interview|instructor|reviewer', title_en: 'text', title_ar: 'text', body_en: 'text', body_ar: 'text',
      quote_en: 'text?', quote_ar: 'text?', author_en: 'text', author_ar: 'text', consent_on: 'date', published_on: 'date', synthetic: 'bool =true', listed: 'bool =true', sort: 'int =0',
    },
    read: [{ res: 'opportunities', where: 'listed' }],
    write: { mode: 'rpc', res: 'opportunities' },
  },
};
