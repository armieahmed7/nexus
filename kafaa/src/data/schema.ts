/**
 * Kafa'a data model: ONE definition for every kafaa_* table (spec Section 10 + module data lists).
 *
 * Generated from this file (npm run gen):
 *   - supabase/migrations/0001_kafaa_schema.sql   tables, constraints, indexes
 *   - supabase/migrations/0003_kafaa_rls.sql       RLS policies (via the access rules below + src/auth/policy.ts)
 *   - src/data/types.gen.ts                        TypeScript row types
 * The LocalBackend evaluates the same `read` / `write` rules in the browser (src/data/access.ts).
 *
 * Column mini-language:  "<type>[?] [pk] [ref:<table>] [enum:a|b|c] [=<default>] [uniq] [idx]"
 *   types: text int num bool date ts json text[]       ? = nullable       =now / =true / =0 / =[] / ={} / ='x'
 *
 * Read rules (any rule may grant a row):
 *   { res, person?, org?, where?, special? }
 *   - grant R/W/A on res -> all rows (filtered by `where` boolean column when given)
 *   - Own   -> row[person] = me          - Scope  -> row[person] = me or in my scope
 *   - OwnOrg/OrgW -> row[org] = my org   - Agg    -> only with special 'agg_ok' (row is already aggregate)
 *                                                  or 'agg_suppressed' (row.group_size >= MIN_GROUP_SIZE)
 *   special 'university_consent': University 'Scope' sees rows where university_org_id = my org and consent_university
 *   special 'observer_org': observers see released reports whose released_to_org_ids contains my org
 * Write rules:
 *   mode 'rpc'    -> no direct writes; only SECURITY DEFINER kafaa_* RPCs (consequential actions)
 *   mode 'direct' -> insert/update when caller has W/A on res; `own` lets Own holders write rows where row[person]=me;
 *                    `orgw` lets OrgW holders write rows where row[org]=my org; `anonInsert` lets anyone insert
 *   mode 'append' -> insert only through kafaa_audit()/RPCs; update and delete always refused (append-only)
 *   mode 'none'   -> read-only reference data (seeded; admins change it through RPCs or migrations)
 * This file must stay import-free (node scripts import it directly). Exception (F01): the M17-M27 table blocks are merged in
 * from src/data/ext/schema.ts, which only imports the modules' own backend/schema.ts files (with explicit .ts extensions).
 */
import { EXT_TABLES } from './ext/schema.ts';

export type ReadRule = {
  res: string;
  person?: string;
  org?: string;
  where?: string;
  special?: 'agg_ok' | 'agg_suppressed' | 'university_consent' | 'observer_org';
};
export type WriteRule = { mode: 'rpc' | 'direct' | 'append' | 'none'; res?: string; own?: boolean; orgw?: boolean; anonInsert?: boolean; del?: boolean };
export type TableDef = {
  module: string; // owning module (M01..M16) - see CONTRACT.md ownership table
  label: string;
  cols: Record<string, string>;
  read: ReadRule[];
  write: WriteRule;
  localOnly?: boolean;
};

const PUB: ReadRule[] = [{ res: 'public_content' }];
const T = (s: string) => s;

