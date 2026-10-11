// [W4 · E3] PGlite checks for 20261009143001_kafaa_w4e3_simulator.sql (F28 simulator scenario library and coverage):
// SQL = TS parity of the content check, the scenario validator and the plan validator / gap count; exam scenarios refused
// (exam_content, audited); RBAC (instructors write, the training manager approves with maker-checker, managers/auditors/
// employees cannot write); the coverage gaps of the seeded cycles; crew debriefs that write F01 evidence (ojt, evidenced, never
// verified) only for crew members present in the booked slot, with the same evidence rows and xAPI statements as the TS rules;
// RLS on debriefs and member rows (own, crew scope, sat) and the simDebriefs read RPC.
import { readFileSync } from 'node:fs';

export default async function w4e3Checks({ db, as, one, count, ok, uid }) {
  const S = await import('../../src/modules/m04/scenarios.ts');
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  console.log('W4E3 · F28 simulator scenario library');
  let n = 1430;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['nse', 'Nuclear Safety Engineer']]) {
    if (uid[persona]) continue;
    const row = (await db.query('select user_id from profiles where persona_id = $1', [persona])).rows[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  const norm = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));
  const rpc = async (persona, fn, args, types) => (await one(persona, `select ${fn}(${args.map((_, i) => `$${i + 1}${types?.[i] ?? ''}`).join(', ')}) as r`, args)).r;

  // ── seed sanity
  ok(T.sim_scenarios.length >= 20 && T.sim_scenarios.every((s) => s.purpose === 'training'), `seed: ${T.sim_scenarios.length} scenarios, all purpose training`);
  ok(new Set(T.sim_scenarios.map((s) => s.status)).size === 4, 'seed: scenarios in every status (draft, in review, approved, retired)');
  ok(T.crew_debriefs.length >= 100 && T.crew_debriefs.every((d) => d.source === 'import' && d.evidence_count === 0), `seed: ${T.crew_debriefs.length} imported debriefs (no seeded skills evidence)`);
  ok(Number((await db.query(`select count(*)::int n from kafaa_sim_scenarios where purpose <> 'training'`)).rows[0].n) === 0, 'no scenario row has a purpose other than training');
  let bad = 0;
  try { await db.query(`insert into kafaa_sim_scenarios (id, code, title_en, title_ar, summary_en, summary_ar, category, purpose, duration_min, fidelity) values ('x-exam','X-1','a','a','a','a','normal','exam',60,'full_scope')`); } catch { bad = 1; }
  ok(bad === 1, 'the table itself refuses purpose = exam (check constraint)');

  // ── content check parity (SQL kafaa_sim_content_issue = TS contentIssue)
  const corpus = [
    'Loss of one main feedwater pump at full power', 'This is the NRC exam scenario', 'Examination of the crew', 'Use the answer key afterwards', 'Licensing test drill',
    'امتحان الطاقم', 'مفتاح الإجابة مرفق', 'Respond to a security event', 'Intruder at the perimeter fence', 'Cyber attack on the plant network', 'سيناريو أمني', 'الضمانات النووية',
    'Fail transmitter 1RC-PT-0455 low', 'Close valve FW-V-123', 'Pressure drops to 1500 psig', 'Boron at 1200 ppm', 'Insert MF-RCS01 at minute 5', 'insert mf rx12 malfunction',
    'APR-1400 reactor coolant system', 'FANR-REG-16 requires it', 'At 100% power the crew', 'Steam generator tube rupture with a slow isolation', 'تمزق أنبوب مولّد البخار', '', null,
    'Armed response team', 'Disarmed alarms are not part of this', 'examining the trend', 'Temperature 300 °C at the outlet', 'flow 500 gpm',
  ];
  let cdiff = 0;
  for (const t of corpus) {
    const sql = (await db.query('select kafaa_sim_content_issue($1::text[]) as r', [[t]])).rows[0].r;
    if ((sql ?? null) !== S.contentIssue([t])) { cdiff++; console.log('    content mismatch:', t, sql, S.contentIssue([t])); }
  }
  ok(cdiff === 0, `content check: SQL equals TS on ${corpus.length} texts (exam, security, tags, setpoints, malfunction codes, Arabic)`);
  ok(S.contentIssue(['Close valve FW-V-123']) === 'specific_content' && S.contentIssue(['APR-1400 reactor coolant system']) === null && S.contentIssue(['امتحان الطاقم']) === 'exam_content',
    'tags are caught, APR-1400 is not; Arabic exam wording is caught');
  const seededTexts = [...T.sim_scenarios.flatMap((s) => [s.title_en, s.title_ar, s.summary_en, s.summary_ar, s.events_en, s.events_ar]), ...T.sim_objectives.flatMap((o) => [o.title_en, o.title_ar])];
  ok((await db.query('select kafaa_sim_content_issue($1::text[]) as r', [seededTexts])).rows[0].r === null, 'every seeded scenario and objective text passes the SQL content check');

  // ── scenario validator parity (SQL kafaa_sim_validate = TS validateScenario)
  const objectives = new Map(T.sim_objectives.map((o) => [o.id, o]));
  const comps = new Set(T.competencies.map((c) => c.id));
  const base = { purpose: 'training', title_en: 'Loss of instrument air to one header', title_ar: 'فقدان هواء الأجهزة لأحد الخطوط', summary_en: 'The crew responds to a loss of instrument air and protects affected valves.', summary_ar: 'يستجيب الطاقم لفقدان هواء الأجهزة ويحمي الصمامات المتأثرة.', category: 'abnormal', objective_ids: ['so-a1', 'so-t3'], competency_ids: ['hu-01'], positions: ['ro', 'ss', 'sro', 'ro'], duration_min: 90, fidelity: 'full_scope', programmes: ['loct', 'coct', 'coct'] };
  const cases = [
    base, { ...base, purpose: 'exam' }, { ...base, purpose: 'assessment' }, { ...base, purpose: null }, { ...base, title_en: 'Exam: loss of air' }, { ...base, summary_en: 'Security response to an intruder at the protected area boundary.' },
    { ...base, events_en: 'Fail 1IA-PT-0101 low at minute 3' }, { ...base, title_en: 'Air' }, { ...base, summary_ar: 'قصير' }, { ...base, events_en: 'x'.repeat(601) }, { ...base, category: 'test' },
    { ...base, objective_ids: [] }, { ...base, objective_ids: ['so-a1', 'so-a1'] }, { ...base, objective_ids: ['so-zz'] }, { ...base, objective_ids: 'so-a1' }, { ...base, competency_ids: ['sa-01'] },
    { ...base, competency_ids: ['xx-99'] }, { ...base, competency_ids: null }, { ...base, positions: [] }, { ...base, positions: ['pilot'] }, { ...base, duration_min: 95 }, { ...base, duration_min: 600 },
    { ...base, duration_min: '90' }, { ...base, duration_min: 90.5 }, { ...base, fidelity: 'vr' }, { ...base, programmes: [] }, { ...base, programmes: ['exam'] },
    { ...base, objective_ids: ['so-n1', 'so-n2', 'so-n3', 'so-n4', 'so-a1', 'so-a2', 'so-a3', 'so-a4', 'so-a5', 'so-a6', 'so-a7', 'so-e1', 'so-e2'] },
    { ...base, objective_ids: ['so-n1', 'so-a3', 'so-a4', 'so-e1', 'so-e2', 'so-e7', 'so-s2', 'so-t1', 'so-t2', 'so-t3', 'so-t4'], competency_ids: ['rp-01', 'ch-01'] },
  ];
  let vdiff = 0;
  for (const c of cases) {
    const sql = (await db.query('select kafaa_sim_validate($1::jsonb) as r', [JSON.stringify(c)])).rows[0].r;
    const ts = S.validateScenario(c, { objectives, competencies: comps });
    const tsJ = ts.ok ? { ok: true, value: ts.value } : { ok: false, code: ts.code, key: ts.key };
    if (norm(sql) !== norm(tsJ)) { vdiff++; console.log('    validate mismatch:', JSON.stringify(c).slice(0, 120), JSON.stringify(sql), JSON.stringify(tsJ)); }
  }
  ok(vdiff === 0, `scenario validator: SQL equals TS on ${cases.length} inputs (normalisation, every refusal code)`);

  // ── RBAC + exam refusal + maker-checker (SQL path)
  const auditRefused = async (action) => Number((await db.query(`select count(*)::int n from kafaa_audit_events where action = $1 and outcome = 'refused'`, [action])).rows[0].n);
  const r0 = await auditRefused('sim.scenario.save');
  const exam = await rpc('k-instructor', 'kafaa_save_sim_scenario', [JSON.stringify({ ...base, purpose: 'exam' })], ['::jsonb']);
  ok(exam.ok === false && exam.code === 'exam_content' && (await auditRefused('sim.scenario.save')) === r0 + 1, 'creating a scenario with purpose = exam is refused with exam_content and audited');
  for (const p of ['sro', 'k-auditor', 'chco', 'k-ro']) {
    const r = await rpc(p, 'kafaa_save_sim_scenario', [JSON.stringify(base)], ['::jsonb']);
    ok(r.ok === false && r.code === 'forbidden', `${p} cannot write the scenario library (forbidden)`);
  }
  let anonDenied = false;
  try { await as(null, 'select kafaa_save_sim_scenario($1::jsonb)', [JSON.stringify(base)]); } catch { anonDenied = true; }
  ok(anonDenied, 'anonymous callers cannot execute the RPCs');
  const created = await rpc('k-instructor', 'kafaa_save_sim_scenario', [JSON.stringify({ ...base, submit: true })], ['::jsonb']);
  ok(created.ok && created.data.status === 'in_review' && created.data.revision === 1, 'an instructor creates and submits a scenario (in review, revision 1)');
  const row = (await db.query('select * from kafaa_sim_scenarios where id = $1', [created.data.id])).rows[0];
  ok(row.code.startsWith('SCN-') && row.positions.join(',') === 'ss,sro,ro' && row.programmes.join(',') === 'coct,loct' && row.competency_ids.join(',') === 'hu-01,pf-03', 'the stored row is normalised like the TS rules');
  const instrApprove = await rpc('k-instructor', 'kafaa_review_sim_scenario', [created.data.id, 'approve', null]);
  ok(instrApprove.code === 'forbidden', 'an instructor cannot approve (training manager A only)');
  const tmApprove = await rpc('training-mgr', 'kafaa_review_sim_scenario', [created.data.id, 'approve', null]);
  ok(tmApprove.ok && tmApprove.data.status === 'approved', 'the training manager approves a scenario someone else wrote');
  const rev = await rpc('training-mgr', 'kafaa_save_sim_scenario', [JSON.stringify({ ...base, id: created.data.id, summary_en: base.summary_en + ' Revised.', submit: true })], ['::jsonb']);
  ok(rev.ok && rev.data.revision === 2 && rev.data.status === 'in_review', 'revising an approved scenario creates revision 2 back in review');
  const self = await rpc('training-mgr', 'kafaa_review_sim_scenario', [created.data.id, 'approve', null]);
  ok(self.code === 'maker_checker', 'the author of a revision cannot approve it (maker_checker)');
  const ret = await rpc('training-mgr', 'kafaa_review_sim_scenario', [created.data.id, 'return', 'short']);
  ok(ret.code === 'invalid', 'returning needs a reason of at least 10 characters');
  const retire = await rpc('training-mgr', 'kafaa_review_sim_scenario', ['scn-019', 'retire', 'Replaced by a newer containment scenario.']);
  const after = await rpc('k-instructor', 'kafaa_save_sim_scenario', [JSON.stringify({ ...base, id: 'scn-019' })], ['::jsonb']);
  ok(retire.ok && after.code === 'retired', 'a retired scenario cannot be changed');

  // ── coverage: SQL gap count = TS gapCount for every seeded cycle; plan validator parity
  const sc = async () => new Map((await db.query('select * from kafaa_sim_scenarios')).rows.map((s) => [s.id, s]));
  const items = async (id) => (await db.query('select * from kafaa_sim_cycle_items where cycle_id = $1', [id])).rows;
  const cyc = async (id) => (await db.query('select * from kafaa_sim_cycles where id = $1', [id])).rows[0];
  let gdiff = 0;
  const gaps = {};
  for (const c of T.sim_cycles) {
    const sqlG = Number((await db.query('select kafaa_sim_gap_count($1) as g', [c.id])).rows[0].g);
    const tsG = S.gapCount(S.cycleCoverage(await cyc(c.id), await items(c.id), await sc()));
    gaps[c.id] = sqlG;
    if (sqlG !== tsG) gdiff++;
  }
  ok(gdiff === 0 && gaps['cyc-coct-2025-26'] === 2 && gaps['cyc-loct-2026-27'] === 0 && gaps['cyc-coct-2027-28'] > 10, `coverage gaps SQL = TS (COCT 2025-26: ${gaps['cyc-coct-2025-26']}, LOCT: ${gaps['cyc-loct-2026-27']}, COCT 2027-28: ${gaps['cyc-coct-2027-28']})`);
  const cov = S.cycleCoverage(await cyc('cyc-coct-2025-26'), await items('cyc-coct-2025-26'), await sc(), T.crew_debriefs);
  ok(cov.rows.filter((r) => r.status !== 'covered').map((r) => r.objective_id).join(',') === 'so-e6,so-s3', 'the coverage matrix flags the required objectives not covered in the cycle (ATWS, containment protection)');
  const planCases = [
    [{ scenario_id: 'scn-012', segment: 1 }, { scenario_id: 'scn-004', segment: 1 }], [{ scenario_id: 'scn-016', segment: 1 }], [{ scenario_id: 'scn-020', segment: 1 }],
    [{ scenario_id: 'scn-012', segment: 9 }], [{ scenario_id: 'scn-012', segment: 1 }, { scenario_id: 'scn-012', segment: 1 }], [{ scenario_id: 'scn-001', segment: 2 }, { scenario_id: 'scn-015', segment: 2 }, { scenario_id: 'scn-018', segment: 2 }, { scenario_id: 'scn-012', segment: 2 }, { scenario_id: 'scn-013', segment: 2 }],
    [{ scenario_id: 'nope', segment: 1 }], [{ segment: 1 }], 'x', [{ scenario_id: 'scn-012', segment: 1.5 }],
  ];
  let pdiff = 0;
  const c2728 = await cyc('cyc-coct-2027-28');
  for (const p of planCases) {
    const sql = (await db.query('select kafaa_sim_validate_plan($1::jsonb, c) as r from kafaa_sim_cycles c where c.id = $2', [JSON.stringify(p), 'cyc-coct-2027-28'])).rows[0].r;
    const ts = S.validatePlan(p, c2728, await sc());
    if (norm(sql) !== norm(ts.ok ? { ok: true, value: ts.value } : { ok: false, code: ts.code, key: ts.key })) { pdiff++; console.log('    plan mismatch', JSON.stringify(p), JSON.stringify(sql), JSON.stringify(ts)); }
  }
  ok(pdiff === 0, `plan validator: SQL equals TS on ${planCases.length} plans (draft scenario, wrong programme, segment range, duplicate, capacity)`);
  const plan = await rpc('k-instructor', 'kafaa_plan_cycle', [c2728.id, JSON.stringify([{ scenario_id: 'scn-012', segment: 1 }, { scenario_id: 'scn-004', segment: 1 }, { scenario_id: 'scn-013', segment: 2 }]), true], ['', '::jsonb', '']);
  const gapsNow = Number((await db.query('select kafaa_sim_gap_count($1) as g', [c2728.id])).rows[0].g);
  const removed = Number((await db.query(`select count(*)::int n from kafaa_sim_cycle_items where cycle_id = $1 and not active`, [c2728.id])).rows[0].n);
  ok(plan.ok && plan.data.status === 'submitted' && plan.data.gaps === gapsNow && removed === 1, 'planCycle replaces the plan (removed items kept inactive), submits it and returns the gap count');
  const noNote = await rpc('training-mgr', 'kafaa_approve_cycle', [c2728.id, null]);
  const withNote = await rpc('training-mgr', 'kafaa_approve_cycle', [c2728.id, 'Remaining segments are planned next quarter.']);
  ok(noNote.code === 'coverage_gaps' && withNote.ok && withNote.data.status === 'approved', 'approving a cycle with gaps needs a reason; then it is approved');
  const loctSelf = await rpc('k-instructor', 'kafaa_approve_cycle', ['cyc-loct-2026-27', null]);
  const loct = await rpc('training-mgr', 'kafaa_approve_cycle', ['cyc-loct-2026-27', null]);
  ok(loctSelf.code === 'forbidden' && loct.ok && loct.data.gaps === 0, 'instructors cannot approve; the submitted LOCT plan (no gaps) is approved without a note');
  await rpc('training-mgr', 'kafaa_plan_cycle', ['cyc-coct-2027-28', JSON.stringify([{ scenario_id: 'scn-012', segment: 1 }]), true], ['', '::jsonb', '']);
  const mc = await rpc('training-mgr', 'kafaa_approve_cycle', ['cyc-coct-2027-28', 'Remaining segments are planned next quarter.']);
  ok(mc.code === 'maker_checker', 'the planner of a cycle cannot approve it (maker_checker)');

  // ── crew debriefs (SQL path): evidence only for crew present in the booked slot
  await db.query(`insert into kafaa_simulator_slots (id, simulator, starts_at, ends_at, crew, booking_kind, priority, status, booked_by) values
    ('sim-w4e3-b', 'FSS-1', date_trunc('day', now()) - interval '1 day' + interval '7 hours', date_trunc('day', now()) - interval '1 day' + interval '15 hours', 'B', 'coct', 1, 'booked', 'p-k-instructor'),
    ('sim-w4e3-free', 'FSS-2', now() - interval '2 days', now() - interval '2 days' + interval '8 hours', 'D', 'free', 3, 'free', 'p-k-instructor'),
    ('sim-w4e3-next', 'FSS-2', now() + interval '2 days', now() + interval '2 days' + interval '8 hours', 'B', 'coct', 1, 'booked', 'p-k-instructor') on conflict do nothing`);
  const slot = (await db.query(`select * from kafaa_simulator_slots where id = 'sim-w4e3-b'`)).rows[0];
  const people = (await db.query('select id, crew, kind, status, job_role_id from kafaa_people')).rows;
  const roster = S.crewRoster(slot, people);
  ok(roster.length >= 6 && roster.some((r) => r.person_id === 'p-k-ro') && roster.some((r) => r.person_id === 'p-sro'), `crew B roster: ${roster.length} members`);
  const ratings = { communication: 4, procedure_use: 3, diagnosis: 2, leadership: 5 };
  const att = roster.map((r) => ({ person_id: r.person_id, present: r.person_id !== 'w-lo-07' }));
  const input = { slot_id: 'sim-w4e3-b', scenario_id: 'scn-012', cycle_id: null, attendance: att, ratings, self_ratings: { communication: 5, procedure_use: 4, diagnosis: 3, leadership: 4 }, strengths: 'Clear focus briefs.', improvements: 'Verify a second indication.', critique: 'We rushed the first diagnosis.', lang: 'en' };
  const deb = (p, i) => rpc(p, 'kafaa_record_debrief', [JSON.stringify(i)], ['::jsonb']);
  ok((await deb('sro', input)).code === 'forbidden', 'a line manager cannot record a debrief (instructors only)');
  ok((await deb('k-instructor', { ...input, attendance: [...att, { person_id: 'w-ro-03', present: true }] })).code === 'not_in_slot', 'naming someone outside the booked crew is refused (not_in_slot)');
  ok((await deb('k-instructor', { ...input, slot_id: 'sim-w4e3-next' })).code === 'slot_not_started', 'a future slot cannot be debriefed yet');
  ok((await deb('k-instructor', { ...input, slot_id: 'sim-w4e3-free' })).code === 'slot_not_booked', 'a free slot has no crew to debrief');
  ok((await deb('k-instructor', { ...input, scenario_id: 'scn-016' })).code === 'scenario_not_approved', 'only approved scenarios are debriefed');
  ok((await deb('k-instructor', { ...input, critique: 'Like the licensing exam' })).code === 'exam_content', 'debrief notes are content-checked too');
  ok((await deb('k-instructor', { ...input, ratings: { ...ratings, diagnosis: 6 } })).code === 'invalid_ratings', 'ratings must be 1 to 5 for all four team competencies');
  ok((await deb('k-instructor', { ...input, attendance: att.map((a) => ({ ...a, present: false })) })).code === 'no_attendees', 'at least one crew member must be present');
  const d = await deb('k-instructor', input);
  const present = att.filter((a) => a.present).map((a) => a.person_id);
  ok(d.ok && d.data.present === present.length && d.data.absent === 1 && d.data.statements === present.length, `debrief recorded: ${d.data?.present} present, ${d.data?.absent} absent, ${d.data?.evidence} evidence rows`);
  const ev = (await db.query(`select * from kafaa_skill_evidence where ref_table = 'crew_debrief_members' and ref_id like $1 order by id`, [`${d.data.id}:%`])).rows;
  ok(ev.length === d.data.evidence && ev.every((e) => present.includes(e.person_id)) && !ev.some((e) => e.person_id === 'w-lo-07'), 'evidence is written only for crew members present in the booked slot (none for the absent member)');
  ok(ev.every((e) => e.kind === 'ojt' && e.basis === 'evidenced' && e.level >= 2 && e.level <= 3) && !ev.some((e) => e.skill_id === 'sk-pf-03'), 'evidence is ojt / evidenced (never verified), level 2-3; the below-standard diagnosis rating gives none');
  const heldOn = new Date(slot.starts_at).toISOString().slice(0, 10);
  const scen = (await db.query(`select * from kafaa_sim_scenarios where id = 'scn-012'`)).rows[0];
  const tsEv = present.flatMap((p) => S.debriefEvidence(S.debriefMemberId(d.data.id, p), p, ratings, heldOn, 'p-k-instructor', scen.title_en)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const strip = (e) => ({ id: e.id, person_id: e.person_id, skill_id: e.skill_id, level: e.level, basis: e.basis, note: e.note, observed_on: String(e.observed_on instanceof Date ? e.observed_on.toISOString() : e.observed_on).slice(0, 10) });
  ok(norm(ev.map(strip)) === norm(tsEv.map(strip)), 'evidence rows: SQL equals TS debriefEvidence');
  const drow = (await db.query('select * from kafaa_crew_debriefs where id = $1', [d.data.id])).rows[0];
  const members = (await db.query('select * from kafaa_crew_debrief_members where debrief_id = $1 order by id', [d.data.id])).rows;
  const tsSt = S.debriefStatements({ id: d.data.id, slot_id: 'sim-w4e3-b', scenario_id: 'scn-012', cycle_id: null, crew: 'B', held_on: heldOn, ratings }, members.map((m) => ({ person_id: m.person_id, position: m.position, present: m.present })));
  ok(norm(drow.xapi) === norm(tsSt) && drow.source === 'kafaa', 'xAPI statements: SQL equals TS debriefStatements (one per present member, no names or free text)');
  const states = (await db.query(`select * from kafaa_person_skills where person_id = 'p-sro' and skill_id = 'sk-ld-01'`)).rows[0];
  ok(states && states.reasons.some((r) => r.evidence_id === `se:ojt:${d.data.id}:p-sro:sk-ld-01`), 'the F01 recompute folds the new evidence into the skill state (p-sro, leadership)');
  ok((await deb('k-instructor', input)).code === 'already_recorded', 'a scenario is debriefed once per slot');

  // ── RLS and the simDebriefs read RPC
  ok((await count('sro', 'kafaa_crew_debriefs')) === 0 && (await count('training-mgr', 'kafaa_crew_debriefs')) > 100 && (await count('k-auditor', 'kafaa_crew_debriefs')) > 100, 'debrief headers: sat only (training manager, auditor), not managers');
  ok((await count('k-ro', 'kafaa_crew_debrief_members', `person_id <> 'p-k-ro'`)) === 0 && (await count('k-ro', 'kafaa_crew_debrief_members')) > 0, 'a crew member reads only their own member rows');
  ok((await count('sro', 'kafaa_crew_debrief_members', `crew <> 'B'`)) === 0 && (await count('sro', 'kafaa_crew_debrief_members', `crew = 'B'`)) > 20, 'the crew B shift manager reads crew B member rows only (Scope)');
  ok((await count('k-ro', 'kafaa_sim_scenarios')) === 0 && (await count('sro', 'kafaa_sim_scenarios')) > 20 && (await count(null, 'kafaa_sim_scenarios')) === 0, 'the library is for training staff: employees and anonymous read none');
  const kro = await rpc('k-ro', 'kafaa_sim_debriefs', []);
  const sroV = await rpc('sro', 'kafaa_sim_debriefs', []);
  const ins = await rpc('k-instructor', 'kafaa_sim_debriefs', []);
  const chco = await rpc('chco', 'kafaa_sim_debriefs', []);
  ok(kro.length > 0 && kro.every((x) => x.mine && x.crew === 'B') && sroV.every((x) => x.crew === 'B') && ins.length === T.crew_debriefs.length + 1 && chco.length === 0,
    `simDebriefs: k-ro sees own (${kro.length}), the crew B manager crew B (${sroV.length}), instructors all (${ins.length}), HR none`);
  const sNo = await rpc('training-mgr', 'kafaa_sim_debriefs', []);
  ok(sNo[0].id === d.data.id && sNo[0].members.length === roster.length, 'simDebriefs lists the newest first with its members');
  let directW = false;
  try { await as('k-instructor', `update kafaa_sim_scenarios set status = 'approved' where id = 'scn-016'`); directW = (await db.query(`select status from kafaa_sim_scenarios where id = 'scn-016'`)).rows[0].status === 'approved'; } catch { directW = false; }
  ok(!directW, 'no direct writes: status changes only through the RPCs');
}
