// M28 tables (owners: wave B E1 (FS07, FS08) and wave H E1 (FS70, FS71, FS72)). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly). New taxonomies carry _en/_ar columns.
//
// FS08 (wave B · E1) · International crosswalk:
//   skill_frameworks  the external frameworks Kafa'a aligns to (ESCO, O*NET, SFIA 9, SkillsFuture, DigComp, UNESCO AI, GreenComp,
//                     NICE, IAEA, UAE NQF, Lightcast): owner, version, code kind, level scale, source and as-of date. Public; write none.
//   skill_alignments  one row per skill x external entry: code (only when copied from the source; else label-level, "code pending
//                     review"), EN/AR label, match type, level map, source URL, as-of date, review state. Published rows are public
//                     (listed = status published); drafts and retired rows are read by framework owners (sat: instructors and the
//                     training manager), admins and auditors (audit_log). Writes only through rpc.saveAlignment/reviewAlignment/
//                     retireAlignment (frameworks W/A; audited; maker-checker on review). Never deleted: retired instead.
// FS07 (wave B · E1) · Skills Catalogue Explorer:
//   skill_goals       "Add to my goals" from a skill page: own rows only (own_profile), written by rpc.setSkillGoal (skills_profile
//                     Own). Hand-off source for FS33 "Skills I want to grow" (wave D).
//
// FS70/FS71/FS72 (wave H · E1) · Skills signals, hot technologies and inferred-skill suggestions (RBAC logged in the CONTRACT changelog):
//   skill_signal_runs / skill_signals  the published quarterly "ENEC Skills on the Rise" list (one run per ended quarter, kept; rows =
//                     the listed skills with their signals, moved_by, families and reasons). Staff read (internal_content R); written only
//                     by rpc.publishSkillSignals (workforce_strategy W/A). Data-only coupling for FS75: latest run, rows by family.
//   manager_pulse     annual manager pulse answers (share of the team's core skills expected to change by 2030): own rows only
//                     (own_profile); aggregates through rpc.managerPulseSummary (workforce_strategy Agg/R/W/A, transformation Agg).
//   technologies / technology_links / technology_badges  generic technology tags (no vendor brands), their links to opportunities and
//                     role-profile versions, and the published quarterly badges (kept per quarter). Staff read; frameworks W/A write.
//   skill_suggestions "Skills you may have": own rows only (own_profile Own; never a manager, never Scope); rpc.refreshSkillSuggestions
//                     and rpc.respondSuggestion (skills_profile Own). A confirmed suggestion becomes claimed evidence.
//   skill_suggestion_fairness  the surface's weekly fairness snapshot (aggregates only, suppressed under 10): integrations R/A and
//                     skills_profile Agg, like surface_fairness; rpc.runSuggestionFairness (integrations A).
import type { TableDef } from '../../../data/schema';

