// M07 extension tables (owner: W3 · E3, F22 Handover 2030 board). Merged into SCHEMA through src/data/ext/schema.ts.
// Same DSL as src/data/schema.ts. Keep this file import-free except for `import type` (node scripts load it directly).
//
//   external_cover    SAMPLE plan of positions held by external or partner staff (KHNP OSSA, contractors) per role and plan year,
//                     one plan per as-of period. Counts only, never people. HR maintainers (observer_release R/W/A) and auditors
//                     read the plan; everyone else sees it only through rpc.handoverAggregate (suppressed below 10).
//   skill_outlooks    [W5E4] F35 saved skills outlooks (SIMULATED), see the block at the end.
//   handover_cohorts  SAMPLE trainees in COIT, LOIT, GPO, DNT and discipline cohorts earmarked to replace external cover, with the
//                     projected ready date from the programme length (SIMULATED). Counts only; same read rule.
import type { TableDef } from '../../../data/schema';

const HR_PLAN = [{ res: 'observer_release' }];

export const TABLES_M07: Record<string, TableDef> = {
  external_cover: {
    module: 'M07', label: 'Handover 2030: positions with external or partner cover by role and plan year (SAMPLE, counts only) (F22)',
    cols: {
      id: 'text pk', period: 'text idx', role_id: 'text ref:job_roles idx', function: 'text ref:job_families', year: 'int',
      partner: 'text enum:khnp_ossa|contractor|vendor =\'khnp_ossa\'', cover_count: 'int', source: 'text', sample: 'bool =true',
    },
    read: HR_PLAN as TableDef['read'], write: { mode: 'none' },
  },
  handover_cohorts: {
    module: 'M07', label: 'Handover 2030: trainee cohorts earmarked to replace external cover, with projected ready dates (SAMPLE/SIMULATED) (F22)',
    cols: {
      id: 'text pk', period: 'text idx', role_id: 'text ref:job_roles idx', route: 'text enum:coit|loit|gpo|dnt|discipline',
      programme_id: 'text? ref:programmes', talent_programme_id: 'text? ref:talent_programmes', label_en: 'text', label_ar: 'text',
      starts_on: 'date', ready_on: 'date', trainees: 'int', emirati: 'int =0', source: 'text', sample: 'bool =true',
    },
    read: HR_PLAN as TableDef['read'], write: { mode: 'none' },
  },
  // ───────────── W5 · E4 (F35 Skills supply-and-demand outlook, SIMULATED). Saved outlooks: the parameters and the suppressed,
  // aggregate-only results computed on the server (rpc.computeOutlook). HR plan maintainers (observer_release R/W/A: HR analyst,
  // HR director, admin, auditor) read them; HR saves, the HR director releases (line managers then read released outlooks
  // through rpc.releasedOutlooks). Never public. Writes only through the RPCs.
  skill_outlooks: {
    module: 'M07', label: 'Saved skills supply-and-demand outlooks (SIMULATED; aggregate, suppressed results) (F35)',
    cols: {
      id: 'text pk', name: 'text', params: 'json ={}', results: 'json ={}',
      status: 'text enum:draft|released|withdrawn =\'draft\' idx', summary_en: 'text =\'\'', summary_ar: 'text =\'\'',
      created_by: 'text', created_at: 'ts =now', updated_at: 'ts =now', computed_at: 'ts =now',
      released_by: 'text?', released_at: 'ts?', withdrawn_reason: 'text?', simulated: 'bool =true',
    },
    read: HR_PLAN as TableDef['read'], write: { mode: 'rpc', res: 'observer_release' },
  },
  // ───────────── FS53 (wave F · E2) External benchmark lines, kept apart from measured numbers. Each row copies one sourced FS01 figure
  // (kafaa_benchmarks.figures: key, value, unit, labels, as-of, one of the benchmark's https URLs); the guard trigger kafaa_bv_guard
  // (= benchmarkValueProblems in src/modules/m07/market.ts) refuses any drift. Figures the research packs flag as secondary or
  // unverified are stored held (shown = false, with a reason) and never drawn. Read wherever a workforce dashboard is visible
  // (workforce_analytics Agg/R: line managers, HR, auditors; observers hold Agg too and may read these public figures). Seed only.
  benchmark_values: {
    module: 'M07', label: 'External benchmark values for workforce dashboards: copies of sourced FS01 figures, market statistics never summed with measured numbers (FS53)',
    cols: {
      id: 'text pk', benchmark_id: 'text ref:benchmarks idx', figure_key: 'text', metric: 'text', label_en: 'text', label_ar: 'text',
      value: 'num', unit: 'text enum:pct|count|score', scale_max: 'num?', as_of: 'date', source_url: 'text',
      verification: 'text enum:primary|secondary|unverified', shown: 'bool =false', held_reason_en: 'text =\'\'', held_reason_ar: 'text =\'\'',
      pack_ref: 'text', compare_to: 'text? enum:ai_task_share|demand_growth_2030|digital_holders', dashboards: 'text[] =[]',
      note_en: 'text =\'\'', note_ar: 'text =\'\'', sort: 'int =0',
    },
    read: [{ res: 'workforce_analytics', special: 'agg_ok' }], write: { mode: 'none' },
  },
};
