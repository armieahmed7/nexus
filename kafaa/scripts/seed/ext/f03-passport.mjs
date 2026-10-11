// F03/F04 (wave 1 · w1e1) seed: skill claims (F03 "Add a claim") and signed Open Badges 3.0-shaped credentials (F04).
// Loaded by scripts/build-seed.mjs after f01-skills.mjs; f01's finalize derives the skill states afterwards, so the claim
// (rating) and credential evidence written here shows in every person's passport.
// Badges are signed with the server issuer key (key-1). The private seed is read from the SQL function
// kafaa_badge_issuer_seed() in the w1e1 migration, so the key exists in exactly one place in the repo.
import { readFileSync } from 'node:fs';
import { buildCredential, signingBytes, withProof } from '../../../src/modules/m17/issuer.ts';
import { edSign, fromHex, sha256, toHex, utf8 } from '../../../src/modules/m17/badgeCrypto.ts';
import { badgeSourceCheck, courseAlignment, securityComps, addDays, addMonths } from '../../../src/modules/m17/badgeRules.ts';

const MIGRATION = 'supabase/migrations/20261009111001_kafaa_w1e1_passport.sql';
const serverSeed = () => {
  const m = readFileSync(MIGRATION, 'utf8').match(/kafaa_badge_issuer_seed\(\)[\s\S]*?'\\x([0-9a-f]{64})'::bytea/);
  if (!m) throw new Error(`f03: issuer seed not found in ${MIGRATION}`);
  return fromHex(m[1]);
};
const slugFor = (sourceId) => `kb${toHex(sha256(utf8(`kafaa-seed:${sourceId}`))).slice(0, 12)}`;
const evId = (kind, ref, skill) => `se:${kind}:${ref}:${skill}`;
const ts = (d, h = 9) => `${d}T${String(h).padStart(2, '0')}:00:00Z`;

// [claim id, person, skill, level, status, created, note, evidence url | null, decided_by | null]
const CLAIMS = [
  ['scl-k-ro-1', 'p-k-ro', 'sk-da-01', 1, 'superseded', '2026-03-02', 'Completed the plant data literacy e-learning module and built a first trend chart.', null, null],
  ['scl-k-ro-2', 'p-k-ro', 'sk-da-01', 2, 'claimed', '2026-09-20', 'Built a shift-turnover trend dashboard in the training data sandbox; reviewed by the crew lead.', 'https://example.org/kafaa-demo/turnover-dashboard', null],
  ['scl-k-ro-3', 'p-k-ro', 'sk-ld-01-coach', 2, 'validated', '2026-08-11', 'Coached two local operators through their system walkdowns during the spring outage.', null, 'p-sro'],
  ['scl-k-ro-4', 'p-k-ro', 'sk-en-02-perf', 2, 'claimed', '2026-09-30', 'Trended feedwater heater performance for the system engineer during a quarterly review.', null, null],
  ['scl-sro-1', 'p-sro', 'sk-ld-02', 3, 'claimed', '2026-07-14', 'Led crew decision-making in four simulator scenarios as shift supervisor (acting).', null, null],
  ['scl-sro-2', 'p-sro', 'sk-da-01-analysis', 2, 'claimed', '2026-09-03', 'Analysed six months of crew human-performance observations and presented trends.', null, null],
  ['scl-tm-1', 'p-training-mgr', 'sk-ld-01-instruct', 3, 'validated', '2026-05-18', 'Designed and delivered the continuing training cycle for two crews (SAT design phase).', null, 'p-head-sq'],
  ['scl-tm-2', 'p-training-mgr', 'sk-da-02-review', 2, 'claimed', '2026-09-25', 'Reviewed AI-drafted lesson material against the governance checklist before release.', null, null],
  ['scl-lot-1', 'p-k-lo-trainee', 'sk-co-01-rounds', 1, 'claimed', '2026-09-12', 'Shadowed field rounds on the turbine building for three weeks.', null, null],
  ['scl-ins-1', 'p-k-instructor', 'sk-ld-01-coach', 3, 'claimed', '2026-08-22', 'Mentored five instructors on feedback technique in simulator debriefs.', null, null],
  ['scl-op-1', 'p-outage-planner', 'sk-mp-01-outage', 3, 'claimed', '2026-06-30', 'Built the integrated schedule for a refuelling outage window.', null, null],
  ['scl-qc-1', 'p-qc-inspector', 'sk-qa-01-inspect', 3, 'validated', '2026-04-09', 'Prepared inspection and test plans for 14 safety-related work packages.', null, 'p-cpo'],
];
const SYN_SKILLS = ['sk-da-01', 'sk-da-01-analysis', 'sk-hu-02-brief', 'sk-ld-01-coach', 'sk-en-02-perf', 'sk-mp-01-outage', 'sk-da-01-scripting', 'sk-hu-01-star', 'sk-ld-02', 'sk-da-01-twins'];
const SYN_NOTES = [
  'Used the skill on recent shift work and can show the output to my supervisor.',
  'Completed a self-study module and applied it to a real task this quarter.',
  'Practised this during the last outage; looking for validation from my manager.',
  'Delivered a short knowledge-sharing session to my team on this topic.',
];

