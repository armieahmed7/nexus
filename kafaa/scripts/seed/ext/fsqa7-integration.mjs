// FS wave G integration (QA lead): cross-feature hand-offs between the wave-G features (FS60-FS69) and earlier waves, plus the FS48
// mentoring engine card carried over from wave E. Runs as a FINALIZE_LAST finalizer after every wave-G builder and after fsqa6 (file-name
// order). It changes no row on the local seed (the FS48 card step is guarded on the live version 13, exactly as the SQL) and checks the
// wiring; the build fails if an invariant breaks:
//  1. FS60 inputs: the stored ISO 30414 disclosure values equal the formula on the final seed (FS50 register, FS09/FS36 AI-fundamentals
//     coverage, training records and xAPI hours, FS30 credits), so no later builder moved an input after fs60 computed them;
//  2. FS61: the adoption reference is the Future Skills Centre figure in kafaa_benchmarks (a sourced, listed row), and the rate is computed
//     from pilot statuses;
//  3. FS62: FS41 Net Zero competences, FS02 Jahiz groups and the FS09/FS36 AI target are tagged as data (derived or curated links);
//  4. FS64 <- FS51: every released regional-demand row equals demandRows() of a released FS51 forecast; no cell holds 1-9;
//  5. FS66 <- FS57/FS08 + handover 3.9: evidence at hire (kind credential, ref_table programme_alignments) is recorded evidence (kept by
//     every recompute) and the token is in the shared "no derived future-skill state" lists;
//  6. FS69 <- FS32: every pre-arrival share is an FS32 record share with purpose 'prearrival'; shares made for a contractor carry the
//     signed-consent reference (assessor-on-behalf, the FS29 precedent);
//  7. partner isolation data: every FS64 commitment and FS65 pledge names exactly one organisation;
//  8. FS48: the mentoring card carries the FS48 wording; the live step (version 13 -> 14) is a no-op here.
// The live database gets the matching SQL from supabase/migrations/20261010279001_kafaa_fs7qa_integration.sql.
import { readFileSync } from 'node:fs';
import { isRecordedEvidence } from '../../../src/domain/skills.ts';
import { adoptionRate, referenceOf } from '../../../src/modules/m35/pilots.ts';
import { effectiveLinks } from '../../../src/modules/m37/national.ts';
import { demandRows } from '../../../src/modules/m36/regional.ts';
import { recomputeDisclosures } from './fs60-iso30414.mjs';
import { FS48_CARD } from './fs46-future-leadership.mjs';

export const FINALIZE_LAST = true;
export const WAVE_G_REF_TABLES = ['programme_alignments']; // FS66; recorded by kind (credential), so RECORDED_REF_TABLES and the SQL lists stay as they are
/** The shared "no derived future-skill state" lists that must name every wave-G evidence ref_table (handover 3.9 item 3). */
export const SHARED_EVIDENCE_LISTS = ['tests/unit/fs11-catalogue.test.ts', 'tests/unit/fsqa1-integration.test.tsx', 'scripts/validate/fs11-foundation.mjs', 'scripts/validate/fsqa1-integration.mjs'];
/** The live FS48 card step (fs7qa SQL item 2). */
export const FS48_LIVE_STEP = { id: 'mentoring', from_version: 13, to_version: 14, last_changed_at: '2026-10-11T00:00:00Z' };
const FS48_SENTENCE_EN = ' Mentor circles and offers (FS48) are ranked only for people who opt in, from the areas they chose; withdrawing removes them from every ranking.';
const FS48_SENTENCE_AR = ' تُرتَّب حلقات الإرشاد والعروض (FS48) لمن اختار المشاركة فقط ووفق المجالات التي اختارها، والانسحاب يزيله من كل ترتيب.';

/** Mirror of the fs7qa card statement: only a card at version 13 changes; content parts add only what is missing. Returns a new row. */
export function applyFs48CardStep(card) {
  if (!card || card.id !== FS48_LIVE_STEP.id || Number(card.version) !== FS48_LIVE_STEP.from_version) return card;
  const fns = [...(card.scoring_functions ?? [])];
  for (const f of ['src/modules/m22/future.ts#rankCircles', 'src/modules/m22/future.ts#rankOffers']) if (!fns.includes(f)) fns.push(f);
  const inputs = (card.inputs_used ?? []).some((x) => x.key === 'wfn_participants') ? card.inputs_used : [...(card.inputs_used ?? []), FS48_CARD.extra_input];
  return {
    ...card, scoring_functions: fns, inputs_used: inputs,
    limitations_en: card.limitations_en.includes('(FS48)') ? card.limitations_en : card.limitations_en.trimEnd() + FS48_SENTENCE_EN,
    limitations_ar: card.limitations_ar.includes('(FS48)') ? card.limitations_ar : card.limitations_ar.trimEnd() + FS48_SENTENCE_AR,
    version: FS48_LIVE_STEP.to_version, last_changed_at: FS48_LIVE_STEP.last_changed_at,
  };
}

export default function build() {}

