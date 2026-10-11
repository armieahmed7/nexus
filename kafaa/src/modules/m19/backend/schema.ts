// M19 tables (owner: W1 · E3, F07 Learning Coach). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly).
// Both tables are private to the person (own_profile: Own only, nobody holds Scope or R on it). HR sees aggregated
// acceptance rates only, through rpc.coachInsights (suppressed below MIN_GROUP_SIZE).
import type { TableDef } from '../../../data/schema';

export const TABLES_M19: Record<string, TableDef> = {
  coach_feedback: {
    module: 'M19', label: 'Learning Coach feedback per person and suggestion: saved, dismissed (hidden 90 days), enrolled (F07)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', item_kind: 'text enum:course|practice|ojt|mentor|opportunity|reading|refresher idx', item_id: 'text',
      signal: 'text enum:saved|dismissed|enrolled|cleared', competency_ids: 'text[] =[]', at: 'ts =now', hidden_until: 'date?',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
  learning_goals: {
    module: 'M19', label: 'Weekly learning goal in hours and coach focus roles: optional and private, no streaks (F07)',
    cols: { id: 'text pk', person_id: 'text ref:people uniq', hours_per_week: 'num =0', focus_role_ids: 'text[] =[]', updated_at: 'ts =now' },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'direct', res: 'own_profile', own: true },
  },
  // W2 · E3 · F14 Knowledge refreshers: one Leitner state per person and practice item (written only by rpc.submitRefresher; an SQL
  // trigger refuses any item that is not an approved practice-bank item). Private: own rows only. Instructors see item difficulty
  // only as aggregates through rpc.refresherItemStats (suppressed under 10 people).
  refresh_state: {
    module: 'M19', label: 'Knowledge refresher state per person and practice item: Leitner box 1-5, due date, counts (F14; private)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', item_id: 'text ref:items idx', competency_id: 'text? ref:competencies', box: 'int =1', due_on: 'date',
      last_result: 'text? enum:correct|wrong', last_at: 'ts?', attempts: 'int =0', correct: 'int =0', created_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
  refresh_prefs: {
    module: 'M19', label: 'Knowledge refresher cadence: five questions a day or a week, or paused (F14; private, no streaks)',
    cols: { id: 'text pk', person_id: 'text ref:people uniq', cadence: 'text enum:daily|weekly|paused =\'weekly\'', updated_at: 'ts =now' },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'direct', res: 'own_profile', own: true },
  },

  // ───────────── FS wave C · E1 · FS17 Future-skill learning pathways (rules: src/modules/m19/pathways.ts; SQL 20261010231001)
  // Pathway definitions and steps are internal learning content (staff read published rows; training staff and auditors read drafts);
  // written only by rpc.savePathway (training manager). Progress rows are the person's own; colleagues' times reach anyone only as
  // suppressed aggregates (peerStats, MIN_GROUP_SIZE). Gap rows are the FS57 backlog of "requested" steps (training staff).
  pathways: {
    module: 'M19', label: 'Future-skill learning pathway: one FS02 skill at one level (L1-L3), a 3-6 month envelope and a weekly hour cost (FS17)',
    cols: {
      id: 'text pk', skill_id: 'text ref:skills idx', level: 'int', title_en: 'text', title_ar: 'text', summary_en: 'text =\'\'', summary_ar: 'text =\'\'',
      outcome_en: 'text =\'\'', outcome_ar: 'text =\'\'', envelope_months: 'int', weekly_hours: 'num', status: 'text enum:draft|published|retired =\'draft\' idx',
      listed: 'bool =false', version: 'int =1', benchmark_ids: 'text[] =[]', sources: 'json =[]', updated_by: 'text?', updated_at: 'ts =now', sort: 'int =0',
    },
    read: [{ res: 'internal_content', where: 'listed' }, { res: 'sat' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'internal_content' },
  },
  pathway_steps: {
    module: 'M19', label: 'Pathway step in sequence (learn, practice, assess) with hours; content resolves at run time from pins and items that teach the skill at the level (FS17)',
    cols: {
      id: 'text pk', pathway_id: 'text ref:pathways idx', n: 'int', kind: 'text enum:learn|practice|assess', title_en: 'text', title_ar: 'text', hours: 'num',
      pins: 'text[] =[]', auto: 'bool =true', version: 'int =1',
    },
    read: [{ res: 'internal_content' }, { res: 'sat' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'internal_content' },
  },
  pathway_enrolments: {
    module: 'M19', label: 'My progress on a pathway: started, completed or left; step completion is derived from my records, never typed in (FS17; private)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', pathway_id: 'text ref:pathways idx', status: 'text enum:active|completed|withdrawn =\'active\' idx',
      started_on: 'date', completed_on: 'date?', withdrawn_on: 'date?', withdrawn_reason: 'text?', steps_done: 'json =[]', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
  pathway_gaps: {
    module: 'M19', label: 'Gap backlog: a pathway step with no content that teaches its skill at its level ("requested"; feeds FS57) (FS17)',
    cols: {
      id: 'text pk', pathway_id: 'text ref:pathways idx', step_id: 'text ref:pathway_steps', skill_id: 'text ref:skills idx', level: 'int', kind: 'text enum:learn|practice|assess',
      status: 'text enum:open|filled =\'open\' idx', first_seen: 'date', last_checked: 'date', filled_on: 'date?',
    },
    read: [{ res: 'sat' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'sat' },
  },
  // ───────────── FS wave C · E1 · FS18 Curated, outcome-gated external catalogue
  external_resources: {
    module: 'M19', label: 'External learning resource (IAEA, WNU, NEA, universities, AI courses): provider, hours, cost band, languages, skills taught, as-of; published only when it meets the criteria (FS18)',
    cols: {
      id: 'text pk', title_en: 'text', title_ar: 'text', provider_en: 'text', provider_ar: 'text', provider_url: 'text', url: 'text', format: 'text enum:elearning|mooc|course|fellowship|programme|webinar|reading',
      hours: 'num?', duration_en: 'text =\'\'', duration_ar: 'text =\'\'', cost_band: 'text enum:free|low|medium|high|varies', languages: 'text[] =[]', skills: 'json =[]',
      has_assessment: 'bool =false', summary_en: 'text =\'\'', summary_ar: 'text =\'\'', criteria: 'json ={}', criteria_note_en: 'text =\'\'', criteria_note_ar: 'text =\'\'',
      as_of: 'date', sources: 'json =[]', status: 'text enum:draft|published|retired =\'draft\' idx', listed: 'bool =false', version: 'int =1',
      published_by: 'text?', published_on: 'date?', retired_reason: 'text?', retired_on: 'date?', created_by: 'text?', updated_by: 'text?', updated_at: 'ts =now', sort: 'int =0',
    },
    read: [{ res: 'internal_content', where: 'listed' }, { res: 'sat' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'internal_content' },
  },
  catalogue_criteria: {
    module: 'M19', label: 'Published admission criteria for the external catalogue (relevance, provider standing, assessment, language) with a 0-3 scale and the minimum to publish (FS18)',
    cols: {
      id: 'text pk', name_en: 'text', name_ar: 'text', question_en: 'text', question_ar: 'text', scale: 'json =[]', min_score: 'int =0', required: 'bool =true',
      status: 'text enum:published|retired =\'published\'', benchmark_ids: 'text[] =[]', sources: 'json =[]', as_of: 'date', sort: 'int =0',
    },
    read: [{ res: 'internal_content' }, { res: 'sat' }, { res: 'audit_log' }],
    write: { mode: 'none' },
  },
  external_completions: {
    module: 'M19', label: 'My completion of an external resource: recorded through xAPI as "experienced", self-declared until verified (FS79); never verified evidence (FS18; private)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', resource_id: 'text ref:external_resources idx', completed_on: 'date', note: 'text?',
      evidence: 'text enum:self_declared|verified =\'self_declared\'', statement_id: 'text?', created_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
};