export const SCHEMA: Record<string, TableDef> = {
  // ───────────────────────────── Identity and governance (M14, M16)
  organisations: {
    module: 'M09', label: 'Organisations: ENEC entities, partners, suppliers, universities, regulators',
    cols: {
      id: 'text pk', name_en: 'text', name_ar: 'text', short: 'text?',
      kind: 'text enum:group_entity|shareholder|supplier|partner|university|international|regulator|government|finance|offtaker|emergency|research|observer_org idx',
      category: 'text enum:ownership|design_build|om_support|fuel|advanced_rd|international_operators|local_supply_offtake|finance|education_workforce|technology_government|emergency_response|oversight|synthetic idx',
      categories: 'text[] =[]', rel_types: 'text[] =[]',
      relationship_en: 'text =\'\'', relationship_ar: 'text =\'\'',
      status: 'text enum:active|historic|exploratory =\'active\'', dates: 'text =\'\'', country: 'text?',
      binding: 'bool?', public_listed: 'bool =false idx', synthetic: 'bool =false', nexus_org_id: 'text?', icv_score: 'num?',
      sources: 'json =[]', contact_route: 'text?',
    },
    // [G4] + equivalency: ENEC evaluators (and auditors) see which contractor organisation an equivalency request comes from
    read: [{ res: 'public_content', where: 'public_listed' }, { res: 'partner_org', org: 'id' }, { res: 'equivalency' }],
    write: { mode: 'rpc', res: 'partner_org' },
  },
  agreements: {
    module: 'M09', label: 'Agreements (contract, JV, MoU, LoI ...) with public sources',
    cols: {
      id: 'text pk', org_id: 'text ref:organisations idx',
      type: 'text enum:contract|jv|mou|loi|framework|agreement|loan|membership|provider|shareholder|partnership|regulator|exercise|historic|proposal|supply|sca',
      title_en: 'text', title_ar: 'text', binding: 'bool =false', signed: 'text =\'\'', status: 'text enum:active|historic|exploratory =\'active\'', sources: 'json =[]',
    },
    read: PUB, write: { mode: 'none' },
  },
  people: {
    module: 'M14', label: 'Person: minimal profile (synthetic demo tenant)',
    cols: {
      id: 'text pk', persona_id: 'text? uniq', display_name: 'text', display_name_ar: 'text =\'\'', initials: 'text =\'\'',
      kind: 'text enum:staff|contractor|applicant|partner|observer|external idx', entity_id: 'text? ref:organisations', org_id: 'text? ref:organisations idx',
      job_role_id: 'text? ref:job_roles', job_family_id: 'text? ref:job_families idx', team_id: 'text? idx', crew: 'text?', unit: 'text?',
      level: 'text? enum:entry|professional|senior|leadership', nationality_flag: 'text enum:uae|other|unknown =\'unknown\'', gender: 'text? enum:f|m',
      language: 'text enum:en|ar =\'en\'', digits: 'text enum:latn|arab =\'latn\'', hire_date: 'date?', status: 'text enum:active|leaver|candidate =\'active\'',
      manager_id: 'text? ref:people', synthetic: 'bool =true', notes: 'text?',
    },
    read: [{ res: 'own_profile', person: 'id' }, { res: 'qual_records', person: 'id' }, { res: 'licence', person: 'id' }, { res: 'dev_plans', person: 'id' }, { res: 'users_roles', org: 'org_id' }],
    write: { mode: 'direct', res: 'users_roles', own: true, orgw: true },
  },
  role_assignments: {
    module: 'M14', label: 'Role assignment: platform role + scope per person',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', role: 'text idx', org_id: 'text? ref:organisations',
      scope_type: 'text enum:all|entity|family|team|crew|org|self =\'self\'', scope_value: 'text?',
      granted_by: 'text?', granted_at: 'ts =now', expires_at: 'date?', status: 'text enum:active|pending_second|revoked =\'active\'', second_approver: 'text?',
      // G5 (M14): quarterly access reviews for elevated roles (rpc.reviewRoleAccess)
      reviewed_at: 'ts?', reviewed_by: 'text?', review_note: 'text?',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'users_roles', org: 'org_id' }],
    write: { mode: 'rpc', res: 'users_roles' },
  },
  consents: {
    module: 'M14', label: 'Consent with purpose and withdrawal',
    cols: { id: 'text pk', person_id: 'text ref:people idx', type: 'text', purpose: 'text', version: 'text =\'1\'', granted_at: 'ts =now', withdrawn_at: 'ts?' },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'audit_log' }],
    write: { mode: 'direct', res: 'own_profile', own: true },
  },
  audit_events: {
    module: 'M16', label: 'Append-only, hash-chained audit log',
    cols: {
      id: 'text pk', seq: 'int uniq', ts: 'ts =now', actor_person_id: 'text?', actor_role: 'text?', action: 'text idx',
      entity_table: 'text?', entity_id: 'text?', outcome: 'text enum:ok|refused|error =\'ok\'', reason: 'text?',
      before_hash: 'text?', after_hash: 'text?', request_id: 'text?', prev_hash: 'text', hash: 'text',
      ledger_status: 'text enum:written|skipped|not_applicable =\'not_applicable\'', ledger_seq: 'int?',
    },
    read: [{ res: 'audit_log' }],
    write: { mode: 'append' },
  },
  notifications: {
    module: 'M14', label: 'Notices: expiries, assignments, applications',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', kind: 'text', title_en: 'text', title_ar: 'text', body_en: 'text?', body_ar: 'text?',
      link: 'text?', severity: 'text enum:info|ok|warn|bad =\'info\'', created_at: 'ts =now', read_at: 'ts?',
    },
    read: [{ res: 'notifications', person: 'person_id' }],
    write: { mode: 'direct', res: 'notifications', own: true },
  },
  user_settings: {
    module: 'M14', label: 'Language, digits, calendar, notification preferences',
    cols: {
      id: 'text pk', person_id: 'text ref:people uniq', language: 'text enum:en|ar =\'en\'', digits: 'text enum:latn|arab =\'latn\'',
      calendar: 'text enum:gregorian|hijri =\'gregorian\'', notify_inapp: 'bool =true', notify_email: 'bool =false', theme: 'text enum:light|dark|system =\'light\'',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'direct', res: 'own_profile', own: true },
  },
  data_requests: {
    module: 'M14', label: 'Data subject requests (view, export, correction)',
    cols: { id: 'text pk', person_id: 'text ref:people idx', kind: 'text enum:view|export|correction|deletion', status: 'text enum:open|in_progress|closed =\'open\'', note: 'text?', created_at: 'ts =now' },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'users_roles' }],
    write: { mode: 'direct', res: 'own_profile', own: true },
  },
  contact_requests: {
    module: 'M12', label: 'Contact form submissions with routing',
    cols: {
      id: 'text pk', topic: 'text enum:careers|programmes|suppliers|universities|media|accessibility|other', route_to: 'text',
      name: 'text?', email: 'text?', message: 'text', created_at: 'ts =now', status: 'text enum:new|routed|closed =\'new\'',
      // G5 (M12): language of the request, stated-purpose consent and retention
      lang: 'text enum:en|ar =\'en\'', consent_contact: 'bool =false', retention_until: 'date?',
    },
    read: [{ res: 'users_roles' }],
    write: { mode: 'direct', res: 'users_roles', anonInsert: true },
  },

  // ───────────────────────────── Roles and competencies (M01, M02)
  sources: {
    module: 'M16', label: 'Citation registry: every public fact cites one of these',
    cols: { id: 'text pk', label: 'text', url: 'text', publisher: 'text =\'\'', accessed: 'date?', note: 'text?' },
    read: PUB, write: { mode: 'direct', res: 'public_content' },
  },
  job_families: {
    module: 'M01', label: 'Job family (20)',
    cols: {
      id: 'text pk', name_en: 'text', name_ar: 'text', description_en: 'text', description_ar: 'text', sort: 'int =0',
      grp: 'text enum:operations|maintenance_engineering|rp_chem_env|safety_quality_oversight|ep_security_safeguards|training_supply_corporate',
    },
    read: [{ res: 'frameworks' }, ...PUB], write: { mode: 'direct', res: 'frameworks' },
  },
  job_roles: {
    module: 'M01', label: 'Role (28 seed roles) with EN/AR, regulated flag, basis and sources',
    cols: {
      id: 'text pk', family_id: 'text ref:job_families idx', title_en: 'text', title_ar: 'text', function_en: 'text =\'\'', function_ar: 'text =\'\'',
      level: 'text enum:entry|professional|senior|leadership', regulated: 'bool =false', regulation_ref: 'text?', regulation_url: 'text?',
      basis: 'text enum:barakah|generic|uncertain', basis_note: 'text?',
      summary_en: 'text', summary_ar: 'text', qualifications_en: 'text', qualifications_ar: 'text', training_path_en: 'text', training_path_ar: 'text',
      licensing_body_en: 'text', licensing_body_ar: 'text', entry_routes: 'json =[]',
      education: 'text enum:high_school|diploma|bachelor|master', entry_level: 'bool =false', emiratization_reserved: 'bool =false', critical: 'bool =false',
      security_sensitive: 'bool =false', sources: 'json =[]', status: 'text enum:published|draft =\'published\'', version: 'int =1', sort: 'int =0',
      // FS05 (fsAe4): current roles and concept future roles (concept = no vacancy, no deployment decision; profile in role_profile_versions)
      lifecycle: 'text enum:current|concept =\'current\' idx',
    },
    read: [{ res: 'frameworks' }, ...PUB], write: { mode: 'direct', res: 'frameworks' },
  },
  role_responsibilities: {
    module: 'M01', label: 'Role responsibilities',
    cols: { id: 'text pk', role_id: 'text ref:job_roles idx', text_en: 'text', text_ar: 'text', sort: 'int =0' },
    read: [{ res: 'frameworks' }, ...PUB], write: { mode: 'direct', res: 'frameworks' },
  },
  proficiency_levels: {
    module: 'M02', label: 'Proficiency levels (Awareness, Practitioner, Qualified, Expert)',
    cols: { id: 'text pk', level: 'int uniq', name_en: 'text', name_ar: 'text', description_en: 'text', description_ar: 'text' },
    read: [{ res: 'frameworks' }, ...PUB], write: { mode: 'direct', res: 'frameworks' },
  },
  competencies: {
    module: 'M02', label: 'Competency with level descriptors',
    cols: {
      id: 'text pk', code: 'text uniq', domain: 'text idx', domain_en: 'text', domain_ar: 'text', name_en: 'text', name_ar: 'text',
      description_en: 'text', description_ar: 'text', levels: 'json =[]',
    },
    read: [{ res: 'frameworks' }, ...PUB], write: { mode: 'direct', res: 'frameworks' },
  },
  role_competencies: {
    module: 'M02', label: 'Role requires competency at level',
    cols: { id: 'text pk', role_id: 'text ref:job_roles idx', competency_id: 'text ref:competencies idx', required_level: 'int', importance: 'text enum:core|important|useful =\'core\'' },
    read: [{ res: 'frameworks' }, ...PUB], write: { mode: 'direct', res: 'frameworks' },
  },
  career_paths: {
    module: 'M01', label: 'Progression edge with structured conditions and rule reference',
    cols: {
      id: 'text pk', from_role_id: 'text? ref:job_roles idx', to_role_id: 'text ref:job_roles idx', from_label_en: 'text?', from_label_ar: 'text?',
      type: 'text enum:entry|vertical|lateral|cross_functional', route_code: 'text?', label_en: 'text =\'\'', label_ar: 'text =\'\'',
      conditions: 'json =[]', rule_ref: 'text?', basis: 'text enum:barakah|generic|uncertain =\'barakah\'', sort: 'int =0',
      // FS05 (fsAe4): 'future' edges lead from a current role to a concept future role (planning assumption only)
      kind: 'text enum:current|future =\'current\' idx',
    },
    read: [{ res: 'frameworks' }, ...PUB], write: { mode: 'direct', res: 'frameworks' },
  },

  // ───────────────────────────── Qualification (M02)
  qual_standards: {
    module: 'M02', label: 'Qualification standard (versioned qualification card)',
    cols: {
      id: 'text pk', code: 'text idx', title_en: 'text', title_ar: 'text', role_ids: 'text[] =[]', discipline: 'text',
      version: 'int =1', status: 'text enum:current|superseded|draft =\'current\'', owner_role: 'text', requal_months: 'int?',
      effective_date: 'date', supersedes_id: 'text?', change_reason: 'text?', security_restricted: 'bool =false',
    },
    read: [{ res: 'frameworks' }], write: { mode: 'rpc', res: 'frameworks' },
  },
  task_items: {
    module: 'M02', label: 'Task list item on a qualification standard',
    cols: {
      id: 'text pk', standard_id: 'text ref:qual_standards idx', code: 'text', statement_en: 'text', statement_ar: 'text',
      conditions_en: 'text =\'\'', standards_en: 'text =\'\'', method: 'text enum:ojt|jpm|simulator|classroom|written|equivalency',
      evaluator_role: 'text', critical: 'bool =false', sort: 'int =0',
    },
    read: [{ res: 'frameworks' }], write: { mode: 'direct', res: 'frameworks' },
  },
  jpms: {
    module: 'M05', label: 'Job performance measure with critical steps',
    cols: {
      id: 'text pk', task_id: 'text? ref:task_items', standard_id: 'text ref:qual_standards idx', code: 'text', title_en: 'text', title_ar: 'text',
      critical_steps: 'json =[]', pass_criteria_en: 'text', pass_criteria_ar: 'text', time_limit_min: 'int =30',
    },
    read: [{ res: 'frameworks' }], write: { mode: 'direct', res: 'frameworks' },
  },
  evaluator_quals: {
    module: 'M02', label: 'Who may evaluate which standard',
    cols: { id: 'text pk', person_id: 'text ref:people idx', standard_id: 'text ref:qual_standards idx', valid_to: 'date' },
    read: [{ res: 'qual_records', person: 'person_id' }, { res: 'signoff' }], write: { mode: 'rpc', res: 'frameworks' },
  },
  qual_records: {
    module: 'M02', label: 'Qualification record (mirror of the training records system)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', standard_id: 'text ref:qual_standards idx', standard_version: 'int =1',
      status: 'text enum:planned|in_progress|qualified|due|expired|suspended|renewed idx', qualified_on: 'date?', expires_on: 'date? idx',
      source_system: 'text =\'Training records system\'', last_synced: 'ts =now', mirror: 'bool =true', needs_review: 'bool =false', review_reason: 'text?',
      security_mirror_only: 'bool =false',
    },
    read: [{ res: 'qual_records', person: 'person_id' }], write: { mode: 'rpc', res: 'qual_records' },
  },
  evaluations: {
    module: 'M02', label: 'Evaluation (append-only; corrections create a new entry)',
    cols: {
      id: 'text pk', record_id: 'text ref:qual_records idx', task_id: 'text? ref:task_items', person_id: 'text ref:people idx',
      method: 'text enum:ojt|jpm|simulator|classroom|written|equivalency', evaluator_person_id: 'text? ref:people', evaluator_role: 'text',
      result: 'text enum:pass|fail|pending', date: 'date', critical_failed: 'bool =false', supervisor_ack_by: 'text?', supervisor_ack_at: 'ts?',
      correction_of: 'text?', correction_reason: 'text?', created_at: 'ts =now',
    },
    read: [{ res: 'qual_records', person: 'person_id' }], write: { mode: 'append', res: 'signoff' },
  },
  // [G1] Supervisor acknowledgement of an evaluation (trainee -> evaluator -> supervisor). Evaluations are append-only,
  // so the acknowledgement is its own append-only row written by rpc.ackEvaluation.
  evaluation_acks: {
    module: 'M02', label: 'Supervisor acknowledgement of an evaluation (append-only)',
    cols: {
      id: 'text pk', evaluation_id: 'text ref:evaluations idx', record_id: 'text ref:qual_records idx', person_id: 'text ref:people idx',
      ack_by_person_id: 'text ref:people', ack_role: 'text', note: 'text?', created_at: 'ts =now',
    },
    read: [{ res: 'qual_records', person: 'person_id' }], write: { mode: 'append', res: 'signoff' },
  },
  requal_rules: {
    module: 'M02', label: 'Requalification rule and notice intervals',
    cols: { id: 'text pk', standard_id: 'text ref:qual_standards idx', interval_months: 'int', notice_days: 'json =[90,60,30]', description_en: 'text', description_ar: 'text' },
    read: [{ res: 'frameworks' }], write: { mode: 'direct', res: 'frameworks' },
  },

  // ───────────────────────────── Licensing tracker (M03) - mirror, never authority
  licences: {
    module: 'M03', label: 'Licence mirror (RO/SRO), as recorded in the licensee system',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', type: 'text enum:RO|SRO|SRO_QI', facility: 'text =\'Barakah Units 1-4\'', cert_no: 'text',
      issued_on: 'date', expires_on: 'date', status: 'text enum:valid|lapsed|suspended|withdrawn|pending idx', route: 'text?',
      lapsed_on: 'date?', source_system: 'text =\'Licensee certification records (OCTS mirror)\'', last_synced: 'ts =now',
    },
    read: [{ res: 'licence', person: 'person_id' }], write: { mode: 'rpc', res: 'licence' },
  },
  medical_due: {
    module: 'M03', label: 'Medical due date and flag only (no medical content)',
    cols: { id: 'text pk', person_id: 'text ref:people uniq', due_on: 'date', flag: 'text enum:fit|not_confirmed', source_system: 'text =\'Occupational health system (flag only)\'', last_synced: 'ts =now' },
    read: [{ res: 'medical_flag', person: 'person_id' }], write: { mode: 'rpc', res: 'licence' },
  },
  shift_proficiency: {
    module: 'M03', label: 'Quarterly shift counts from the roster feed (counts only)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', quarter: 'text idx', shifts_8h: 'int =0', shifts_12h: 'int =0', sro_role_shifts: 'int =0',
      scheduled_remaining_8h: 'int =0', scheduled_remaining_12h: 'int =0', scheduled_remaining_sro: 'int =0',
      source_system: 'text =\'Shift roster feed (counts only)\'', last_synced: 'ts =now',
    },
    read: [{ res: 'licence', person: 'person_id' }], write: { mode: 'rpc', res: 'licence' },
  },
  exam_milestones: {
    module: 'M03', label: 'Exam milestones (internal and FANR)',
    cols: {
      id: 'text pk', person_id: 'text? ref:people idx', programme_id: 'text? ref:licence_programmes', kind: 'text enum:internal_written|internal_operating|fanr_notice|fanr_written|fanr_operating|result',
      due_on: 'date', status: 'text enum:planned|done|missed =\'planned\'', note_en: 'text?', note_ar: 'text?',
    },
    read: [{ res: 'licence', person: 'person_id' }], write: { mode: 'direct', res: 'licence' },
  },
  requal_cycles: {
    module: 'M03', label: 'Biennial requalification window and COCT attendance',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', window_start: 'date', window_end: 'date', coct_hours_done: 'int =0', coct_hours_required: 'int =0',
      exam_status: 'text enum:not_scheduled|scheduled|passed|failed =\'not_scheduled\'',
    },
    read: [{ res: 'licence', person: 'person_id' }], write: { mode: 'direct', res: 'licence' },
  },
  licence_programmes: {
    module: 'M03', label: 'Licensing programme (COIT class, SRO upgrade) with candidate list deadline',
    cols: {
      id: 'text pk', name_en: 'text', name_ar: 'text', kind: 'text enum:coit_ro|coit_sro|sro_upgrade|asip|requal', start_on: 'date', candidate_list_due: 'date',
      status: 'text enum:planning|candidates_listed|in_training|exams|closed =\'planning\'',
    },
    read: [{ res: 'licence' }, { res: 'internal_content' }], write: { mode: 'direct', res: 'licence' },
  },
  licence_candidates: {
    module: 'M03', label: 'Candidate on a licensing programme with eligibility evidence status',
    cols: {
      id: 'text pk', programme_id: 'text ref:licence_programmes idx', person_id: 'text ref:people idx',
      route: 'text enum:ro_lo36|ro_other_plant|ro_fossil|sro_ro24|sro_bsc|sro_other_plant', evidence: 'json =[]',
      clearance: 'text enum:confirmed|pending =\'pending\'', status: 'text enum:proposed|eligible|evidence_open|withdrawn =\'proposed\'',
    },
    read: [{ res: 'licence', person: 'person_id' }], write: { mode: 'direct', res: 'licence' },
  },
  reporting_obligations: {
    module: 'M03', label: 'Licensee reporting obligations (drafts for a named role to send; Kafa\'a sends nothing to FANR)',
    cols: {
      id: 'text pk', kind: 'text enum:candidate_list|training_plan_report|lapse_report|withdrawal_notice|exam_notice', title_en: 'text', title_ar: 'text',
      due_on: 'date idx', status: 'text enum:open|drafted|sent_by_owner|closed =\'open\'', owner_role: 'text', person_id: 'text? ref:people', rule_ref: 'text',
    },
    read: [{ res: 'licence', person: 'person_id' }], write: { mode: 'direct', res: 'licence' },
  },
  licensing_tasks: {
    module: 'M03', label: 'Coordinator tasks with working-day clocks (lapse, medical overdue, renewal, proficiency risk)',
    cols: {
      id: 'text pk', kind: 'text enum:lapse_report|medical_overdue|renewal|exam_notice|proficiency_risk|withdrawal_risk', person_id: 'text? ref:people idx',
      created_at: 'ts =now', due_at: 'date', status: 'text enum:open|done|cancelled =\'open\'', title_en: 'text', title_ar: 'text', rule_ref: 'text?',
    },
    read: [{ res: 'licence', person: 'person_id' }], write: { mode: 'rpc', res: 'licence' },
  },

  // ───────────────────────────── Learning catalogue (M04)
  programmes: {
    module: 'M04', label: 'Training programme (initial, continuing, leadership, foundation...) with sourced duration',
    cols: {
      id: 'text pk', code: 'text', name_en: 'text', name_ar: 'text',
      area: 'text enum:all_staff|operations|disciplines|foundation|leadership|emergency|simulation|soft_skills|supplier',
      kind: 'text enum:initial|continuing|leadership|foundation|supplier|general', family_id: 'text? ref:job_families',
      duration_en: 'text =\'\'', duration_ar: 'text =\'\'', weeks: 'num?', hours: 'num?', population_2024: 'int?', population_note: 'text?',
      purpose_en: 'text', purpose_ar: 'text', sources: 'json =[]', conflict_note: 'text?', mandatory: 'bool =false', sort: 'int =0',
    },
    read: PUB, write: { mode: 'direct', res: 'training' },
  },
  courses: {
    module: 'M04', label: 'Course with objectives tied to competencies',
    cols: {
      id: 'text pk', programme_id: 'text? ref:programmes idx', code: 'text', title_en: 'text', title_ar: 'text',
      modality: 'text enum:classroom|ojt|simulator|elearning|drill|external|blended|clinic', initial: 'bool =true', mandatory: 'bool =false',
      audience: 'text enum:staff|contractor|supplier|public =\'staff\'', competency_ids: 'text[] =[]', objectives: 'json =[]', prerequisites: 'text[] =[]',
      duration_hours: 'num?', qualifying: 'bool =false', evaluation_form_id: 'text?', owner_role: 'text =\'Nuclear Training\'',
      public_summary: 'bool =false', summary_en: 'text =\'\'', summary_ar: 'text =\'\'', sources: 'json =[]', packaging: 'text? enum:scorm|xapi|none',
      pass_mark: 'num?', validity_months: 'int?', nexus_course_id: 'text?', concept_content: 'bool =false',
    },
    read: [{ res: 'public_content', where: 'public_summary' }, { res: 'internal_content' }, { res: 'training' }],
    write: { mode: 'direct', res: 'training' },
  },
  course_modules: {
    module: 'M04', label: 'Course module',
    cols: { id: 'text pk', course_id: 'text ref:courses idx', n: 'int', title_en: 'text', title_ar: 'text', minutes: 'int =60', public_summary: 'bool =false' },
    read: [{ res: 'public_content', where: 'public_summary' }, { res: 'internal_content' }, { res: 'training' }],
    write: { mode: 'direct', res: 'training' },
  },
  sessions: {
    module: 'M04', label: 'Scheduled session (class, simulator, drill)',
    cols: {
      id: 'text pk', course_id: 'text ref:courses idx', starts_at: 'ts idx', ends_at: 'ts', location: 'text', instructor_person_id: 'text? ref:people',
      capacity: 'int =12', kind: 'text enum:class|simulator|drill|elearning|clinic', crew: 'text?', priority: 'text enum:licence_critical|mandatory|elective =\'mandatory\'',
      audience: 'text enum:staff|contractor|supplier =\'staff\'', public_summary: 'bool =false',
      // G2 additions (2026-10-08): session lifecycle
      status: 'text enum:scheduled|completed|cancelled =\'scheduled\'',
    },
    read: [{ res: 'internal_content' }, { res: 'training' }, { res: 'public_content', where: 'public_summary' }],
    write: { mode: 'direct', res: 'training' },
  },
  simulator_slots: {
    module: 'M04', label: 'Full-scope simulator slot by crew with licence-critical priority',
    cols: {
      id: 'text pk', simulator: 'text', starts_at: 'ts idx', ends_at: 'ts', crew: 'text?', session_id: 'text? ref:sessions',
      booking_kind: 'text enum:coct|requal|initial|elective|maintenance|free', priority: 'int =3', status: 'text enum:booked|tentative|free|displaced =\'booked\'',
      booked_by: 'text?',
    },
    read: [{ res: 'internal_content' }, { res: 'training' }], write: { mode: 'rpc', res: 'training' },
  },
  enrolments: {
    module: 'M04', label: 'Enrolment (assigned or elective)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', course_id: 'text ref:courses idx', session_id: 'text? ref:sessions', org_id: 'text? ref:organisations idx',
      status: 'text enum:assigned|requested|approved|waitlisted|enrolled|in_progress|completed|failed|cancelled idx',
      source: 'text enum:role_rule|manager|self|partner_admin|coordinator', assigned_by: 'text?', due_on: 'date?', enrolled_at: 'ts =now',
      progress_pct: 'int =0', completed_at: 'ts?', score: 'num?', certificate_no: 'text?', evaluation_id: 'text?',
      // G2 additions (2026-10-08): attendance, waitlist order, approval trail
      attendance: 'text? enum:present|absent|excused', waitlisted_at: 'ts?', decided_by: 'text?', decision_note: 'text?',
    },
    read: [{ res: 'training', person: 'person_id', org: 'org_id' }],
    write: { mode: 'direct', res: 'training', own: true, orgw: true },
  },
  training_records: {
    module: 'M04', label: 'Completed training (transcript)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', course_id: 'text ref:courses', completed_on: 'date', hours: 'num =0',
      result: 'text enum:completed|passed|failed|attended', source_system: 'text =\'Training records system\'', evaluation_id: 'text?',
      enrolment_id: 'text?', // G2 addition
    },
    read: [{ res: 'training', person: 'person_id' }, { res: 'qual_records', person: 'person_id' }], write: { mode: 'rpc', res: 'training' },
  },
  curriculum_rules: {
    module: 'M04', label: 'Role-based mandatory assignment (curriculum per role)',
    cols: { id: 'text pk', role_id: 'text ref:job_roles idx', course_id: 'text ref:courses', mandatory: 'bool =true', due_within_days: 'int =90', note: 'text?' },
    read: [{ res: 'internal_content' }, { res: 'training' }], write: { mode: 'direct', res: 'training' },
  },
  external_requests: {
    module: 'M04', label: 'External course request with approval',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', title: 'text', provider: 'text', cost_aed: 'num?', justification: 'text =\'\'',
      status: 'text enum:requested|approved|rejected =\'requested\'', approver_person_id: 'text?', decided_at: 'ts?', created_at: 'ts =now',
      start_on: 'date?', hours: 'num?', decision_note: 'text?', // G2 additions
    },
    read: [{ res: 'training', person: 'person_id' }], write: { mode: 'direct', res: 'training', own: true },
  },
  certificates: {
    module: 'M04', label: 'Kafa\'a-issued internal course certificates (never FANR certificates); public verify via RPC',
    cols: {
      id: 'text pk', person_id: 'text? ref:people idx', org_id: 'text? ref:organisations', holder_initials: 'text', course_id: 'text ref:courses',
      issued_on: 'date', valid_to: 'date?', status: 'text enum:valid|expired|revoked =\'valid\'',
      enrolment_id: 'text?', issued_by: 'text?', // G2 additions
    },
    read: [{ res: 'training', person: 'person_id', org: 'org_id' }], write: { mode: 'rpc', res: 'training' },
  },

  // ───────────────────────────── Assessments (M05)
  items: {
    module: 'M05', label: 'Assessment item (secure bank or open practice bank)',
    cols: {
      id: 'text pk', bank: 'text enum:secure|practice idx', is_practice: 'bool =false', competency_id: 'text? ref:competencies', task_id: 'text?', topic: 'text =\'\'',
      difficulty: 'text enum:easy|medium|hard =\'medium\'', reference: 'text?', current_version: 'int =1',
      status: 'text enum:draft|in_review|approved|retired =\'draft\'', writer_person_id: 'text?', reviewer_person_id: 'text?', approver_person_id: 'text?',
      p_value: 'num?', discrimination: 'num?',
    },
    // G2 (2026-10-08): items change only through RPCs (kafaa_save_item, kafaa_item_review, kafaa_retire_item) so separation of duties cannot be bypassed
    read: [{ res: 'public_content', where: 'is_practice' }, { res: 'secure_items' }], write: { mode: 'rpc', res: 'secure_items' },
  },
  item_versions: {
    module: 'M05', label: 'Item version (stem, options, key, rationale)',
    cols: {
      id: 'text pk', item_id: 'text ref:items idx', version: 'int', is_practice: 'bool =false', stem_en: 'text', stem_ar: 'text', options: 'json =[]',
      answer: 'text', rationale_en: 'text =\'\'', rationale_ar: 'text =\'\'', created_at: 'ts =now',
      author_person_id: 'text?', change_note: 'text?', // G2 additions
    },
    read: [{ res: 'public_content', where: 'is_practice' }, { res: 'secure_items' }], write: { mode: 'rpc', res: 'secure_items' },
  },
  blueprints: {
    module: 'M05', label: 'Exam blueprint',
    cols: { id: 'text pk', title: 'text', standard_id: 'text? ref:qual_standards', spec: 'json =[]', status: 'text enum:draft|approved =\'draft\'' },
    read: [{ res: 'secure_items' }], write: { mode: 'direct', res: 'secure_items' },
  },
  assessment_forms: {
    module: 'M05', label: 'Assessment form (exam, practice quiz, JPM, simulator evaluation)',
    cols: {
      id: 'text pk', blueprint_id: 'text? ref:blueprints', title_en: 'text', title_ar: 'text', kind: 'text enum:written|jpm|simulator|ojt|practice',
      is_practice: 'bool =false', item_ids: 'text[] =[]', time_limit_min: 'int =30', pass_mark: 'num =80', status: 'text enum:draft|approved|retired =\'approved\'',
      audience_en: 'text =\'\'', audience_ar: 'text =\'\'',
      // G2 additions: linked course and the retake / appeal rules of the standard
      course_id: 'text?', max_attempts: 'int =3', retake_wait_days: 'int =7', appeal_days: 'int =10',
    },
    read: [{ res: 'public_content', where: 'is_practice' }, { res: 'secure_items' }, { res: 'internal_content' }], write: { mode: 'direct', res: 'secure_items' },
  },
  attempts: {
    module: 'M05', label: 'Attempt (exam or practice); results update quals only after evaluator sign-off',
    cols: {
      id: 'text pk', form_id: 'text ref:assessment_forms idx', person_id: 'text ref:people idx', scheduled_for: 'ts?', started_at: 'ts?', submitted_at: 'ts?',
      score: 'num?', passed: 'bool?', status: 'text enum:scheduled|in_progress|submitted|graded|released', proctor_person_id: 'text?', released: 'bool =false',
      // G2 additions: retakes, timing, release sign-off, appeal outcome
      attempt_no: 'int =1', retake_of: 'text?', deadline_at: 'ts?', late: 'bool =false', released_by: 'text?', released_at: 'ts?',
      voided_item_ids: 'text[] =[]', counts: 'bool =true', evaluator_note: 'text?',
    },
    read: [{ res: 'qual_records', person: 'person_id' }, { res: 'secure_items' }], write: { mode: 'rpc', res: 'secure_items' },
  },
  responses: {
    module: 'M05', label: 'Response to a secure item (never sent to Dalil, logs or exports)',
    cols: { id: 'text pk', attempt_id: 'text ref:attempts idx', item_id: 'text ref:items', version: 'int', answer: 'text', correct: 'bool' },
    read: [{ res: 'secure_items' }], write: { mode: 'rpc', res: 'secure_items' },
  },
  jpm_results: {
    module: 'M05', label: 'JPM result; a failed critical step fails the JPM',
    cols: {
      id: 'text pk', jpm_id: 'text ref:jpms', person_id: 'text ref:people idx', evaluator_person_id: 'text ref:people', date: 'date', steps: 'json =[]',
      critical_failed: 'bool =false', score_pct: 'num =0', result: 'text enum:pass|fail', signed: 'bool =false', evaluation_id: 'text?',
    },
    read: [{ res: 'qual_records', person: 'person_id' }], write: { mode: 'rpc', res: 'signoff' },
  },
  appeals: {
    module: 'M05', label: 'Appeal against an assessment outcome',
    cols: {
      id: 'text pk', attempt_id: 'text ref:attempts', person_id: 'text ref:people idx', reason: 'text', status: 'text enum:open|upheld|rejected =\'open\'',
      decided_by: 'text?', created_at: 'ts =now',
      item_id: 'text?', decision_note: 'text?', decided_at: 'ts?', // G2 additions
    },
    // G2: candidates read their own appeals; instructors and training managers read all (secure_items)
    read: [{ res: 'qual_records', person: 'person_id' }, { res: 'secure_items' }], write: { mode: 'rpc', res: 'secure_items' },
  },

  // ───────────────────────────── Development (M02/M04)
  dev_plans: {
    module: 'M04', label: 'Individual development plan towards a target role',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', target_role_id: 'text ref:job_roles', status: 'text enum:draft|submitted|approved|active|closed =\'draft\'',
      approved_by: 'text?', created_at: 'ts =now', review_on: 'date?', note: 'text?',
      decision_note: 'text?', decided_at: 'ts?', // G2 additions
    },
    read: [{ res: 'dev_plans', person: 'person_id' }], write: { mode: 'direct', res: 'dev_plans', own: true },
  },
  plan_activities: {
    module: 'M04', label: 'Development plan activity and milestone',
    cols: {
      id: 'text pk', plan_id: 'text ref:dev_plans idx', person_id: 'text ref:people idx', kind: 'text enum:course|ojt|mentoring|project|assessment|reading',
      title_en: 'text', title_ar: 'text', due_on: 'date?', status: 'text enum:planned|in_progress|done =\'planned\'', course_id: 'text?',
    },
    read: [{ res: 'dev_plans', person: 'person_id' }], write: { mode: 'direct', res: 'dev_plans', own: true },
  },
  mentors: {
    module: 'M04', label: 'Opt-in mentor offers (human matching)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', role_id: 'text? ref:job_roles', interests: 'text[] =[]', capacity: 'int =2', opt_in: 'bool =true',
      bio_en: 'text =\'\'', bio_ar: 'text =\'\'',
      // W2E3 (F13 Mentoring 2.0): mentoring types and offered skills (shown to colleagues and used for skills-based matching);
      // sme* is a line-manager (or training-manager) nomination recorded only through rpc.nominateSme (SQL trigger + local guard)
      types: 'text[] =[]', skill_ids: 'text[] =[]', khnp_paired: 'bool =false',
      sme: 'bool =false', sme_skill_ids: 'text[] =[]', sme_nominated_by: 'text?', sme_nominated_on: 'date?',
    },
    // G2: second rule gives the mentor's own row a person column, so staff can opt in and edit their own offer
    read: [{ res: 'internal_content' }, { res: 'dev_plans', person: 'person_id' }], write: { mode: 'direct', res: 'dev_plans', own: true },
  },
  mentoring_requests: {
    module: 'M04', label: 'Mentoring request (human matching)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', mentor_id: 'text? ref:mentors', interest: 'text', status: 'text enum:requested|matched|declined|closed =\'requested\'', created_at: 'ts =now',
      mentor_person_id: 'text? idx', message: 'text =\'\'', responded_at: 'ts?', // G2 additions: the mentor sees requests addressed to them
      // W2E3 (F13): the mentoring type and up to five skills the mentee wants help with (rpc.requestMentoring)
      mentoring_type: 'text? enum:career|knowledge_transfer|leadership|reverse|peer_onboarding', skill_ids: 'text[] =[]',
    },
    read: [{ res: 'dev_plans', person: 'person_id' }, { res: 'dev_plans', person: 'mentor_person_id' }], write: { mode: 'direct', res: 'dev_plans', own: true },
  },

  // ───────────────────────────── Talent pipeline (M06, M10)
  talent_programmes: {
    module: 'M06', label: 'Talent pipeline programme (Mustaqbali, DNT, Energy Pioneers, GDP, GPO ...)',
    cols: {
      id: 'text pk', name_en: 'text', name_ar: 'text', stage: 'text enum:school|school_leaver|university|graduate|experienced|postgraduate|mixed idx',
      nationality: 'text enum:uae_only|uae_priority|open', education_en: 'text', education_ar: 'text', duration_en: 'text', duration_ar: 'text',
      facts_en: 'text', facts_ar: 'text', outcome_en: 'text =\'\'', outcome_ar: 'text =\'\'', apply_mode: 'text enum:in_kafaa|link_out|closed',
      link_out_url: 'text?', sources: 'json =[]', conflict_note: 'text?', criteria: 'json =[]', sort: 'int =0', nexus_program_id: 'text?',
    },
    read: [{ res: 'talent_content' }], write: { mode: 'direct', res: 'talent_content' },
  },
  applications: {
    module: 'M06', label: 'Light application / expression of interest (decision mirrored from HR)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', programme_id: 'text ref:talent_programmes idx',
      stage: 'text enum:interest|submitted|screening|assessment|interview|offer|accepted|unsuccessful|withdrawn idx',
      submitted_at: 'ts =now', updated_at: 'ts =now', decision: 'text enum:none|offer|unsuccessful|withdrawn =\'none\'', decision_source: 'text?',
      consent_version: 'text =\'1\'', delete_after: 'date?', answers: 'json ={}', nationality_flag: 'text enum:uae|other|unknown =\'unknown\'',
      gender: 'text? enum:f|m',
    },
    // [G3] write mode 'rpc': applicants submit and withdraw through kafaa_submit_application / kafaa_withdraw_application,
    // so nobody can move their own application to "offer" with a direct update.
    read: [{ res: 'applications', person: 'person_id' }], write: { mode: 'rpc', res: 'applications' },
  },
  application_events: {
    module: 'M06', label: 'Application stage history (plain-language)',
    cols: { id: 'text pk', application_id: 'text ref:applications idx', person_id: 'text ref:people idx', ts: 'ts =now', stage: 'text', note_en: 'text =\'\'', note_ar: 'text =\'\'', by_role: 'text?' },
    read: [{ res: 'applications', person: 'person_id' }], write: { mode: 'rpc', res: 'applications' },
  },
  vacancies: {
    module: 'M06', label: 'Vacancy (links out to ENEC\'s official careers channel)',
    cols: {
      id: 'text pk', title_en: 'text', title_ar: 'text', role_id: 'text? ref:job_roles', entity_id: 'text ref:organisations', location: 'text',
      uae_nationals_only: 'bool =false', posted_on: 'date', closes_on: 'date?', official_url: 'text', status: 'text enum:open|closed =\'open\'', sample: 'bool =true',
    },
    read: [{ res: 'talent_content' }], write: { mode: 'direct', res: 'talent_content' },
  },
  events: {
    module: 'M06', label: 'Outreach events and career fairs',
    cols: {
      id: 'text pk', title_en: 'text', title_ar: 'text', kind: 'text enum:career_fair|open_day|webinar|festival|info_session|summer_school', starts_on: 'date',
      ends_on: 'date?', location_en: 'text', location_ar: 'text', url: 'text?', audience: 'text =\'\'', sources: 'json =[]', sample: 'bool =false',
    },
    read: [{ res: 'talent_content' }], write: { mode: 'direct', res: 'talent_content' },
  },
  scholar_cohorts: {
    module: 'M10', label: 'Scholar / intern cohort (aggregate)',
    cols: {
      id: 'text pk', programme_id: 'text ref:talent_programmes', intake_year: 'int', university_org_id: 'text? ref:organisations', destination: 'text',
      pathway: 'text', size: 'int', in_study: 'int =0', graduated: 'int =0', placed: 'int =0', women_pct: 'num?', sample: 'bool =true',
    },
    // [G3] a university partner reads the cohort aggregates hosted at its own university (partner_org OwnOrg on university_org_id)
    read: [{ res: 'cohorts', special: 'agg_ok' }, { res: 'cohorts' }, { res: 'workforce_analytics', special: 'agg_ok' }, { res: 'partner_org', org: 'university_org_id' }],
    write: { mode: 'direct', res: 'cohorts' },
  },
  scholars: {
    module: 'M10', label: 'Scholar (universities see only consenting students)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', cohort_id: 'text ref:scholar_cohorts idx', university_org_id: 'text ref:organisations idx',
      status: 'text enum:in_study|graduated|placed|withdrawn', progress_note: 'text =\'\'', year_of_study: 'int?',
      consent_university: 'bool =false', consent_sponsor: 'bool =true',
    },
    read: [{ res: 'cohorts', person: 'person_id', special: 'university_consent' }], write: { mode: 'direct', res: 'cohorts', own: true },
  },
  internships: {
    module: 'M10', label: 'Internship placement',
    cols: {
      id: 'text pk', host_entity_id: 'text ref:organisations', university_org_id: 'text? ref:organisations', title_en: 'text', title_ar: 'text', family_id: 'text? ref:job_families',
      seats: 'int', starts_on: 'date', status: 'text enum:open|closed|filled =\'open\'', intake_year: 'int',
    },
    read: [{ res: 'talent_content' }], write: { mode: 'direct', res: 'talent_content' },
  },

  // ───────────────────────────── Partner ecosystem (M09, M10)
  partner_onboarding: {
    module: 'M09', label: 'Partner onboarding case (readiness path, approval, hand-off to NEXUS partner lens)',
    cols: {
      id: 'text pk', org_id: 'text ref:organisations idx', kind: 'text enum:supplier|university|international', status: 'text enum:invited|in_progress|submitted|approved|returned|handed_off idx',
      started_at: 'ts =now', submitted_at: 'ts?', decided_at: 'ts?', decided_by: 'text?', decision_note: 'text?', summary: 'json ={}', nexus_handoff_ref: 'text?',
      history: 'json =[]', // [G4] status-tracking trail shown to the supplier: [{ at, action, status, by_role, note }]
    },
    // [G4] rpc only: the supplier submits through kafaa_partner_onboarding_action, ENEC decides through kafaa_decide_partner_onboarding
    read: [{ res: 'partner_org', org: 'org_id' }], write: { mode: 'rpc', res: 'partner_org' },
  },
  supplier_readiness: {
    module: 'M09', label: 'Supplier readiness path step status',
    cols: {
      id: 'text pk', org_id: 'text ref:organisations idx', step_key: 'text', status: 'text enum:not_started|in_progress|done =\'not_started\'',
      evidence: 'text?', self_assessment: 'json ={}', updated_at: 'ts =now',
    },
    read: [{ res: 'partner_org', org: 'org_id' }], write: { mode: 'direct', res: 'partner_org', orgw: true },
  },
  equivalency_requests: {
    module: 'M09', label: 'Contractor equivalency request per person and standard',
    cols: {
      id: 'text pk', org_id: 'text ref:organisations idx', person_id: 'text? ref:people', person_label: 'text', standard_id: 'text ref:qual_standards',
      evidence: 'json =[]', status: 'text enum:submitted|under_review|equivalent|training_required|rejected idx', decision_note: 'text?', decider_role: 'text?',
      decided_by: 'text?', decided_at: 'ts?', submitted_at: 'ts =now',
      mapping: 'json =[]', // [G4] evaluator mapping of evidence to task items: [{ task_id, covered, evidence: [index], note }]
      history: 'json =[]', // [G4] [{ at, action, status, by_role, note }]
      submitted_by: 'text?', // [G4]
    },
    // [G4] rpc only: partner admins submit through kafaa_submit_equivalency, evaluators map and decide through RPCs
    read: [{ res: 'equivalency', org: 'org_id' }], write: { mode: 'rpc', res: 'equivalency' },
  },
  icv_plans: {
    module: 'M09', label: 'ICV improvement plan',
    cols: {
      id: 'text pk', org_id: 'text ref:organisations idx', baseline: 'num', target: 'num', target_year: 'int', certificate_valid_to: 'date?', levers: 'json =[]',
      status: 'text enum:draft|submitted|reviewed =\'draft\'', reviewed_at: 'ts?', certificate_file: 'text?',
      review_note: 'text?', submitted_at: 'ts?', reviewed_by: 'text?', certificate_sha256: 'text?', // [G4]
    },
    // [G4] rpc only: kafaa_save_icv_plan (supplier) and kafaa_review_icv_plan (ENEC) so a supplier cannot mark its own plan reviewed
    read: [{ res: 'partner_org', org: 'org_id' }], write: { mode: 'rpc', res: 'partner_org' },
  },
  // [G4] Supplier document checklist: metadata and hash of each uploaded file (the file itself stays with the supplier in this concept)
  supplier_documents: {
    module: 'M09', label: 'Supplier onboarding document checklist with review evidence',
    cols: {
      id: 'text pk', org_id: 'text ref:organisations idx', doc_key: 'text', required: 'bool =true', step_key: 'text',
      status: 'text enum:missing|uploaded|accepted|rejected =\'missing\' idx', file_name: 'text?', size_kb: 'int?', sha256: 'text?',
      uploaded_at: 'ts?', uploaded_by: 'text?', reviewed_at: 'ts?', reviewed_by: 'text?', review_note: 'text?',
    },
    read: [{ res: 'partner_org', org: 'org_id' }], write: { mode: 'rpc', res: 'partner_org' },
  },
  // [G4] Supplier academy knowledge checks (concept content; questions are public, answer keys are not)
  academy_checks: {
    module: 'M09', label: 'Supplier academy knowledge-check questions (concept content)',
    cols: { id: 'text pk', course_id: 'text ref:courses idx', n: 'int', q_en: 'text', q_ar: 'text', options: 'json =[]' },
    read: PUB, write: { mode: 'none' },
  },
  academy_check_keys: {
    module: 'M09', label: 'Answer keys for supplier academy checks (read by RPC only)',
    cols: { id: 'text pk', check_id: 'text ref:academy_checks idx', answer: 'int' },
    read: [{ res: 'training' }], write: { mode: 'none' },
  },
  research_challenges: {
    module: 'M10', label: 'Research challenge (publishes only after a screening sign-off)',
    cols: {
      id: 'text pk', title_en: 'text', title_ar: 'text', theme: 'text', summary_en: 'text', summary_ar: 'text',
      status: 'text enum:draft|screening|published|closed =\'draft\'', is_published: 'bool =false idx', screening_signed_by: 'text?', screening_signed_at: 'ts?',
      security_ok: 'bool =false', export_control_ok: 'bool =false', closes_on: 'date?',
    },
    read: [{ res: 'public_content', where: 'is_published' }, { res: 'research' }], write: { mode: 'rpc', res: 'research' },
  },
  research_proposals: {
    module: 'M10', label: 'Research proposal with IP routing',
    cols: {
      id: 'text pk', challenge_id: 'text? ref:research_challenges', org_id: 'text ref:organisations idx', title: 'text', summary: 'text',
      status: 'text enum:draft|submitted|screening|accepted|declined =\'draft\'', ip_route: 'text?', screened: 'bool =false', submitted_at: 'ts?',
    },
    // [G3] write mode 'rpc': proposals are saved and submitted through kafaa_save_research_proposal and decided through
    // kafaa_decide_research_proposal, so a partner cannot mark its own proposal screened or accepted.
    read: [{ res: 'research', org: 'org_id' }], write: { mode: 'rpc', res: 'research' },
  },

  // ───────────────────────────── Workforce analytics (M07)
  workforce_snapshots: {
    module: 'M07', label: 'Aggregate workforce measure (suppressed below the minimum group size)',
    cols: {
      id: 'text pk', period: 'text idx', entity_id: 'text?', family_id: 'text?', level: 'text?',
      measure: 'text enum:headcount|emirati|women|hires|attrition|training_hours|senior_emirati|top_positions_uae|age_18_30|age_31_50|age_51_plus',
      value: 'num', group_size: 'int', source: 'text', sample: 'bool =true',
    },
    read: [{ res: 'workforce_analytics', special: 'agg_suppressed' }], write: { mode: 'none' },
  },
  kpi_series: {
    module: 'M07', label: 'KPI series with source or SAMPLE label',
    cols: {
      id: 'text pk', metric: 'text idx', label_en: 'text', label_ar: 'text', period: 'text', value: 'num', unit: 'text =\'\'', source: 'text',
      source_url: 'text?', sample: 'bool =false', public: 'bool =false', definition_en: 'text =\'\'', definition_ar: 'text =\'\'',
    },
    read: [{ res: 'public_content', where: 'public' }, { res: 'workforce_analytics', special: 'agg_ok' }], write: { mode: 'none' },
  },
  critical_roles: {
    module: 'M07', label: 'Bench depth by critical role (counts only, never names)',
    cols: {
      id: 'text pk', role_id: 'text ref:job_roles', period: 'text', target_bench: 'int', qualified: 'int', in_training: 'int', pipeline: 'int',
      source: 'text', sample: 'bool =true',
    },
    read: [{ res: 'workforce_analytics', special: 'agg_ok' }], write: { mode: 'direct', res: 'workforce_analytics' },
  },
  observer_reports: {
    module: 'M07', label: 'Aggregate report released to an observer organisation (approval logged)',
    cols: {
      id: 'text pk', title_en: 'text', title_ar: 'text', period: 'text', body: 'json ={}', status: 'text enum:draft|pending_approval|released|withdrawn =\'draft\'',
      prepared_by: 'text?', approved_by: 'text?', approved_at: 'ts?', released_to_org_ids: 'text[] =[]',
    },
    read: [{ res: 'observer_release' }, { res: 'workforce_analytics', special: 'observer_org' }], write: { mode: 'rpc', res: 'observer_release' },
  },
  scenarios: {
    module: 'M07', label: 'Scenario planner (always SIMULATED)',
    cols: {
      id: 'text pk', name: 'text', kind: 'text enum:headcount|technology|programme', params: 'json ={}', results: 'json ={}', simulated: 'bool =true',
      owner_person_id: 'text?', created_at: 'ts =now',
    },
    read: [{ res: 'workforce_analytics', special: 'agg_ok' }], write: { mode: 'direct', res: 'workforce_analytics' },
  },

  // ───────────────────────────── Safety culture (M08)
  sc_traits: {
    module: 'M08', label: 'The 10 traits of a healthy nuclear safety culture',
    cols: { id: 'text pk', n: 'int', name_en: 'text', name_ar: 'text', description_en: 'text', description_ar: 'text', behaviours: 'json =[]', prompts: 'json =[]' },
    read: PUB, write: { mode: 'none' },
  },
  hu_tools: {
    module: 'M08', label: 'Human performance tools (core and conditional)',
    cols: { id: 'text pk', name_en: 'text', name_ar: 'text', description_en: 'text', description_ar: 'text', kind: 'text enum:core|conditional' },
    read: [{ res: 'internal_content' }, ...PUB], write: { mode: 'direct', res: 'internal_content' },
  },
  oe_lessons: {
    module: 'M08', label: 'Curated, de-identified operating-experience lesson',
    cols: {
      id: 'text pk', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', lesson_en: 'text', lesson_ar: 'text',
      source_kind: 'text', trait_ids: 'text[] =[]', reviewed_on: 'date', reviewing_body: 'text', deidentified: 'bool =true',
      status: 'text enum:draft|in_review|published =\'published\'', affected_standard_ids: 'text[] =[]', sample: 'bool =true',
    },
    read: [{ res: 'internal_content' }], write: { mode: 'direct', res: 'internal_content' },
  },
  ecp_channels: {
    module: 'M08', label: 'Employee Concerns Program channels (content owned by ECP)',
    cols: { id: 'text pk', kind: 'text', label_en: 'text', label_ar: 'text', detail_en: 'text', detail_ar: 'text', sort: 'int =0', source: 'text' },
    read: PUB, write: { mode: 'none' },
  },
  concern_cases: {
    module: 'M08', label: '[K] ECP referral log: metadata only, never the concern text; anonymous option',
    cols: {
      id: 'text pk', ref_no: 'text uniq', received_on: 'date', channel: 'text enum:ecp_office|intranet|phone|email|unit_rep|r2p_referral',
      anonymous: 'bool =true', category: 'text enum:nuclear_safety|quality|hird|other', status: 'text enum:received|triaged|investigating|referred|closed =\'received\'',
      priority: 'text enum:routine|priority|urgent =\'routine\'', triage_owner_role: 'text?', triaged_at: 'ts?', ecp_system_ref: 'text', sample: 'bool =true',
      // G5 (M08): closure metadata only (never the concern text)
      closed_on: 'date?', outcome: 'text? enum:substantiated|not_substantiated|referred_cap|referred_hr|referred_external|no_action',
    },
    read: [{ res: 'concern_cases' }], write: { mode: 'rpc', res: 'concern_cases' },
  },

  // ───────────────────────────── Advanced reactors (M11)
  adv_technologies: {
    module: 'M11', label: 'Technology family evaluated under ADVANCE (no deployment decision implied)',
    cols: {
      id: 'text pk', family_en: 'text', family_ar: 'text', partners_en: 'text', partners_ar: 'text', designs: 'text', skill_areas_en: 'text', skill_areas_ar: 'text',
      mou_date: 'text', sources: 'json =[]', sort: 'int =0',
    },
    read: PUB, write: { mode: 'direct', res: 'public_content' },
  },
  skill_bridges: {
    module: 'M11', label: 'What transfers from a current role to a future technology, and what is new',
    cols: { id: 'text pk', from_role_id: 'text ref:job_roles', tech_id: 'text ref:adv_technologies', transfers_en: 'text', transfers_ar: 'text', new_en: 'text', new_ar: 'text' },
    read: PUB, write: { mode: 'direct', res: 'public_content' },
  },
  future_skills: {
    module: 'M11', label: 'Future-skills radar values (SIMULATED scenarios, never forecasts)',
    cols: {
      id: 'text pk', skill_en: 'text', skill_ar: 'text', tech_ids: 'text[] =[]', scenario: 'text', value: 'num', simulated: 'bool =true',
      skill_key: 'text =\'\'', readiness: 'num?', // [G4] stable skill key and SIMULATED current-readiness index (0-100)
      // [FS04] one keyspace: the catalogue skill this radar key resolves to (primary row of future_skill_map), the level the
      // computed readiness counts (rpc.futureRadar), and the sourced SIMULATED demand assumption of this scenario. `readiness`
      // above is the legacy hand-entered index, no longer shown.
      sk_id: 'text? ref:skills', target_level: 'int =2', assumption_en: 'text =\'\'', assumption_ar: 'text =\'\'', sources: 'json =[]',
    },
    read: [{ res: 'workforce_analytics', special: 'agg_ok' }], write: { mode: 'direct', res: 'workforce_analytics' },
  },
  // [G4] Skills needed per technology family (orientation only; no deployment decision implied)
  adv_skills: {
    module: 'M11', label: 'Skill areas per technology family and how they relate to APR-1400 skills',
    cols: {
      id: 'text pk', tech_id: 'text ref:adv_technologies idx', skill_en: 'text', skill_ar: 'text',
      area: 'text enum:physics|chemistry|materials|operations|maintenance|licensing|digital|project|safety',
      relation: 'text enum:transfers|adapts|new', note_en: 'text =\'\'', note_ar: 'text =\'\'', sort: 'int =0',
      sk_ids: 'text[] =[]', // [FS04] catalogue skills this ADVANCE skill resolves to (active future_skill_map rows of the key)
    },
    read: PUB, write: { mode: 'direct', res: 'public_content' },
  },
  // [G4] Future-role catalogue: concept roles, no headcount, no sites, no dates
  future_roles: {
    module: 'M11', label: 'Future-role catalogue (concept roles; no headcount, sites or dates)',
    cols: {
      id: 'text pk', tech_ids: 'text[] =[]', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text',
      from_role_ids: 'text[] =[]', skill_ids: 'text[] =[]', horizon: 'text enum:watch|explore|prepare', family_id: 'text? ref:job_families', sort: 'int =0',
    },
    read: PUB, write: { mode: 'direct', res: 'public_content' },
  },
  // [G4] Learning tracks on advanced reactor fundamentals for interested staff and students
  adv_tracks: {
    module: 'M11', label: 'Learning tracks on advanced reactor fundamentals (concept content)',
    cols: {
      id: 'text pk', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', audience: 'text enum:students|staff|all',
      level: 'text enum:intro|intermediate', tech_ids: 'text[] =[]', modules: 'json =[]', course_id: 'text? ref:courses', hours: 'num =0', sources: 'json =[]', sort: 'int =0',
    },
    read: PUB, write: { mode: 'direct', res: 'public_content' },
  },
  // [G4] Skills-gap plan actions against SIMULATED scenarios (HR only; never a forecast)
  skill_gap_plans: {
    module: 'M11', label: 'Skills-gap plan actions against SIMULATED scenarios',
    cols: {
      id: 'text pk', skill_key: 'text idx', scenario: 'text', action: 'text enum:train|reskill|hire|partner|research', owner_role: 'text',
      target_quarter: 'text', status: 'text enum:draft|active|done =\'draft\'', note: 'text =\'\'', created_by: 'text?', created_at: 'ts =now', updated_at: 'ts?',
      sk_id: 'text? ref:skills idx', // [FS04] re-keyed to the catalogue skill; skill_key stays as the label (radar key or sk-* id)
    },
    read: [{ res: 'workforce_analytics', special: 'agg_ok' }], write: { mode: 'rpc', res: 'workforce_analytics' },
  },

  // ───────────────────────────── Public content (M12, M15, M16)
  content_pages: {
    module: 'M16', label: 'Content page with sources, review date and bilingual approval',
    cols: {
      id: 'text pk', slug: 'text uniq', zone: 'text enum:public|staff|partner', module: 'text', title_en: 'text', title_ar: 'text', body_en: 'text', body_ar: 'text',
      sources: 'json =[]', as_of: 'date', review_on: 'date', status: 'text enum:draft|in_translation|in_review|published =\'draft\'',
      is_published: 'bool =false idx', translation_status: 'text enum:en_only|ar_draft|both_approved =\'en_only\'', owner_role: 'text =\'Editor\'', ecp_owned: 'bool =false',
      // G5 (M12/M16): news-style items and summaries; editorial trail
      kind: 'text enum:page|news =\'page\' idx', published_on: 'date?', summary_en: 'text =\'\'', summary_ar: 'text =\'\'', topic: 'text =\'general\'',
      updated_by: 'text?', updated_at: 'ts =now', no_factual_claims: 'bool =false',
    },
    read: [{ res: 'public_content', where: 'is_published' }, { res: 'internal_content' }], write: { mode: 'direct', res: 'public_content' },
  },
  facts: {
    module: 'M12', label: 'Sourced statistic with "as of" date (or SAMPLE label)',
    cols: {
      id: 'text pk', key: 'text uniq', label_en: 'text', label_ar: 'text', value: 'text', value_ar: 'text =\'\'', detail_en: 'text =\'\'', detail_ar: 'text =\'\'',
      source_id: 'text? ref:sources', as_of: 'date', sample: 'bool =false', public: 'bool =true', conflict_note: 'text?', topic: 'text =\'barakah\'',
    },
    read: [{ res: 'public_content', where: 'public' }, { res: 'internal_content' }], write: { mode: 'direct', res: 'public_content' },
  },
  glossary: {
    module: 'M15', label: 'Arabic-English nuclear glossary (owner: Nuclear Training)',
    cols: { id: 'text pk', term_en: 'text', term_ar: 'text', definition_en: 'text', definition_ar: 'text', owner: 'text =\'Nuclear Training\'', status: 'text enum:draft|reviewed =\'draft\'' },
    read: PUB, write: { mode: 'direct', res: 'public_content' },
  },
  faqs: {
    module: 'M12', label: 'FAQ',
    cols: { id: 'text pk', topic: 'text', q_en: 'text', q_ar: 'text', a_en: 'text', a_ar: 'text', sort: 'int =0' },
    read: PUB, write: { mode: 'direct', res: 'public_content' },
  },

  // ───────────────────────────── Dalil (M13)
  corpus_docs: {
    module: 'M13', label: 'Approved corpus document for Dalil grounding',
    cols: {
      id: 'text pk', title: 'text', url: 'text?', kind: 'text enum:kafaa_page|enec_page|fanr_page|internal', modes: 'text[] =[]', is_public: 'bool =false',
      approved: 'bool =true', text_en: 'text', text_ar: 'text =\'\'', updated_at: 'ts =now',
    },
    read: [{ res: 'public_content', where: 'is_public' }, { res: 'internal_content' }, { res: 'dalil_config' }], write: { mode: 'direct', res: 'dalil_config' },
  },
  advisor_sessions: {
    module: 'M13', label: 'Dalil session (retained for a limited period)',
    cols: {
      id: 'text pk', person_id: 'text? ref:people idx', mode: 'text enum:public|applicant|staff|partner', started_at: 'ts =now', retention_until: 'date',
      handoff: 'text enum:none|careers|training|partner_desk =\'none\'', handoff_consent: 'bool =false', turns: 'int =0',
      // G5 (M13): anonymous rate-limit key (random per browser, no identity), page the user came from, hand-off status
      client_key: 'text? idx', page_context: 'text?', handoff_status: 'text enum:none|requested|picked_up|closed =\'none\'', handoff_note: 'text?', last_turn_at: 'ts?',
      // W5E5 (F37): career mode. The mode check cannot be widened without dropping it, so career sessions keep mode 'staff' and set submode.
      submode: 'text? enum:career',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'dalil_config' }], write: { mode: 'rpc', res: 'dalil_config' }, // G5: writes only via rpc.dalilTurn / dalilHandoff (server-side rate limit)
  },
  advisor_turns: {
    module: 'M13', label: 'Dalil turn (question, cited answer or refusal)',
    cols: {
      id: 'text pk', session_id: 'text ref:advisor_sessions idx', person_id: 'text? ref:people', speaker: 'text enum:user|dalil', text: 'text', citations: 'json =[]',
      refused: 'bool =false', refusal_category: 'text?', ts: 'ts =now',
      // G5 (M13): detected intent, retrieval confidence, and whether the user's text was withheld (concerns are never stored)
      intent: 'text?', confidence: 'num?', redacted: 'bool =false', mode: 'text? enum:public|applicant|staff|partner',
      // W5E5 (F37): 'career' for Dalil career-mode turns (mode stays 'staff'; see advisor_sessions.submode)
      submode: 'text? enum:career',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'dalil_config' }], write: { mode: 'rpc', res: 'dalil_config' }, // G5: writes only via rpc.dalilTurn / dalilHandoff (server-side rate limit)
  },
  eval_runs: {
    module: 'M13', label: 'Dalil evaluation run (citation and refusal thresholds)',
    cols: {
      id: 'text pk', run_at: 'ts', release: 'text', lang: 'text enum:en|ar|both', in_scope_total: 'int', cited_correct: 'int', refusal_total: 'int', refusal_correct: 'int',
      pass: 'bool', notes: 'text =\'\'',
      // G5 (M13): per-case results and the engine that ran
      details: 'json =[]', engine: 'text =\'retrieval-v1\'', run_by: 'text?', security_total: 'int =0', security_correct: 'int =0',
    },
    read: [{ res: 'dalil_config' }], write: { mode: 'direct', res: 'dalil_config' },
  },
  refusal_policies: {
    module: 'M13', label: 'Dalil refusal policy per out-of-scope category',
    cols: {
      id: 'text pk', category: 'text', description_en: 'text', description_ar: 'text', patterns: 'text[] =[]', response_en: 'text', response_ar: 'text',
      enabled: 'bool =true', stop_conversation: 'bool =false',
    },
    read: PUB, write: { mode: 'direct', res: 'dalil_config' },
  },
  dalil_settings: {
    module: 'M13', label: 'Dalil global settings and kill switch',
    cols: {
      id: 'text pk', enabled: 'bool =true', public_rate_limit_per_hour: 'int =20', staff_mode: 'bool =false', model_gateway: 'text =\'UAE-hosted model option (concept)\'',
      retention_days: 'int =30', updated_at: 'ts =now', updated_by: 'text?',
      // G5 (M13): signed-in rate limit and the active answer engine (pluggable; no LLM key in the demo)
      signed_in_rate_limit_per_hour: 'int =60', engine: 'text =\'retrieval-v1\'',
    },
    read: PUB, write: { mode: 'rpc', res: 'dalil_config' },
  },

  // ───────────────────────────── Integrations (M16)
  integrations: {
    module: 'M16', label: 'Connector and sync status (systems of record)',
    cols: {
      id: 'text pk', name: 'text', system_kind: 'text', domain: 'text', direction: 'text enum:in|out|both', last_success: 'ts', threshold_hours: 'int =24',
      status: 'text enum:ok|degraded|stale|error|disabled', records: 'int =0', errors: 'int =0', schedule: 'text =\'\'', notes: 'text =\'\'',
    },
    read: [{ res: 'integrations' }, { res: 'internal_content' }], write: { mode: 'direct', res: 'integrations' },
  },
  // G5 (M16): demo feature flags. Readable by everyone (pages hide features), written by platform admins only
  // (write rule uses the 'integrations' resource: admin A, auditor R). Every change is audited by the row trigger.
  feature_flags: {
    module: 'M16', label: 'Feature flags for the demo tenant (admin console)',
    cols: {
      id: 'text pk', key: 'text uniq', label_en: 'text', label_ar: 'text', description_en: 'text =\'\'', description_ar: 'text =\'\'',
      enabled: 'bool =true', locked: 'bool =false', area: 'text =\'general\'', updated_at: 'ts =now', updated_by: 'text?',
    },
    read: PUB, write: { mode: 'direct', res: 'integrations' },
  },

  // ───────────────────────────── F01 (wave 0) · Skills core: catalogue, evidence and derived person skill state
  // The catalogue is a finer layer under the 29 competencies (one core skill per competency, code = competency code, plus
  // specialised skills). Evidence rows are derived from qualification records, course passes, assessment passes and JPM
  // passes (kinds qual|course|assessment|jpm, rebuilt by rpc.recomputeSkills) or recorded by other features (rating|ojt|
  // credential, kept across recomputes). Rules: src/domain/skills.ts (TS) = kafaa_skill_* functions (SQL).
  skills: {
    module: 'M17', label: 'Skill catalogue: finer layer under the competencies (F01)',
    cols: {
      id: 'text pk', code: 'text uniq', competency_id: 'text ref:competencies idx', name_en: 'text', name_ar: 'text',
      area: 'text enum:plant_systems|operations|maintenance|radiation_chemistry|engineering|safety|human_performance|emergency|security|quality|leadership|digital|project idx',
      core: 'bool =false', key_level: 'int =2', evidence_keys: 'text[] =[]', adjacent_ids: 'text[] =[]', adv_skill_ids: 'text[] =[]',
      description_en: 'text =\'\'', description_ar: 'text =\'\'', sources: 'json =[]', sort: 'int =0',
      // FS02 (future skills, wave A): taxonomy attributes. ESCO reusability level, Lightcast skill type, lifecycle (ESCO:
      // obsolete, never deleted), decay class (FS03 half-lives), owner function, version and review date (UPKEEP), SFIA-style
      // level essence at the key level, ESCO alternative labels, Jahiz future group, future-skills area and the benchmark rows
      // the skill follows. Rules and labels: src/domain/taxonomy.ts. Guard: SQL kafaa_fs_skill_guard = guards.ts 'skills'.
      reusability: 'text enum:transversal|cross_sectoral|sector_specific|occupation_specific =\'sector_specific\'',
      skill_type: 'text enum:common|specialised|licence_like =\'specialised\'',
      lifecycle: 'text enum:emerging|growing|stable|declining|obsolete =\'stable\' idx',
      decay_class: 'text enum:fast|standard|slow =\'standard\'',
      owner_role: 'text enum:nuclear_training|operations|maintenance|engineering|radiation_chemistry|safety_licensing|human_performance|emergency_preparedness|quality|leadership_development|digital_ai_governance|sustainability|advanced_reactors|cyber_awareness =\'nuclear_training\'',
      version: 'int =1', review_due: 'date?',
      level_essence_en: 'text =\'\'', level_essence_ar: 'text =\'\'', alt_labels_en: 'text[] =[]', alt_labels_ar: 'text[] =[]',
      future_group: 'text? enum:digital|ten_x|data_ai|new_economy|nuclear_excellence idx',
      fs_area: 'text? enum:transversal|ai_data|green_energy|advanced_reactor|cyber_hygiene|digital_plant idx',
      benchmark_ids: 'text[] =[]', obsolete_on: 'date?', replaced_by: 'text? ref:skills',
    },
    read: [{ res: 'frameworks' }, ...PUB], write: { mode: 'direct', res: 'frameworks' },
  },
  skill_evidence: {
    module: 'M17', label: 'Skill evidence per person (derived from records, or recorded by later features) (F01)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', skill_id: 'text ref:skills idx',
      kind: 'text enum:qual|course|assessment|jpm|rating|ojt|credential idx', ref_table: 'text', ref_id: 'text idx', level: 'int',
      basis: 'text enum:verified|evidenced|validated|claimed', status: 'text enum:current|lapsed =\'current\'', observed_on: 'date',
      note: 'text?', recorded_by: 'text?', active: 'bool =true', created_at: 'ts =now',
      org_id: 'text? idx', contractor: 'bool =false', // W5E2 (F33): stamped for contractor people (supplier organisations) by kafaa_cp_stamp
    },
    // W5E2 (F33): contractors read their own rows (own_profile Own); partner admins their organisation's (equivalency OwnOrg);
    // ENEC evaluators and auditors (equivalency A/R) contractor rows only (where contractor). No cross-org reads.
    read: [{ res: 'skills_profile', person: 'person_id' }, { res: 'own_profile', person: 'person_id' }, { res: 'equivalency', org: 'org_id', where: 'contractor' }],
    write: { mode: 'rpc', res: 'skills_profile' },
  },
  person_skills: {
    module: 'M17', label: 'Derived skill state per person: level 0-4, confidence, basis and reasons (F01)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', skill_id: 'text ref:skills idx', level: 'int', confidence: 'num',
      basis: 'text enum:verified|evidenced|validated|claimed|none', reasons: 'json =[]', evidence_count: 'int =0', active: 'bool =true', updated_at: 'ts =now',
      org_id: 'text? idx', contractor: 'bool =false', // W5E2 (F33): see skill_evidence

      // FS03: how sure we are. Band from the cautious end of an 80% interval around confidence (src/domain/skills.ts)
      confidence_band: 'text enum:low|medium|high =\'low\'', conf_low: 'num =0', conf_high: 'num =0',
    },
    read: [{ res: 'skills_profile', person: 'person_id' }, { res: 'own_profile', person: 'person_id' }, { res: 'equivalency', org: 'org_id', where: 'contractor' }],
    write: { mode: 'rpc', res: 'skills_profile' },
  },
  // F02 (wave 0) · which engine serves each AI-flavoured surface, and its weights. Readable by everyone (transparency);
  // changed only by platform admins through rpc.setEngineWeights (audited).
  engine_settings: {
    module: 'M16', label: 'Engine per surface (deterministic or model slot) and ranking weights (F02)',
    cols: {
      id: 'text pk', surface: 'text uniq enum:skills|recommend|match|search', engine: 'text enum:deterministic|model =\'deterministic\'',
      weights: 'json ={}', updated_by: 'text?', updated_at: 'ts =now',
    },
    read: PUB, write: { mode: 'rpc', res: 'integrations' },
  },

  // ───────────────────────────── FS01 (future skills, wave A) · Benchmark registry
  // The 40 international benchmarks the future-skills features follow (PLAN.md section 4): owner, year, https sources, as-of
  // date, the published figures (every benchmark number shown in the product comes from `figures`, never from copy) and what
  // Kafa'a borrows. Published rows are public (<BenchmarkChip>, <BenchmarkLine> in src/ui); drafts and retired rows are read
  // by admins, auditors and SAT staff; framework owners (frameworks W/A) edit them on /admin/frameworks?tab=benchmarks.
  benchmarks: {
    module: 'M28', label: 'International future-skills benchmarks: owner, year, sources, as-of date, figures, what Kafa\'a borrows (FS01)',
    cols: {
      id: 'text pk', name_en: 'text', name_ar: 'text', owner_en: 'text', owner_ar: 'text', country_en: 'text', country_ar: 'text',
      category: 'text enum:global|national|uae|nuclear_energy|ai|corporate idx',
      year_from: 'int', year_to: 'int?', year_kind: 'text enum:single|range|editions|current|reference =\'single\'',
      urls: 'text[]', fact_en: 'text', fact_ar: 'text', borrow_en: 'text', borrow_ar: 'text', figures: 'json =[]',
      feature_ids: 'text[] =[]', as_of: 'date', status: 'text enum:draft|published|retired =\'published\' idx', listed: 'bool =true',
      sort: 'int =0', updated_at: 'ts =now', updated_by: 'text?',
    },
    read: [{ res: 'public_content', where: 'listed' }, { res: 'integrations' }, { res: 'sat' }],
    write: { mode: 'direct', res: 'frameworks' },
  },

  // ───────────────────────────── Local-only mirror of the NEXUS evidence ledger
  ledger_local: {
    module: 'M16', label: 'LocalBackend mirror of nexus_append_ledger writes (same hash scheme). Not created in SQL.',
    localOnly: true,
    cols: {
      id: 'text pk', seq: 'int', ts: 'ts', actor: 'text', role: 'text', plane: 'text', domain: 'text', action: 'text', evidence_class: 'text',
      reason: 'text?', case_id: 'text?', agent_id: 'text?', prev_hash: 'text', hash: 'text', actor_persona_id: 'text?',
    },
    read: [{ res: 'audit_log' }],
    write: { mode: 'append' },
  },
  // F01: M17-M27 module tables (src/modules/<m>/backend/schema.ts)
  ...EXT_TABLES,
};
void T;

