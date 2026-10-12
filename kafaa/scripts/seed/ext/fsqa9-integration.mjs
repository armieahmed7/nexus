// FS wave I integration (QA lead): cross-feature hand-offs between the wave-I features (FS78-FS84) and earlier waves. Runs as a
// FINALIZE_LAST finalizer after every wave-I builder and after fsqa8 (file-name order). It changes no row and checks the wiring on the
// final seed; the build fails if an invariant breaks:
//  1. FS79 -> FS32/M17: every verified, unexpired external certificate is a learner-record item (kind xcert) whose status is its trust
//     tier; unverified, rejected, withdrawn and revoked certificates never are; the full record of each holder is a valid CLR 2.0 shape
//     with no security or medical wording; every seeded share reference passes the widened reference check;
//  2. FS79 -> F01: certificate evidence exists only for verified (active) or revoked (inactive) certificates, uses the recorded kind
//     credential, the tier's basis and at most the tier's level, and only reviewed FS08 crosswalk rows;
//  3. FS80 <- FS36 and -> F01: every gallery entry names an existing AI-system register row; builder credit (ojt, recorded) only for an
//     approved (or later retired) entry with at least one adopter;
//  4. FS82/FS83 -> F01: grant-output and visit evidence use recorded kinds (rating, ojt), so recomputes keep them; budgets SIMULATED;
//  5. FS81: every plan is SIMULATED and carries review dates (the person-and-HR-only read rule is proved in PGlite and the unit tests);
//  6. FS78 <- FS30/FS18: the balance unit is the FS30 credit (1 credit = 10 hours) and every study-time request names an FS18 gated item;
//  7. FS84 <- F11: the 24 F11 targets stay horizon 'current'; every 2028/2030 target names the role-profile versions it came from;
//  8. the shared "no derived future-skill state" lists name the four wave-I evidence ref_tables (handover 3.9).
// The live database gets the matching SQL from supabase/migrations/20261010299001_kafaa_fs9qa_integration.sql.
import { readFileSync } from 'node:fs';
import { isRecordedEvidence } from '../../../src/domain/skills.ts';
import { RESTRICTED_RECORD, buildBundle, recordItems, validateClr } from '../../../src/modules/m17/learnerRecord.ts';
import { TIER_BASIS, TIER_CAP, trustTier, reviewed } from '../../../src/modules/m34/extcerts.ts';
import { CREDIT_HOURS as BALANCE_CREDIT_HOURS } from '../../../src/modules/m34/balance.ts';
import { CREDIT_HOURS as FS30_CREDIT_HOURS } from '../../../src/modules/m34/credits.ts';

export const FINALIZE_LAST = true;
/** The shared "no derived future-skill state" lists (handover 3.9 item 3). */
export const SHARED_EVIDENCE_LISTS = ['tests/unit/fs11-catalogue.test.ts', 'tests/unit/fsqa1-integration.test.tsx', 'scripts/validate/fs11-foundation.mjs', 'scripts/validate/fsqa1-integration.mjs'];
/** Wave-I evidence ref_tables: all written with recorded kinds, so RECORDED_REF_TABLES and the SQL lists stay as they are. */
export const WAVE_I_REF_TABLES = { external_certs: 'credential', automations: 'ojt', grant_applications: 'rating', consortium_visits: 'ojt' };
/** The day the wiring is checked on (the seed's "today"). */
export const FSQA9_DAY = '2026-10-12';
/** The share reference check of kafaa_lr_refs_ok after the wave-I redefinition. */
export const REF_OK = /^(mc|badge|xcert|qual|skill):[A-Za-z0-9._:-]{1,120}$/;

export function recordWorldOf(T, pid, today = FSQA9_DAY) {
  const p = (T.people ?? []).find((x) => x.id === pid);
  return { today, person: pid, initials: p?.initials || '—', microcred_awards: T.microcred_awards ?? [], microcred_defs: T.microcred_defs ?? [], badges: T.badges ?? [], certificates: T.certificates ?? [],
    qual_records: T.qual_records ?? [], qual_standards: T.qual_standards ?? [], person_skills: T.person_skills ?? [], skills: T.skills ?? [], competencies: T.competencies ?? [], external_certs: T.external_certs ?? [] };
}

export default function build() {}

