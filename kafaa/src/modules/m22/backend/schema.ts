// M22 tables (owner: W2 · E5 · F16 Leadership journeys, F17 Communities of practice and expert finder).
// Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Keep this file import-free except for `import type` (node scripts load it directly).
//
// Read rules (an R/W/A grant on the named resource reads every row whose `where` column is true):
//  - leadership_programmes: public facts from the 10th CNS national report (sources + as-of date on every row).
//  - leadership_nominations: the nominee and the nominator (Own), managers in scope (skills_profile Scope), the training
//    manager (skills_profile A) and the HR authority (talent_review R/A; HR analysts in scope); admins and auditors.
//  - leadership_360_requests: the rater only (own_profile Own). The subject sees counts and names through rpc.my360.
//  - leadership_360: individual responses are readable by nobody through the API (open_read is always false); the subject's
//    aggregate comes from rpc.my360 (>= 5 responses) and HR's from rpc.leadershipStats (>= 10 subjects).
//  - communities, community_members, ks_sessions: staff (knowledge R). Threads and posts: staff read published ones
//    (`visible`), authors read their own (held or hidden), admins and auditors read all. Stewards see held posts through
//    rpc.moderationQueue.
//  - expert_optin: staff read visible profiles only; the person reads their own. People who did not opt in have no row.
//  - expert_requests: the requester and the expert only.
import type { TableDef } from '../../../data/schema';

type RR = TableDef['read'];
const STAFF_ALL: RR = [{ res: 'knowledge' }];