export function finalize(T) {
  const fail = (m) => { throw new Error(`fsqa7: ${m}`); };
  if (!T.hc_disclosures || !T.regional_demand || !T.prearrival_shares || !T.engine_cards) return; // partial builds (unit fixtures)
  // 1. FS60 inputs reproduce
  const stored = JSON.stringify(T.hc_disclosures.map((d) => d.metric_values));
  const probe = { ...T, hc_disclosures: T.hc_disclosures.map((d) => ({ ...d })) };
  recomputeDisclosures(probe);
  if (JSON.stringify(probe.hc_disclosures.map((d) => d.metric_values)) !== stored) fail('the stored FS60 disclosure values no longer equal the formula on the final seed: call recomputeDisclosures(T)');
  // 2. FS61 reference and rate
  const ref = referenceOf(T.benchmarks);
  const fsc = T.benchmarks.find((b) => b.id === 'FSC');
  if (!ref || !fsc?.listed || !/^https:\/\//.test(ref.url) || !ref.as_of) fail('the FS61 reference must be the listed FSC benchmark figure with an https source and an as-of date');
  const rate = adoptionRate(T.skill_pilots).rate;
  if (rate == null) fail('FS61 adoption rate is not computable');
  // 3. FS62 wiring as data
  const links = effectiveLinks({ tags: T.national_tags, links: T.tag_links, skills: T.skills, cec_competences: T.cec_competences ?? [] });
  const nz = links.filter((l) => l.basis === 'net_zero' && l.target_table === 'cec_competences').length;
  const jz = links.filter((l) => l.basis === 'future_group' && l.target_table === 'skills').length;
  const ai = links.filter((l) => l.target_table === 'ai_org_targets').length;
  if (!nz || !jz || !ai) fail(`FS62 links missing (net zero ${nz}, Jahiz ${jz}, AI target ${ai})`);
  // 4. FS64 <- FS51
  const area = Object.fromEntries(T.skills.map((s) => [s.id, s.area]));
  const fc = new Map((T.skill_forecasts ?? []).map((f) => [f.id, f]));
  for (const rel of new Set(T.regional_demand.map((r) => r.release_id))) {
    const rows = T.regional_demand.filter((r) => r.release_id === rel);
    const f = fc.get(rows[0].forecast_id);
    if (!f || f.status !== 'released') fail(`release ${rel} does not come from a released FS51 forecast`);
    const want = demandRows(f.results, f.scenario, area);
    const pick = (r) => JSON.stringify([r.area, r.year, r.demand_low, r.demand_high, r.gap_low, r.gap_high, r.gap_plan, r.skills_n, r.withheld_n, r.suppressed]);
    if (JSON.stringify(rows.map(pick).sort()) !== JSON.stringify(want.map(pick).sort())) fail(`release ${rel} differs from demandRows() of ${f.id}`);
  }
  const small = T.regional_demand.filter((r) => ['demand_low', 'demand_high', 'gap_low', 'gap_high', 'gap_plan'].some((k) => r[k] != null && r[k] > 0 && r[k] < 10));
  if (small.length) fail(`${small.length} released demand cells hold 1-9`);
  // 5. FS66 evidence is recorded evidence
  for (const t of WAVE_G_REF_TABLES) {
    if (!isRecordedEvidence({ kind: 'credential', ref_table: t })) fail(`${t} evidence would not survive a recompute`);
    for (const f of SHARED_EVIDENCE_LISTS) if (!readFileSync(f, 'utf8').includes(`'${t}'`)) fail(`${f} does not name ${t}`);
  }
  const progEv = T.skill_evidence.filter((e) => e.ref_table === 'programme_alignments');
  if (progEv.some((e) => e.kind !== 'credential' || e.basis !== 'validated')) fail('programme evidence must be validated credential evidence');
  // 6. FS69 <- FS32
  const shares = new Map(T.record_shares.map((s) => [s.id, s]));
  for (const p of T.prearrival_shares) {
    const s = shares.get(p.share_id);
    if (!s || s.consents?.purpose !== 'prearrival' || s.person_id !== p.person_id) fail(`pre-arrival share ${p.id} is not an FS32 share with purpose prearrival`);
    if (p.created_via === 'on_behalf' && !(p.consent_ref && s.consents?.on_behalf)) fail(`pre-arrival share ${p.id} made on behalf without a consent reference`);
  }
  // 7. one organisation per FS64 commitment and FS65 pledge
  const orgs = new Set(T.organisations.map((o) => o.id));
  const noOrg = [...T.provider_commitments, ...T.pledges].filter((r) => !orgs.has(r.org_id));
  if (noOrg.length) fail(`${noOrg.length} commitments or pledges without a known organisation`);
  // 8. FS48 card
  const i = T.engine_cards.findIndex((c) => c.id === 'mentoring');
  if (i < 0) fail('mentoring engine card missing');
  const before = JSON.stringify(T.engine_cards[i]);
  T.engine_cards[i] = applyFs48CardStep(T.engine_cards[i]);
  const card = T.engine_cards[i];
  if (JSON.stringify(card) !== before) fail('the FS48 live step changed the local card (it must be a no-op off version 13)');
  if (!FS48_CARD.scoring_functions.every((f) => card.scoring_functions.includes(f)) || !card.inputs_used.some((x) => x.key === 'wfn_participants')
    || card.limitations_en !== FS48_CARD.limitations_en || card.limitations_ar !== FS48_CARD.limitations_ar) fail('the mentoring card lacks the FS48 wording');
  const onBehalf = T.prearrival_shares.filter((p) => p.created_via === 'on_behalf').length;
  console.log(`fsqa7: FS60 ${T.hc_disclosures.length} disclosures reproduce from the formula; FS61 adoption ${rate}% vs the FSC reference from kafaa_benchmarks; FS62 links net zero ${nz}, Jahiz ${jz}, AI target ${ai}; `
    + `FS64 ${T.regional_demand.length} released demand rows = demandRows(released FS51); FS66 programme evidence recorded (${progEv.length} seeded); FS69 ${T.prearrival_shares.length} pre-arrival shares on FS32 (${onBehalf} on behalf with consent); `
    + `${T.provider_commitments.length} commitments and ${T.pledges.length} pledges each name one organisation; FS48 mentoring card v${card.version} (live step 13 -> 14 is a no-op here)`);
}
