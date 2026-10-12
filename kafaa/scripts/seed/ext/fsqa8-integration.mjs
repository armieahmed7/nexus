// FS wave H integration (QA lead): cross-feature hand-offs between the wave-H features (FS70-FS77) and earlier waves. Runs as a
// FINALIZE_LAST finalizer after every wave-H builder and after fsqa7 (file-name order). It changes no row and checks the wiring on the
// final seed; the build fails if an invariant breaks:
//  1. FS70/FS71 published lists: every stored Skills on the Rise list and every stored badge list equals the rule on the final seed (no
//     builder that runs after fs70 moved an input of a published quarter: goals, evidence, hires, opportunities, role-profile versions);
//  2. FS70 -> FS75: the digest's rising-skill topic reads the stored FS70 rows (quarter, skill_id, category, rank, families) and gives at
//     least one nudge on FS75_FROM;
//  3. FS72 -> FS55: the skill_suggestions engine card (protected inputs excluded) and its fairness snapshot exist; a confirmed suggestion is
//     recorded evidence (kind rating, basis claimed) and the token is in the shared "no derived future-skill state" lists;
//  4. FS74 <- FS09/FS31/FS25/FS41 + FS72: the wallet counts evidence only: claimed states (what a confirmed FS72 suggestion writes) never
//     complete an item for anyone; FS62 tags the wallet target (curated links) and the target is a dated leadership setting with who/when;
//  5. FS69 -> F36 (wave-G carry-over): pre-arrival checks owed reach the digest of the evaluator who opened the share on the contractor's
//     behalf, from FS75_FROM only; no seeded digest falls on or after that day (seeded digests unchanged);
//  6. FS76: the seeded release-gate run carries the future-skills set and passes (citation >= 95 %, every security case declined);
//  7. FS77: induction plans name the baseline baselineFor() gives for their intake year, or are flagged stale (planStale).
// The live database gets the matching SQL from supabase/migrations/20261010289001_kafaa_fs8qa_integration.sql.
import { readFileSync } from 'node:fs';
import { isRecordedEvidence } from '../../../src/domain/skills.ts';
import { risingSkills, signalInputFromTables } from '../../../src/modules/m28/signals.ts';
import { technologyBadges, badgeInputFromTables } from '../../../src/modules/m28/technologies.ts';
import { gatherDigest } from '../../../src/shell/digest/rules.ts';
import { FS75_FROM } from '../../../src/shell/digest/future.ts';
import { walletStatus, walletWorld } from '../../../src/modules/m37/wallet.ts';
import { effectiveLinks } from '../../../src/modules/m37/national.ts';
import { baselineFor, planStale } from '../../../src/modules/m06/starter.ts';

export const FINALIZE_LAST = true;
/** The shared "no derived future-skill state" lists that must name the wave-H evidence ref_table (handover 3.9 item 3). */
export const SHARED_EVIDENCE_LISTS = ['tests/unit/fs11-catalogue.test.ts', 'tests/unit/fsqa1-integration.test.tsx', 'scripts/validate/fs11-foundation.mjs', 'scripts/validate/fsqa1-integration.mjs'];
export const WAVE_H_REF_TABLES = ['skill_suggestions']; // FS72; recorded by kind (rating), so RECORDED_REF_TABLES and the SQL lists stay as they are
/** Fields of kafaa_skill_signals the FS75 digest reads (data-only coupling). */
export const SIGNAL_FIELDS = ['quarter', 'skill_id', 'category', 'rank', 'families'];

const pick = (o, ks) => JSON.stringify(ks.map((k) => o[k] ?? null));

/** The digest data the seed builders pass to the TS rules (every table the gatherer reads). */
export function digestDataOf(T) {
  return new Proxy({}, { get: (_, k) => (typeof k === 'string' ? T[k] ?? [] : undefined) });
}

/** Claimed copies of every skill state (what a confirmed FS72 suggestion adds), at level 3 for the wallet's skills. */
export function withClaims(T, pid, skillIds) {
  return [...(T.person_skills ?? []).filter((s) => s.person_id === pid && s.active), ...skillIds.map((k) => ({ id: `ps:claim:${pid}:${k}`, person_id: pid, skill_id: k, level: 3, basis: 'claimed', active: true }))];
}

