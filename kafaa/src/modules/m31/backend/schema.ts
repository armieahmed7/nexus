// M31 tables (owners: wave E E1 (FS38, FS39, FS40)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
//
// RBAC (M31 has no policy resource of its own; logged in the CONTRACT changelog, FS wave E · E1):
//  - FS38 smr_deltas: skills_taxonomy R (every role, the public included) reads published rows (`listed`); drafts and retired rows for
//    audit_log R (admin, auditors) and sat (instructors, training manager). Writes through saveSmrDelta: frameworks W/A.
//  - FS39 plant_visits: the visitor and the named host only (own_profile on person_id / host_person_id); writes through RPCs.
//  - FS40 twin_scenarios: internal_content R (staff) reads published rows; secure_items (instructors, training manager) all rows.
//    twin_keys: secure_items only (staff never read a key). twin_attempts: own rows only. Authoring needs secure_items A.
import type { TableDef } from '../../../data/schema';

export const TABLES_M31: Record<string, TableDef> = {
  // ───────────── FS38 SMR delta overlay for every Barakah role
  smr_deltas: {
    module: 'M31', label: 'SMR delta for one current Barakah role on one ADVANCE technology family: what changes (by dimension), what stays, skills, delta training and sources; planning assumption, no deployment decision implied (FS38)',
    cols: {
      id: 'text pk', role_id: 'text ref:job_roles idx', tech_id: 'text ref:adv_technologies idx', rank: 'int', path_only: 'bool =false',
      dims: 'json =[]', changes_en: 'text', changes_ar: 'text', stays_en: 'text', stays_ar: 'text',
      skills: 'json =[]', training: 'json =[]', concept_role_ids: 'text[] =[]', sources: 'json =[]', benchmark_ids: 'text[] =[]',
      status: 'text enum:draft|published|retired =\'draft\' idx', listed: 'bool =false', version: 'int =1', as_of: 'date', sort: 'int =0',
      updated_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'skills_taxonomy', where: 'listed' }, { res: 'audit_log' }, { res: 'sat' }],
    write: { mode: 'rpc', res: 'frameworks' },
  },

  // ───────────── FS39 Plant literacy for everyone and a reference-plant log
  plant_visits: {
    module: 'M31', label: 'Reference-plant visit or simulator observation logged by a person and confirmed (or declined) by the named host; confirmed visits write capped F01 evidence (FS39)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', kind: 'text enum:reference_plant|simulator_observation|partner_facility idx', host_person_id: 'text ref:people idx',
      visit_on: 'date', hours: 'num', note: 'text =\'\'', status: 'text enum:logged|confirmed|declined|withdrawn =\'logged\' idx',
      decided_by: 'text?', decided_at: 'ts?', decline_reason: 'text?', level: 'int =0', evidence: 'json =[]', created_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'own_profile', person: 'host_person_id' }],
    write: { mode: 'rpc', res: 'skills_profile' },
  },

  // ───────────── FS40 Digital-twin diagnosis drills
  twin_scenarios: {
    module: 'M31', label: 'Digital-twin diagnosis drill: synthetic plant-model trend set (SIMULATED, SYN-TW code), components, failure modes, checks, actions and rationales; no answers (the key is in twin_keys) (FS40)',
    cols: {
      id: 'text pk', code: 'text uniq', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', scenario_en: 'text', scenario_ar: 'text',
      system_en: 'text', system_ar: 'text', difficulty: 'int', level: 'int', skill_ids: 'text[] =[]', series: 'json ={}', components: 'json =[]', modes: 'json =[]',
      checks: 'json =[]', actions: 'json =[]', rationales: 'json =[]', max_checks: 'int =3', est_minutes: 'int =12', synthetic: 'bool =true', sources: 'json =[]',
      status: 'text enum:draft|published|retired =\'draft\' idx', listed: 'bool =false', version: 'int =1', sort: 'int =0', updated_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'internal_content', where: 'listed' }, { res: 'secure_items' }],
    write: { mode: 'rpc', res: 'secure_items' },
  },
  twin_keys: {
    module: 'M31', label: 'Answer key of a digital-twin drill: the degrading component and mode, useful and unsafe checks, conservative and unsafe actions, sound rationales; training staff only (FS40)',
    cols: {
      id: 'text pk', scenario_id: 'text ref:twin_scenarios uniq', component_id: 'text', mode_id: 'text', useful_checks: 'text[] =[]', unsafe_checks: 'text[] =[]',
      conservative_actions: 'text[] =[]', best_action: 'text', unsafe_actions: 'text[] =[]', sound_rationales: 'text[] =[]', explain: 'json ={}', pass_pct: 'int =70',
    },
    read: [{ res: 'secure_items' }],
    write: { mode: 'rpc', res: 'secure_items' },
  },
  twin_attempts: {
    module: 'M31', label: 'One person\'s submitted digital-twin drill: checks, diagnosis, action, rationales, score, pass, level and the capped evidence it wrote (FS40)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', scenario_id: 'text ref:twin_scenarios idx', scenario_version: 'int', attempt_no: 'int',
      checks: 'text[] =[]', component_id: 'text', mode_id: 'text', action_id: 'text', rationale_ids: 'text[] =[]',
      points: 'int', max_points: 'int', pct: 'int', critical_ok: 'bool', passed: 'bool', level: 'int =0',
      feedback: 'json ={}', reasons: 'json =[]', evidence: 'json =[]', submitted_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'secure_items' },
  },
};
