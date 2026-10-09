// M04 extension tables (owner: W2 · E3, F13 Mentoring 2.0). Merged into SCHEMA through src/data/ext/schema.ts; `npm run gen`
// regenerates types, SQL and RLS. Same DSL as src/data/schema.ts (where the M04 mentors / mentoring_requests blocks live).
// Keep this file import-free except for `import type` (node scripts load it directly).
// Live DDL, RLS and RPCs: supabase/migrations/20261009123001_kafaa_w2e3_mentoring_refreshers.sql.
//
// Privacy: agreements and shared session logs are readable only by the two people in the pair (own_profile Own on either person
// column; nobody holds R, W, A or Scope on own_profile, so not managers, HR, the training manager or admins). Private session
// notes live in their own table because row-level security works on rows: each note is readable by its author only. The training
// manager sees the programme only as aggregates (rpc.mentoringProgramme, suppressed under 10 pairs).
import type { TableDef } from '../../../data/schema';

const PAIR = [{ res: 'own_profile', person: 'person_id' }, { res: 'own_profile', person: 'mentor_person_id' }];

export const TABLES_M04: Record<string, TableDef> = {
  mentoring_agreements: {
    module: 'M04', label: 'Mentoring agreement: skill goals, cadence and duration, close-out ratings (F13; the pair only)',
    cols: {
      id: 'text pk', request_id: 'text ref:mentoring_requests uniq', mentor_id: 'text ref:mentors idx', person_id: 'text ref:people idx', mentor_person_id: 'text ref:people idx',
      mentoring_type: 'text enum:career|knowledge_transfer|leadership|reverse|peer_onboarding idx', goals: 'json =[]',
      cadence: 'text enum:weekly|fortnightly|monthly', starts_on: 'date', ends_on: 'date',
      status: 'text enum:proposed|active|closing|closed|declined =\'proposed\' idx', proposed_by: 'text ref:people', proposed_at: 'ts =now', responded_at: 'ts?', decline_note: 'text?',
      mentee_ratings: 'json?', mentor_ratings: 'json?', mentee_note: 'text?', mentor_note: 'text?', mentee_closed_at: 'ts?', mentor_closed_at: 'ts?', closed_at: 'ts?',
      attainment_pct: 'num?', validated_skill_ids: 'text[] =[]', validated_claim_ids: 'text[] =[]', updated_at: 'ts =now',
    },
    read: PAIR as TableDef['read'], write: { mode: 'rpc', res: 'own_profile' },
  },
  mentoring_sessions: {
    module: 'M04', label: 'Mentoring session log: date, minutes, skills touched and a shared note (F13; the pair only)',
    cols: {
      id: 'text pk', agreement_id: 'text ref:mentoring_agreements idx', person_id: 'text ref:people idx', mentor_person_id: 'text ref:people idx',
      held_on: 'date', minutes: 'int =60', skill_ids: 'text[] =[]', topics: 'text =\'\'', note_shared: 'text =\'\'', logged_by: 'text ref:people', logged_at: 'ts =now',
    },
    read: PAIR as TableDef['read'], write: { mode: 'rpc', res: 'own_profile' },
  },
  mentoring_private_notes: {
    module: 'M04', label: 'Private mentoring session note: readable by its author only (F13)',
    cols: {
      id: 'text pk', session_id: 'text ref:mentoring_sessions idx', agreement_id: 'text ref:mentoring_agreements idx', author_person_id: 'text ref:people idx',
      note: 'text', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'author_person_id' }], write: { mode: 'rpc', res: 'own_profile' },
  },
};