export default function build(T, ctx) {
  const today = ctx.DEMO_TODAY;
  T.skill_claims = [];
  T.badges = [];
  T.skill_evidence = T.skill_evidence ?? [];
  const people = new Map(T.people.map((p) => [p.id, p]));
  const skills = new Map(T.skills.map((s) => [s.id, s]));

  // ── F03 claims: persona stories plus a deterministic spread over synthetic staff
  const rows = [...CLAIMS];
  const staff = T.people.filter((p) => p.kind === 'staff' && !p.persona_id && p.status !== 'leaver').sort((a, b) => (a.id < b.id ? -1 : 1));
  staff.forEach((p, i) => {
    if (i % 3 !== 0) return;
    const skill = SYN_SKILLS[i % SYN_SKILLS.length];
    const level = 1 + (i % 3);
    const validated = i % 4 === 0 && p.manager_id;
    rows.push([`scl-${p.id}-1`, p.id, skill, level, validated ? 'validated' : 'claimed', addDays(today, -(10 + (i % 120))), SYN_NOTES[i % SYN_NOTES.length], null, validated ? p.manager_id : null]);
  });
  const sec = securityComps(T.competencies);
  for (const [id, person, skill, level, status, created, note, url, decidedBy] of rows) {
    const s = skills.get(skill);
    if (!s || !people.has(person)) throw new Error(`f03: claim ${id} references unknown ${s ? person : skill}`);
    if (sec.has(s.competency_id) || s.area === 'security') throw new Error(`f03: claim ${id} is on a security skill`);
    T.skill_claims.push({ id, person_id: person, skill_id: skill, level, note, evidence_url: url, status, created_at: ts(created), decided_by: decidedBy, decided_at: decidedBy ? ts(addDays(created, 6), 14) : null, decision_note: decidedBy ? 'Observed on the job; level confirmed.' : null });
    T.skill_evidence.push({ id: evId('rating', id, skill), person_id: person, skill_id: skill, kind: 'rating', ref_table: 'skill_claims', ref_id: id, level, basis: status === 'validated' ? 'validated' : 'claimed', status: 'current', observed_on: status === 'validated' ? addDays(created, 6) : created, note, recorded_by: status === 'validated' ? decidedBy : person, active: status !== 'superseded' && status !== 'rejected', created_at: ts(created) });
  }

  // ── F04 badges, signed with key-1
  const seed = serverSeed();
  const world = (me) => ({ me, today, initials: people.get(me)?.initials ?? '—', certificates: T.certificates, training_records: T.training_records, courses: T.courses, competencies: T.competencies, badges: T.badges, licences: T.licences, qual_records: T.qual_records });
  const issue = (src, issuedOn, opts = {}) => {
    const course = T.courses.find((c) => c.id === src.course_id);
    const aligned = courseAlignment(course, T.skills, sec);
    const slug = slugFor(src.source_id);
    const id = `bdg-${slug}`;
    const cred = buildCredential({ slug, kind: src.kind, certificateNo: src.certificate_no, course, holderInitials: src.holder_initials, issuedOn, validTo: src.valid_to, sourceDate: src.source_date, sourceSystem: src.source_system, alignment: aligned, keyId: 'key-1' });
    const signed = withProof(cred, edSign(signingBytes(cred), seed));
    const status = opts.revoked ? 'revoked' : 'active';
    T.badges.push({
      id, person_id: opts.person, source_table: src.source_table, source_id: src.source_id, course_id: course.id, holder_initials: src.holder_initials,
      achievement: { kind: src.kind, code: course.code, name_en: course.title_en, name_ar: course.title_ar, skills: aligned.map((a) => a.id) },
      credential: signed, issued_on: issuedOn, valid_to: src.valid_to, status, key_id: 'key-1', public_slug: slug,
      revoked_at: opts.revoked ? ts(opts.revoked.on, 11) : null, revoke_reason: opts.revoked?.reason ?? null, created_at: ts(issuedOn, 10),
    });
    if (status === 'active' && !opts.noEvidence)
      for (const a of aligned) T.skill_evidence.push({ id: evId('credential', id, a.id), person_id: opts.person, skill_id: a.id, kind: 'credential', ref_table: 'badges', ref_id: id, level: a.level, basis: 'evidenced', status: 'current', observed_on: src.source_date, note: null, recorded_by: opts.person, active: true, created_at: ts(issuedOn, 10) });
    return id;
  };
  const issueEligible = (person, sourceId, issuedOn) => {
    const chk = badgeSourceCheck(sourceId, world(person));
    if (chk.code !== 'ok') return null;
    return issue(chk.source, issuedOn ?? [addDays(chk.source.source_date, 10), today].sort()[0], { person });
  };
  // personas: k-ro's HU-101 certificate (KAF-2026-000417); sro and training-mgr have their HU-101 completion wrapped.
  // Left for the live demo: k-ro and sro c-scwe, k-lo-trainee and k-instructor completions.
  const krCert = T.certificates.find((c) => c.person_id === 'p-k-ro' && c.status === 'valid');
  if (krCert) issueEligible('p-k-ro', krCert.id, '2026-03-20');
  for (const p of ['p-sro', 'p-training-mgr']) {
    const tr = T.training_records.find((t) => t.person_id === p && t.course_id === 'c-hu');
    if (tr) issueEligible(p, tr.id);
  }
  const keep = new Set(['p-k-ro', 'p-sro', 'p-training-mgr', 'p-k-lo-trainee', 'p-k-instructor']);
  const holders = [...new Set(T.training_records.map((t) => t.person_id))].filter((p) => !keep.has(p) && people.get(p)?.kind === 'staff').sort();
  holders.forEach((p, i) => {
    for (const course of i % 2 === 0 ? ['c-hu', 'c-scwe'] : i % 3 === 0 ? ['c-scwe'] : []) {
      const tr = T.training_records.find((t) => t.person_id === p && t.course_id === course);
      if (tr) issueEligible(p, tr.id);
    }
  });
  // one badge withdrawn by its holder
  const w = T.badges.find((b) => b.course_id === 'c-scwe' && !keep.has(b.person_id));
  if (w) {
    w.status = 'revoked';
    w.revoked_at = ts(addDays(w.issued_on, 30), 11);
    w.revoke_reason = 'Withdrawn by the holder: duplicate of an external record';
    for (const e of T.skill_evidence) if (e.ref_table === 'badges' && e.ref_id === w.id) e.active = false;
  }
  // history: badges on certificates that have since expired or been revoked (status follows the source); security courses skipped
  for (const c of T.certificates.filter((x) => x.status !== 'valid' && people.get(x.person_id)?.kind === 'staff')) {
    const course = T.courses.find((x) => x.id === c.course_id);
    if (!course || (course.competency_ids ?? []).some((id) => sec.has(id))) continue; // security training is never a badge
    issue({ source_table: 'certificates', source_id: c.id, kind: 'certificate', course_id: course.id, certificate_no: c.id, source_date: c.issued_on, valid_to: c.valid_to, source_system: "Kafa'a certificate register", holder_initials: c.holder_initials },
      addDays(c.issued_on, 9), { person: c.person_id, noEvidence: true });
  }
  void addMonths;
}
