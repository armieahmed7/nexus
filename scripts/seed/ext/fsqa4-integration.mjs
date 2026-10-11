// FS wave D integration (QA lead): cross-feature hand-offs between the wave-D features and earlier waves. Runs as a FINALIZE_LAST
// finalizer after fs27 (gigs), fs29 (credit tags), fs31 (FS31 credentials and awards) and fsqa3 (wave-C gap backlog), by file name.
//  1. FS31 -> FS30: the FS31 micro-credentials get their indicative NQF level and credit tag (fs29 ensureCreditTags, same rule as every
//     other current micro-credential), and the credit ledger is rebuilt so FS31 awards count (creditsFor = kafaa_cr_compute).
//  2. FS31 -> FS27/FS28: the strategic tier also names wave-D future gigs and future-role rotations (microcred_unlocks rows), so a
//     strategic credential unlocks an FS27 channel gig; kafaa_apply_opportunity / local applyOpportunity refuse a non-holder.
//  3. FS27/FS31 -> FS17 gap backlog (FS57 feed): one more kafaa_refresh_pathway_gaps replay on QA_REFRESH with the wave-D content
//     (channel gigs fill practice steps): open rows whose step now resolves become "filled"; nothing is deleted.
// The live database gets the same rows from supabase/migrations/20261010249001_kafaa_fs4qa_integration.sql (guarded DML).
import { resolvePathway } from '../../../src/modules/m19/pathways.ts';
import { unlockId, unlockProblem } from '../../../src/modules/m17/futureCreds.ts';
import { ensureCreditTags, rebuildLedger } from './fs29-rpl-credits.mjs';
import { QA_REFRESH } from './fsqa3-integration.mjs';

export const FINALIZE_LAST = true;
export const QA_D_REFRESH = QA_REFRESH; // the wave-D QA ran on the same day as the wave-C QA (2026-10-11)

/** Wave-D unlocks: strategic credentials that name FS27 channel gigs and FS28 future-role rotations. */
export const FSQA4_UNLOCKS = [
  ['MC-AI-ASSURER', 'opportunity', 'fg-ai-chem-trend-flags', 'Flags from the chemistry trend model are checked by people who can verify AI output.', 'يتحقق من إشارات نموذج اتجاهات الكيمياء أشخاص قادرون على التحقق من مخرجات الذكاء الاصطناعي.'],
  ['MC-TWINS', 'opportunity', 'fg-dig-twin-validation', 'Validating the twin against plant history needs a digital twin practitioner.', 'يحتاج التحقق من التوأم الرقمي مقابل سجل المحطة إلى ممارس للتوائم الرقمية.'],
  ['MC-TWINS', 'rotation', 'rt-fs-digital-twin', 'The digital twin rotation takes digital twin practitioners first.', 'يقبل تدوير التوأم الرقمي ممارسي التوائم الرقمية أولًا.'],
  ['MC-DATA-DECISIONS', 'rotation', 'rt-fs-data-office', 'The data office rotation takes holders of the data-for-decisions credential first.', 'يقبل تدوير مكتب البيانات حاملي اعتماد البيانات لقرارات المحطة أولًا.'],
];
export const UNLOCK_SET_AT = '2026-10-11T09:00:00Z';

function contentAll(T) {
  return { courses: T.courses, externals: T.external_resources, opportunities: T.opportunities, credentials: T.microcred_defs ?? [], fitness: T.fitness_areas ?? [], adaptive: T.adaptive_banks ?? [], tasks: T.performance_tasks ?? [] };
}
/** kafaa_refresh_pathway_gaps on `day` (same rule): requested steps open (re-opened if filled), new ones added, other open rows filled. */
export function refreshGaps(T, gaps, day) {
  const want = new Map();
  for (const p of T.pathways.filter((x) => x.status === 'published').sort((a, b) => (a.id < b.id ? -1 : 1)))
    for (const s of resolvePathway(p, T.pathway_steps, contentAll(T)).steps.filter((x) => x.status === 'requested')) want.set(`pg:${s.step_id}`, { p, s });
  const byId = new Map(gaps.map((g) => [g.id, { ...g }]));
  for (const [id, { p, s }] of want) {
    const g = byId.get(id);
    if (g) Object.assign(g, { status: 'open', last_checked: day, filled_on: null });
    else byId.set(id, { id, pathway_id: p.id, step_id: s.step_id, skill_id: p.skill_id, level: p.level, kind: s.kind, status: 'open', first_seen: day, last_checked: day, filled_on: null });
  }
  for (const g of byId.values()) if (g.status === 'open' && !want.has(g.id)) Object.assign(g, { status: 'filled', filled_on: day, last_checked: day });
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

export default function build() {}

export function finalize(T) {
  // 1. FS31 -> FS30 credit tags and ledger
  const before = (T.credit_tags ?? []).length;
  if (T.credit_tags && T.credit_stacks) {
    ensureCreditTags(T);
    rebuildLedger(T);
  }
  // 2. FS31 -> FS27/FS28 unlocks
  T.microcred_unlocks ??= [];
  for (const [def_code, target_kind, target_id, note_en, note_ar] of FSQA4_UNLOCKS) {
    const id = unlockId(def_code, target_kind, target_id);
    if (T.microcred_unlocks.some((u) => u.id === id)) continue;
    const bad = unlockProblem({ def_code, target_kind, target_id, note_en, note_ar, active: true }, { defs: T.microcred_defs, unlocks: T.microcred_unlocks, opportunities: T.opportunities, rotation_templates: T.rotation_templates });
    if (bad !== 'ok') throw new Error(`fsqa4: unlock ${id}: ${bad}`);
    T.microcred_unlocks.push({ id, def_code, target_kind, target_id, note_en, note_ar, active: true, set_by: 'p-training-mgr', set_at: UNLOCK_SET_AT });
  }
  T.microcred_unlocks.sort((a, b) => (a.id < b.id ? -1 : 1));
  // 3. FS27/FS31 -> FS17 gap backlog
  if (T.pathways && T.pathway_gaps) {
    const n0 = T.pathway_gaps.filter((g) => g.status === 'open').length;
    T.pathway_gaps = refreshGaps(T, T.pathway_gaps, QA_D_REFRESH);
    const open = T.pathway_gaps.filter((g) => g.status === 'open').length;
    console.log(`fsqa4: ${T.credit_tags.length - before} FS31 credit tags, ${T.credit_ledger?.length ?? 0} ledger rows, ${FSQA4_UNLOCKS.length} wave-D unlocks; gap backlog ${T.pathway_gaps.length} rows (${open} open, ${n0 - open} more filled by FS27 gigs and FS31 credentials)`);
  }
}
