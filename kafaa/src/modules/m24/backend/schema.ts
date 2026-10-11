// M24 tables (owner: W3 · E2 · F20 Knowledge loss risk assessment, F21 Knowledge capture studio).
// Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Keep this file import-free except for `import type` (node scripts load it directly).
//
// Read rules. `knowledge` is readable by every staff role (R), so a plain `{ res: 'knowledge' }` rule would show a row to
// all staff. The KLRA tables therefore carry an always-false `open_read` column: the R/W/A branch never applies, and the
// only table-level readers are department heads for people in their scope (knowledge Scope, managers). The KM owner
// (knowledge A, the training manager in the demo) reads every KLRA row through rpc.klraRegister / klraPosition, and HR
// (knowledge Agg) sees only the suppressed department heatmap from rpc.klraHeatmap. Never public, never staff-wide.
//  - klra_settings: thresholds; served inside the KLRA RPC payloads (table rule as above on `updated_by`).
//  - klra_positions: the position register (synthetic HR feed bands + F11 single-point-of-failure snapshot). No birth date
//    or age column exists anywhere: only retirement and contract-end bands.
//  - klra_assessments, klra_actions: per-quarter assessment (total = attrition x position) and mitigation actions.
//  - sme_profiles: opt-in SME directory (staff read listed profiles; the SME reads their own).
//  - capture_sessions: the SME and the interviewer read their sessions (transcripts stay out of staff view); the KM owner
//    sees all through rpc.captureBoard.
//  - knowledge_assets: staff read published assets (`published` = status published); the author and the SME read their own
//    drafts; reviewers (knowledge W/A) get the review queue through rpc.reviewQueue.
//  - asset_reviews: the reviewer and the asset author read them. asset_uses: own rows only ("used by" counts on the asset).
import type { TableDef } from '../../../data/schema';

type RR = TableDef['read'];
/** Department head (knowledge Scope) for the person on the row; R/W/A never applies because open_read is always false. */
const KLRA_SCOPE: RR = [{ res: 'knowledge', person: 'person_id', where: 'open_read' }];

