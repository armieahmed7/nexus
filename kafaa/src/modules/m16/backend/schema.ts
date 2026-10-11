// M16 tables added by W3 · E5 (F24 Recommendation transparency, opt-out and fairness monitor). Merged into SCHEMA by
// src/data/ext/schema.ts; `npm run gen` regenerates types, SQL and RLS. Same DSL as src/data/schema.ts; import type only.
// Access (no new policy resource; BACKLOG F24 RBAC mapped onto existing grants):
//  - engine_cards: staff read (internal_content R): every employee can see how each recommendation works.
//  - reco_optouts: the person only (own_profile Own); admins see per-surface counts through rpc.optoutStats (suppressed < 10).
//  - fairness_snapshots: admin and ai-governance (integrations A), auditors (integrations R) and HR aggregates
//    (skills_profile Agg, also training_manager A). Rows are aggregates only, already suppressed below MIN_GROUP_SIZE.
//  - engine_changes: the change log of F02 engine settings: admins and auditors (integrations R/A).
// All four change only through RPCs (setRecoOptout, runFairnessSnapshot, changeEngineWeights / setEngineWeights).
import type { TableDef } from '../../../data/schema';

export const TABLES_M16: Record<string, TableDef> = {
  engine_cards: {
    module: 'M16', label: 'Model and engine card per recommendation surface: inputs used and never used, weights, owner, oversight, last change (F24)',
    cols: {
      id: 'text pk', engine_surface: 'text enum:skills|recommend|match|search idx', module: 'text', route: 'text', feature: 'text',
      title_en: 'text', title_ar: 'text', purpose_en: 'text', purpose_ar: 'text', owner_en: 'text', owner_ar: 'text',
      inputs_used: 'json =[]', inputs_excluded: 'text[] =[]', scoring_functions: 'text[] =[]', weight_keys: 'text[] =[]',
      output_en: 'text', output_ar: 'text', oversight_en: 'text', oversight_ar: 'text', limitations_en: 'text', limitations_ar: 'text',
      opt_out: 'bool =false', version: 'int =1', last_changed_at: 'ts =now', last_change_id: 'text?', sources: 'json =[]', sort: 'int =0',
    },
    read: [{ res: 'internal_content' }],
    write: { mode: 'rpc', res: 'integrations' },
  },
  reco_optouts: {
    module: 'M16', label: 'Per-person, per-surface opt-out of ranked recommendations (F24; private to the person)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', surface: 'text enum:navigator|coach|marketplace idx', opted_out: 'bool =true',
      reason: 'text?', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
  fairness_snapshots: {
    module: 'M16', label: 'Weekly fairness monitor: outcome rate per group with suppression below 10 and the four-fifths flag (F24; aggregates only)',
    cols: {
      id: 'text pk', period: 'text idx', as_of: 'date', surface: 'text enum:navigator|marketplace|mentoring|talent_evidence', metric: 'text enum:navigator_ready|opportunity_selected|mentoring_matched|hipo_pool idx',
      dimension: 'text enum:gender|nationality', group_key: 'text enum:f|m|uae|other', n: 'int?', positives: 'int?', rate: 'num?', ratio: 'num?',
      suppressed: 'bool =false', flagged: 'bool =false', source: 'text', run_by: 'text?', created_at: 'ts =now',
    },
    read: [{ res: 'integrations' }, { res: 'skills_profile', special: 'agg_ok' }],
    write: { mode: 'rpc', res: 'integrations' },
  },
  engine_changes: {
    module: 'M16', label: 'Change log of engine settings and weights (F02 settings): before, after, rationale, audit and ledger (F24)',
    cols: {
      id: 'text pk', surface: 'text enum:skills|recommend|match|search idx', engine_before: 'text?', engine_after: 'text', weights_before: 'json ={}', weights_after: 'json ={}',
      rationale: 'text?', card_ids: 'text[] =[]', changed_by: 'text?', changed_by_role: 'text?', changed_at: 'ts =now', audit_seq: 'int?', ledger_seq: 'int?',
    },
    read: [{ res: 'integrations' }],
    write: { mode: 'rpc', res: 'integrations' },
  },
};