export const TABLES_M22: Record<string, TableDef> = {
  // ───────────── F16 Leadership journeys
  leadership_programmes: {
    module: 'M22', label: 'Enterprise Nuclear Leadership Academy programmes with published facts and sources (F16)',
    cols: {
      id: 'text pk', code: 'text uniq', kind: 'text enum:course|programme|coaching|mentoring|external',
      title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', audience_en: 'text', audience_ar: 'text',
      duration_en: 'text', duration_ar: 'text', duration_days: 'num?', completions: 'int?', completions_year: 'int?',
      fact_en: 'text =\'\'', fact_ar: 'text =\'\'',
      steps: 'text[] =[]', mandatory_steps: 'text[] =[]', required_tracks: 'text[] =[]', skill_ids: 'text[] =[]', behaviour_ids: 'text[] =[]',
      nominable: 'bool =true', course_id: 'text? ref:courses', link_route: 'text?', sources: 'json =[]', sort: 'int =0',
    },
    read: [{ res: 'public_content' }], write: { mode: 'none' },
  },
  leadership_nominations: {
    module: 'M22', label: 'Nomination of a person to a leadership programme: manager nominates, HR decides (maker-checker) (F16)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', programme_id: 'text ref:leadership_programmes idx', nominated_by: 'text ref:people idx',
      reason: 'text', cycle: 'text', status: 'text enum:nominated|approved|declined|completed =\'nominated\' idx',
      person_name: 'text =\'\'', person_name_ar: 'text =\'\'', person_role_id: 'text?', person_family_id: 'text?', nominator_name: 'text =\'\'', nominator_name_ar: 'text =\'\'',
      decided_by: 'text?', decided_at: 'ts?', decision_note: 'text?', history: 'json =[]', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [
      { res: 'skills_profile', person: 'person_id' },
      { res: 'own_profile', person: 'nominated_by' },
      { res: 'talent_review', person: 'person_id' },
      { res: 'audit_log' },
    ],
    write: { mode: 'rpc', res: 'talent_review' },
  },
  leadership_360_requests: {
    module: 'M22', label: 'Leadership behaviours 360: an invitation to rate a colleague (rater-only rows) (F16)',
    cols: {
      id: 'text pk', cycle: 'text idx', subject_id: 'text ref:people idx', rater_id: 'text ref:people idx', rater_kind: 'text enum:self|manager|peer|report',
      status: 'text enum:invited|submitted =\'invited\'', subject_name: 'text =\'\'', subject_name_ar: 'text =\'\'', invited_at: 'ts =now', submitted_at: 'ts?',
      form_version: 'int =1', // FS46: 1 = eight behaviours (F16), 2 = twelve with anchors; a subject's cycle keeps one version
    },
    read: [{ res: 'own_profile', person: 'rater_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
  leadership_360: {
    module: 'M22', label: 'Leadership behaviours 360 responses: anonymous scores, read only as aggregates through RPCs (F16)',
    cols: {
      id: 'text pk', cycle: 'text idx', subject_id: 'text ref:people idx', rater_kind: 'text enum:self|manager|peer|report',
      scores: 'json ={}', submitted_at: 'ts =now', open_read: 'bool =false',
      form_version: 'int =1', // FS46
    },
    read: [{ res: 'audit_log', where: 'open_read' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },

  // ───────────── F17 Communities of practice and expert finder
  communities: {
    module: 'M22', label: 'Communities of practice by discipline: charter, steward role card (F17)',
    cols: {
      id: 'text pk', code: 'text uniq', discipline: 'text enum:operations|maintenance|chemistry|radiation_protection|engineering|digital_ai|human_performance',
      name_en: 'text', name_ar: 'text', charter_en: 'text', charter_ar: 'text', steward_role_en: 'text', steward_role_ar: 'text',
      skill_ids: 'text[] =[]', open: 'bool =true', sort: 'int =0',
    },
    read: STAFF_ALL, write: { mode: 'none' },
  },
  community_members: {
    module: 'M22', label: 'Community membership (member or steward) (F17)',
    cols: {
      id: 'text pk', community_id: 'text ref:communities idx', person_id: 'text ref:people idx', role: 'text enum:member|steward =\'member\'',
      active: 'bool =true', person_name: 'text =\'\'', person_name_ar: 'text =\'\'', person_role_id: 'text?', joined_at: 'ts =now', updated_at: 'ts =now',
    },
    read: STAFF_ALL, write: { mode: 'rpc', res: 'knowledge' },
  },
  threads: {
    module: 'M22', label: 'Community Q&A thread (moderated) (F17)',
    cols: {
      id: 'text pk', community_id: 'text ref:communities idx', title: 'text', lang: 'text enum:en|ar =\'en\'', author_id: 'text ref:people idx',
      author_name: 'text =\'\'', author_name_ar: 'text =\'\'', first_post_id: 'text?', status: 'text enum:open|closed =\'open\'', visible: 'bool =true',
      reply_count: 'int =0', last_post_at: 'ts =now', skill_ids: 'text[] =[]', created_at: 'ts =now',
    },
    read: [{ res: 'knowledge', where: 'visible' }, { res: 'own_profile', person: 'author_id' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'knowledge' },
  },
  posts: {
    module: 'M22', label: 'Community post with moderation status (F17)',
    cols: {
      id: 'text pk', thread_id: 'text ref:threads idx', community_id: 'text ref:communities idx', author_id: 'text ref:people idx',
      author_name: 'text =\'\'', author_name_ar: 'text =\'\'', body: 'text', lang: 'text enum:en|ar =\'en\'',
      status: 'text enum:published|held|hidden =\'published\' idx', visible: 'bool =true', moderated_by: 'text?', moderated_at: 'ts?', moderation_note: 'text?', created_at: 'ts =now',
    },
    read: [{ res: 'knowledge', where: 'visible' }, { res: 'own_profile', person: 'author_id' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'knowledge' },
  },
  expert_optin: {
    module: 'M22', label: 'Expert finder opt-in: skills I am happy to be found for (level 3 or above), visible or hidden (F17)',
    cols: {
      id: 'text pk', person_id: 'text ref:people uniq', skill_ids: 'text[] =[]', visible: 'bool =true', headline: 'text =\'\'',
      person_name: 'text =\'\'', person_name_ar: 'text =\'\'', role_id: 'text?', family_id: 'text?', team_id: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'knowledge', where: 'visible' }, { res: 'own_profile', person: 'person_id' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'knowledge' },
  },
  expert_requests: {
    module: 'M22', label: 'In-app request to an opted-in expert (no contact details are exchanged) (F17)',
    cols: {
      id: 'text pk', expert_id: 'text ref:people idx', requester_id: 'text ref:people idx', skill_id: 'text ref:skills', message: 'text',
      status: 'text enum:sent|accepted|declined =\'sent\'', reply: 'text?', requester_name: 'text =\'\'', requester_name_ar: 'text =\'\'',
      expert_name: 'text =\'\'', expert_name_ar: 'text =\'\'', created_at: 'ts =now', answered_at: 'ts?',
    },
    read: [{ res: 'own_profile', person: 'requester_id' }, { res: 'own_profile', person: 'expert_id' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'knowledge' },
  },
  ks_sessions: {
    module: 'M22', label: 'Knowledge-sharing session catalogue: held sessions with recordings (synthetic links) and upcoming events (F17)',
    cols: {
      id: 'text pk', community_id: 'text? ref:communities idx', topic: 'text enum:proficiency|outage_lessons|project_management|ai|mcr_overview|radiation_safety|data_analytics|human_performance|chemistry|maintenance',
      title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', presenter_role_en: 'text', presenter_role_ar: 'text',
      held_on: 'date', status: 'text enum:held|upcoming', duration_min: 'int =60', recording_ref: 'text?', keywords: 'text[] =[]', skill_ids: 'text[] =[]',
      synthetic: 'bool =true', sources: 'json =[]',
    },
    read: STAFF_ALL, write: { mode: 'none' },
  },

  // ═════════════ FS46 · FS47 · FS48 (wave E · E4, fsEe4). Migration 20261010254001_kafaa_fs54_future_leadership.sql.
  // Read rules:
  //  - leadership_behaviours, fl_competencies, fl_external, wfn_programmes: public reference rows with sources (public_content).
  //  - fl_cohorts, wfn_circles, wfn_offers: staff (knowledge R). Circles show the mentor role card, never names or member counts.
  //  - fl_participants: the participant (skills_profile Own), managers in scope (Scope), the training manager (skills_profile A), the
  //    HR authority (talent_review R/A; analysts in scope) and auditors (audit_log). Same audience as the F16 nominations.
  //  - wfn_participants, wfn_circle_members, wfn_requests: the person only (own_profile Own). HR sees aggregates only (rpc.wfnStats);
  //    the training manager (programme owner) sees requests made to offers through rpc.wfnDesk. Nobody else reads opt-in data.
  leadership_behaviours: {
    module: 'M22', label: 'Leadership behaviours rated in the 360, with anchors at every rating point and coach cards; form 2 adds four future behaviours (FS46)',
    cols: {
      id: 'text pk', form_from: 'int =1', sort: 'int =0', trait_id: 'text?', title_en: 'text', title_ar: 'text', short_en: 'text', short_ar: 'text',
      statement_en: 'text', statement_ar: 'text', framework_en: 'text', framework_ar: 'text', anchors: 'json ={}', coach: 'json ={}', links: 'json =[]',
      programme_ids: 'text[] =[]', benchmark_ids: 'text[] =[]', sources: 'json =[]',
    },
    read: [{ res: 'public_content' }], write: { mode: 'none' },
  },
  fl_competencies: {
    module: 'M22', label: 'Future Leaders nuclear-management competencies (INMA pattern): descriptors per level, skill targets, learning route (FS47)',
    cols: {
      id: 'text pk', code: 'text uniq', sort: 'int =0', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', area_en: 'text', area_ar: 'text',
      descriptors: 'json ={}', skill_targets: 'json ={}', route: 'json =[]', external_ids: 'text[] =[]', sources: 'json =[]',
    },
    read: [{ res: 'public_content' }], write: { mode: 'none' },
  },
  fl_external: {
    module: 'M22', label: 'External management programmes linked to the Future Leaders track, with sources and dates (FS47)',
    cols: {
      id: 'text pk', kind: 'text enum:summer_school|school|masters|mobility|trainee|internship', sort: 'int =0', owner_en: 'text', owner_ar: 'text',
      title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', dates_en: 'text', dates_ar: 'text', year_from: 'int?', year_to: 'int?',
      competency_ids: 'text[] =[]', sources: 'json =[]',
    },
    read: [{ res: 'public_content' }], write: { mode: 'none' },
  },
  fl_cohorts: {
    module: 'M22', label: 'Future Leaders cohorts: modules, policy-project brief, mentor, seats and dates (FS47)',
    cols: {
      id: 'text pk', code: 'text uniq', year: 'int', status: 'text enum:planned|open|running|completed', seats: 'int =12', starts_on: 'date', ends_on: 'date',
      title_en: 'text', title_ar: 'text', modules: 'json =[]', brief_en: 'text', brief_ar: 'text', mentor_en: 'text', mentor_ar: 'text', sort: 'int =0',
    },
    read: STAFF_ALL, write: { mode: 'none' },
  },
  fl_participants: {
    module: 'M22', label: 'A selected Future Leaders participant: modules completed and the policy project with its review (FS47)',
    cols: {
      id: 'text pk', nomination_id: 'text ref:leadership_nominations uniq', person_id: 'text ref:people idx', cohort_id: 'text ref:fl_cohorts idx',
      person_name: 'text =\'\'', person_name_ar: 'text =\'\'', modules_done: 'text[] =[]',
      project_title: 'text?', project_question: 'text?', project_summary: 'text?', project_sponsor_role: 'text?',
      project_status: 'text enum:none|draft|submitted|returned|accepted =\'none\'', project_submitted_on: 'date?', project_reviewed_by: 'text?', project_review_note: 'text?', project_decided_on: 'date?',
      status: 'text enum:active|completed|withdrawn =\'active\'', completed_on: 'date?', history: 'json =[]', updated_at: 'ts =now',
    },
    read: [{ res: 'skills_profile', person: 'person_id' }, { res: 'talent_review', person: 'person_id' }, { res: 'audit_log' }],
    write: { mode: 'rpc', res: 'talent_review' },
  },
  wfn_programmes: {
    module: 'M22', label: 'Women in future nuclear skills: the three strands with their international patterns and sources (FS48)',
    cols: {
      id: 'text pk', strand: 'text enum:circles|visiting|sponsored uniq', sort: 'int =0', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text',
      pattern_en: 'text', pattern_ar: 'text', fact_en: 'text', fact_ar: 'text', sources: 'json =[]',
    },
    read: [{ res: 'public_content' }], write: { mode: 'none' },
  },
  wfn_participants: {
    module: 'M22', label: 'Opt-in to the women in future nuclear skills network: areas, ways to take part, mentor; withdrawable (FS48; private)',
    cols: {
      id: 'text pk', person_id: 'text ref:people uniq', active: 'bool =true', interests: 'text[] =[]', strands: 'text[] =[]', mentor: 'bool =false',
      joined_on: 'date?', withdrawn_on: 'date?', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
  wfn_circles: {
    module: 'M22', label: 'Mentor circles on a future-skills theme with a mentor role card and seats (FS48)',
    cols: {
      id: 'text pk', sort: 'int =0', status: 'text enum:active|closed', seats: 'int =6', focus: 'text[] =[]', skill_ids: 'text[] =[]', starts_on: 'date',
      title_en: 'text', title_ar: 'text', mentor_role_en: 'text', mentor_role_ar: 'text', cadence_en: 'text', cadence_ar: 'text',
    },
    read: STAFF_ALL, write: { mode: 'none' },
  },
  wfn_circle_members: {
    module: 'M22', label: 'Mentor circle membership (member or mentor), ended rather than removed (FS48; private)',
    cols: {
      id: 'text pk', circle_id: 'text ref:wfn_circles idx', person_id: 'text ref:people idx', role: 'text enum:member|mentor =\'member\'', active: 'bool =true',
      joined_on: 'date?', left_on: 'date?',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
  wfn_offers: {
    module: 'M22', label: 'Visiting-professional placements and sponsored study with a placement (concept offers) (FS48)',
    cols: {
      id: 'text pk', strand: 'text enum:visiting|sponsored', sort: 'int =0', status: 'text enum:open|closed', seats: 'int =1', weeks: 'int?', months: 'int?',
      closes_on: 'date', focus: 'text[] =[]', title_en: 'text', title_ar: 'text', host_en: 'text', host_ar: 'text', placement_en: 'text', placement_ar: 'text',
    },
    read: STAFF_ALL, write: { mode: 'none' },
  },
  wfn_requests: {
    module: 'M22', label: 'A participant\'s request for a placement or sponsored study, decided by the programme owner (FS48; private)',
    cols: {
      id: 'text pk', offer_id: 'text ref:wfn_offers idx', person_id: 'text ref:people idx', person_name: 'text =\'\'', person_name_ar: 'text =\'\'', statement: 'text',
      status: 'text enum:interested|shortlisted|placed|completed|declined|withdrawn =\'interested\' idx', outcome: 'text? enum:progressed|same_role',
      decided_by: 'text?', decided_on: 'date?', note: 'text?', history: 'json =[]', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'own_profile' },
  },
};
