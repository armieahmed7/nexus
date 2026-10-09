// M23 tables (owner: W3 · E1 · F18 Talent review, F19 Succession planning). Merged into SCHEMA by src/data/schema.ts;
// `npm run gen` regenerates types, SQL and RLS. Same DSL as src/data/schema.ts. Import-free except `import type`.
//
// Confidential (talent_review). Read rules:
//  - Every table except talent_priorities: `{ res: 'talent_review', where: 'listed' }` with `listed` always true, so only an
//    R/W/A grant reads rows directly (the HR director). Line managers and the HR business partner (talent_review Scope) read
//    through the SECURITY DEFINER RPCs (talentBoard, successionBoard …), which apply their scope and never return the caller's
//    own placement. Employees, auditors (audit log only), observers and partners read nothing.
//  - talent_priorities: the person (own_profile Own) reads their agreed development priorities; it holds no box, performance,
//    potential or pool field. HR director reads all.
import type { TableDef } from '../../../data/schema';

type RR = TableDef['read'];
const CONF: RR = [{ res: 'talent_review', where: 'listed' }];

export const TABLES_M23: Record<string, TableDef> = {
  // ───────────── F18 Talent review
  review_cycles: {
    module: 'M23', label: 'Talent review cycle per organisation unit: open → calibration → locked (F18, confidential)',
    cols: {
      id: 'text pk', code: 'text uniq', title_en: 'text', title_ar: 'text', period: 'text idx', family_ids: 'text[] =[]',
      status: 'text enum:open|calibration|locked =\'open\' idx', opened_by: 'text? ref:people', opened_on: 'date', due_on: 'date?',
      calibration_started_at: 'ts?', calibration_started_by: 'text? ref:people', calibrated_by: 'text? ref:people', calibrated_at: 'ts?',
      locked_by: 'text? ref:people', locked_at: 'ts?', lock_note: 'text?', listed: 'bool =true', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: CONF, write: { mode: 'rpc', res: 'talent_review' },
  },
  perf_ratings: {
    module: 'M23', label: 'Performance rating mirror 1-5 (synthetic HR field, SIMULATED) (F18, confidential)',
    cols: { id: 'text pk', person_id: 'text ref:people idx', period: 'text', rating: 'int', source: 'text', listed: 'bool =true' },
    read: CONF, write: { mode: 'none' },
  },
  review_placements: {
    module: 'M23', label: '9-box placement with evidence snapshot, calibration and development actions (F18, confidential)',
    cols: {
      id: 'text pk', cycle_id: 'text ref:review_cycles idx', person_id: 'text ref:people idx', perf: 'int', potential: 'int', anchors: 'json ={}',
      box: 'int', hipo: 'bool =false', perf_record: 'int?', evidence_snapshot: 'json ={}', evidence_index: 'int =0',
      placed_by: 'text ref:people', placed_at: 'ts =now', calibrated: 'bool =false', calibrated_by: 'text? ref:people', calibrated_at: 'ts?',
      note: 'text?', actions: 'json =[]', status: 'text enum:placed|locked =\'placed\'', history: 'json =[]', listed: 'bool =true', updated_at: 'ts =now',
    },
    read: CONF, write: { mode: 'rpc', res: 'talent_review' },
  },
  talent_priorities: {
    module: 'M23', label: 'Development priorities agreed in talent review, visible to the employee (no box or rating) (F18)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', cycle_id: 'text ref:review_cycles', period: 'text', priorities: 'json =[]',
      agreed_on: 'date', status: 'text enum:agreed|done =\'agreed\'', listed: 'bool =true', created_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, ...CONF], write: { mode: 'rpc', res: 'talent_review' },
  },
  talent_pool: {
    module: 'M23', label: 'HiPo pool from locked review cycles (feeds ESTADAD nominations, F16) (F18, confidential)',
    cols: {
      id: 'text pk', cycle_id: 'text ref:review_cycles idx', person_id: 'text ref:people idx', pool: 'text enum:hipo =\'hipo\'', since: 'date',
      programme_id: 'text?', status: 'text enum:active|left =\'active\'', listed: 'bool =true',
    },
    read: CONF, write: { mode: 'rpc', res: 'talent_review' },
  },

  // ───────────── F19 Succession planning
  succession_slates: {
    module: 'M23', label: 'Succession slate for a critical or leadership role and period (F19, confidential)',
    cols: {
      id: 'text pk', role_id: 'text ref:job_roles idx', period: 'text idx', status: 'text enum:draft|proposed|confirmed =\'draft\'',
      entity_id: 'text?', family_id: 'text?', critical: 'bool =false', leadership: 'bool =false', incumbent_en: 'text', incumbent_ar: 'text',
      target_bench: 'int =3', confirmed_by: 'text? ref:people', confirmed_at: 'ts?', confirm_note: 'text?', listed: 'bool =true', sort: 'int =0', updated_at: 'ts =now',
    },
    read: CONF, write: { mode: 'rpc', res: 'talent_review' },
  },
  successors: {
    module: 'M23', label: 'Successor (or external emergency cover role card) on a slate, readiness, gates and gap actions (F19, confidential)',
    cols: {
      id: 'text pk', slate_id: 'text ref:succession_slates idx', person_id: 'text? ref:people idx', cover_source: 'text enum:internal|khnp|contractor =\'internal\'',
      cover_label_en: 'text =\'\'', cover_label_ar: 'text =\'\'', readiness: 'text? enum:ready_now|1_2y|3_5y', computed_readiness: 'text? enum:ready_now|1_2y|3_5y',
      readiness_pct: 'int?', months: 'int?', gates: 'json =[]', gaps: 'json =[]', emergency: 'bool =false', actions: 'json =[]', note: 'text?',
      status: 'text enum:proposed|confirmed|withdrawn =\'proposed\' idx', proposed_by: 'text? ref:people', proposed_at: 'ts =now', confirmed_by: 'text? ref:people', confirmed_at: 'ts?',
      person_name: 'text =\'\'', person_name_ar: 'text =\'\'', person_role_id: 'text?', listed: 'bool =true', sort: 'int =0', updated_at: 'ts =now',
    },
    read: CONF, write: { mode: 'rpc', res: 'talent_review' },
  },
  bench_rollups: {
    module: 'M23', label: 'Bench roll-up from confirmed slates into M07 critical-role counts (before and after) (F19)',
    cols: {
      id: 'text pk', period: 'text idx', role_id: 'text ref:job_roles', slate_id: 'text ref:succession_slates', critical_role_id: 'text',
      before: 'json ={}', after: 'json ={}', rolled_by: 'text? ref:people', rolled_at: 'ts =now', listed: 'bool =true',
    },
    read: CONF, write: { mode: 'rpc', res: 'talent_review' },
  },
};
