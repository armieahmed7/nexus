// M25 tables (owner: W4 · E1 · F25 Training effectiveness, F26 Training needs forecast). Merged into SCHEMA by src/data/schema.ts;
// `npm run gen` regenerates types, SQL and RLS. Same DSL as src/data/schema.ts. Keep this file import-free except for `import type`.
//
// Read rules. `learning_analytics` gives training managers A, managers W and auditors R, and any R/W/A grant reads every row of a
// table whose rule names the resource. Person-level effectiveness rows therefore carry an always-false `open_read` column, so only
// the Own branch applies:
//  - eval_responses (L1): the respondent only. Instructors, managers and the training manager never read an individual response;
//    they get course results through rpc.effectivenessReport, which shows nothing under 10 responses.
//  - l3_observations (L3): the person observed and the observer of record. The training manager (A) and auditors (R) get the full
//    board, and line managers their own team's, through rpc.l3Board.
//  - demand_snapshots (F26): no direct reader; rpc.demandReport serves exact numbers to the training manager and auditors and
//    suppresses cells under 10 for aggregate-only viewers (managers, instructors, HR).
// Reference and aggregate rows are readable by every learning_analytics holder (agg_ok): evaluation designs, SAMPLE KPI links,
// redesign flags (also `sat` readers, so the F27 SAT workbench picks them up). Session proposals follow the M04 schedule
// (`training` R/W/A: instructors, training manager, auditors) because they show as drafts on /training/schedule.
import type { TableDef } from '../../../data/schema';

type RR = TableDef['read'];
const LA = 'learning_analytics';
const AGG: RR = [{ res: LA, special: 'agg_ok' }];

