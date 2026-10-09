// [W5 · E2 · F33] PGlite checks for 20261009152001_kafaa_w5e2_contractor_passport.sql: organisation-scoped RLS on the passport (the card's
// alnoor-gm vs gulfhydro-qa test), the org stamp on every skill row, SQL = TS parity of the passport evidence and of the equivalency
// pre-check for every contractor x every standard, the pre-check never changing an equivalency record, security standards refused,
// evidence triggers on certificates and equivalency decisions, contracted role profiles and contractor badges (F04 signer).
import {
  CPMSG, contractorEvidence, precheck,
} from '../../src/modules/m09/contractor.ts';

export default async function w5e2Checks({ db, as, count, ok, uid }) {
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  let n = 5200;
  for (const persona of ['k-contractor', 'alnoor-qaqc', 'k-ro', 'k-instructor']) {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [persona]]);
  }
  console.log('W5E2 · F33 contractor and supplier skills passport');
  const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
  const rpc = async (persona, fn, args = []) => (await as(persona, `select ${fn} as r`, args))[0].r;
  const rows = async (table, where = 'true') => (await q(`select to_jsonb(x) j from ${table} x where ${where}`)).map((r) => r.j);
  const d10 = (v) => (v == null ? v : typeof v === 'string' ? v.slice(0, 10) : v instanceof Date ? v.toISOString().slice(0, 10) : v);
  const today = (await q('select current_date::text as d'))[0].d;

  // ── stamp: every skill row carries the org scope of its person
  const bad = await q(`select count(*)::int n from (select person_id, org_id, contractor from kafaa_person_skills union all select person_id, org_id, contractor from kafaa_skill_evidence) s
    where s.org_id is distinct from kafaa_cp_org(s.person_id) or s.contractor is distinct from (kafaa_cp_org(s.person_id) is not null)`);
  const stamped = (await q(`select count(distinct org_id)::int n from kafaa_person_skills where contractor`))[0].n;
  ok(bad[0].n === 0 && stamped >= 3, `person_skills and skill_evidence rows of contractor people carry their supplier organisation (${stamped} organisations); staff rows none`);

  // ── RLS: no cross-organisation reads (card acceptance: alnoor-gm vs gulfhydro-qa)
  for (const t of ['kafaa_person_skills', 'kafaa_skill_evidence', 'kafaa_contractor_engagements']) {
    const a = await count('alnoor-gm', t, `org_id is distinct from 'org-alnoor' and person_id <> kafaa_me()`);
    const g = await count('gulfhydro-qa', t, `org_id is distinct from 'org-gulfhydro' and person_id <> kafaa_me()`);
    const aOwn = await count('alnoor-gm', t, `person_id like 'c-alnoor-%'`);
    const gOwn = await count('gulfhydro-qa', t, `person_id like 'c-gulf-%'`);
    const aX = await count('alnoor-gm', t, `person_id like 'c-gulf-%' or person_id like 'c-dhafra-%' or person_id = 'p-gulfhydro-qa'`);
    const gX = await count('gulfhydro-qa', t, `person_id like 'c-alnoor-%' or person_id like 'c-dhafra-%' or person_id like 'p-alnoor-%'`);
    ok(a === 0 && g === 0 && aOwn > 0 && gOwn > 0 && aX === 0 && gX === 0, `${t}: alnoor-gm reads Al Noor passports only, gulfhydro-qa Gulf Hydro-Valve only (no cross-org rows)`);
  }
  ok((await count('k-contractor', 'kafaa_person_skills', `person_id <> kafaa_me()`)) === 0 && (await count('k-contractor', 'kafaa_person_skills')) > 0
    && (await count('k-contractor', 'kafaa_contractor_engagements', `person_id <> kafaa_me()`)) === 0, 'a contractor (partner_user) reads their own passport only');
  const allContractorRows = (await q(`select count(*)::int n from kafaa_person_skills where contractor`))[0].n;
  ok((await count('training-mgr', 'kafaa_person_skills', 'contractor')) === allContractorRows && (await count('k-instructor', 'kafaa_person_skills', 'contractor')) === allContractorRows
    && (await count('k-auditor', 'kafaa_person_skills', 'contractor')) === allContractorRows, 'ENEC evaluators (equivalency A) and auditors (R) read every contractor passport');
  ok((await count('k-auditor', 'kafaa_person_skills', 'not contractor and person_id <> kafaa_me()')) === 0 && (await count('k-instructor', 'kafaa_skill_evidence', `not contractor and person_id <> kafaa_me()`)) === (await count('k-instructor', 'kafaa_skill_evidence', `not contractor and person_id <> kafaa_me() and kafaa_rule_read('skills_profile', person_id, null, false)`)),
    'the equivalency branch opens contractor rows only (staff rows still follow skills_profile)');
  ok((await count('sro', 'kafaa_person_skills', 'contractor')) === 0 && (await count(null, 'kafaa_contractor_engagements')) === 0 && (await count(null, 'kafaa_person_skills')) === 0,
    'line managers and anonymous visitors read no contractor passport');
  ok((await count('alnoor-gm', 'kafaa_contract_role_targets', `org_id <> 'org-alnoor'`)) === 0 && (await count('alnoor-gm', 'kafaa_contract_role_targets')) > 0
    && (await count('training-mgr', 'kafaa_contract_role_targets')) === (await q('select count(*)::int n from kafaa_contract_role_targets'))[0].n && (await count('sro', 'kafaa_contract_role_targets')) === 0,
    'contracted role profiles: own organisation, ENEC evaluators; not other staff');
  ok((await count(null, 'kafaa_task_skill_links')) > 80, 'the task → skill map is public reference data');
  let direct = 0;
  for (const sql of [`insert into kafaa_contract_role_targets (id, org_id, role_id, headcount_band) values ('x', 'org-alnoor', 'quality-assurance-qc', '1-4')`,
    `update kafaa_person_skills set level = 4 where person_id = 'c-alnoor-01' returning id`, `insert into kafaa_contractor_engagements (id, person_id, org_id, ref_code, title_en, title_ar, started_on, status) values ('x','c-alnoor-01','org-alnoor','x','x','x',current_date,'signed_off')`]) {
    try { const r = await as('k-admin', sql); if (!r.length) direct++; } catch { direct++; }
  }
  ok(direct === 3, 'passport tables cannot be written directly (RPC only)');
  let internal = false;
  try { await as('training-mgr', `select kafaa_cp_sync('c-alnoor-01')`); } catch { internal = true; }
  let anonPc = false;
  try { await as(null, `select kafaa_equivalency_precheck('c-alnoor-01', 'qs-mech')`); } catch { anonPc = true; }
  ok(internal && anonPc, 'internal helpers are not executable by API roles; anonymous visitors cannot run the pre-check');

  // ── SQL = TS: passport evidence of every contractor (from the current tables)
  const W = {
    skills: await rows('kafaa_skills'), comps: await rows('kafaa_competencies'), courses: await rows('kafaa_courses'), standards: await rows('kafaa_qual_standards'),
    roleComps: await rows('kafaa_role_competencies'),
    certificates: (await rows('kafaa_certificates')).map((c) => ({ ...c, issued_on: d10(c.issued_on), valid_to: d10(c.valid_to) })),
    equivalency: await rows('kafaa_equivalency_requests'),
    engagements: (await rows('kafaa_contractor_engagements')).map((g) => ({ ...g, ended_on: d10(g.ended_on), started_on: d10(g.started_on) })),
  };
  const contractors = (await q(`select id from kafaa_people where kafaa_cp_org(id) is not null order by id collate "C"`)).map((r) => r.id);
  let evDiff = 0, evRows = 0, firstEv = null;
  for (const p of contractors) {
    const sql = (await q(`select id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on::text as observed_on, note, active from kafaa_cp_evidence($1, $2::date) order by id collate "C"`, [p, today]));
    const ts = contractorEvidence(p, W, today).map(({ person_id, ...e }) => e); // eslint-disable-line no-unused-vars
    evRows += ts.length;
    if (canon(sql) !== canon(ts)) { evDiff++; firstEv ??= p; }
  }
  ok(evDiff === 0 && evRows > 300, `SQL passport evidence equals TS for all ${contractors.length} contractor people (${evRows} rows)${firstEv ? `; first diff ${firstEv}` : ''}`);
  const stored = await q(`select count(*)::int n from kafaa_cp_evidence('c-alnoor-01', current_date) e left join kafaa_skill_evidence s on s.id = e.id
    where s.id is null or s.level <> e.level or s.basis <> e.basis or s.active <> e.active`);
  ok(stored[0].n === 0, 'the stored passport evidence of a seeded contractor is what the sync would write');

  // ── SQL = TS: the equivalency pre-check, every contractor x every non-security current standard
  const tasks = await rows('kafaa_task_items');
  const links = await rows('kafaa_task_skill_links');
  const states = await rows('kafaa_person_skills', 'active');
  const stds = W.standards.filter((s) => s.status === 'current' && !s.security_restricted);
  let pcDiff = 0, pcN = 0, firstPc = null;
  const outlooks = new Set();
  for (const p of contractors) {
    for (const s of stds) {
      const sql = (await q('select kafaa_cp_precheck_compute($1, $2) r', [p, s.id]))[0].r;
      const ts = precheck({ person_id: p, standard: s, tasks, links, states: states.filter((x) => x.person_id === p), skills: W.skills, comps: W.comps, requests: W.equivalency, courses: W.courses });
      pcN++;
      outlooks.add(ts.outlook);
      if (canon(sql) !== canon(ts)) { pcDiff++; firstPc ??= `${p}/${s.id}`; }
    }
  }
  ok(pcDiff === 0 && pcN > 500, `SQL pre-check equals TS for ${pcN} contractor x standard pairs${firstPc ? `; first diff ${firstPc}` : ''}`);
  ok(['already_equivalent', 'likely_equivalent', 'review', 'training_likely'].every((o) => outlooks.has(o)), 'the seed shows every pre-check outlook (already equivalent, likely, review, training likely)');

  // ── RPC: pre-check flows (read-only, audited, no cross-org, security refused)
  const eqDigest = async () => (await q(`select md5(string_agg(to_jsonb(r)::text, '|' order by r.id collate "C")) d from kafaa_equivalency_requests r`))[0].d;
  const auditN = async (outcome) => (await q(`select count(*)::int n from kafaa_audit_events where action = 'equivalency.precheck' and outcome = $1`, [outcome]))[0].n;
  const before = await eqDigest();
  const okBefore = await auditN('ok');
  const pc1 = await rpc('alnoor-gm', `kafaa_equivalency_precheck('c-alnoor-02', 'qs-mech')`);
  const pc2 = await rpc('training-mgr', `kafaa_equivalency_precheck('c-gulf-01', 'qs-elec')`);
  const pc3 = await rpc('k-contractor', `kafaa_equivalency_precheck('p-k-contractor', 'qs-get')`);
  ok(pc1.ok && pc2.ok && pc3.ok && pc1.data.tasks.length === 4 && pc1.data.open_request_id === 'eq-2' && pc2.data.prior_request_id === 'eq-4' && (await auditN('ok')) === okBefore + 3,
    'the partner admin, an ENEC evaluator and the contractor run the pre-check (audited; open and prior requests linked)');
  ok((await eqDigest()) === before, 'the pre-check never changes an equivalency record');
  const refusedBefore = await auditN('refused');
  const x1 = await rpc('alnoor-gm', `kafaa_equivalency_precheck('c-gulf-03', 'qs-mech')`);
  const x2 = await rpc('gulfhydro-qa', `kafaa_equivalency_precheck('c-alnoor-01', 'qs-mech')`);
  const x3 = await rpc('k-contractor', `kafaa_equivalency_precheck('c-dhafra-04', 'qs-rp')`);
  const x4 = await rpc('training-mgr', `kafaa_equivalency_precheck('p-k-ro', 'qs-ro')`);
  ok([x1, x2, x3, x4].every((r) => !r.ok && r.code === 'not_found' && r.message === CPMSG.not_found_person) && (await auditN('refused')) === refusedBefore + 4,
    'other organisations, colleagues and staff are "not found" (no cross-org reads), and every refusal is audited');
  const sec = await rpc('alnoor-gm', `kafaa_equivalency_precheck('c-alnoor-02', 'qs-sec')`);
  const sec2 = await rpc('alnoor-gm', `kafaa_submit_equivalency($1::jsonb)`, [JSON.stringify({ person_id: 'c-alnoor-02', person_label: 'x', standard_id: 'qs-sec', evidence: [{ name: 'x', kind: 'certificate' }] })]).catch(() => null);
  ok(!sec.ok && sec.code === 'invalid' && sec.message === CPMSG.security && (!sec2 || sec2.code === 'invalid'), 'security standards are excluded from the pre-check, as in submitEquivalency');
  const nf = await rpc('alnoor-gm', `kafaa_equivalency_precheck('c-alnoor-02', 'qs-nope')`);
  ok(!nf.ok && nf.code === 'not_found' && nf.message === CPMSG.not_found_standard, 'an unknown standard is not found');

  // ── triggers: an equivalency decision and a certificate change re-sync the passport
  const eqBefore = (await q(`select level from kafaa_person_skills where id = 'ps:c-gulf-04:sk-mp-01-mech'`))[0]?.level ?? 0;
  const m = await rpc('training-mgr', `kafaa_map_equivalency('eq-13', $1::jsonb)`, [JSON.stringify(['qs-mech-t1', 'qs-mech-t2', 'qs-mech-t3', 'qs-mech-t4'].map((t) => ({ task_id: t, covered: true, evidence: [0], note: 'ok' })))]);
  const dec = await rpc('training-mgr', `kafaa_decide_equivalency('eq-13', 'equivalent', 'All tasks evidenced in the W5E2 check')`);
  const evq = (await q(`select basis, level, active, contractor, org_id from kafaa_skill_evidence where id = 'se:credential:eq-13:sk-mp-01-mech'`))[0];
  const st = (await q(`select level, basis, contractor, org_id from kafaa_person_skills where id = 'ps:c-gulf-04:sk-mp-01-mech'`))[0];
  ok(m.ok && dec.ok && evq?.basis === 'validated' && evq.level === 3 && evq.active && evq.contractor && evq.org_id === 'org-gulfhydro' && st?.level === 3 && st.level >= eqBefore && st.contractor,
    'an "equivalent" decision becomes validated passport evidence and the skill state is recomputed (stamped for the organisation)');
  await db.query(`update kafaa_certificates set status = 'revoked' where id = 'SA-CERT-00110'`);
  const revoked = (await q(`select bool_and(not active) a, count(*)::int n from kafaa_skill_evidence where ref_id = 'SA-CERT-00110'`))[0];
  await db.query(`update kafaa_certificates set status = 'valid' where id = 'SA-CERT-00110'`);
  const restored = (await q(`select bool_and(active) a from kafaa_skill_evidence where ref_id = 'SA-CERT-00110'`))[0];
  ok(revoked.n > 0 && revoked.a && restored.a, 'a revoked academy certificate deactivates its passport evidence; restoring it reactivates the evidence');

  // ── contracted role profiles (ENEC partner_org A)
  const t1 = await rpc('k-admin', `kafaa_set_contract_role_target($1::jsonb)`, [JSON.stringify({ org_id: 'org-gulfhydro', role_id: 'radiation-protection-technician', headcount_band: '1-4', contract_ref: 'W5E2-CHECK', scope_en: 'Check', scope_ar: 'فحص' })]);
  const t2 = await rpc('alnoor-gm', `kafaa_set_contract_role_target($1::jsonb)`, [JSON.stringify({ org_id: 'org-alnoor', role_id: 'quality-assurance-qc', headcount_band: '25+' })]);
  const t3 = await rpc('k-admin', `kafaa_set_contract_role_target($1::jsonb)`, [JSON.stringify({ org_id: 'org-alnoor', role_id: 'security-officer', headcount_band: '1-4' })]);
  const t4 = await rpc('k-admin', `kafaa_set_contract_role_target($1::jsonb)`, [JSON.stringify({ org_id: 'org-alnoor', role_id: 'quality-assurance-qc', headcount_band: '3-7' })]);
  const t5 = await rpc('k-admin', `kafaa_set_contract_role_target($1::jsonb)`, [JSON.stringify({ org_id: 'ku', role_id: 'quality-assurance-qc', headcount_band: '1-4' })]);
  const led = (await q(`select ledger_status from kafaa_audit_events where action = 'contractor.role_target' and outcome = 'ok' order by seq desc limit 1`))[0];
  ok(t1.ok && t1.data.id === 'crt-org-gulfhydro-radiation-protection-technician' && led && t2.code === 'forbidden' && t3.code === 'security_restricted' && t4.code === 'invalid' && t5.code === 'not_found'
    && (await count('gulfhydro-qa', 'kafaa_contract_role_targets', `id = '${t1.data.id}'`)) === 1 && (await count('alnoor-gm', 'kafaa_contract_role_targets', `id = '${t1.data.id}'`)) === 0,
    'ENEC sets contracted role profiles (ledger); partners cannot; security roles, bad bands and non-suppliers are refused; the organisation sees its own');

  // ── contractor badges (F04 signer; key-1 server key)
  const b0 = await rpc('k-ro', `kafaa_issue_contractor_badge('SA-CERT-00101')`);
  const b1 = await rpc('alnoor-qaqc', `kafaa_issue_contractor_badge('SA-CERT-00101')`);
  const b2 = await rpc('alnoor-qaqc', `kafaa_issue_contractor_badge('SA-CERT-00101')`);
  const b3 = await rpc('alnoor-qaqc', `kafaa_issue_contractor_badge('SA-CERT-00104')`);
  await db.query(`update kafaa_certificates set valid_to = '2026-01-01' where id = 'SA-CERT-00102'`);
  const b4 = await rpc('alnoor-qaqc', `kafaa_issue_contractor_badge('SA-CERT-00102')`);
  await db.query(`update kafaa_certificates set valid_to = '2028-08-19' where id = 'SA-CERT-00102'`);
  const ver = b1.ok ? await rpc(null, `kafaa_verify_badge($1)`, [b1.data.slug]) : null;
  ok(b0.code === 'forbidden' && b1.ok && b2.code === 'already_issued' && b3.code === 'not_found' && b4.code === 'not_eligible' && ver?.ok && ver.data?.status === 'active',
    'a contractor wraps their own valid academy certificate as a signed badge that verifies publicly; duplicates, others\' and expired certificates are refused; staff are refused');
  const self = await rpc('alnoor-qaqc', `kafaa_contractor_badges('p-alnoor-qaqc')`);
  const adm = await rpc('alnoor-gm', `kafaa_contractor_badges('p-alnoor-qaqc')`);
  const evl = await rpc('training-mgr', `kafaa_contractor_badges('p-alnoor-qaqc')`);
  const other = await rpc('gulfhydro-qa', `kafaa_contractor_badges('p-alnoor-qaqc')`);
  ok(self.length === 1 && self[0].credential?.proof?.proofValue && adm[0]?.credential && evl.length === 1 && evl[0].credential === null && other.length === 0,
    'contractor credentials: the holder and their partner admin get the signed credential, evaluators the list only, other organisations nothing');
  const noEv = (await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'badges' and ref_id = $1`, [b1.data?.id]))[0].n;
  ok(noEv === 0, 'the badge adds no evidence (the certificate already is passport evidence)');
}
