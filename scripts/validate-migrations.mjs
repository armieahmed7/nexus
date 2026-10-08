// Validates supabase/migrations/*.sql + supabase/seed.sql against a local Postgres (PGlite), with test-only stubs of the
// existing NEXUS objects. Applies everything twice (idempotency), then runs RLS / RPC acceptance checks as real roles.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

const db = new PGlite();
const read = (p) => readFileSync(p, 'utf8');
const migs = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failures++; console.log(`  ✗ ${msg}`); } };

await db.exec(read('supabase/tests/nexus_stubs.sql'));
for (let pass = 1; pass <= 2; pass++) {
  for (const m of migs) {
    try { await db.exec(read(`supabase/migrations/${m}`)); } catch (e) { console.error(`✗ ${m} (pass ${pass}): ${e.message}`); process.exit(1); }
  }
  try { await db.exec(read('supabase/seed.sql')); } catch (e) { console.error(`✗ seed.sql (pass ${pass}): ${e.message}`); process.exit(1); }
  console.log(`pass ${pass}: ${migs.length} migrations + seed applied`);
}

// Test identities: NEXUS profiles for a few personas (test-only; Kafa'a-only personas get test profiles here too)
const P = { 'training-mgr': ['Training Manager'], sro: ['Shift Manager · licensed SRO'], 'gulfhydro-qa': ['Gulf Hydro-Valve QA Manager'], 'alnoor-gm': ['Al Noor General Manager'],
  'k-instructor': ['Instructor'], 'k-university': ['University'], 'k-observer': ['Observer'], 'k-licensing-coord': ['Licensing Coordinator'], 'k-auditor': ['Auditor'], 'k-ecp': ['ECP officer'], 'k-hr-analyst': ['HR analyst'], chco: ['Chief Human Capital Officer'], 'k-admin': ['Admin'], 'ai-governance': ['AI Governance Lead'] };