export type TableName = keyof typeof SCHEMA;
export const TABLE_NAMES = Object.keys(SCHEMA) as TableName[];
export const sqlName = (t: string) => `kafaa_${t}`;

export type ParsedCol = {
  name: string; type: string; nullable: boolean; pk: boolean; ref?: string; enumValues?: string[]; def?: string; uniq: boolean; idx: boolean;
};
export function parseCol(name: string, spec: string): ParsedCol {
  const parts = spec.trim().split(/\s+(?=(?:[^']*'[^']*')*[^']*$)/);
  let type = parts[0];
  const nullable = type.endsWith('?');
  if (nullable) type = type.slice(0, -1);
  const out: ParsedCol = { name, type, nullable, pk: false, uniq: false, idx: false };
  for (const p of parts.slice(1)) {
    if (p === 'pk') out.pk = true;
    else if (p === 'uniq') out.uniq = true;
    else if (p === 'idx') out.idx = true;
    else if (p.startsWith('ref:')) out.ref = p.slice(4);
    else if (p.startsWith('enum:')) out.enumValues = p.slice(5).split('|');
    else if (p.startsWith('=')) out.def = p.slice(1);
  }
  return out;
}
export function columnsOf(t: string): ParsedCol[] {
  return Object.entries(SCHEMA[t].cols).map(([n, s]) => parseCol(n, s));
}
