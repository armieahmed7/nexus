// FS wave C integration (QA lead): cross-feature hand-offs between FS17 (pathways), FS19 (course pack) and FS21/FS22 (adaptive
// assessments, performance tasks). Runs as a FINALIZE_LAST finalizer after fs17, fs19 and fs21 (file-name order).
//  1. FS21/FS22 -> FS17: assessment steps now also discover active FS21 adaptive banks and FS22 performance tasks that assess the
//     pathway's skill (src/modules/m19/pathways.ts discover(); SQL kafaa_pw_discover redefined in the QA migration).
//  2. FS19/FS21/FS22 -> FS17 gap backlog (FS57 feed): the backlog keeps every row FS17 first saw (steps that resolved to nothing
//     before the course pack and the assessments existed; these rows are live already) and replays one kafaa_refresh_pathway_gaps
//     on QA_REFRESH: a row whose step now resolves becomes "filled", the rest stay "open", and any newly empty step is added.
// The live database gets the same rows from supabase/migrations/20261010239001_kafaa_fs3qa_integration.sql (guarded DML).
import { resolvePathway } from '../../../src/modules/m19/pathways.ts';
import { FS31_DEFS } from './fs31-future-credentials.mjs'; // FS wave D · E3: FS31 credentials came after wave C

export const FINALIZE_LAST = true;
export const QA_REFRESH = '2026-10-11';

/** FS17's content before wave C's other branches: no FS19 pack courses, no FS21 banks, no FS22 tasks. */
export function contentBefore(T) {
  const pack = new Set((T.course_pack_items ?? []).map((p) => p.course_id));
  const fs31 = new Set(FS31_DEFS.map((d) => `mcd-${d[0].toLowerCase()}-v${d[1]}`));
  return { courses: T.courses.filter((c) => !pack.has(c.id)), externals: T.external_resources, opportunities: T.opportunities, credentials: (T.microcred_defs ?? []).filter((d) => !fs31.has(d.id)), fitness: T.fitness_areas ?? [] };
}
/** Content after the wave C merge (what kafaa_pw_resolve reads). */
export function contentAfter(T) {
  return { courses: T.courses, externals: T.external_resources, opportunities: T.opportunities, credentials: T.microcred_defs ?? [], fitness: T.fitness_areas ?? [], adaptive: T.adaptive_banks ?? [], tasks: T.performance_tasks ?? [] };
}
function requested(T, content) {
  const out = new Map();
  for (const p of T.pathways.filter((x) => x.status === 'published')) {
    for (const s of resolvePathway(p, T.pathway_steps, content).steps.filter((x) => x.status === 'requested')) out.set(`pg:${s.step_id}`, { p, s });
  }
  return out;
}
/** The gap backlog after one refresh on QA_REFRESH (same rule as kafaa_refresh_pathway_gaps). */
export function refreshedGaps(T, firstSeen) {
  const before = requested(T, contentBefore(T));
  const now = requested(T, contentAfter(T));
  const rows = [];
  for (const [id, { p, s }] of before) {
    const open = now.has(id);
    rows.push({ id, pathway_id: p.id, step_id: s.step_id, skill_id: p.skill_id, level: p.level, kind: s.kind, status: open ? 'open' : 'filled', first_seen: firstSeen, last_checked: QA_REFRESH, filled_on: open ? null : QA_REFRESH });
  }
  for (const [id, { p, s }] of now) if (!before.has(id)) rows.push({ id, pathway_id: p.id, step_id: s.step_id, skill_id: p.skill_id, level: p.level, kind: s.kind, status: 'open', first_seen: QA_REFRESH, last_checked: QA_REFRESH, filled_on: null });
  return rows.sort((a, b) => (a.id < b.id ? -1 : 1));
}

export default function build() {}

export function finalize(T) {
  if (!T.pathways || !T.pathway_gaps) return;
  const firstSeen = T.pathway_gaps[0]?.first_seen ?? '2026-10-10';
  T.pathway_gaps = refreshedGaps(T, firstSeen);
  const open = T.pathway_gaps.filter((g) => g.status === 'open').length;
  console.log(`fsqa3: pathway gap backlog ${T.pathway_gaps.length} rows (${open} open, ${T.pathway_gaps.length - open} filled by FS19 courses and FS21/FS22 assessments on ${QA_REFRESH})`);
}