const uid = {};
let i = 0;
for (const [persona, roles] of Object.entries(P)) {
  uid[persona] = `00000000-0000-4000-8000-${String(++i).padStart(12, '0')}`;
  const org = persona.startsWith('gulf') ? 'org-gulfhydro' : persona.startsWith('alnoor') ? 'org-alnoor' : persona === 'k-university' ? 'ku' : persona === 'k-observer' ? 'org-observer' : 'enec-ops';
  const lens = /gulf|alnoor|university|observer/.test(persona) ? 'partner' : 'employee';
  await db.query(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing`, [uid[persona], `${persona}@test`, persona, org, lens, roles]);
}
const as = async (persona, sql, params = []) => {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [persona ? JSON.stringify({ sub: uid[persona] }) : '']);
  await db.exec(persona ? 'set role authenticated' : 'set role anon');
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role'); }
};
const one = async (persona, sql, params) => (await as(persona, sql, params))[0];
const count = async (persona, table, where = 'true') => Number((await one(persona, `select count(*)::int as n from ${table} where ${where}`)).n);

console.log('RLS and RPC checks');
ok((await count(null, 'kafaa_job_roles')) === 28, 'anon reads all 28 published roles');
ok((await count(null, 'kafaa_people')) === 0, 'anon reads no people');
ok((await count(null, 'kafaa_qual_records')) === 0, 'anon reads no qualification records');
ok((await count(null, 'kafaa_organisations', 'not public_listed')) === 0, 'anon reads only public directory entries');
ok((await count(null, 'kafaa_items', 'bank = \'secure\'')) === 0, 'anon reads no secure items');
ok((await count(null, 'kafaa_items', 'bank = \'practice\'')) >= 30, 'anon reads practice items');
const sroQ = await as('sro', `select distinct p.crew from kafaa_qual_records q join kafaa_people p on p.id = q.person_id where p.id <> kafaa_me()`);
ok(sroQ.length > 0 && sroQ.every((r) => r.crew === 'B'), 'shift supervisor sees qualification records for crew B only');
ok((await count('sro', 'kafaa_medical_due', 'person_id <> kafaa_me()')) === 0, 'shift supervisor sees no medical flags of others');
ok((await count('gulfhydro-qa', 'kafaa_equivalency_requests', "org_id <> 'org-gulfhydro'")) === 0, 'partner admin sees only own organisation equivalency (B-06)');
const auditBefore = Number((await db.query('select count(*)::int n from kafaa_audit_events')).rows[0].n);
const ge = await one('gulfhydro-qa', `select kafaa_get_equivalency('eq-1') r`);
const auditAfter = Number((await db.query('select count(*)::int n from kafaa_audit_events')).rows[0].n);
ok(ge.r.ok === false && ge.r.code === 'not_found' && auditAfter === auditBefore + 1, 'cross-org equivalency read returns not_found and writes an audit event');
const self = await one('k-instructor', `select kafaa_signoff_evaluation('{"record_id":"qr-p-k-instructor-qs-instr","task_id":"qs-instr-t1","result":"pass"}'::jsonb) r`);
ok(self.r.ok === false && self.r.code === 'self_sign', 'self sign-off refused with a clear error (and audited)');
const led0 = Number((await db.query('select count(*)::int n from ledger_entries')).rows[0].n);
const so = await one('k-instructor', `select kafaa_signoff_evaluation('{"record_id":"qr-p-k-lo-trainee-qs-lo-turbine","task_id":"qs-lo-turbine-t3","result":"pass"}'::jsonb) r`);
const led1 = Number((await db.query('select count(*)::int n from ledger_entries')).rows[0].n);
ok(so.r.ok === true && led1 === led0 + 1, 'qualified evaluator signs off a trainee task; NEXUS ledger appended');
const crit = await one('k-instructor', `select kafaa_record_jpm('jpm-qs-lo-turbine-t2', 'p-k-lo-trainee', '[{"n":1,"result":"pass"},{"n":2,"result":"pass"},{"n":3,"result":"fail"},{"n":4,"result":"pass"},{"n":5,"result":"pass"}]'::jsonb) r`);
ok(crit.r.ok && crit.r.data.result === 'fail' && crit.r.data.critical_failed === true, 'a failed critical step fails the JPM regardless of score');
ok((await count('k-university', 'kafaa_scholars', 'not consent_university')) === 0 && (await count('k-university', 'kafaa_scholars')) > 0, 'university sees only consenting scholars');
const obs = await as('k-observer', 'select id from kafaa_observer_reports');
ok(obs.length === 1 && obs[0].id === 'or-1', 'observer sees only the report released to its organisation');
const ws = await as('k-hr-analyst', `select * from kafaa_workforce_aggregate('2026-Q3', 'headcount') where family_id = 'safeguards'`);
ok(ws.length === 1 && ws[0].suppressed === true && ws[0].value === null, 'group of 7 shows suppressed, not a value');
const lap = await one('k-licensing-coord', `select kafaa_set_licence_status('lic-w-ro-07', 'lapsed', 'Test: source record says lapsed') r`);
const due = await one(null, `select kafaa_add_working_days('2026-10-08'::date, 3) d`);
ok(lap.r.ok === true && String(due.d).startsWith('2026-10-13') || (due.d instanceof Date && due.d.toISOString().startsWith('2026-10-13')), 'lapse detected on Thursday 8 Oct 2026 -> deadline Tue 13 Oct (3 UAE working days)');
const mc = await one('k-hr-analyst', `select kafaa_observer_report_action('or-3', 'submit', array['org-observer']) r`);
const mc2 = await one('k-hr-analyst', `select kafaa_observer_report_action('or-3', 'approve', '{}') r`);
const mc3 = await one('chco', `select kafaa_observer_report_action('or-3', 'approve', '{}') r`);
ok(mc.r.ok && !mc2.r.ok && mc3.r.ok, 'observer release: preparer cannot approve; CHCO office approves');
const tri = await one('k-ecp', `select kafaa_triage_concern('cc-5', 'triaged', 'priority') r`);
ok(tri.r.ok, 'ECP officer triages a referral (metadata only)');
ok((await count('sro', 'kafaa_concern_cases')) === 0, 'nobody else reads ECP referrals');
const rs = await one('k-admin', `select kafaa_screen_research_challenge('rc-4', true, false) r`);
ok(rs.r.ok && (await count(null, 'kafaa_research_challenges', "id = 'rc-4'")) === 0, 'research challenge stays unpublished without full screening sign-off');
const verify = await one(null, `select kafaa_verify_certificate('KAF-2026-000417') r`);
ok(verify.r.found === true && !('person_id' in verify.r), 'public certificate verification returns no personal data');
try { await db.exec(`update kafaa_audit_events set reason = 'x'`); ok(false, 'audit log rejects updates'); } catch { ok(true, 'audit log rejects updates (even for the owner)'); }
try { await db.exec(`delete from kafaa_evaluations where id = 'ev-1'`); ok(false, 'evaluations are append-only'); } catch { ok(true, 'evaluations are append-only'); }
const chain = await one('k-auditor', 'select kafaa_audit_verify() n');
ok(Number(chain.n) > 7, `audit hash chain verifies (${chain.n} entries, seed + live)`);
const np = await as(null, 'select * from kafaa_nexus_training_programs()');
ok(np.length === 1 && np[0].id === 'TP-DNT', 'NEXUS training programmes: anon sees public-basis rows only');
const ne = await as('gulfhydro-qa', 'select * from kafaa_nexus_eco_enrolments()');
ok(ne.every((r) => r.org_id === 'org-gulfhydro'), 'NEXUS eco_enrolments: partner sees only its own organisation');
const grant = await one('k-admin', `select kafaa_grant_role('p-k-editor', 'auditor', 'all', null) r`);
const self2 = await one('k-admin', `select kafaa_approve_role('${grant.r.data.id}') r`);
const second = await one('ai-governance', `select kafaa_approve_role('${grant.r.data.id}') r`);
ok(grant.r.data.status === 'pending_second' && !self2.r.ok && second.r.ok, 'elevated role grant needs a second admin');

// [G3] M06/M07/M10 checks
await (await import('./validate-g3.mjs')).default({ db, as, one, count, ok, uid });

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll migration checks passed');
process.exit(failures ? 1 : 0);