export const TABLES_M25: Record<string, TableDef> = {
  // ───────────── F25 Training effectiveness
  eval_surveys: {
    module: 'M25', label: 'Evaluation design per course: L1 form items, L2 pre/post knowledge checks, L3 checklist and timing, committee (F25)',
    cols: {
      id: 'text pk', course_id: 'text ref:courses uniq', committee: 'text enum:all_staff|operations|maintenance|rp_chem|engineering|emergency|leadership|training idx',
      l1_items: 'text[] =[]', pre_form_id: 'text? ref:assessment_forms', post_form_id: 'text? ref:assessment_forms', l3_days: 'int =90', l3_items: 'json =[]',
      active: 'bool =true', updated_at: 'ts =now',
    },
    read: [...AGG, { res: 'internal_content' }],
    write: { mode: 'none' },
  },
  eval_responses: {
    module: 'M25', label: 'L1 reaction response (anonymous to instructors and managers; person id kept only for duplicates and L3 scheduling) (F25)',
    cols: {
      id: 'text pk', course_id: 'text ref:courses idx', person_id: 'text ref:people idx', completion_ref: 'text uniq', completed_on: 'date',
      ratings: 'json ={}', recommend: 'bool =false', submitted_at: 'ts =now', open_read: 'bool =false',
    },
    read: [{ res: LA, person: 'person_id', where: 'open_read' }],
    write: { mode: 'rpc', res: LA },
  },
  l3_observations: {
    module: 'M25', label: 'L3 behaviour observation: supervisor checklist tied to the course objectives, due 90 days after completion (F25)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', course_id: 'text ref:courses idx', completion_ref: 'text uniq', completed_on: 'date',
      observer_person_id: 'text? ref:people idx', due_on: 'date idx', items: 'json =[]', status: 'text enum:scheduled|done|cancelled =\'scheduled\' idx',
      note: 'text?', recorded_by: 'text?', recorded_at: 'ts?', scheduled_at: 'ts =now', open_read: 'bool =false',
    },
    read: [{ res: LA, person: 'person_id', where: 'open_read' }, { res: LA, person: 'observer_person_id', where: 'open_read' }],
    write: { mode: 'rpc', res: LA },
  },
  course_kpi_links: {
    module: 'M25', label: 'L4 results: a SAMPLE plant KPI linked to a course (association, not causation) (F25)',
    cols: {
      id: 'text pk', course_id: 'text ref:courses idx', kpi: 'text enum:rework_rate|hu_event_rate|first_time_pass', label_en: 'text', label_ar: 'text', unit: 'text',
      direction: 'text enum:lower_better|higher_better', series: 'json =[]', note_en: 'text =\'\'', note_ar: 'text =\'\'', sample: 'bool =true',
    },
    read: AGG,
    write: { mode: 'none' },
  },
  redesign_flags: {
    module: 'M25', label: 'Course flagged for redesign by the training manager, with the evidence; feeds the F27 SAT workbench (F25)',
    cols: {
      id: 'text pk', course_id: 'text ref:courses idx', reasons: 'json =[]', note: 'text =\'\'', status: 'text enum:open|in_sat|closed =\'open\' idx',
      raised_by: 'text', raised_by_name: 'text =\'\'', raised_at: 'ts =now', sat_ref: 'text?',
    },
    read: [...AGG, { res: 'sat' }],
    write: { mode: 'rpc', res: LA },
  },

  // ───────────── F26 Training needs and demand forecast
  needs_links: {
    module: 'M25', label: 'Training needs mapping: requalification course per standard, cross-training course per job family (F26)',
    cols: { id: 'text pk', kind: 'text enum:requal|family', from_id: 'text idx', course_id: 'text ref:courses', note: 'text =\'\'' },
    read: [...AGG, { res: 'internal_content' }],
    write: { mode: 'none' },
  },
  demand_snapshots: {
    module: 'M25', label: 'Demand per course, quarter and source with its role drill-down (exact; served suppressed to aggregate viewers) (F26)',
    cols: {
      id: 'text pk', period: 'text idx', course_id: 'text ref:courses idx', source: 'text enum:expiry|mandatory|klra|roadmap|coach|future',
      count: 'int =0', suppressed: 'bool =false', detail: 'json =[]', computed_at: 'ts =now', computed_by: 'text?', open_read: 'bool =false',
    },
    read: [{ res: LA, where: 'open_read' }],
    write: { mode: 'rpc', res: LA },
  },
  session_proposals: {
    module: 'M25', label: 'Draft session proposal for the scheduler (never published; sessions are created through the M04 schedule) (F26)',
    cols: {
      id: 'text pk', period: 'text idx', course_id: 'text ref:courses idx', kind: 'text enum:class|simulator|drill|elearning|clinic', sessions: 'int', seats_each: 'int',
      dates: 'text[] =[]', demand: 'int =0', shortfall: 'int =0', status: 'text enum:draft|scheduled|withdrawn =\'draft\' idx', session_id: 'text? ref:sessions',
      note: 'text =\'\'', created_by: 'text', created_at: 'ts =now', decided_by: 'text?', decided_at: 'ts?',
    },
    read: [{ res: 'training' }],
    write: { mode: 'rpc', res: LA },
  },

  // ───────────── FS56 Skill-change effectiveness (FS wave F · E4). Aggregates only, already suppressed when stored (no cell under 10).
  skill_change_measures: {
    module: 'M25', label: 'Skill change per course or pathway: F01 level before and 90 days after, with a matched comparison where available (FS56)',
    cols: {
      id: 'text pk', kind: 'text enum:course|pathway idx', item_id: 'text idx', as_of: 'date', window_days: 'int =90',
      completers: 'int?', measured: 'int?', suppressed: 'bool =false', before_x100: 'int?', after_x100: 'int?', change_x100: 'int?', moved_pct: 'int?',
      comparison_people: 'int?', comparison_change_x100: 'int?', net_x100: 'int?', method: 'text? enum:matched|before_after',
      verdict: 'text enum:moves|some|flat|window_open|suppressed idx', next_on: 'date?', skills: 'json =[]', reasons: 'json =[]',
      computed_at: 'ts =now', computed_by: 'text?',
    },
    read: AGG,
    write: { mode: 'rpc', res: LA },
  },
  // ───────────── FS57 Curriculum coverage: the decision layer over the FS17 gap backlog (M19 pathway_gaps) and uncovered role skills.
  gap_backlog: {
    module: 'M25', label: 'Gap-filling backlog: one row per skill and level the catalogue should reach, with owner, date and build / partner / buy (FS57)',
    cols: {
      id: 'text pk', skill_id: 'text ref:skills idx', level: 'int', owner_role: 'text', owner_person_id: 'text? ref:people', due_on: 'date?',
      route: 'text? enum:build|partner|buy', rationale: 'text =\'\'', rationale_ar: 'text?', plan: 'json?', predicted: 'json =[]',
      status: 'text enum:open|decided =\'open\' idx', first_seen: 'date', created_by: 'text', decided_by: 'text?', decided_at: 'ts?', history: 'json =[]', updated_at: 'ts =now',
    },
    read: AGG,
    write: { mode: 'rpc', res: LA },
  },
};
