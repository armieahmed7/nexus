// FS78 Learning balance and protected study time + FS79 Verified import of external certificates (FS wave I · E1, module M34) seed.
//  1. learning_balances: the SIMULATED 2026 balance of every active member of staff (grantFor: 60 hours = 6 credits, plus a 40-hour
//     mid-career top-up from 8 years of service on 1 January; age is never read), refreshed with balanceOf() over the requests below.
//  2. study_time_requests: 22 synthetic requests in every state (approved and used, approved and coming up, waiting for the line
//     manager, declined with a reason, withdrawn, one decided by the HR authority), all on items of the FS18 outcome-gated catalogue,
//     each passing checkRequest on the day it was sent and checkDecide on the day it was decided (line manager = lineManagerOf, never
//     the requester). Requests waiting for a decision start after 2026-10-18, so the demo can still approve them.
//  3. external_certs: 13 synthetic external certificates (online platforms, a vendor, professional bodies, a university, ENEC) in every
//     state (submitted, verified, rejected, withdrawn, revoked). Verified ones carry their trust tier and the certMapping() rows; their
//     F01 evidence (kind credential, ref_table external_certs, basis and level by tier) names FS02 future skills only, through reviewed
//     FS08 crosswalk rows only, so the original 71-skill states are unchanged; states are re-derived for those people (FS03 decay).
//     Verification links use the reserved example.org domain (synthetic).
//  4. notifications: the line managers' "waiting for you" notices and the holders' verification notices (dated 2026-10-09 to 10-11,
//     after the seeded 2026-10-08 digests).
// FINALIZE_LAST (after f01 derives states, fs08 seeds the crosswalk and fs17 the external catalogue). Synthetic people only.
import { decayModelFrom, deriveStates } from '../../../src/domain/skills.ts';
import { levelsOf } from '../../../src/auth/policy.ts';
import { lineManagerOf } from '../../../src/modules/m20/domain.ts';
import { catalogueCheck } from '../../../src/modules/m19/pathways.ts';
import { balanceId, balanceOf, checkDecide, checkRequest, creditsOfHours, grantFor } from '../../../src/modules/m34/balance.ts';
import { certEvidence, certMapping, checkSubmit, checkVerify, issuerTier } from '../../../src/modules/m34/extcerts.ts';

export const FINALIZE_LAST = true;
const YEAR = 2026;
const GATE_DAY = '2026-10-11'; // the catalogue's as-of dates are 2026-10-10: gating is checked on the seed day
const TS = (d, h = '09:00') => `${d}T${h}:00Z`;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byId = (a, b) => cmp(a.id, b.id);

export default function build() {}