export default function build() {}

export function finalize(T) {
  const fail = (m) => { throw new Error(`fsqa8: ${m}`); };
  if (!T.skill_signal_runs || !T.wallet_targets || !T.digest_nudge_rules || !T.dalil_intents || !T.intake_baselines) return; // partial builds (unit fixtures)
  const raw = (t) => T[t] ?? [];
  // 1. FS70/FS71 stored lists = the rules on the final seed
  const inp = signalInputFromTables(raw);
  for (const run of T.skill_signal_runs) {
    const res = risingSkills(inp, run.quarter);
    const want = (res?.rows ?? []).map((r) => pick(r, ['skill_id', 'category', 'rank', 'score'])).sort();
    const got = T.skill_signals.filter((s) => s.run_id === run.id).map((r) => pick(r, ['skill_id', 'category', 'rank', 'score'])).sort();
    if (JSON.stringify(want) !== JSON.stringify(got)) fail(`the stored FS70 list ${run.quarter} no longer equals risingSkills() on the final seed: a builder after fs70 moved an input (rerun fs70's finalize)`);
  }
  const bin = badgeInputFromTables(raw);
  for (const q of new Set(T.technology_badges.map((b) => b.quarter))) {
    const res = technologyBadges(bin, q);
    const want = [...(res?.hot ?? []).map((x) => `enec:${x.technology_id}:${x.rank}`), ...(res?.roles ?? []).map((x) => `${x.role_id}:${x.technology_id}`)].sort();
    const got = T.technology_badges.filter((b) => b.quarter === q).map((b) => (b.scope === 'enec' ? `enec:${b.technology_id}:${b.rank}` : `${b.role_id}:${b.technology_id}`)).sort();
    if (JSON.stringify(want) !== JSON.stringify(got)) fail(`the stored FS71 badges ${q} no longer equal technologyBadges() on the final seed`);
  }
  // 2. FS70 -> FS75: the rising-skill topic reads the stored rows
  for (const s of T.skill_signals) for (const f of SIGNAL_FIELDS) if (!(f in s)) fail(`skill_signals ${s.id} lacks ${f} (the FS75 digest reads it)`);
  const data = digestDataOf(T);
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active');
  const latest = T.skill_signals.reduce((m, r) => (r.quarter > m ? r.quarter : m), '');
  let rising = 0;
  for (const p of staff) {
    const it = gatherDigest(data, p.id, FS75_FROM).filter((i) => i.ref_table === 'skill_signals');
    for (const i of it) if (!T.skill_signals.some((s) => s.quarter === latest && s.skill_id === i.ref_id && s.category === 'growing')) fail(`rising-skill nudge ${i.id} is not on the ${latest} list`);
    rising += it.length;
  }
  if (!rising) fail(`no rising-skill nudge on ${FS75_FROM} from the ${latest} FS70 list`);
  // 3. FS72 -> FS55
  const card = T.engine_cards.find((c) => c.id === 'skill_suggestions');
  const excl = (card?.inputs_excluded ?? []).map((x) => (typeof x === 'string' ? x : x.key));
  if (!card || !['gender', 'nationality_flag', 'age'].every((k) => excl.includes(k))) fail('the FS72 engine card is missing or does not exclude the protected inputs');
  if (!(T.skill_suggestion_fairness ?? []).length) fail('the FS72 surface has no fairness snapshot');
  if (!isRecordedEvidence({ kind: 'rating', ref_table: 'skill_suggestions' })) fail('a confirmed suggestion (kind rating) must be recorded evidence');
  for (const f of SHARED_EVIDENCE_LISTS) if (!readFileSync(f, 'utf8').includes("'skill_suggestions'")) fail(`${f} must list 'skill_suggestions' (handover 3.9)`);
  // 4. FS74: evidence only; FS62 tags; leadership setting
  const ww = walletWorld(raw);
  const walletSkills = [...new Set([...(T.ai_skill_tracks ?? []).map((x) => x.skill_id), ...(T.ai_rungs ?? []).flatMap((c) => c.skill_ids ?? []), 'sk-da-01',
    ...(T.core_skills ?? []).flatMap((c) => c.skill_ids ?? []), ...(T.cec_competences ?? []).flatMap((c) => c.skill_ids ?? [])].filter(Boolean))];
  let complete = 0;
  for (const p of staff) {
    const base = walletStatus(p.id, ww.inputsFor(p.id), FS75_FROM);
    const claimed = walletStatus(p.id, { ...ww.inputsFor(p.id), states: withClaims(T, p.id, walletSkills) }, FS75_FROM);
    if (claimed.met !== base.met) fail(`claimed states moved ${p.id}'s wallet from ${base.met} to ${claimed.met} items (evidence only)`);
    if (base.complete) complete++;
  }
  const wl = effectiveLinks({ tags: T.national_tags, links: T.tag_links, skills: T.skills, cec_competences: T.cec_competences ?? [] }).filter((l) => l.target_table === 'wallet_targets');
  const wt = T.wallet_targets.find((t) => t.id === 'wt-core-five');
  if (wl.length < 1 || !wt || !wt.set_by || !wt.set_by_role || !wt.set_at || !wt.due_on || wt.pct == null) fail('the wallet target must be tagged in FS62 and carry its value, date and who set it when');
  // 5. FS69 -> F36: pre-arrival checks owed
  const owed = [];
  for (const p of T.people) for (const i of gatherDigest(data, p.id, FS75_FROM)) if (i.ref_table === 'prearrival_shares') owed.push([p.id, i.ref_id]);
  for (const [pid, id] of owed) {
    const pa = T.prearrival_shares.find((x) => x.id === id);
    if (!pa || pa.created_via !== 'on_behalf' || pa.created_by !== pid || pa.checked_at) fail(`pre-arrival item ${id} reached ${pid}, who did not open it on the contractor's behalf or it is checked`);
  }
  const before = T.people.filter((p) => gatherDigest(data, p.id, '2026-10-11').some((i) => i.ref_table === 'prearrival_shares')).length;
  if (!owed.length || before) fail(`pre-arrival checks owed: ${owed.length} on ${FS75_FROM}, ${before} people before it (must be 0)`);
  if (T.digest_runs.some((r) => String(r.as_of ?? '').slice(0, 10) >= FS75_FROM)) fail('a seeded digest falls on or after FS75_FROM');
  // 6. FS76 release gate
  const ev = T.eval_runs.find((r) => r.id === 'eval-2026-10-fs76');
  if (!ev || !ev.pass || !String(ev.engine).includes('future-v1') || ev.cited_correct / ev.in_scope_total < 0.95 || ev.security_correct !== ev.security_total) fail('the FS76 release-gate run must carry the future set and pass');
  // 7. FS77 induction plans read the baseline of their intake year
  let stale = 0;
  for (const pl of T.induction_plans) {
    const b = baselineFor(T.intake_baselines.filter((x) => x.status === 'published'), Number(pl.intake_year), pl.programme);
    const s = planStale(pl, T.intake_baselines);
    if ((b?.id ?? null) !== (pl.baseline_id ?? null) && !s) fail(`induction plan ${pl.id} names ${pl.baseline_id} but ${b?.id ?? 'no baseline'} applies and it is not flagged stale`);
    if (s) stale++;
  }
  console.log(`fsqa8: FS70 ${T.skill_signal_runs.length} lists and FS71 badges reproduce; ${rising} rising-skill nudges on ${FS75_FROM} from ${latest}; FS72 card + ${T.skill_suggestion_fairness.length} fairness rows; `
    + `wallet evidence only (${complete} complete, ${wl.length} FS62 tags); ${owed.length} pre-arrival checks owed; FS76 gate ${ev.cited_correct}/${ev.in_scope_total}; ${T.induction_plans.length} induction plans (${stale} stale)`);
}
