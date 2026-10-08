// [G3] PGlite checks for M06 (applications), M07 (workforce) and M10 (universities and research).
// Called from scripts/validate-migrations.mjs with its helpers; runs after the foundation checks on the same database.
export default async function g3Checks({ db, as, one, count, ok, uid }) {
  console.log('G3 checks (M06, M07, M10)');
  // Test identities for personas the foundation block does not create.
  for (const [persona, org, n] of [['k-student', 'public', 901], ['k-graduate', 'public', 902]]) {
    uid[persona] = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    await db.query(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing`, [uid[persona], `${persona}@test`, persona, org, 'public', ['Applicant']]);
  }
  const rpc = async (persona, sql) => (await one(persona, `select ${sql} r`)).r;
  const fails = async (persona, sql) => { try { await as(persona, sql); return false; } catch { return true; } };

  // M06 · applications
  ok(await fails(null, `select kafaa_submit_application('dnt', '{}'::jsonb)`), 'anonymous visitors cannot call kafaa_submit_application');
  const sub = await rpc('k-student', `kafaa_submit_application('dnt', '{"stage_finder":"finishing_school","nationality":"uae"}'::jsonb)`);
  ok(sub.ok === true && sub.data.stage === 'submitted', 'applicant submits a DNT application through the RPC');
  const dup = await rpc('k-student', `kafaa_submit_application('dnt', '{}'::jsonb)`);
  ok(dup.ok === false && dup.code === 'conflict', 'a second open application to the same programme is refused (conflict)');
  const eid = await rpc('k-student', `kafaa_submit_application('gpo', '{"emirates_id":"784-0000-0000000-0"}'::jsonb)`);
  ok(eid.ok === false && eid.code === 'invalid', 'an Emirates ID is never collected at application time');
  const lo = await rpc('k-student', `kafaa_submit_application('train-for-work', '{}'::jsonb)`);
  ok(lo.ok === false && lo.code === 'invalid', 'link-out programmes take applications on the official channel only');
  ok(await fails('k-student', `update kafaa_applications set stage = 'offer' where id = '${sub.data.id}'`), 'an applicant cannot move their own application to offer with a direct update');
  const ev = Number((await one('k-student', `select count(*)::int n from kafaa_application_events where application_id = '${sub.data.id}'`)).n);
  ok(ev === 1, 'the submission is recorded in the plain-language application history');
  const other = await rpc('k-graduate', `kafaa_withdraw_application('${sub.data.id}', 'not mine')`);
  ok(other.ok === false && other.code === 'not_found', "an applicant cannot withdraw someone else's application");
  const wd = await rpc('k-student', `kafaa_withdraw_application('${sub.data.id}', 'Changed my plans')`);
  const after = await one('k-student', `select stage, delete_after from kafaa_applications where id = '${sub.data.id}'`);
  ok(wd.ok === true && after.stage === 'withdrawn' && after.delete_after != null, 'withdrawal closes the application and schedules deletion');
  const funnel = await as('k-hr-analyst', 'select * from kafaa_application_funnel()');
  ok(funnel.some((r) => r.suppressed && r.n === null) && funnel.some((r) => !r.suppressed && r.n >= 10) && funnel.every((r) => r.suppressed || r.n >= 10), 'HR funnel shows counts only and suppresses cells under 10');
  ok((await count('k-hr-analyst', 'kafaa_applications')) === 0, 'the HR analyst (aggregate only) reads no individual applications');
  const dec = await rpc('chco', `kafaa_decide_application('app-p001', 'screening', 'Eligibility confirmed by HR')`);
  ok(dec.ok === true, 'the HR authority records a screening decision (mirrored from HR) as evidence');

  // M07 · workforce
  const bt = await rpc('k-hr-analyst', `kafaa_set_bench_target('crit-shift-supervisor', 26, 'Fifth crew planned for 2027')`);
  const bt2 = await rpc('alnoor-gm', `kafaa_set_bench_target('crit-shift-supervisor', 1, 'nope nope')`);
  ok(bt.ok === true && bt2.ok === false && bt2.code === 'forbidden', 'only HR sets bench-depth targets');
  const scn = await rpc('k-hr-analyst', `kafaa_save_scenario('{"name":"Fifth crew","kind":"headcount","params":{"crews":6},"results":{"ro":12}}'::jsonb)`);
  const scnRow = await one('k-hr-analyst', `select name, simulated from kafaa_scenarios where id = '${scn.data?.id}'`);
  ok(scn.ok === true && /SIMULATED/.test(scnRow.name) && scnRow.simulated === true, 'saved scenarios are always labelled SIMULATED');
  const dr = await rpc('k-hr-analyst', `kafaa_draft_observer_report('{"title_en":"Emiratization Q3 2026","title_ar":"التوطين الربع الثالث","period":"2026-Q3","tiles":[{"k":"emiratization","v":"54.7%","src":"SR2024"}]}'::jsonb)`);
  const sub2 = await rpc('k-hr-analyst', `kafaa_observer_report_action('${dr.data?.id}', 'submit', array['org-observer'])`);
  ok(dr.ok && sub2.ok && (await count('k-observer', 'kafaa_observer_reports', `id = '${dr.data?.id}'`)) === 0, 'a drafted observer report stays invisible to the observer until approved');
  const ws = await as('k-hr-analyst', `select * from kafaa_workforce_aggregate('2026-Q2', 'emirati') where family_id = 'safeguards'`);
  ok(ws.length === 1 && ws[0].suppressed && ws[0].value === null, 'earlier quarters suppress the group of 7 as well');

  // M10 · universities and research
  ok((await count('k-university', 'kafaa_scholar_cohorts')) > 0 && (await count('k-university', 'kafaa_scholar_cohorts', "university_org_id <> 'ku'")) === 0, 'a university reads only the cohort aggregates hosted at its own university');
  ok((await count('alnoor-gm', 'kafaa_scholar_cohorts')) === 0, 'a supplier partner reads no scholar cohorts');
  const rp = await rpc('alnoor-gm', `kafaa_save_research_proposal('{"challenge_id":"rc-1","title":"Arabic glossary audio","summary":"Audio pronunciations for the Arabic nuclear glossary, built with students.","ip_route":null,"submit":true}'::jsonb)`);
  ok(rp.ok === true && rp.data.status === 'submitted', 'a partner submits a research proposal to a published challenge');
  ok(await fails('alnoor-gm', `update kafaa_research_proposals set status = 'accepted', screened = true where id = '${rp.data.id}'`), 'a partner cannot accept or screen its own proposal with a direct update');
  const unpub = await rpc('alnoor-gm', `kafaa_save_research_proposal('{"challenge_id":"rc-4","title":"Scenario tooling","summary":"Tooling for simulator scenario authoring and versioning.","submit":true}'::jsonb)`);
  ok(unpub.ok === false && unpub.code === 'invalid', 'proposals cannot answer an unpublished (unscreened) challenge');
  const acc0 = await rpc('k-admin', `kafaa_decide_research_proposal('${rp.data.id}', 'accepted', false, 'Looks good')`);
  const acc1 = await rpc('k-admin', `kafaa_decide_research_proposal('${rp.data.id}', 'accepted', true, 'Screened: no plant data, no export-controlled content')`);
  ok(acc0.ok === false && acc1.ok === true, 'a proposal cannot be accepted before security and export-control screening');
  const ed = await rpc('k-admin', `kafaa_save_research_challenge('{"id":"rc-2","title_en":"Heat-stress management for outdoor work (revised)","title_ar":"إدارة الإجهاد الحراري (منقح)","theme":"Health & safety","summary_en":"Revised statement.","summary_ar":"بيان منقح.","closes_on":"2027-02-28"}'::jsonb)`);
  ok(ed.ok && ed.data.status === 'screening' && (await count(null, 'kafaa_research_challenges', "id = 'rc-2'")) === 0, 'editing a published challenge unpublishes it until a new screening sign-off');
  const scr = await rpc('k-admin', `kafaa_screen_research_challenge('rc-2', true, true)`);
  const audited = Number((await db.query(`select count(*)::int n from kafaa_audit_events where action = 'research.screen' and entity_id = 'rc-2' and outcome = 'ok'`)).rows[0].n);
  ok(scr.ok && audited === 1 && (await count(null, 'kafaa_research_challenges', "id = 'rc-2'")) === 1, 'the challenge republishes only with a screening sign-off recorded in the audit log');
}
