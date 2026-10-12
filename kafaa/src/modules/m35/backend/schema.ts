// M35 tables (owners: wave F E1 (FS50, FS51) and wave G E1 (FS60, FS61)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
//
// RBAC (FS wave F · E1; logged in the CONTRACT changelog): workforce_strategy only (hr_analyst Agg/W, hr_director Agg/W/A,
// training_manager Agg, admin R, auditor R; never public, no staff grant). The three tables hold no person-level data (aggregate,
// suppressed results; owner and reviewer are role cards), so the read rule is `agg_ok` (Agg, R, W or A). Writes only through RPCs:
// FS50 saveCriticalSkill (W drafts, A adopts or retires), reviewCriticalSkill (A); FS51 saveSkillForecast (W), releaseSkillForecast (A).
import type { TableDef } from '../../../data/schema';

const WS = [{ res: 'workforce_strategy' as const, special: 'agg_ok' as const }];

export const TABLES_M35: Record<string, TableDef> = {
  // ───────────── FS50 Critical Future-Skills Register
  critical_skills: {
    module: 'M35', label: 'Critical future skill on the strategic register: owner (function and role card), target level, people-equivalent targets by year, KPIs, build/buy/borrow/bot decision with rationale, FS04 gap plans; progress is computed, never stored (FS50)',
    cols: {
      id: 'text pk', skill_id: 'text ref:skills uniq', owner_function: 'text', owner_person_id: 'text ref:people idx', target_level: 'int',
      targets: 'json =[]', kpis: 'json =[]', decision: 'text enum:build|buy|borrow|bot', rationale_en: 'text', rationale_ar: 'text',
      decision_history: 'json =[]', gap_plan_ids: 'text[] =[]', status: 'text enum:draft|active|retired =\'draft\' idx', adopted_on: 'date?',
      version: 'int =1', sort: 'int =0', benchmark_ids: 'text[] =[]', created_by: 'text', created_at: 'ts =now', updated_by: 'text?', updated_at: 'ts =now',
    },
    read: WS,
    write: { mode: 'rpc', res: 'workforce_strategy' },
  },
  critical_skill_reviews: {
    module: 'M35', label: 'Quarterly review of a critical future skill by the HR director: rating, the computed progress snapshot, notes EN/AR and any decision change; audited and ledgered (FS50)',
    cols: {
      id: 'text pk', critical_skill_id: 'text ref:critical_skills idx', quarter: 'text', rating: 'text enum:met|on_track|at_risk|off_track',
      progress: 'json ={}', note_en: 'text', note_ar: 'text', decision_before: 'text', decision_after: 'text', reviewed_by: 'text', reviewed_at: 'ts =now',
    },
    read: WS,
    write: { mode: 'rpc', res: 'workforce_strategy' },
  },

  // ───────────── FS51 Three-scenario skill forecasting bands
  skill_forecasts: {
    module: 'M35', label: 'Saved three-scenario skill forecast (baseline, ADVANCE, accelerated; SIMULATED): annual cycle and version, assumptions, aggregate suppressed results, method basis, release (FS51)',
    cols: {
      id: 'text pk', cycle: 'int idx', version: 'int', name: 'text', scenario: 'text enum:baseline|advance|accelerated =\'baseline\'',
      params: 'json ={}', results: 'json ={}', basis: 'json ={}', method: 'text', status: 'text enum:draft|released|superseded =\'draft\' idx',
      summary_en: 'text =\'\'', summary_ar: 'text =\'\'', created_by: 'text', created_at: 'ts =now', updated_at: 'ts =now',
      released_by: 'text?', released_at: 'ts?', superseded_by: 'text?', simulated: 'bool =true',
    },
    read: WS,
    write: { mode: 'rpc', res: 'workforce_strategy' },
  },
};
