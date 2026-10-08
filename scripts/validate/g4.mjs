// [G4] PGlite checks for M09 (supplier onboarding, documents, ICV, equivalency, academy) and M11 (gap plans).
// Called from scripts/validate-migrations.mjs with its helpers. Each check runs as a real role through RLS and the RPCs.
export async function g4Checks({ db, as, one, count, ok, uid }) {
  console.log('G4 checks (M09, M11)');
  // Extra test identities (NEXUS profiles, test-only)
  let i = 980; // distinct from G2 (901+) and G3 (951+) test uids
  for (const [persona, org] of [['k-contractor', 'org-dhafra'], ['alnoor-qaqc', 'org-alnoor']]) {
    uid[persona] = `00000000-0000-4000-8000-${String(++i).padStart(12, '0')}`;
    await db.query(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,'partner',$5) on conflict do nothing`, [uid[persona], `${persona}@test`, persona, org, ['Partner']]);
  }
  const rpc = async (persona, sql, params) => (await one(persona, `select ${sql} r`, params)).r;
  const audits = async () => Number((await db.query('select count(*)::int n from kafaa_audit_events')).rows[0].n);

  // Isolation (B-06 lesson): suppliers see only their own file
  ok((await count('alnoor-gm', 'kafaa_supplier_documents', "org_id <> 'org-alnoor'")) === 0 && (await count('alnoor-gm', 'kafaa_supplier_documents')) > 0, 'supplier sees only its own document checklist');
  ok((await count('k-contractor', 'kafaa_partner_onboarding', "org_id <> 'org-dhafra'")) === 0 && (await count('k-contractor', 'kafaa_partner_onboarding')) === 1, 'contractor (partner user) sees only its own organisation case');
  ok((await count(null, 'kafaa_supplier_documents')) === 0 && (await count(null, 'kafaa_icv_plans')) === 0, 'anon reads no supplier documents or ICV plans');
  let a0 = await audits();
  const up = await rpc('alnoor-gm', `kafaa_upload_supplier_document('org-gulfhydro', 'qa_manual', 'x.pdf', 10, repeat('a', 64))`);
  ok(up.code === 'not_found' && (await audits()) === a0 + 1, "upload to another supplier's file returns not_found and is audited");

  // Direct writes are closed: the case, ICV plan and equivalency change only through RPCs
  let direct = 'ok';
  try { await as('gulfhydro-qa', `update kafaa_partner_onboarding set status = 'approved' where id = 'po-gulfhydro'`); } catch { direct = 'refused'; }
  const st = (await db.query(`select status from kafaa_partner_onboarding where id = 'po-gulfhydro'`)).rows[0].status;
  ok(direct === 'refused' && st === 'in_progress', 'a supplier cannot approve its own case with a direct write');
  let directIcv = 'ok';
  try { await as('gulfhydro-qa', `update kafaa_icv_plans set status = 'reviewed' where org_id = 'org-gulfhydro'`); } catch { directIcv = 'refused'; }
  ok(directIcv === 'refused', 'a supplier cannot mark its own ICV plan reviewed');

  // Readiness path → submit → summary
  const notReady = await rpc('gulfhydro-qa', `kafaa_partner_onboarding_action('po-gulfhydro', 'submit')`);
  ok(notReady.ok === false && notReady.code === 'invalid' && /readiness step/.test(notReady.message) && /document/.test(notReady.message), 'submitting an incomplete readiness path is refused with what is missing');
  await db.exec(`update kafaa_supplier_readiness set status = 'done' where org_id = 'org-gulfhydro' and step_key <> 'handoff'`);
  for (const k of ['nqa1_programme', 'cgd_procedure', 'cfsi_procedure', 'safety_culture_statement', 'icv_certificate']) {
    const r = await rpc('gulfhydro-qa', `kafaa_upload_supplier_document('org-gulfhydro', $1, $2, 240, $3)`, [k, `${k}.pdf`, 'b'.repeat(64)]);
    if (!r.ok) console.log('   upload failed', k, r.message);
  }
  const sub = await rpc('gulfhydro-qa', `kafaa_partner_onboarding_action('po-gulfhydro', 'submit')`);
  ok(sub.ok && sub.data.status === 'submitted' && /^KFA-RS-GULFHYDRO-\d{8}$/.test(sub.data.summary.ref) && sub.data.summary.documents.length >= 9 && /not a registration/.test(sub.data.summary.disclaimer),
    'completing the readiness path produces a readiness summary for ENEC registration');
  const upLocked = await rpc('gulfhydro-qa', `kafaa_upload_supplier_document('org-gulfhydro', 'iso9001', 'iso.pdf', 10, repeat('c', 64))`);
  ok(upLocked.code === 'conflict', 'documents are locked while the case is with ENEC');

  // ENEC review: approval needs every required document accepted
  const early = await rpc('k-admin', `kafaa_decide_partner_onboarding('po-gulfhydro', 'approved', 'ok')`);
  ok(early.ok === false && /not accepted/.test(early.message), 'approval is refused until every required document is accepted');
  const rej = await rpc('k-admin', `kafaa_review_supplier_document('sd-org-gulfhydro-qa_manual', 'rejected', '')`);
  ok(rej.code === 'invalid', 'a document rejection needs a note');
  const docs = (await db.query(`select id from kafaa_supplier_documents where org_id = 'org-gulfhydro' and status in ('uploaded', 'accepted', 'rejected') and required`)).rows;
  for (const d of docs) await rpc('k-admin', `kafaa_review_supplier_document($1, 'accepted', 'Checked')`, [d.id]);
  const led0 = Number((await db.query('select count(*)::int n from ledger_entries')).rows[0].n);
  const appr = await rpc('k-admin', `kafaa_decide_partner_onboarding('po-gulfhydro', 'approved', 'Evidence complete')`);
  const hand = await rpc('k-admin', `kafaa_decide_partner_onboarding('po-gulfhydro', 'handed_off', 'To NEXUS partner lens')`);
  const hs = (await db.query(`select status from kafaa_supplier_readiness where org_id = 'org-gulfhydro' and step_key = 'handoff'`)).rows[0].status;
  const hist = (await db.query(`select history from kafaa_partner_onboarding where id = 'po-gulfhydro'`)).rows[0].history;
  ok(appr.ok && hand.ok && hs === 'done' && hist.some((h) => h.action === 'handed_off'), 'ENEC approves and hands off; the supplier sees the step and history');
  ok(Number((await db.query('select count(*)::int n from ledger_entries')).rows[0].n) >= led0 + 2, 'approval and hand-off append to the NEXUS ledger');

  // ICV plan rules
  const short = await rpc('alnoor-gm', `kafaa_save_icv_plan('org-alnoor', '{"baseline":41,"target":50,"target_year":2028,"levers":[{"lever":"Local sourcing","delta":2}],"certificate_file":"c.pdf","certificate_valid_to":"2027-06-30"}'::jsonb, true)`);
  ok(short.ok === false && /do not cover/.test(short.message), 'an ICV plan whose levers do not cover the gap cannot be submitted');
  const good = await rpc('alnoor-gm', `kafaa_save_icv_plan('org-alnoor', '{"baseline":41,"target":50,"target_year":2028,"levers":[{"lever":"Emirati hiring","delta":5},{"lever":"Local sourcing","delta":4}],"certificate_file":"c.pdf","certificate_valid_to":"2027-06-30"}'::jsonb, true)`);
  const rev = await rpc('k-admin', `kafaa_review_icv_plan('icv-org-alnoor', 'reviewed', 'Levers cover the gap')`);
  ok(good.ok && good.data.status === 'submitted' && rev.ok, 'a covered ICV plan is submitted and reviewed by ENEC');

  // Contractor equivalency
  const sec = await rpc('gulfhydro-qa', `kafaa_submit_equivalency('{"person_label":"G-03","standard_id":"qs-sec","evidence":[{"name":"cert","kind":"certificate"}]}'::jsonb)`);
  ok(sec.ok === false && /Security/.test(sec.message), 'security qualifications are refused for equivalency');
  const eq = await rpc('gulfhydro-qa', `kafaa_submit_equivalency('{"person_id":"c-gulf-02","person_label":"Contractor technician G-02","standard_id":"qs-elec","evidence":[{"name":"Electrical training record","kind":"training_record"},{"name":"JPM record","kind":"jpm_record"}]}'::jsonb)`);
  ok(eq.ok && (await count('alnoor-gm', 'kafaa_equivalency_requests', `id = '${eq.data.id}'`)) === 0, 'partner admin submits an equivalency request that other partners cannot see');
  const tooEarly = await rpc('training-mgr', `kafaa_decide_equivalency($1, 'equivalent', 'Looks fine')`, [eq.data.id]);
  ok(tooEarly.ok === false && /every task item/.test(tooEarly.message), 'equivalent needs every task item covered by mapped evidence');
  const map = await rpc('training-mgr', `kafaa_map_equivalency($1, '[{"task_id":"qs-elec-t1","covered":true,"evidence":[0]},{"task_id":"qs-elec-t2","covered":true,"evidence":[1]},{"task_id":"qs-elec-t3","covered":true,"evidence":[0]}]'::jsonb)`, [eq.data.id]);
  const dec = await rpc('training-mgr', `kafaa_decide_equivalency($1, 'equivalent', 'All tasks evidenced')`, [eq.data.id]);
  const again = await rpc('training-mgr', `kafaa_decide_equivalency($1, 'rejected', 'Second thoughts')`, [eq.data.id]);
  ok(map.ok && map.data.covered === 3 && dec.ok && again.ok === false, 'evaluator maps evidence, records equivalent; decisions are final');

  // Supplier academy
  const en = await rpc('k-contractor', `kafaa_enrol_supplier_course('c-sa-cgd-103', null)`);
  const keys = (await db.query(`select k.check_id, k.answer from kafaa_academy_check_keys k join kafaa_academy_checks c on c.id = k.check_id where c.course_id = 'c-sa-cgd-103'`)).rows;
  const wrong = JSON.stringify(keys.map((k) => ({ check_id: k.check_id, answer: (k.answer + 1) % 3 })));
  const fail = await rpc('k-contractor', `kafaa_complete_supplier_course($1, $2::jsonb)`, [en.data?.id, wrong]);
  const pass = await rpc('k-contractor', `kafaa_complete_supplier_course($1, $2::jsonb)`, [en.data?.id, JSON.stringify(keys)]);
  const ver = await one(null, `select kafaa_verify_certificate($1) r`, [pass.data?.certificate_no ?? 'none']);
  ok(en.ok && fail.ok && fail.data.passed === false && pass.ok && pass.data.passed && ver.r.found === true && !('person_id' in ver.r), 'contractor enrols, fails then passes the server-scored check, and the certificate verifies publicly');
  const other = await rpc('alnoor-qaqc', `kafaa_complete_supplier_course($1, $2::jsonb)`, [en.data?.id, JSON.stringify(keys)]);
  ok(other.code === 'not_found', "nobody can complete someone else's enrolment");
  const enOther = await rpc('k-contractor', `kafaa_enrol_supplier_course('c-sa-cgd-103', 'c-dhafra-02')`);
  ok(enOther.code === 'forbidden', 'only a partner admin may enrol someone else');
  ok((await count(null, 'kafaa_academy_checks')) > 0 && (await count(null, 'kafaa_academy_check_keys')) === 0 && (await count('k-contractor', 'kafaa_academy_check_keys')) === 0, 'questions are public, answer keys are not');

  // M09 invite a partner from a register-interest request
  const inv = await rpc('k-admin', `kafaa_invite_partner('{"name_en":"Falcon Seals Trading","kind":"supplier","request_id":"ct-1"}'::jsonb)`);
  const invDup = await rpc('k-admin', `kafaa_invite_partner('{"name_en":"falcon seals trading","kind":"supplier"}'::jsonb)`);
  const invNo = await rpc('alnoor-gm', `kafaa_invite_partner('{"name_en":"Self Made Org","kind":"supplier"}'::jsonb)`);
  const invDocs = inv.ok ? await one('k-admin', `select count(*)::int n from kafaa_supplier_documents where org_id = $1`, [inv.data.org_id]) : { n: 0 };
  const invSteps = inv.ok ? await one('k-admin', `select count(*)::int n from kafaa_supplier_readiness where org_id = $1`, [inv.data.org_id]) : { n: 0 };
  const invPub = inv.ok ? await one(null, `select count(*)::int n from kafaa_organisations where id = $1`, [inv.data.org_id]) : { n: 1 };
  ok(inv.ok && invDocs.n === 12 && invSteps.n === 6 && invDup.code === 'conflict' && invNo.code === 'forbidden' && invPub.n === 0,
    'admin invites a supplier (case, six steps, twelve checklist rows); duplicates and partners are refused; the new organisation is not public');

  const gp = await rpc('k-hr-analyst', `kafaa_save_skill_gap_plan('{"skill_key":"salt-chemistry","scenario":"Scenario A (SIMULATED)","action":"partner","owner_role":"Nuclear Training (role)","target_quarter":"2027-Q3"}'::jsonb)`);
  const gpNo = await rpc('alnoor-gm', `kafaa_save_skill_gap_plan('{"skill_key":"salt-chemistry","scenario":"A","action":"partner","owner_role":"x role","target_quarter":"2027-Q3"}'::jsonb)`);
  ok(gp.ok && gpNo.code === 'forbidden' && (await count(null, 'kafaa_skill_gap_plans')) === 0 && (await count(null, 'kafaa_future_skills')) === 0, 'HR saves skills-gap plans; the public sees no SIMULATED radar or plans');
  ok((await count(null, 'kafaa_future_roles')) >= 10 && (await count(null, 'kafaa_adv_skills')) >= 20, 'public reads the future-role catalogue and skills per technology');
}