export function finalize(T) {
  const fail = (m) => { throw new Error(`fsqa9: ${m}`); };
  if (!T.external_certs || !T.automations || !T.transition_plans || !T.grant_applications || !T.consortium_visits || !T.learning_balances) return; // partial builds (unit fixtures)
  const day = FSQA9_DAY;
  // 1. FS79 -> FS32: record items
  const holders = [...new Set(T.external_certs.map((c) => c.person_id))].sort();
  let xitems = 0;
  for (const pid of holders) {
    const w = recordWorldOf(T, pid, day);
    const items = recordItems(w);
    const want = T.external_certs.filter((c) => c.person_id === pid && c.status === 'verified' && !(c.expires_on && String(c.expires_on).slice(0, 10) < day)).map((c) => `xcert:${c.id}`).sort();
    const got = items.filter((i) => i.kind === 'xcert');
    if (JSON.stringify(got.map((i) => i.ref).sort()) !== JSON.stringify(want)) fail(`${pid}: record xcert items ${got.map((i) => i.ref)} != verified certificates ${want}`);
    for (const i of got) {
      const c = T.external_certs.find((x) => x.id === i.id);
      if (i.status !== trustTier(c) || i.status === 'claimed') fail(`${i.ref}: record status ${i.status} is not the trust tier ${trustTier(c)}`);
    }
    const bundle = buildBundle(w, items.map((i) => i.ref), { id: `fsqa9:${pid}`, issued_on: day, valid_until: null });
    const probs = validateClr(bundle);
    if (probs.length) fail(`${pid}: the full learner record is not CLR-shaped: ${probs[0]}`);
    if (RESTRICTED_RECORD.test(JSON.stringify(bundle))) fail(`${pid}: the learner record carries security or medical wording`);
    xitems += got.length;
  }
  for (const s of T.record_shares ?? []) for (const r of s.items ?? []) if (!REF_OK.test(r)) fail(`record share ${s.id}: reference ${r} fails the share reference check`);
  // 2. FS79 -> F01
  const al = new Map((T.skill_alignments ?? []).map((a) => [a.id, a]));
  const ev = (T.skill_evidence ?? []).filter((e) => e.ref_table === 'external_certs');
  for (const e of ev) {
    const c = T.external_certs.find((x) => x.id === e.ref_id);
    if (!c || !['verified', 'revoked'].includes(c.status)) fail(`evidence ${e.id} rests on a certificate that was never verified`);
    if (c.status === 'revoked' && e.active) fail(`evidence ${e.id} of revoked certificate ${c.id} is still active`);
    const tier = c.tier;
    if (e.kind !== 'credential' || e.basis !== TIER_BASIS[tier] || Number(e.level) > TIER_CAP[tier]) fail(`evidence ${e.id}: kind ${e.kind}, basis ${e.basis}, level ${e.level} do not follow tier ${tier}`);
    if (!(c.alignment_ids ?? []).some((a) => reviewed(al.get(a)) && al.get(a).skill_id === e.skill_id)) fail(`evidence ${e.id} maps through no reviewed crosswalk row`);
  }
  // 3. FS80 <- FS36
  const systems = new Set((T.ai_systems ?? []).map((s) => s.id));
  for (const a of T.automations) if (!systems.has(a.system_id)) fail(`automation ${a.id} names no AI-system register row (${a.system_id})`);
  for (const e of (T.skill_evidence ?? []).filter((x) => x.ref_table === 'automations')) {
    const a = T.automations.find((x) => x.id === e.ref_id);
    const adopters = (T.automation_adoptions ?? []).filter((x) => x.automation_id === e.ref_id).length;
    if (!a || !['approved', 'retired'].includes(a.status) || adopters < 1 || e.person_id !== a.builder_person_id || e.kind !== 'ojt') fail(`builder credit ${e.id} without an approved, adopted entry`);
  }
  // 4. FS79/FS80/FS82/FS83 evidence is recorded (kept by kafaa_skills_apply)
  for (const [rt, kind] of Object.entries(WAVE_I_REF_TABLES)) if (!isRecordedEvidence({ kind, ref_table: rt })) fail(`${rt} evidence (kind ${kind}) must be recorded evidence`);
  for (const e of (T.skill_evidence ?? []).filter((x) => x.ref_table in WAVE_I_REF_TABLES)) if (e.kind !== WAVE_I_REF_TABLES[e.ref_table]) fail(`evidence ${e.id} uses kind ${e.kind}`);
  if ((T.grant_rounds ?? []).some((r) => r.simulated !== true) || (T.consortium_cohorts ?? []).some((c) => c.simulated === false)) fail('FS82/FS83 budgets must be SIMULATED');
  // 5. FS81
  for (const p of T.transition_plans) if (p.simulated !== true || !(p.reviews ?? []).length) fail(`transition plan ${p.id} must be SIMULATED and carry review dates`);
  // 6. FS78 <- FS30/FS18
  if (BALANCE_CREDIT_HOURS !== FS30_CREDIT_HOURS) fail(`FS78 credit unit ${BALANCE_CREDIT_HOURS} h differs from FS30 ${FS30_CREDIT_HOURS} h`);
  const xr = new Map((T.external_resources ?? []).map((x) => [x.id, x]));
  for (const r of T.study_time_requests ?? []) {
    const item = xr.get(r.resource_id);
    if (!item) fail(`study-time request ${r.id} names no FS18 catalogue item`);
    if (r.status === 'approved' && !(item.status === 'published' && item.listed === true)) fail(`approved study time ${r.id} charges an ungated item ${r.resource_id}`);
  }
  // 7. FS84 <- F11
  const tst = T.team_skill_targets ?? [];
  if (tst.filter((x) => (x.horizon ?? 'current') === 'current').length !== 24) fail('the 24 F11 team targets must stay horizon current');
  for (const x of tst) if ((x.horizon ?? 'current') !== 'current' && !(x.profile_version_ids ?? []).length) fail(`team target ${x.id} (${x.horizon}) names no role-profile version`);
  // 8. shared evidence lists
  for (const f of SHARED_EVIDENCE_LISTS) for (const rt of Object.keys(WAVE_I_REF_TABLES)) if (!readFileSync(f, 'utf8').includes(`'${rt}'`)) fail(`${f} must list '${rt}' (handover 3.9)`);
  console.log(`fsqa9: FS79 ${xitems} verified certificates in ${holders.length} holders' learner records (tier as status, CLR-shaped); ${ev.length} certificate evidence rows by tier; `
    + `${T.automations.length} gallery entries on register rows; wave-I evidence recorded; ${T.transition_plans.length} SIMULATED plans with reviews; FS78 unit ${BALANCE_CREDIT_HOURS} h = FS30; `
    + `${tst.filter((x) => (x.horizon ?? 'current') !== 'current').length} FS84 targets with versions`);
}
