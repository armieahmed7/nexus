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
  // [W2 · E2] F12 Career conversations. Private to the person (own_profile Own: nobody holds Scope, R or A on it) and to the
  // line manager of record once the person shares the preparation or the manager records the conversation: manager_read_id is
  // set by the RPCs only then (the second rule matches nothing before). HR sees aggregates only (rpc.conversationInsights);
  // talent review reads the aspiration through rpc.talentAspirations, and only with share_with_talent_review on. RPC writes only.
  career_conversations: {
    module: 'M18', label: 'Career conversation: employee preparation, pre-filled agenda, manager notes and agreed actions, acknowledgement (F12)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', manager_person_id: 'text? ref:people idx', manager_read_id: 'text? idx', cycle: 'text =\'\'',
      status: 'text enum:draft|held|acknowledged =\'draft\' idx', person_name: 'text =\'\'', person_name_ar: 'text =\'\'', manager_name: 'text =\'\'', manager_name_ar: 'text =\'\'',
      prep: 'json ={}', prep_submitted_at: 'ts?', agenda: 'json ={}', held_on: 'date?', notes: 'text?', actions: 'json =[]',
      focus_role_id: 'text? ref:job_roles', coach_hours: 'num?', plan_id: 'text?', recorded_at: 'ts?',
      employee_agrees: 'bool?', employee_comment: 'text?', acknowledged_at: 'ts?', share_with_talent_review: 'bool =false',
      created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'own_profile', person: 'manager_read_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
  // [FS wave B · E5] FS15 Future roles in the Navigator and Roadmap. SIMULATED, anonymised mirror of HR role changes (no person
  // ids): the source of "how many colleagues made this move and the median months". Rows are read only by workforce_analytics
  // R (auditors); everyone else gets suppressed aggregates through rpc.transitionEvidence (counts under 10 suppressed).
  role_moves: {
    module: 'M18', label: 'SIMULATED anonymised mirror of past role changes (from role, to role, date, months in the previous role); aggregates only (FS15)',
    cols: {
      id: 'text pk', from_role_id: 'text ref:job_roles idx', to_role_id: 'text ref:job_roles idx', moved_on: 'date', months_before: 'int',
      kind: 'text enum:progression|lateral =\'progression\'', simulated: 'bool =true', source: 'text =\'SIMULATED HR mirror\'',
    },
    read: [{ res: 'workforce_analytics' }],
    write: { mode: 'none' },
  },
  // [FS wave B · E5] FS16 Role outlook labels with published criteria. Criteria versions are public reference rows (thresholds,
  // precedence, sources); labels are public (label only); the components behind each label are staff-readable
  // (transformation R). Labels and components change only through rpc.publishOutlookLabels (HR director); past years are kept.
  role_outlook_criteria: {
    module: 'M18', label: 'Published criteria for the Growing / Stable / Changing role outlook labels, one row per criteria version (FS16)',
    cols: {
      id: 'text pk', version: 'int', year_from: 'int', thresholds: 'json ={}', precedence: 'text[] =[]', components: 'text[] =[]',
      summary_en: 'text', summary_ar: 'text', sources: 'json =[]', benchmark_ids: 'text[] =[]', as_of: 'date', status: 'text enum:published|retired =\'published\'',
    },
    read: [{ res: 'public_content' }],
    write: { mode: 'none' },
  },
  role_outlook_labels: {
    module: 'M18', label: 'Role outlook label per role and year (Growing, Stable, Changing); public, label only; past years kept (FS16)',
    cols: {
      id: 'text pk', role_id: 'text ref:job_roles idx', year: 'int idx', label: 'text enum:growing|stable|changing idx', criteria_id: 'text ref:role_outlook_criteria',
      archived: 'bool =false', as_of: 'date', published_by_role: 'text?', published_at: 'ts =now',
    },
    read: [{ res: 'public_content' }],
    write: { mode: 'rpc', res: 'transformation' },
  },
  role_outlook_components: {
    module: 'M18', label: 'The components behind each role outlook label (demand growth, shortfall, profile change); staff only (FS16)',
    cols: {
      id: 'text pk', role_id: 'text ref:job_roles idx', year: 'int idx', criteria_id: 'text ref:role_outlook_criteria', components: 'json ={}', computed_at: 'ts =now',
    },
    read: [{ res: 'transformation' }],
    write: { mode: 'rpc', res: 'transformation' },
  },
  // [FS wave D · E4] FS34 Transferable-skills translator. ESCO-aligned skill sets for source occupations outside nuclear (oil and
  // gas, power, process, aviation, defence, utilities): each row is an ESCO v1.2 occupation concept with the Kafa'a skills and
  // typical levels it brings, each skill tied to an essential or optional ESCO skill of that occupation, and a cited source.
  // Public reference rows (listed); no writes from the API. The translation itself is computed and never stored.
  occupation_templates: {
    module: 'M18', label: 'ESCO-aligned source occupation for the career-changer translator: Kafa\'a skills and typical levels, cited ESCO concepts (FS34)',
    cols: {
      id: 'text pk', esco_uri: 'text', esco_code: 'text', isco_code: 'text?', title_en: 'text', title_ar: 'text', esco_label_en: 'text', esco_label_ar: 'text',
      industry: 'text enum:oil_gas|power|process|aviation|defence|utilities idx', summary_en: 'text', summary_ar: 'text', skills: 'json =[]', sources: 'json =[]',
      benchmark_ids: 'text[] =[]', as_of: 'date', status: 'text enum:draft|published|retired =\'published\'', listed: 'bool =true', sort: 'int =0',
    },
    read: [{ res: 'public_content', where: 'listed' }],
    write: { mode: 'none' },
  },
  // [FS wave D · E4] FS35 Career Health check. My own snapshots (Assess, Chart, Execute): the five components as computed when
  // saved, my plan and the career conversation it ended in. Own only: own_profile carries Own for every signed-in role and
  // nothing wider, so no manager, HR or talent-review reader can see a snapshot. RPC writes only (rpc.saveHealthSnapshot).
  health_snapshots: {
    module: 'M18', label: 'My Career Health check snapshots: five visible components, my plan and the booked conversation; own only (FS35)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', taken_at: 'ts =now', as_of: 'date', role_id: 'text? ref:job_roles', components: 'json =[]',
      good: 'int =0', watch: 'int =0', act: 'int =0', plan: 'json ={}', step: 'text enum:assessed|charted|executed =\'assessed\'', conversation_id: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
};
