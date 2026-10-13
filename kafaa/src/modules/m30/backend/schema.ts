// M30 tables (owners: wave B E3 (FS11, FS12) and wave I E3 (FS81)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
//
// FS11 My Role in 2030 (Role Transformation Maps) and FS12 Task exposure view (FS wave B · E3):
//  - role_transformations: one map per current role (28): archetype, technology drivers, staff summary and a public summary with no
//    numbers, sources, version and the published history. Published maps are public (public_content where is_public); staff read
//    every map (transformation R). Written only by rpc.publishTransformation (training manager / HR director; audited; ledger on publish).
//  - transformation_drafts: the open draft of a map, read directly only by admin and auditors (audit_log); editors get it through
//    rpc.roleTransformation. Written only by rpc.publishTransformation.
//  - transformation_milestones: the dated timeline (OSSA support ending around 2030, ADVANCE planning gates, the 2035 horizon); public,
//    sourced, planning gates labelled SIMULATED; "no deployment decision implied". Seeded only.
//  - transformation_archetypes: the three SkillsFuture Singapore role archetypes with what each means for learning. Public, seeded.
// The task bands, skills added, bridge curriculum and time-to-ready are computed (rule transformRole, TS = SQL), never stored.
//
// FS81 Transition plans and ladder-rung protection (FS wave I · E3):
//  - transition_plans: one SIMULATED HR record per person whose role is changing: protected role (kept while retraining) and until when,
//    target role, horizon, why, retraining steps, the synthetic practice added for ladder-rung alerts (simulator scenarios, OJT
//    repetitions), dated reviews (at most 183 days apart), status draft|active|completed|withdrawn, acknowledgement, history.
//    Visible to the person (own_profile Own on person_id) and to HR only: HR (transformation A) reads and decides every plan through
//    the SECURITY DEFINER RPCs (transitionPlans, transitionPlanView), so no read rule names `transformation` and managers in scope
//    read nothing (logged deviation from the policy.ts comment "managers their team's transition plans"). Written only by
//    rpc.saveTransitionPlan / reviewTransitionPlan / closeTransitionPlan (HR) and acknowledgeTransitionPlan (the person).
//    The ladder-rung alert is computed (rule rungAlert in ../transition.ts, TS = SQL kafaa_tp_alert), never stored.
import type { TableDef } from '../../../data/schema';

export const TABLES_M30: Record<string, TableDef> = {
  role_transformations: {
    module: 'M30', label: 'Role transformation map per current role: archetype, technology drivers, staff and public summaries (FS11)',
    cols: {
      id: 'text pk', role_id: 'text ref:job_roles uniq', family_id: 'text ref:job_families idx',
      archetype: 'text? enum:mastery_builder|analytical_specialist|human_connector', drivers: 'text[] =[]',
      summary_en: 'text', summary_ar: 'text', public_summary_en: 'text', public_summary_ar: 'text',
      sources: 'json =[]', as_of: 'date', status: 'text enum:draft|published =\'draft\' idx', is_public: 'bool =false', path_only: 'bool =false',
      version: 'int =0', history: 'json =[]', updated_by: 'text?', updated_at: 'ts =now', published_by: 'text?', published_at: 'ts?', sort: 'int =0',
    },
    read: [{ res: 'public_content', where: 'is_public' }, { res: 'transformation' }],
    write: { mode: 'rpc', res: 'transformation' },
  },
  transformation_drafts: {
    module: 'M30', label: 'Open draft of a role transformation map (editors read it through rpc.roleTransformation) (FS11)',
    cols: {
      id: 'text pk', role_id: 'text ref:job_roles uniq', content: 'json ={}', open: 'bool =true', saved_by: 'text?', saved_at: 'ts =now',
    },
    read: [{ res: 'audit_log' }],
    write: { mode: 'rpc', res: 'transformation' },
  },
  transformation_milestones: {
    module: 'M30', label: 'Role transformation timeline: OSSA support to around 2030, ADVANCE planning gates (SIMULATED), 2035 horizon (FS11)',
    cols: {
      id: 'text pk', year: 'int', kind: 'text enum:ossa|advance|profiles|horizon', title_en: 'text', title_ar: 'text', body_en: 'text', body_ar: 'text',
      simulated: 'bool =false', families: 'text[] =[]', sources: 'json =[]', as_of: 'date', sort: 'int =0',
    },
    read: [{ res: 'public_content' }],
    write: { mode: 'none' },
  },
  transformation_archetypes: {
    module: 'M30', label: 'Role archetypes (SkillsFuture Singapore 2025): what each means for learning (FS11)',
    cols: {
      id: 'text pk', name_en: 'text', name_ar: 'text', meaning_en: 'text', meaning_ar: 'text', learning_en: 'text', learning_ar: 'text',
      example_en: 'text', example_ar: 'text', sources: 'json =[]', as_of: 'date', sort: 'int =0',
    },
    read: [{ res: 'public_content' }],
    write: { mode: 'none' },
  },
  transition_plans: {
    module: 'M30', label: 'Transition plan (SIMULATED HR): protected role, retraining, target role, ladder-rung practice and review dates; person and HR only (FS81)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', current_role_id: 'text? ref:job_roles', protected_role_id: 'text ref:job_roles', protected_until: 'date',
      target_role_id: 'text ref:job_roles idx', horizon: "text enum:2030|2035 ='2030'", trigger: 'text enum:task_automation|role_redesign|new_technology|career_move',
      start_on: 'date', end_on: 'date', reviews: 'json =[]', next_review_on: 'date? idx', retraining: 'json =[]', practice: 'json =[]',
      note_en: "text =''", note_ar: "text =''", status: "text enum:draft|active|completed|withdrawn ='draft' idx", simulated: 'bool =true',
      acknowledged_at: 'ts?', revision: 'int =1', history: 'json =[]', created_by: 'text?', created_at: 'ts =now', updated_by: 'text?', updated_at: 'ts =now',
      activated_by: 'text?', activated_at: 'ts?', closed_by: 'text?', closed_at: 'ts?', close_note: 'text?',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'transformation' },
  },
};