// ───────────── FS78 study-time requests: [person, n, resource, hours, pattern, starts, ends, sent, status, decidedOn, decider?, note?, reason]
const R = [
  ['p-k-ro', 1, 'xr-iaea-newcomers', 16, 'release_days', '2026-03-08', '2026-03-26', '2026-03-01', 'approved', '2026-03-02', null, null, 'Regulatory foundations before my requalification cycle'],
  ['p-k-ro', 2, 'xr-elements-of-ai', 20, 'shift_blocks', '2026-10-20', '2026-12-18', '2026-10-10', 'requested', null, null, null, 'AI basics so I can check the new plant-data assistant against independent indications'],
  ['p-k-lo-trainee', 1, 'xr-ai-for-everyone', 6, 'shift_blocks', '2026-05-10', '2026-05-24', '2026-05-03', 'approved', '2026-05-05', null, null, 'Short AI literacy course between simulator blocks'],
  ['p-k-lo-trainee', 2, 'xr-openlearn-systems', 24, 'non_shift_week', '2026-11-08', '2026-11-12', '2026-10-09', 'requested', null, null, null, 'Systems thinking week during my non-shift week'],
  ['w-ro-01', 1, 'xr-uncclearn-climate', 12, 'release_days', '2026-06-07', '2026-06-18', '2026-05-31', 'approved', '2026-06-01', null, null, 'Climate literacy for the clean-energy pathway'],
  ['w-ro-01', 2, 'xr-nea-nest', 30, 'release_days', '2026-11-15', '2026-12-17', '2026-10-08', 'requested', null, null, null, 'NEST fellowship preparation sessions'],
  ['w-ro-02', 1, 'xr-google-ai-essentials', 7, 'shift_blocks', '2026-04-12', '2026-04-23', '2026-04-05', 'declined', '2026-04-07', null, 'Outage window: please send it again for after the outage', 'AI essentials course in short blocks'],
  ['w-ro-02', 2, 'xr-google-ai-essentials', 7, 'shift_blocks', '2026-06-14', '2026-06-25', '2026-06-07', 'approved', '2026-06-08', null, null, 'AI essentials course after the outage, as agreed'],
  ['w-sro-01', 1, 'xr-wnu-summer-institute', 40, 'non_shift_week', '2026-07-05', '2026-08-13', '2026-06-01', 'approved', '2026-06-03', null, null, 'Pre-reading and project work for the summer institute'],
  ['w-sro-04', 1, 'xr-iaea-newcomers', 20, 'release_days', '2026-09-06', '2026-09-24', '2026-08-30', 'withdrawn', null, null, null, 'Regulatory foundations refresher'],
  ['w-lo-02', 1, 'xr-elements-of-ai', 20, 'shift_blocks', '2026-11-01', '2026-12-10', '2026-10-11', 'requested', null, null, null, 'AI literacy before the digital twin drills'],
  ['w-lo-07', 1, 'xr-ai-for-everyone', 6, 'shift_blocks', '2026-09-13', '2026-09-24', '2026-09-06', 'approved', '2026-09-07', null, null, 'Short AI literacy course'],
  ['p-sro', 1, 'xr-nea-nest', 24, 'release_days', '2026-02-08', '2026-03-19', '2026-02-01', 'approved', '2026-02-02', null, null, 'Fellowship reading for the advanced reactor stack'],
  ['p-outage-planner', 1, 'xr-et-iso30414', 4, 'release_days', '2026-07-12', '2026-07-16', '2026-07-05', 'approved', '2026-07-06', null, null, 'ISO 30414 reading for the workforce disclosure pack'],
  ['p-outage-planner', 2, 'xr-openlearn-systems', 18, 'non_shift_week', '2026-11-22', '2026-11-26', '2026-10-10', 'requested', null, null, null, 'Systems thinking for outage planning'],
  ['p-buyer', 1, 'xr-google-ai-essentials', 7, 'release_days', '2026-08-09', '2026-08-20', '2026-08-02', 'approved', '2026-08-03', null, null, 'AI essentials for supplier data reviews'],
  ['p-qc-inspector', 1, 'xr-uncclearn-climate', 12, 'release_days', '2026-10-25', '2026-11-19', '2026-10-09', 'requested', null, null, null, 'Climate literacy for supplier ESG checks'],
  ['p-nse', 1, 'xr-elements-of-ai', 30, 'release_days', '2026-01-11', '2026-03-05', '2026-01-04', 'approved', '2026-01-05', null, null, 'AI foundations for engineering reviews'],
  ['p-nse', 2, 'xr-openlearn-systems', 24, 'non_shift_week', '2026-05-17', '2026-05-21', '2026-05-10', 'approved', '2026-05-11', null, null, 'Systems thinking for design change reviews'],
  ['p-nse', 3, 'xr-iaea-newcomers', 20, 'release_days', '2026-11-08', '2026-12-03', '2026-10-11', 'requested', null, null, null, 'Regulatory foundations for the advanced reactor studies'],
  ['p-training-mgr', 1, 'xr-wnu-summer-institute', 30, 'release_days', '2026-07-05', '2026-08-13', '2026-06-20', 'approved', '2026-06-22', 'p-chco', null, 'Summer institute while the line manager was on leave'],
  ['w-lo-10', 1, 'xr-iaea-newcomers', 20, 'release_days', '2026-07-19', '2026-08-06', '2026-07-12', 'approved', '2026-07-13', null, null, 'Regulatory foundations in my first months'],
  ['w-lo-10', 2, 'xr-elements-of-ai', 30, 'shift_blocks', '2026-09-06', '2026-10-01', '2026-08-30', 'approved', '2026-08-31', null, null, 'AI literacy for new operators'],
];