export const TABLES_M28: Record<string, TableDef> = {
  skill_frameworks: {
    module: 'M28', label: 'External skills frameworks the crosswalk aligns to: owner, version, code kind, level scale, source (FS08)',
    cols: {
      id: 'text pk', short: 'text', name_en: 'text', name_ar: 'text', owner_en: 'text', owner_ar: 'text', version_label: 'text =\'\'',
      kind: 'text enum:skills|occupations|competences|qualifications|reference', code_label_en: 'text =\'\'', code_label_ar: 'text =\'\'',
      codes_copied: 'bool =false', level_scale_en: 'text =\'\'', level_scale_ar: 'text =\'\'', scope_en: 'text =\'\'', scope_ar: 'text =\'\'',
      url: 'text', benchmark_id: 'text? idx', as_of: 'date', sort: 'int =0',
    },
    read: [{ res: 'public_content' }], write: { mode: 'none' },
  },
  skill_alignments: {
    module: 'M28', label: 'Skill crosswalk: one external framework entry per row, match type, level map, source and review state (FS08)',
    cols: {
      id: 'text pk', skill_id: 'text ref:skills idx', framework: 'text ref:skill_frameworks idx', external_code: 'text?',
      label_en: 'text', label_ar: 'text', label_ar_official: 'bool =false', external_meta: 'json ={}',
      match_type: 'text enum:exact|close|broad|partial idx', level_map: 'json ={}', note_en: 'text =\'\'', note_ar: 'text =\'\'',
      source_url: 'text', as_of: 'date', status: 'text enum:draft|published|retired =\'draft\' idx', listed: 'bool =false',
      reviewed_by: 'text?', reviewed_role: 'text?', reviewed_on: 'date?', retired_reason: 'text?', retired_on: 'date?',
      version: 'int =1', created_by: 'text?', created_at: 'ts =now', updated_by: 'text?', updated_at: 'ts =now', sort: 'int =0',
    },
    read: [{ res: 'public_content', where: 'listed' }, { res: 'audit_log' }, { res: 'sat' }],
    write: { mode: 'rpc', res: 'frameworks' },
  },
  skill_goals: {
    module: 'M28', label: 'Skills a person wants to grow, added from the skills explorer (FS07; hand-off to FS33)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', skill_id: 'text ref:skills idx', target_level: 'int =2',
      status: 'text enum:active|removed =\'active\' idx', source: 'text =\'skills_explorer\'', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'skills_profile' },
  },

  // ───────────── FS70 ENEC Skills on the Rise (wave H · E1)
  skill_signal_runs: {
    module: 'M28', label: 'Published quarterly ENEC Skills on the Rise list: quarter, method version, counts; kept once published, never recomputed (FS70)',
    cols: {
      id: 'text pk', quarter: 'text uniq', method: 'text', status: 'text enum:published =\'published\'', counts: 'json ={}',
      published_by: 'text', published_role: 'text?', published_at: 'ts =now', summary_en: 'text =\'\'', summary_ar: 'text =\'\'',
    },
    read: [{ res: 'internal_content' }],
    write: { mode: 'rpc', res: 'workforce_strategy' },
  },
  skill_signals: {
    module: 'M28', label: 'A skill on a published Skills on the Rise list: category (in demand now or growing), rank, the three signals (suppressed under 10), the signals that moved it, job families and reasons (FS70; FS75 reads it)',
    cols: {
      id: 'text pk', run_id: 'text ref:skill_signal_runs idx', quarter: 'text idx', skill_id: 'text ref:skills idx', category: 'text enum:now|growing idx',
      rank: 'int', score: 'int', moved_by: 'text[] =[]', signals: 'json =[]', families: 'text[] =[]', reasons: 'json =[]', published_at: 'ts =now',
    },
    read: [{ res: 'internal_content' }],
    write: { mode: 'rpc', res: 'workforce_strategy' },
  },
  manager_pulse: {
    module: 'M28', label: 'Annual manager pulse answer: the share of my team\'s core skills I expect to change by 2030; own rows only, read by HR as an aggregate (FS70)',
    cols: {
      id: 'text pk', year: 'int idx', person_id: 'text ref:people idx', family_id: 'text?', team_size: 'int?', share_pct: 'int',
      submitted_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'transformation' },
  },

  // ───────────── FS71 Hot technologies and in-demand badges (wave H · E1)
  technologies: {
    module: 'M28', label: 'Generic technology tag (never a vendor or product brand): name and description EN/AR, category, related skills (FS71)',
    cols: {
      id: 'text pk', name_en: 'text', name_ar: 'text', description_en: 'text', description_ar: 'text', category: 'text enum:plant_data|analytics|automation|digital_twin|inspection|work_management|ai_tools|simulation idx',
      skill_ids: 'text[] =[]', status: 'text enum:active|retired =\'active\' idx', version: 'int =1', created_by: 'text?', created_at: 'ts =now', updated_by: 'text?', updated_at: 'ts =now', sort: 'int =0',
    },
    read: [{ res: 'internal_content' }],
    write: { mode: 'rpc', res: 'frameworks' },
  },
  technology_links: {
    module: 'M28', label: 'A technology tag on an opportunity or a role-profile version, with the source\'s job family, role and date (FS71)',
    cols: {
      id: 'text pk', technology_id: 'text ref:technologies idx', ref_table: 'text enum:opportunities|role_profile_versions', ref_id: 'text idx', family_id: 'text?', role_id: 'text?',
      source_on: 'date', active: 'bool =true', linked_by: 'text?', linked_at: 'ts =now',
    },
    read: [{ res: 'internal_content' }],
    write: { mode: 'rpc', res: 'frameworks' },
  },
  technology_badges: {
    module: 'M28', label: 'Published quarterly technology badge: hot across ENEC or in demand for a role, with the counts behind it; past quarters kept (FS71)',
    cols: {
      id: 'text pk', quarter: 'text idx', technology_id: 'text ref:technologies idx', scope: 'text enum:enec|role idx', role_id: 'text?', rank: 'int?',
      sources: 'int =0', families: 'int =0', recent: 'int =0', via_profile: 'bool =false', family_opportunities: 'int =0', criteria: 'text',
      published_by: 'text', published_at: 'ts =now',
    },
    read: [{ res: 'internal_content' }],
    write: { mode: 'rpc', res: 'frameworks' },
  },

  // ───────────── FS72 Skills you may have (wave H · E1)
  skill_suggestions: {
    module: 'M28', label: 'An inferred skill suggested to me with its sources and reasons; private until I confirm (claimed evidence), reject or mark not me (180 days suppressed) (FS72)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', skill_id: 'text ref:skills idx', status: 'text enum:open|confirmed|rejected|not_me|expired =\'open\' idx',
      level: 'int =1', score: 'int =0', sources: 'text[] =[]', reasons: 'json =[]', first_on: 'date', generated_on: 'date', responded_on: 'date?', suppressed_until: 'date?',
      evidence_id: 'text?', history: 'json =[]', version: 'int =1', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }],
    write: { mode: 'rpc', res: 'skills_profile' },
  },
  skill_suggestion_fairness: {
    module: 'M28', label: 'Weekly fairness snapshot of the skill-suggestions surface: people reached by gender and nationality, suppressed below 10, four-fifths flag (FS72; aggregates only)',
    cols: {
      id: 'text pk', period: 'text idx', as_of: 'date', card: 'text', metric: 'text', dimension: 'text enum:gender|nationality', group_key: 'text enum:f|m|uae|other',
      n: 'int?', positives: 'int?', rate: 'num?', ratio: 'num?', suppressed: 'bool =false', flagged: 'bool =false', source: 'text', run_by: 'text?', created_at: 'ts =now',
    },
    read: [{ res: 'integrations' }, { res: 'skills_profile', special: 'agg_ok' }],
    write: { mode: 'rpc', res: 'integrations' },
  },
};