// ───────────── W4 · E3 (F28 Simulator scenario library and coverage). Training scenarios only (purpose is always 'training';
// exam content is refused). Library, objectives and cycle plans: simulator instructors and the training manager (sat R/W/A) and
// training staff (training R/W/A, which includes line managers' A) read; writes go through the kafaa_sim_* RPCs only.
// Crew debriefs: instructors, the training manager and auditors read the debrief (sat); each crew member reads their own
// member row and managers / instructors their scope (skills_profile Own/Scope); the debrief view for crews is rpc.simDebriefs.
// Live DDL, RLS and RPCs: supabase/migrations/20261009143001_kafaa_w4e3_simulator.sql. Rules: src/modules/m04/scenarios.ts.
const SIM_READ: TableDef['read'] = [{ res: 'sat' }, { res: 'training' }];
export const TABLES_M04_SIM: Record<string, TableDef> = {
  sim_objectives: {
    module: 'M04', label: 'Simulator training objective catalogue (generic, sourced to IAEA SAT and simulator guidance) (F28)',
    cols: {
      id: 'text pk', code: 'text uniq', title_en: 'text', title_ar: 'text', category: 'text enum:normal|abnormal|emergency|severe_accident|team idx',
      competency_id: 'text ref:competencies idx', programmes: 'text[] =[]', active: 'bool =true', sort: 'int =0', sources: 'json =[]',
    },
    read: [{ res: 'internal_content' }, { res: 'sat' }], write: { mode: 'none' },
  },
  sim_scenarios: {
    module: 'M04', label: 'Simulator training scenario (metadata only; never exam content): objectives, competencies, positions, fidelity, revision (F28)',
    cols: {
      id: 'text pk', code: 'text uniq', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', events_en: "text =''", events_ar: "text =''",
      category: 'text enum:normal|abnormal|emergency|severe_accident idx', purpose: "text enum:training ='training'",
      objective_ids: 'text[] =[]', competency_ids: 'text[] =[]', positions: 'text[] =[]', duration_min: 'int', fidelity: 'text enum:full_scope|limited_scope|desktop',
      programmes: 'text[] =[]', status: "text enum:draft|in_review|approved|retired ='draft' idx", revision: 'int =1',
      author_person_id: 'text? ref:people', last_edited_by: 'text? ref:people', submitted_at: 'ts?', approved_by: 'text? ref:people', approved_at: 'ts?', review_note: 'text?',
      last_run_on: 'date?', run_count: 'int =0', history: 'json =[]', sources: 'json =[]', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: SIM_READ, write: { mode: 'rpc', res: 'sat' },
  },
  sim_cycles: {
    module: 'M04', label: 'COCT/LOCT simulator cycle plan (two years in segments) with required objectives and competencies (F28)',
    cols: {
      id: 'text pk', programme: 'text enum:coct|loct idx', label_en: 'text', label_ar: 'text', starts_on: 'date', ends_on: 'date', segments: 'int =8',
      requirements: 'json =[]', required_competency_ids: 'text[] =[]', status: "text enum:draft|submitted|approved|closed ='draft' idx",
      planned_by: 'text? ref:people', planned_at: 'ts?', approved_by: 'text? ref:people', approved_at: 'ts?', gap_note: 'text?', sources: 'json =[]',
    },
    read: SIM_READ, write: { mode: 'rpc', res: 'sat' },
  },
  sim_cycle_items: {
    module: 'M04', label: 'Scenario planned in a cycle segment (inactive when removed from the plan) (F28)',
    cols: {
      id: 'text pk', cycle_id: 'text ref:sim_cycles idx', scenario_id: 'text ref:sim_scenarios idx', segment: 'int', active: 'bool =true',
      added_by: 'text? ref:people', added_at: 'ts =now',
    },
    read: SIM_READ, write: { mode: 'rpc', res: 'sat' },
  },
  crew_debriefs: {
    module: 'M04', label: 'Structured crew debrief after a simulator scenario: instructor team ratings, crew self-ratings and self-critique (F28)',
    cols: {
      id: 'text pk', slot_id: 'text ref:simulator_slots idx', scenario_id: 'text ref:sim_scenarios idx', cycle_id: 'text? ref:sim_cycles idx', crew: 'text', simulator: 'text',
      held_on: 'date idx', instructor_person_id: 'text ref:people', ratings: 'json ={}', self_ratings: 'json?',
      strengths_en: 'text?', strengths_ar: 'text?', improvements_en: 'text?', improvements_ar: 'text?', critique_en: 'text?', critique_ar: 'text?',
      present_count: 'int =0', absent_count: 'int =0', evidence_count: 'int =0', xapi: 'json =[]', recorded_at: 'ts =now',
      // 'import': history from the training records system before Kafa'a captured debriefs (no skills evidence); 'kafaa': recordDebrief
      source: "text enum:kafaa|import ='kafaa'",
    },
    read: [{ res: 'sat' }], write: { mode: 'rpc', res: 'sat' },
  },
  crew_debrief_members: {
    module: 'M04', label: 'Crew member on a debrief: position, present or absent, and the F01 evidence written for them (F28)',
    cols: {
      id: 'text pk', debrief_id: 'text ref:crew_debriefs idx', person_id: 'text ref:people idx', crew: 'text', position: 'text enum:ss|sro|ro|sta|lo',
      present: 'bool', scenario_id: 'text ref:sim_scenarios', held_on: 'date', evidence_ids: 'text[] =[]',
    },
    read: [{ res: 'sat' }, { res: 'skills_profile', person: 'person_id' }], write: { mode: 'rpc', res: 'sat' },
  },
};

// W4E3: one M04 block for src/data/ext/schema.ts (mentoring tables first, then the simulator tables).
Object.assign(TABLES_M04, TABLES_M04_SIM);
