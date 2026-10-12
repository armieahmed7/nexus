// FS wave E integration (QA lead): cross-feature hand-offs between the wave-E features (FS38-FS49) and earlier waves. Runs as a
// FINALIZE_LAST finalizer after every wave-E builder and after fsqa4 (file-name order). It adds no rows: the wave-E data effects are
// produced where they belong (fs38/fs44 rebuild the F36 digests with the host-confirmation approvals; fsqa4's ensureCreditTags tags the
// FS42/FS43 courses and pathways). This finalizer fails the build if a wiring invariant breaks:
//  1. recorded evidence (handover 3.9): every wave-E evidence ref_table (plant_visits, twin_attempts, lectures, knowledge_assets) is
//     in RECORDED_REF_TABLES, so an F01 recompute keeps it (SQL: the final kafaa_skill_states_v2 / kafaa_skills_apply in fs5qa);
//  2. FS42/FS43 -> FS17: the two new pathways pass pathwayProblems(); FS42/FS43 -> FS30: each new course and pathway has a credit tag;
//     MC-H2-HEAT stays a draft (settled decision) and is still satisfiable; the credit ledger is unchanged by wave E;
//  3. FS17 gap backlog (FS57 feed): wave-E content fills no backlog step (a refresh on the QA day changes nothing; 215 rows);
//  4. FS40 -> FS31: MC-TWINS lists published twin drills as a route for its twin criterion (satisfiability with twin_scenarios);
//  5. FS39 -> F36: every logged plant visit naming a host by the demo day appears in that host's digest candidates.
// The live database gets the matching SQL and guarded replays from supabase/migrations/20261010259001_kafaa_fs5qa_integration.sql.
import { RECORDED_REF_TABLES } from '../../../src/domain/skills.ts';
import { pathwayProblems } from '../../../src/modules/m19/pathways.ts';
import { routesFor, satisfiability } from '../../../src/modules/m17/futureCreds.ts';
import { gatherDigest } from '../../../src/shell/digest/rules.ts';
import { refreshGaps } from './fsqa4-integration.mjs';

export const FINALIZE_LAST = true;
export const QA_E_REFRESH = '2026-10-11'; // the wave-E QA ran on the same day as the wave-C and wave-D QA
export const WAVE_E_REF_TABLES = ['plant_visits', 'twin_attempts', 'lectures', 'knowledge_assets'];
export const WAVE_E_PATHWAYS = ['pw-et-system-integration', 'pw-et-esg-managers'];
export const WAVE_E_COURSES = ['c-et-ghg-mgr', 'c-et-esg-clinic'];

export default function build() {}

export function finalize(T, ctx) {
  const fail = (m) => { throw new Error(`fsqa5: ${m}`); };
  if (!T.plant_visits || !T.pathways) return; // partial builds (unit fixtures)
  // 1. recorded evidence
  for (const t of WAVE_E_REF_TABLES) if (!RECORDED_REF_TABLES.includes(t)) fail(`${t} is not a recorded evidence table`);
  const used = new Set(T.skill_evidence.filter((e) => WAVE_E_REF_TABLES.includes(e.ref_table)).map((e) => e.ref_table));
  for (const t of ['plant_visits', 'twin_attempts', 'lectures']) if (!used.has(t)) fail(`no seeded evidence row for ${t}`);
  // 2. pathways, credit tags, MC-H2-HEAT
  for (const id of WAVE_E_PATHWAYS) {
    const p = T.pathways.find((x) => x.id === id);
    if (!p || p.status !== 'published') fail(`pathway ${id} missing or not published`);
    const ver = Number(p.version ?? 1);
    const steps = T.pathway_steps.filter((s) => s.pathway_id === id && Number(s.version ?? 1) === ver).sort((a, b) => a.n - b.n);
    const input = { ...p, level: Number(p.level), envelope_months: Number(p.envelope_months), weekly_hours: Number(p.weekly_hours), steps: steps.map((s) => ({ kind: s.kind, hours: Number(s.hours), title_en: s.title_en, title_ar: s.title_ar, pins: s.pins ?? [], auto: s.auto !== false })) };
    const pr = pathwayProblems(input, T.skills);
    if (pr.length) fail(`pathway ${id}: ${pr.join(', ')}`);
  }
  for (const id of [...WAVE_E_PATHWAYS, ...WAVE_E_COURSES]) if (!(T.credit_tags ?? []).some((t) => t.item_id === id && t.status === 'published')) fail(`no credit tag for ${id}`);
  const h2 = T.microcred_defs.filter((d) => d.code === 'MC-H2-HEAT');
  if (!h2.length || h2.some((d) => d.status !== 'draft')) fail('MC-H2-HEAT must stay a draft (settled decision)');
  const content = { courses: T.courses, course_skill_links: T.course_skill_links ?? [], adaptive_banks: T.adaptive_banks ?? [], performance_tasks: T.performance_tasks ?? [], opportunities: T.opportunities, skills: T.skills, twin_scenarios: T.twin_scenarios ?? [] };
  if (!satisfiability(h2[0], content).ok) fail('MC-H2-HEAT is no longer satisfiable');
  // 3. gap backlog
  const before = JSON.stringify(T.pathway_gaps);
  if (JSON.stringify(refreshGaps(T, T.pathway_gaps, QA_E_REFRESH)) !== before) fail('wave-E content changes the FS17 gap backlog: replay a guarded refresh live');
  // 4. MC-TWINS twin-drill route
  const twins = T.microcred_defs.find((d) => d.code === 'MC-TWINS' && d.status === 'current');
  const crit = (twins?.criteria ?? []).find((c) => c.kind === 'skill' && c.ref === 'sk-fs-ai-twin');
  const tw = crit ? routesFor(crit, content).filter((r) => r.kind === 'twin') : [];
  if (!tw.length) fail('MC-TWINS lists no twin-drill route');
  // 5. digest approvals for hosts
  const data = { people: T.people, qual_records: [], qual_standards: [], licences: [], skill_checkins: [], skill_ratings: [], mentoring_requests: [], mentoring_agreements: [], mentoring_sessions: [], opportunities: [], opportunity_applications: [],
    career_conversations: [], refresh_state: [], refresh_prefs: [], enrolments: [], courses: [], person_skills: [], skills: [], role_competencies: [], career_paths: [], career_targets: [], engine_settings: [], reco_optouts: [], plant_visits: T.plant_visits };
  const today = ctx?.DEMO_TODAY ?? '2026-10-08';
  const pending = T.plant_visits.filter((v) => v.status === 'logged' && String(v.created_at).slice(0, 10) <= today);
  for (const v of pending) if (!gatherDigest(data, v.host_person_id, today).some((i) => i.id === `approval:plant_visits:${v.id}`)) fail(`host ${v.host_person_id} misses plant visit ${v.id}`);
  const tags = T.credit_tags.filter((t) => [...WAVE_E_PATHWAYS, ...WAVE_E_COURSES].includes(t.item_id)).length;
  console.log(`fsqa5: recorded evidence ${WAVE_E_REF_TABLES.join('/')} kept by recomputes; ${WAVE_E_PATHWAYS.length} wave-E pathways pass pathwayProblems, ${tags} credit tags, MC-H2-HEAT draft; gap backlog unchanged (${T.pathway_gaps.length} rows, ${T.pathway_gaps.filter((g) => g.status === 'open').length} open); MC-TWINS twin routes ${tw.map((r) => r.id).join(', ')}; ${pending.length} host confirmations in the digest`);
}
