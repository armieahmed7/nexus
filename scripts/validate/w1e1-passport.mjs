// [W1 · E1 · F03/F04] PGlite checks for 20261009111001_kafaa_w1e1_passport.sql: SQL Ed25519 and canonical JSON equal the TS
// implementation (RFC 8032 vector and every seeded badge), claimSkill / issueBadge / revokeBadge / verifyBadge RBAC, refusal
// codes and audit rows, the public verify payload (no names, emails or photos) and RLS on the new tables.
import { readFileSync } from 'node:fs';
import { canon, edSign, fromHex, toHex, utf8 } from '../../src/modules/m17/badgeCrypto.ts';
import { verifyCredential, signingText } from '../../src/modules/m17/issuer.ts';
import { publicPayloadProblems } from '../../src/modules/m17/publicPayload.ts';

export default async function w1e1Checks({ db, as, one, count, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  // test identity for the Kafa'a-only persona k-ro (disjoint uid range for w1e1)
  uid['k-ro'] = '00000000-0000-4000-8000-000000001101';
  await db.query(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1, 'k-ro@test', 'k-ro', 'enec-ops', 'employee', $2) on conflict do nothing`, [uid['k-ro'], ['Reactor Operator']]);

  // ── crypto parity: RFC 8032 test 2 and a UTF-8 message
  const rfcSeed = '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb';
  const rfcSig = '92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00';
  const s1 = (await q(`select encode(kafaa_ed25519_sign('\\x72'::bytea, decode($1, 'hex')), 'hex') s`, [rfcSeed]))[0].s;
  const msg = 'Kafa\'a كفاءة · badge';
  const s2 = (await q(`select encode(kafaa_ed25519_sign(convert_to($1, 'UTF8'), decode($2, 'hex')), 'hex') s`, [msg, rfcSeed]))[0].s;
  ok(s1 === rfcSig && s2 === toHex(edSign(utf8(msg), fromHex(rfcSeed))), 'SQL Ed25519 matches RFC 8032 test 2 and the TS signer');

  // ── every seeded badge: SQL canonical JSON = TS canon; TS verifies the signature; SQL rebuild + re-sign = stored credential (sample)
  const rows = await q(`select b.*, b.credential::text as cred_text from kafaa_badges b order by b.id collate "C"`);
  const jcs = await q(`select id, kafaa_jcs(credential #- '{proof,proofValue}') t from kafaa_badges order by id collate "C"`);
  const canonOk = rows.every((r, i) => jcs[i].t === signingText(JSON.parse(r.cred_text)));
  const sigOk = rows.every((r) => verifyCredential(JSON.parse(r.cred_text)).outcome === 'valid');
  ok(rows.length === T.badges.length && rows.length > 20 && canonOk && sigOk, `all ${rows.length} seeded badges: SQL canonical JSON equals TS and every Ed25519 signature verifies`);
  const sample = rows.filter((r) => r.status === 'active').slice(0, 3);
  let rebuilt = 0;
  for (const r of sample) {
    const src = r.source_table === 'certificates' ? T.certificates.find((c) => c.id === r.source_id) : T.training_records.find((t) => t.id === r.source_id);
    const sd = r.source_table === 'certificates' ? src.issued_on : src.completed_on;
    const sys = r.source_table === 'certificates' ? "Kafa'a certificate register" : src.source_system;
    const x = (await q(`select kafaa_badge_sign(kafaa_badge_credential($1, $2, $3, $4, $5, $6::date, $7::date, $8::date, $9, 'key-1'))::text j`,
      [r.public_slug, r.source_table === 'certificates' ? 'certificate' : 'completion', r.source_table === 'certificates' ? r.source_id : null, r.course_id, r.holder_initials, r.issued_on, r.valid_to, sd, sys]))[0].j;
    if (canon(JSON.parse(x)) === canon(JSON.parse(r.cred_text))) rebuilt++;
  }
  ok(sample.length === 3 && rebuilt === 3, 'SQL credential builder + signer reproduce the seeded (TS-built, TS-signed) credentials byte for byte');

  // ── claimSkill
  const aud = async () => (await q('select count(*)::int n from kafaa_audit_events'))[0].n;
  const a0 = await aud();
  const sec = await one('k-ro', `select kafaa_claim_skill('sk-sa-01', 2, 'I know the security procedures') r`);
  const secAudit = (await q(`select outcome, reason from kafaa_audit_events where action = 'skills.claim' order by seq desc limit 1`))[0];
  ok(sec.r.code === 'security_restricted' && (await aud()) === a0 + 1 && secAudit.outcome === 'refused', 'a claim on a security competency is refused with security_restricted and an audit row');
  const bad = await one('k-ro', `select kafaa_claim_skill('sk-da-01', 5, 'too high') r`);
  const badUrl = await one('k-ro', `select kafaa_claim_skill('sk-da-01', 2, 'note here', 'javascript:alert(1)') r`);
  ok(bad.r.code === 'invalid' && badUrl.r.code === 'invalid', 'claim level 1-4 and http(s) evidence links are enforced');
  const c1 = await one('k-ro', `select kafaa_claim_skill('sk-da-01-scripting', 2, 'Wrote a Python script to trend shift logs (training sandbox)', 'https://example.org/x') r`);
  const st = await q(`select level, basis from kafaa_person_skills where id = 'ps:p-k-ro:sk-da-01-scripting'`);
  const ev = await q(`select basis, active from kafaa_skill_evidence where ref_table = 'skill_claims' and ref_id = $1`, [c1.r.data?.id]);
  ok(c1.r.ok && st[0]?.basis === 'claimed' && st[0].level === 2 && ev[0]?.basis === 'claimed' && ev[0].active, 'a claim stays claimed, writes rating evidence and updates the skill state');
  const c2 = await one('k-ro', `select kafaa_claim_skill('sk-da-01-scripting', 3, 'Second claim at a higher level after a project') r`);
  const sup = await q(`select status from kafaa_skill_claims where id = $1`, [c1.r.data.id]);
  ok(c2.r.ok && sup[0].status === 'superseded', 'a new claim on the same skill supersedes the earlier pending claim');
  let rl = null;
  for (let i = 0; i < 20 && !rl; i++) { const r = await one('k-ro', `select kafaa_claim_skill('sk-hu-02-brief', 2, 'Repeated claim number ${i}') r`); if (!r.r.ok) rl = r.r.code; }
  ok(rl === 'rate_limited', 'claims are rate-limited to 20 a day');
  ok((await one('k-auditor', `select kafaa_claim_skill('sk-da-01', 2, 'auditor claim') r`)).r.code === 'forbidden', 'roles without skills_profile Own cannot claim');

  // ── issueBadge
  const tr = (course) => T.training_records.find((t) => t.person_id === 'p-k-ro' && t.course_id === course)?.id;
  const dup = await one('k-ro', `select kafaa_issue_badge('KAF-2026-000417') r`);
  const lic = await one('k-ro', `select kafaa_issue_badge('lic-p-k-ro') r`);
  const qual = await one('k-ro', `select kafaa_issue_badge('qr-p-k-ro-qs-ro') r`);
  const secC = await one('k-ro', `select kafaa_issue_badge($1) r`, [tr('c-sec-aw')]);
  const other = await one('k-ro', `select kafaa_issue_badge('SA-CERT-00101') r`);
  ok(dup.r.code === 'already_issued' && lic.r.code === 'not_eligible' && qual.r.code === 'not_eligible' && secC.r.code === 'security_restricted' && other.r.code === 'not_found',
    'issueBadge refuses a duplicate, licence and qualification mirrors (not_eligible), security training and other people\'s certificates');
  await q(`insert into kafaa_certificates (id, person_id, org_id, holder_initials, course_id, issued_on, valid_to, status) values
    ('KAF-TEST-EXP', 'p-k-ro', 'enec-ops', 'RO', 'c-scwe', '2023-01-01', '2025-01-01', 'valid'), ('KAF-TEST-REV', 'p-k-ro', 'enec-ops', 'RO', 'c-onb', '2026-01-01', '2028-01-01', 'revoked') on conflict do nothing`);
  const exp = await one('k-ro', `select kafaa_issue_badge('KAF-TEST-EXP') r`);
  const rev = await one('k-ro', `select kafaa_issue_badge('KAF-TEST-REV') r`);
  ok(exp.r.code === 'not_eligible' && rev.r.code === 'not_eligible', 'a badge cannot be issued from an expired or revoked certificate (not_eligible)');
  await q(`update kafaa_certificates set course_id = 'c-onb' where id = 'KAF-TEST-EXP'`);
  const l0 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const iss = await one('k-ro', `select kafaa_issue_badge($1) r`, [tr('c-scwe')]);
  const nb = (await q(`select credential::text c, key_id, status from kafaa_badges where id = $1`, [iss.r.data?.id]))[0];
  const cev = await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'badges' and ref_id = $1 and kind = 'credential' and active`, [iss.r.data?.id]);
  const issAud = (await q(`select outcome, ledger_status from kafaa_audit_events where action = 'badge.issue' order by seq desc limit 1`))[0];
  ok(iss.r.ok && nb && verifyCredential(JSON.parse(nb.c)).outcome === 'valid' && verifyCredential(JSON.parse(nb.c)).keyId === 'key-1' && cev[0].n > 0 && issAud.outcome === 'ok' && ['written', 'skipped'].includes(issAud.ledger_status),
    'issueBadge signs a server (key-1) credential the TS verifier accepts, records credential evidence and is audited with a ledger attempt');
  void l0;
  const tampered = JSON.parse(nb.c);
  tampered.credentialSubject.holderInitials = 'XX';
  ok(verifyCredential(tampered).outcome === 'invalid_signature', 'changing a field of the issued credential makes the signature invalid');

  // ── verifyBadge (anonymous)
  const slug = iss.r.data.slug;
  const v = await one(null, `select kafaa_verify_badge($1) r`, [slug]);
  const vAud = (await q(`select actor_person_id, outcome from kafaa_audit_events where action = 'badge.verify' order by seq desc limit 1`))[0];
  ok(v.r.ok && v.r.data.status === 'active' && v.r.data.credential && vAud.outcome === 'ok' && vAud.actor_person_id === null, 'anonymous verifyBadge returns the signed credential and status and writes an audit row');
  const probs = [];
  for (const b of rows.slice(0, 30)) {
    const x = await one(null, `select kafaa_verify_badge($1) r`, [b.public_slug]);
    probs.push(...publicPayloadProblems(x.r));
  }
  ok(probs.length === 0, `verify payloads carry no person name, email or photo (${probs[0] ?? 'clean'})`);
  const nf = await one(null, `select kafaa_verify_badge('kb-nope') r`);
  ok(nf.r.code === 'not_found', 'an unknown slug returns not_found');
  let limited = null;
  for (let i = 0; i < 25 && !limited; i++) { const x = await one(null, `select kafaa_verify_badge($1) r`, [slug]); if (!x.r.ok) limited = x.r.code; }
  ok(limited === 'rate_limited', 'verification is rate-limited per badge');
  const revB = T.badges.find((b) => b.source_id === 'KAF-2025-000301');
  const vr = await one(null, `select kafaa_verify_badge($1) r`, [revB.public_slug]);
  const krB = T.badges.find((b) => b.source_id === 'KAF-2026-000417');
  await q(`update kafaa_certificates set valid_to = '2026-01-01' where id = 'KAF-2026-000417'`);
  const ve = await one(null, `select kafaa_verify_badge($1) r`, [krB.public_slug]);
  await q(`update kafaa_certificates set valid_to = '2028-03-12' where id = 'KAF-2026-000417'`);
  ok(ve.r.data?.status === 'expired' && vr.r.data?.status === 'revoked', 'badge status follows the source certificate (expired, revoked)');
  ok(!T.badges.some((b) => T.courses.find((c) => c.id === b.course_id).competency_ids.some((id) => T.competencies.find((k) => k.id === id)?.domain === 'security')), 'no seeded badge wraps security training');

  // ── revokeBadge
  const notMine = await one('sro', `select kafaa_revoke_badge($1, 'not mine') r`, [iss.r.data.id]);
  const noWhy = await one('k-ro', `select kafaa_revoke_badge($1, '') r`, [iss.r.data.id]);
  const wd = await one('k-ro', `select kafaa_revoke_badge($1, 'Withdrawn for the test') r`, [iss.r.data.id]);
  const again = await one('k-ro', `select kafaa_revoke_badge($1, 'again please') r`, [iss.r.data.id]);
  const cevAfter = await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'badges' and ref_id = $1 and active`, [iss.r.data.id]);
  ok(notMine.r.code === 'not_found' && noWhy.r.code === 'invalid' && wd.r.ok && again.r.code === 'conflict' && cevAfter[0].n === 0, 'revokeBadge: holder or training manager only, reason required, evidence deactivated, no double revoke');
  const tmRev = await one('training-mgr', `select kafaa_revoke_badge($1, 'Revoked by training after review') r`, [T.badges.find((b) => b.person_id === 'p-sro').id]);
  ok(tmRev.r.ok, 'a training manager (skills_profile A) can revoke any badge');

  // ── RLS and execute rights
  ok((await count(null, 'kafaa_badges')) === 0 && (await count(null, 'kafaa_skill_claims')) === 0, 'anonymous visitors read no badges or claims (verification only through the RPC)');
  const sroOthers = await as('sro', `select distinct p.crew from kafaa_skill_claims c join kafaa_people p on p.id = c.person_id where p.id <> kafaa_me()`);
  ok(sroOthers.every((r) => r.crew === 'B'), 'a shift supervisor reads claims of crew B only (Scope)');
  ok((await count('k-hr-analyst', 'kafaa_badges', 'person_id <> kafaa_me()')) === 0 && (await count('gulfhydro-qa', 'kafaa_badges')) === 0 && (await count('k-auditor', 'kafaa_skill_claims')) === 0, 'HR (aggregate only), partners and auditors read no individual badges or claims');
  ok((await count('k-ro', 'kafaa_badges')) >= 2 && (await count('k-ro', 'kafaa_badges', 'person_id <> kafaa_me()')) === 0, 'a holder reads only their own badges');
  let direct = false;
  try { await as('k-ro', `insert into kafaa_badges (id, person_id, source_table, source_id, course_id, holder_initials, issued_on, public_slug) values ('x', 'p-k-ro', 'certificates', 'x', 'c-hu', 'RO', current_date, 'kbx')`); } catch { direct = true; }
  ok(direct, 'badges cannot be written directly (RPC only)');
  let anonClaim = false, internal = false;
  try { await as(null, `select kafaa_claim_skill('sk-da-01', 2, 'anon')`); } catch { anonClaim = true; }
  try { await as('k-ro', `select kafaa_badge_issuer_seed()`); } catch { internal = true; }
  let signer = false;
  try { await as('k-ro', `select kafaa_ed25519_sign('\\x00'::bytea, '\\x00'::bytea)`); } catch { signer = true; }
  ok(anonClaim && internal && signer, 'anonymous callers cannot claim; the issuer key and the signer are not executable by API roles');
}