export const TABLES_M24: Record<string, TableDef> = {
  // ───────────── F20 Knowledge loss risk assessment
  klra_settings: {
    module: 'M24', label: 'KLRA thresholds set by the knowledge-management owner (F20)',
    cols: {
      id: 'text pk', high_threshold: 'int =16', medium_threshold: 'int =8', updated_by: 'text?', updated_at: 'ts =now', history: 'json =[]', open_read: 'bool =false',
    },
    read: [{ res: 'knowledge', person: 'updated_by', where: 'open_read' }],
    write: { mode: 'rpc', res: 'knowledge' },
  },
  klra_positions: {
    module: 'M24', label: 'KLRA position register: synthetic HR feed bands (no dates of birth or ages) and the F11 coverage snapshot (F20)',
    cols: {
      id: 'text pk', person_id: 'text? ref:people idx', role_id: 'text? ref:job_roles', family_id: 'text? ref:job_families idx', entity_id: 'text?', team_id: 'text?', crew: 'text?',
      department: 'text enum:operations|maintenance_engineering|rp_chem_ep|training_quality|corporate idx',
      kind: 'text enum:staff|ossa|contractor =\'staff\'', title_en: 'text', title_ar: 'text', holder_en: 'text =\'\'', holder_ar: 'text =\'\'',
      retirement_band: 'text enum:within_2|2_5|5_plus|na =\'na\'', contract_kind: 'text enum:permanent|fixed_term|secondment|ossa =\'permanent\'',
      contract_end_band: 'text enum:within_1|1_2|2_5|5_plus|none =\'none\'',
      criticality: 'text enum:critical|regulated|qualified|general =\'general\'', spof_skill_ids: 'text[] =[]', codified_base: 'int =0', replace_months: 'int =6',
      feed_as_of: 'date', synthetic: 'bool =true', active: 'bool =true', open_read: 'bool =false',
    },
    read: KLRA_SCOPE,
    write: { mode: 'rpc', res: 'knowledge' },
  },
  klra_assessments: {
    module: 'M24', label: 'Quarterly knowledge loss risk assessment of a position: total = attrition x position (F20)',
    cols: {
      id: 'text pk', period: 'text idx', position_id: 'text ref:klra_positions idx', person_id: 'text? ref:people idx', department: 'text',
      attrition_factor: 'int', position_factor: 'int', total: 'int', proposed_attrition: 'int', proposed_position: 'int', adjusted: 'bool =false',
      note: 'text?', reasons: 'json =[]', drivers: 'json ={}', assessed_by: 'text ref:people', assessed_by_name: 'text =\'\'', assessed_by_name_ar: 'text =\'\'',
      assessed_at: 'ts =now', open_read: 'bool =false',
    },
    read: KLRA_SCOPE,
    write: { mode: 'rpc', res: 'knowledge' },
  },
  klra_actions: {
    module: 'M24', label: 'KLRA mitigation action for a position: capture, mentoring, successor, documentation or cross-training (F20)',
    cols: {
      id: 'text pk', assessment_id: 'text ref:klra_assessments idx', position_id: 'text ref:klra_positions idx', person_id: 'text? ref:people idx', period: 'text',
      kind: 'text enum:capture|mentoring|successor|documentation|cross_training', owner_role: 'text enum:km_owner|line_manager|training|hr|sme',
      due_on: 'date', status: 'text enum:planned|in_progress|done|cancelled =\'planned\' idx', note: 'text =\'\'', ref_table: 'text?', ref_id: 'text?', outcome: 'text?',
      created_by: 'text ref:people', created_at: 'ts =now', closed_by: 'text?', closed_at: 'ts?', open_read: 'bool =false',
    },
    read: KLRA_SCOPE,
    write: { mode: 'rpc', res: 'knowledge' },
  },

  // ───────────── F21 Knowledge capture studio and knowledge base
  sme_profiles: {
    module: 'M24', label: 'Subject-matter expert opt-in profile: skills, availability and capture window band (F21)',
    cols: {
      id: 'text pk', person_id: 'text ref:people uniq', kind: 'text enum:staff|retiring|rotating|visiting_khnp|partner =\'staff\'', skill_ids: 'text[] =[]',
      availability: 'text enum:available|limited|unavailable =\'available\'', departing_band: 'text enum:within_2|2_5|5_plus|visiting|unspecified =\'unspecified\'',
      listed: 'bool =false', headline: 'text =\'\'', person_name: 'text =\'\'', person_name_ar: 'text =\'\'', role_id: 'text?', family_id: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'knowledge', where: 'listed' }, { res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'knowledge' },
  },
  capture_sessions: {
    module: 'M24', label: 'Structured knowledge-capture interview: plan, hold, transcribe (text upload only) (F21)',
    cols: {
      id: 'text pk', sme_id: 'text ref:people idx', interviewer_id: 'text ref:people idx', created_by: 'text ref:people',
      template: 'text enum:critical_decisions|rules_of_thumb|war_stories|who_to_ask|documents', title: 'text', lang: 'text enum:en|ar =\'en\'',
      status: 'text enum:planned|held|transcribed|cancelled =\'planned\' idx', planned_on: 'date', held_on: 'date?', duration_min: 'int =60',
      skill_ids: 'text[] =[]', standard_ids: 'text[] =[]', position_id: 'text? ref:klra_positions', action_id: 'text?',
      transcript: 'text =\'\'', transcript_words: 'int =0', notes: 'text =\'\'', asset_id: 'text?',
      sme_name: 'text =\'\'', sme_name_ar: 'text =\'\'', interviewer_name: 'text =\'\'', interviewer_name_ar: 'text =\'\'',
      history: 'json =[]', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'sme_id' }, { res: 'own_profile', person: 'interviewer_id' }, { res: 'own_profile', person: 'created_by' }],
    write: { mode: 'rpc', res: 'knowledge' },
  },
  knowledge_assets: {
    module: 'M24', label: 'Knowledge asset: summary, key points and links, published after a technical review and a security and content check (F21)',
    cols: {
      id: 'text pk', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', body: 'text', body_lang: 'text enum:en|ar =\'en\'',
      key_points: 'json =[]', skill_ids: 'text[] =[]', standard_ids: 'text[] =[]', requal_standard_ids: 'text[] =[]', oe_ids: 'text[] =[]', course_ids: 'text[] =[]',
      system_family: 'text enum:reactor_core|primary|secondary|electrical|i_and_c|chemistry|radiation_protection|maintenance|outage|human_performance|emergency_preparedness|training idx',
      status: 'text enum:draft|review|published|withdrawn =\'draft\' idx', published: 'bool =false', reviewers: 'text[] =[]', suggestions: 'json =[]',
      author_id: 'text ref:people idx', sme_id: 'text ref:people idx', source_session_id: 'text?', position_id: 'text?',
      author_name: 'text =\'\'', author_name_ar: 'text =\'\'', sme_name: 'text =\'\'', sme_name_ar: 'text =\'\'', template: 'text?',
      used_by: 'int =0', version: 'int =1', submitted_at: 'ts?', published_at: 'ts?', published_by: 'text?', withdrawn_at: 'ts?', withdrawn_reason: 'text?',
      created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'knowledge', where: 'published' }, { res: 'own_profile', person: 'author_id' }, { res: 'own_profile', person: 'sme_id' }],
    write: { mode: 'rpc', res: 'knowledge' },
  },
  asset_reviews: {
    module: 'M24', label: 'Review of a knowledge asset: technical review or security and content check (two different people, never the author) (F21)',
    cols: {
      id: 'text pk', asset_id: 'text ref:knowledge_assets idx', asset_author_id: 'text ref:people', reviewer_id: 'text ref:people idx',
      kind: 'text enum:technical|security', outcome: 'text enum:pass|changes', note: 'text =\'\'', checks: 'json ={}', decisions: 'json ={}',
      reviewer_name: 'text =\'\'', reviewer_name_ar: 'text =\'\'', superseded: 'bool =false', version: 'int =1', created_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'reviewer_id' }, { res: 'own_profile', person: 'asset_author_id' }],
    write: { mode: 'rpc', res: 'knowledge' },
  },
  asset_uses: {
    module: 'M24', label: 'A person marked a knowledge asset as used (feeds the "used by N" count, shown from 10) (F21)',
    cols: { id: 'text pk', asset_id: 'text ref:knowledge_assets idx', person_id: 'text ref:people idx', used_on: 'date' },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'knowledge' },
  },
};