// ───────────── FS79 external certificates
const CERTS = [
  { id: 'xc-p-k-ro-01', person: 'p-k-ro', resource: 'xr-elements-of-ai', issuer_kind: 'online_platform', credential_ref: 'EOAI-SAMPLE-4821', issued_on: '2026-04-22',
    alignment_ids: ['al:sk-fs-tr-techlit:esco:d15ce60f', 'al:sk-fs-ai-use:esco:e465a154'], levels: { 'al:sk-fs-tr-techlit:esco:d15ce60f': 1, 'al:sk-fs-ai-use:esco:e465a154': 1 },
    submitted: '2026-10-02', verify: { by: 'p-training-mgr', on: '2026-10-09', method: 'issuer_url' } },
  { id: 'xc-p-k-ro-02', person: 'p-k-ro', title: 'Certificate in systems thinking practice', issuer: 'Institute of Systems Engineering Practice (synthetic professional body)', issuer_kind: 'professional_body',
    accreditation_ref: 'ACC-SAMPLE-2291', credential_ref: 'ISEP-SAMPLE-0457', issued_on: '2026-09-15', expires_on: '2029-09-15',
    alignment_ids: ['al:sk-fs-tr-systems:esco:0f9958d2', 'al:sk-fs-tr-analytical:onet:2.A.2.a'], levels: { 'al:sk-fs-tr-systems:esco:0f9958d2': 2, 'al:sk-fs-tr-analytical:onet:2.A.2.a': 2 }, submitted: '2026-10-10' },
  { id: 'xc-p-sro-01', person: 'p-sro', title: 'Graduate certificate in operational leadership', issuer: 'Gulf Institute of Technology (synthetic university)', issuer_kind: 'university',
    accreditation_ref: 'ACCR-SAMPLE-118', credential_ref: 'GIT-SAMPLE-2025-311', issued_on: '2025-12-14',
    alignment_ids: ['al:sk-fs-tr-leadership:esco:3740b2a0'], levels: { 'al:sk-fs-tr-leadership:esco:3740b2a0': 3 }, submitted: '2026-10-01', verify: { by: 'p-k-instructor', on: '2026-10-10', method: 'issuer_registry' } },
  { id: 'xc-p-nse-01', person: 'p-nse', title: 'Plant data quality assessment', issuer: 'ENEC Learning and Development (sample)', issuer_kind: 'enec', credential_ref: 'ENEC-DQ-SAMPLE-031', issued_on: '2026-09-28',
    alignment_ids: ['al:sk-fs-ai-plantdata:esco:713fb616', 'al:sk-fs-ai-dataeng:esco:9d0d89be', 'al:sk-fs-ai-dataeng:sfia9:deng'],
    levels: { 'al:sk-fs-ai-plantdata:esco:713fb616': 2, 'al:sk-fs-ai-dataeng:esco:9d0d89be': 2, 'al:sk-fs-ai-dataeng:sfia9:deng': 2 }, submitted: '2026-10-03', verify: { by: 'p-training-mgr', on: '2026-10-11', method: 'enec_assessment' } },
  { id: 'xc-p-buyer-01', person: 'p-buyer', title: 'Strategic sourcing analytics', issuer: 'Procurement analytics vendor (synthetic)', issuer_kind: 'vendor', credential_ref: 'PAV-SAMPLE-77810', issued_on: '2026-08-21',
    alignment_ids: ['al:sk-fs-dp-procurement:sfia9:sorc'], levels: { 'al:sk-fs-dp-procurement:sfia9:sorc': 2 }, submitted: '2026-09-29', verify: { by: 'p-k-instructor', on: '2026-10-09', method: 'issuer_url' } },
  { id: 'xc-p-qc-inspector-01', person: 'p-qc-inspector', title: 'Data analysis for inspection records', issuer: 'Online data skills platform (synthetic)', issuer_kind: 'online_platform', credential_ref: 'ODS-SAMPLE-5512', issued_on: '2026-07-30',
    alignment_ids: ['al:sk-fs-tr-analytical:esco:4707da90'], levels: {}, submitted: '2026-10-04', reject: { by: 'p-training-mgr', on: '2026-10-10', note: 'The verification link does not open an issuer record; please add the issuer\'s registry link and send it again.' } },
  { id: 'xc-p-outage-planner-01', person: 'p-outage-planner', title: 'Scheduling with digital tools', issuer: 'Planning software vendor (synthetic)', issuer_kind: 'vendor', credential_ref: 'PSV-SAMPLE-0912', issued_on: '2026-06-11',
    alignment_ids: ['al:sk-fs-tr-techlit:esco:d15ce60f'], levels: {}, submitted: '2026-09-20', withdrawn: '2026-09-24' },
  { id: 'xc-p-k-lo-trainee-01', person: 'p-k-lo-trainee', resource: 'xr-ai-for-everyone', issuer_kind: 'online_platform', credential_ref: 'AIFE-SAMPLE-3390', issued_on: '2026-05-26',
    alignment_ids: ['al:sk-fs-ai-use:esco:e465a154', 'al:sk-fs-tr-curiosity:esco:9bf266a6'], levels: { 'al:sk-fs-tr-curiosity:esco:9bf266a6': 1 }, submitted: '2026-10-08' },
  { id: 'xc-w-ro-01-01', person: 'w-ro-01', resource: 'xr-uncclearn-climate', issuer_kind: 'online_platform', credential_ref: 'UNCC-SAMPLE-62018', issued_on: '2026-06-18',
    alignment_ids: ['al:sk-fs-gr-climaterisk:esco:1565b401', 'al:sk-fs-gr-ghg:esco:8abdc43c'], levels: { 'al:sk-fs-gr-climaterisk:esco:1565b401': 1 }, submitted: '2026-09-30', verify: { by: 'p-sq-lead', on: '2026-10-10', method: 'issuer_url' } },
  { id: 'xc-w-sro-01-01', person: 'w-sro-01', title: 'Professional certificate in data-driven decisions', issuer: 'Association of Data Practitioners (synthetic professional body)', issuer_kind: 'professional_body',
    accreditation_ref: 'ACC-SAMPLE-7705', credential_ref: 'ADP-SAMPLE-1186', issued_on: '2026-03-12', alignment_ids: ['al:sk-fs-ai-verify:digcomp:1.2'], levels: { 'al:sk-fs-ai-verify:digcomp:1.2': 2 },
    submitted: '2026-09-25', verify: { by: 'p-training-mgr', on: '2026-10-09', method: 'issuer_registry' }, revoke: { by: 'p-head-sq', on: '2026-10-11', note: 'The issuer withdrew this certificate series after an audit of its assessments.' } },
  { id: 'xc-p-chco-01', person: 'p-chco', title: 'Certificate in creative problem solving', issuer: 'Creative Practice Society (synthetic professional body)', issuer_kind: 'professional_body', credential_ref: 'CPS-SAMPLE-2040', issued_on: '2026-08-05',
    alignment_ids: ['al:sk-fs-tr-creative:esco:c624c6a3'], levels: { 'al:sk-fs-tr-creative:esco:c624c6a3': 2 }, submitted: '2026-10-09' },
  { id: 'xc-p-training-mgr-01', person: 'p-training-mgr', title: 'Climate risk for energy professionals', issuer: 'Gulf Institute of Technology (synthetic university)', issuer_kind: 'university', accreditation_ref: 'ACCR-SAMPLE-118',
    credential_ref: 'GIT-SAMPLE-2026-087', issued_on: '2026-09-02', alignment_ids: ['al:sk-fs-gr-climaterisk:esco:1565b401'], levels: { 'al:sk-fs-gr-climaterisk:esco:1565b401': 2 }, submitted: '2026-10-07' },
  { id: 'xc-p-k-instructor-01', person: 'p-k-instructor', title: 'Digital information literacy certificate', issuer: 'Association of Data Practitioners (synthetic professional body)', issuer_kind: 'professional_body',
    accreditation_ref: 'ACC-SAMPLE-7705', credential_ref: 'ADP-SAMPLE-1412', issued_on: '2026-08-30', alignment_ids: ['al:sk-fs-ai-verify:digcomp:1.2', 'al:sk-fs-ai-data-care:digcomp:4.2'],
    levels: { 'al:sk-fs-ai-verify:digcomp:1.2': 2, 'al:sk-fs-ai-data-care:digcomp:4.2': 2 }, submitted: '2026-10-05', verify: { by: 'p-training-mgr', on: '2026-10-11', method: 'document_check' } },
];

export function finalize(T) {
  const fail = (m) => { throw new Error(`fs78: ${m}`); };
  const people = new Map(T.people.map((p) => [p.id, p]));
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  const alignments = new Map(T.skill_alignments.map((a) => [a.id, a]));
  const res = new Map(T.external_resources.map((x) => [x.id, x]));
  const notes = [];
  const notify = (id, pid, en, ar, link, severity, on) => notes.push({ id, person_id: pid, kind: 'recognition', title_en: en, title_ar: ar, body_en: null, body_ar: null, link, severity, created_at: TS(on, '07:30'), read_at: null });
  const rolesOf = (pid, on) => [...new Set(['public', ...T.role_assignments.filter((a) => a.person_id === pid && a.status === 'active' && (!a.expires_at || String(a.expires_at).slice(0, 10) >= on)).map((a) => a.role)])].sort();
  const actingRole = (pid, resName, levels, on) => rolesOf(pid, on).find((r) => levels.some((l) => levelsOf(r, resName).includes(l))) ?? null;

  // 1. balances
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status !== 'leaver').sort(byId);
  T.learning_balances = staff.map((p) => {
    const g = grantFor(p, YEAR);
    return { id: balanceId(p.id, YEAR), person_id: p.id, person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, entity_id: p.entity_id ?? null, job_family_id: p.job_family_id ?? null, year: YEAR, base_hours: g.base_hours, topup_hours: g.topup_hours, topup_basis: g.topup_basis, service_years: g.service_years,
      granted_hours: g.granted_hours, used_hours: 0, pending_hours: 0, remaining_hours: g.granted_hours, simulated: true, open_read: false, refreshed_at: TS('2026-01-01', '03:00'), created_at: TS('2026-01-01', '03:00') };
  });
  const bal = new Map(T.learning_balances.map((b) => [b.person_id, b]));

  // 2. requests, in the order they were sent
  T.study_time_requests = [];
  const crit = T.catalogue_criteria;
  for (const [pid, n, rid, hours, pattern, starts, ends, sent, status, decidedOn, decider, note, reason] of [...R].sort((a, b) => cmp(a[7], b[7]) || cmp(a[0], b[0]))) {
    const p = people.get(pid) ?? fail(`person ${pid}`);
    const x = res.get(rid) ?? fail(`resource ${rid}`);
    const gated = x.status === 'published' && x.listed === true && catalogueCheck(x, crit, T.skills, GATE_DAY).ok;
    const mine = T.study_time_requests.filter((r) => r.person_id === pid && r.year === YEAR);
    const b = balanceOf(bal.get(pid) ?? fail(`balance ${pid}`), mine);
    const lm = lineManagerOf(pid, T.people, T.role_assignments, sent);
    const input = { resource_id: rid, hours, pattern, starts_on: starts, ends_on: ends, reason };
    const c = checkRequest(input, { today: sent, person: p, item: { id: rid, hours: x.hours == null ? null : Number(x.hours), gated }, available: b.available_hours,
      openSame: mine.some((r) => r.resource_id === rid && (r.status === 'requested' || r.status === 'approved')), lineManager: lm });
    if (c !== 'ok') fail(`request ${pid} ${n} fails checkRequest (${c})`);
    const id = `str-${pid}-${String(n).padStart(2, '0')}`;
    const row = {
      id, person_id: pid, person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, line_manager_id: lm, line_manager_name: people.get(lm)?.display_name ?? '', year: YEAR, resource_id: rid, resource_title_en: x.title_en,
      resource_title_ar: x.title_ar, hours, credits: creditsOfHours(hours), starts_on: starts, ends_on: ends, pattern, reason, status: 'requested', decided_by: null, decided_role: null,
      decided_on: null, decision_note: null, history: [{ at: TS(sent), status: 'requested', by: pid, note: reason }], open_read: false, created_at: TS(sent), updated_at: TS(sent),
    };
    T.study_time_requests.push(row);
    if (status === 'approved' || status === 'declined') {
      const by = decider ?? lm;
      const isHr = rolesOf(by, decidedOn).includes('hr_director');
      const rem = balanceOf(bal.get(pid), T.study_time_requests.filter((r) => r.person_id === pid && r.id !== id)).remaining_hours;
      const d = checkDecide({ decision: status === 'approved' ? 'approve' : 'decline', note }, row, by, { today: decidedOn, hr: isHr, remaining: rem });
      if (d !== 'ok') fail(`decision on ${id} fails checkDecide (${d})`);
      const role = by === lm ? (actingRole(by, 'recognition', ['Scope'], decidedOn) ?? actingRole(by, 'recognition', ['Own'], decidedOn)) : isHr ? 'hr_director' : actingRole(by, 'recognition', ['Own'], decidedOn);
      Object.assign(row, { status, decided_by: by, decided_role: role, decided_on: decidedOn, decision_note: note, updated_at: TS(decidedOn, '10:00'),
        history: [...row.history, { at: TS(decidedOn, '10:00'), status, by, note }] });
    } else if (status === 'withdrawn') {
      Object.assign(row, { status, updated_at: TS(sent, '15:00'), history: [...row.history, { at: TS(sent, '15:00'), status, by: pid, note: null }] });
    } else if (status === 'requested') {
      notify(`nt-${id}-requested`, lm, `Study-time request: ${p.display_name} (${hours} h, ${x.title_en})`, `طلب وقت دراسة: ${p.display_name_ar || p.display_name} (${hours} ساعة، ${x.title_ar})`, '/team/study-time', 'info', sent > '2026-10-08' ? sent : '2026-10-09');
    }
  }
  T.study_time_requests.sort(byId);
  for (const b of T.learning_balances) {
    const v = balanceOf(b, T.study_time_requests);
    if (v.remaining_hours < 0 || v.available_hours < 0) fail(`balance below zero for ${b.person_id}`);
    Object.assign(b, { granted_hours: v.granted_hours, used_hours: v.used_hours, pending_hours: v.pending_hours, remaining_hours: v.remaining_hours });
    if (v.approved || v.requested) b.refreshed_at = T.study_time_requests.filter((r) => r.person_id === b.person_id).map((r) => r.updated_at).sort().at(-1);
  }

  // 3. external certificates
  T.external_certs = [];
  const evidence = [];
  for (const spec of CERTS) {
    const p = people.get(spec.person) ?? fail(`person ${spec.person}`);
    const x = spec.resource ? res.get(spec.resource) ?? fail(`resource ${spec.resource}`) : null;
    const input = {
      title: spec.title ?? `${x.title_en}: course certificate`, issuer: spec.issuer ?? x.provider_en, issuer_kind: spec.issuer_kind, accreditation_ref: spec.accreditation_ref ?? null, credential_ref: spec.credential_ref,
      issued_on: spec.issued_on, expires_on: spec.expires_on ?? null, verification_url: `https://certificates.example.org/verify/${spec.credential_ref.toLowerCase()}`, alignment_ids: [...spec.alignment_ids].sort(),
      levels: spec.levels, resource_id: spec.resource ?? null, note: null,
    };
    const c = checkSubmit(input, { today: spec.submitted, alignments, skills, duplicate: T.external_certs.some((r) => r.person_id === spec.person && r.verification_url === input.verification_url) });
    if (c !== 'ok') fail(`certificate ${spec.id} fails checkSubmit (${c})`);
    const row = {
      id: spec.id, person_id: spec.person, person_name: p.display_name, ...input, status: 'submitted', tier: null, method: null, verified_by: null, verified_role: null, verified_on: null, decision_note: null,
      mapped: [], evidence_ids: [], history: [{ at: TS(spec.submitted), status: 'submitted', by: spec.person, note: null }], created_at: TS(spec.submitted), updated_at: TS(spec.submitted),
    };
    T.external_certs.push(row);
    const role = (by, on) => actingRole(by, 'recognition', ['A'], on) ?? fail(`${by} is not a verifier`);
    if (spec.verify) {
      const k = spec.verify;
      const cv = checkVerify({ decision: 'verify', method: k.method }, row, k.by, k.on);
      if (cv !== 'ok') fail(`verify ${spec.id} fails checkVerify (${cv})`);
      const tier = issuerTier(row);
      const m = certMapping(row, tier, alignments, skills);
      const ev = certEvidence({ ...row, status: 'verified', tier }, m, k.on, k.by);
      if (!ev.length) fail(`verified ${spec.id} maps no skill`);
      if (ev.some((e) => !skills.get(e.skill_id)?.fs_area)) fail(`seeded external-certificate evidence must name FS02 skills only (${spec.id})`);
      for (const e of ev) evidence.push({ ...e, created_at: TS(k.on, '11:00'), org_id: null, contractor: false });
      Object.assign(row, { status: 'verified', tier, method: k.method, verified_by: k.by, verified_role: role(k.by, k.on), verified_on: k.on, mapped: m.rows, evidence_ids: ev.map((e) => e.id),
        updated_at: TS(k.on, '11:00'), history: [...row.history, { at: TS(k.on, '11:00'), status: 'verified', by: k.by, note: null }] });
      notify(`nt-xc-${spec.id}-verified`, spec.person, `External certificate verified: ${row.title} (${ev.length} skills)`, `تم التحقق من الشهادة الخارجية: ${row.title} (${ev.length} مهارات)`, '/my/recognition/certificates', 'ok', k.on);
      if (spec.revoke) {
        const r2 = spec.revoke;
        if (checkVerify({ decision: 'revoke', note: r2.note }, row, r2.by, r2.on) !== 'ok') fail(`revoke ${spec.id}`);
        role(r2.by, r2.on);
        for (const e of evidence) if (row.evidence_ids.includes(e.id)) e.active = false;
        Object.assign(row, { status: 'revoked', decision_note: r2.note, updated_at: TS(r2.on, '12:00'), history: [...row.history, { at: TS(r2.on, '12:00'), status: 'revoked', by: r2.by, note: r2.note }] });
        notify(`nt-xc-${spec.id}-revoked`, spec.person, `External certificate revoked: ${row.title}`, `أُلغي التحقق من الشهادة الخارجية: ${row.title}`, '/my/recognition/certificates', 'warn', r2.on);
      }
    } else if (spec.reject) {
      const r2 = spec.reject;
      if (checkVerify({ decision: 'reject', note: r2.note }, row, r2.by, r2.on) !== 'ok') fail(`reject ${spec.id}`);
      Object.assign(row, { status: 'rejected', verified_by: r2.by, verified_role: role(r2.by, r2.on), decision_note: r2.note, updated_at: TS(r2.on, '12:00'),
        history: [...row.history, { at: TS(r2.on, '12:00'), status: 'rejected', by: r2.by, note: r2.note }] });
      notify(`nt-xc-${spec.id}-rejected`, spec.person, `External certificate not verified: ${row.title}`, `لم يُتحقق من الشهادة الخارجية: ${row.title}`, '/my/recognition/certificates', 'warn', r2.on);
    } else if (spec.withdrawn) {
      Object.assign(row, { status: 'withdrawn', updated_at: TS(spec.withdrawn), history: [...row.history, { at: TS(spec.withdrawn), status: 'withdrawn', by: spec.person, note: null }] });
    }
  }
  T.external_certs.sort(byId);
  const have = new Set(T.skill_evidence.map((e) => e.id));
  for (const e of evidence) if (have.has(e.id)) fail(`evidence ${e.id} exists`);
  T.skill_evidence = [...T.skill_evidence, ...evidence].sort(byId);
  T.notifications = [...T.notifications.filter((n) => !/^nt-(str|xc)-/.test(n.id)), ...notes].sort(byId);

  // F01 states for people with external-certificate evidence (FS03 decay model); the original catalogue stays unchanged
  const who = new Set(evidence.map((e) => e.person_id));
  const now = '2026-10-08';
  const before = new Map(T.person_skills.map((s) => [s.id, `${s.level}|${s.confidence}|${s.basis}|${s.active}`]));
  const states = deriveStates(T.skill_evidence.filter((e) => who.has(e.person_id)), now, decayModelFrom(T.engine_settings, T.skills));
  const cur = new Map(T.person_skills.map((p) => [p.id, p]));
  let added = 0;
  for (const st of states) {
    const patch = { level: st.level, confidence: st.confidence, basis: st.basis, reasons: st.reasons, evidence_count: st.evidence_count, confidence_band: st.confidence_band, conf_low: st.conf_low, conf_high: st.conf_high, active: true };
    const c0 = cur.get(st.id);
    if (!c0) { T.person_skills.push({ id: st.id, person_id: st.person_id, skill_id: st.skill_id, ...patch, org_id: null, contractor: false, updated_at: `${now}T00:00:00Z` }); added++; continue; }
    Object.assign(c0, patch);
  }
  T.person_skills.sort(byId);
  const changed = T.person_skills.filter((s) => !skills.get(s.skill_id)?.fs_area && before.has(s.id) && before.get(s.id) !== `${s.level}|${s.confidence}|${s.basis}|${s.active}`);
  if (changed.length) fail(`${changed.length} states of the original catalogue changed (${changed[0].id})`);
  const sb = T.study_time_requests;
  console.log(`fs78/79: ${T.learning_balances.length} balances (${T.learning_balances.filter((b) => b.topup_hours > 0).length} with the mid-career top-up), ${sb.length} study-time requests `
    + `(${sb.filter((r) => r.status === 'approved').length} approved, ${sb.filter((r) => r.status === 'requested').length} waiting), ${T.external_certs.length} external certificates `
    + `(${T.external_certs.filter((r) => r.status === 'verified').length} verified), ${evidence.length} evidence rows (${evidence.filter((e) => e.active).length} active) for ${who.size} people (${added} new skill states), ${notes.length} notices`);
}
