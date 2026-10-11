// [FS wave D · E1 · FS27 + FS28] PGlite checks for 20261010241001_kafaa_fs41_future_gigs_secondments.sql: SQL = TS parity (envelope
// validation, channel rule, envelope fit for every seeded envelope x future gig, HR stats, secondment / close / tag validation, secondment
// stats), RLS on the new tables, and the acceptance criteria as RPC flows:
//  FS27  at least 12 open future gigs across the 5 channels · an approved envelope lets an application skip the per-gig release while within
//        its limit (and only then) · completion writes evidence through the F08 path · maker-checker on the envelope.
//  FS28  at least 3 future-role templates published · closing a secondment creates the knowledge-capture task (due within 60 days of return)
//        · no security-area placement is offered (refused and audited).
import { readFileSync } from 'node:fs';
import { CHANNELS, channelProblem, computeFutureStats, envelopeFit, validateEnvelope, openPeriods } from '../../src/modules/m20/futureGigs.ts';
import { secondmentStats, validateClose, validateSecondment, validateTag } from '../../src/modules/m20/secondment.ts';

export default async function fs41Checks({ db, as, count, ok, uid }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  let n = 4100;
  const ROLE = { 'k-ro': 'Reactor Operator', sro: 'Shift Manager · licensed SRO', 'sme-reviewer': 'SME reviewer', 'ops-ceo': 'Operations CEO', 'outage-planner': 'Outage Planner', 'outage-manager': 'Outage Manager',
    'cap-coord': 'CAP coordinator', 'cap-chair': 'CAP chair', 'fuel-pm': 'Fuel PM', nse: 'NSE', cpo: 'CPO', 'sec-compliance': 'Security compliance', 'group-cfo': 'Group CFO', dra: 'Director Regulatory Affairs', 'chem-sup': 'Chemistry Supervisor', 'head-sq': 'Head of Supplier Quality', 'rp-lead': 'RP lead', 'work-control': 'Work Control' };
  for (const [persona, role] of Object.entries(ROLE)) {
    if (uid[persona]) continue;
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  console.log('FS41 · FS27 future-skills gigs and time envelopes · FS28 future-role rotations and secondments');
  const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
  const today = (await q('select current_date::text as d'))[0].d;
  const plus = (d, k) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); };
  const rows = async (table) => (await q(`select to_jsonb(x) j from ${table} x`)).map((r) => r.j);
  const rpc = async (persona, sql, p = []) => (await as(persona, sql, p))[0].r;

  // ── acceptance (seed)
  const opps = await rows('kafaa_opportunities');
  const openFuture = opps.filter((o) => o.channel && o.status === 'open' && o.listed).sort((a, b) => (a.id < b.id ? -1 : 1));
  ok(openFuture.length >= 12 && CHANNELS.every((c) => openFuture.some((o) => o.channel === c)), `FS27 AC1: ${openFuture.length} open future gigs across all 5 channels`);
  const tpls = await rows('kafaa_rotation_templates');
  const fut = tpls.filter((t) => t.future_track && t.status === 'active' && t.listed);
  ok(fut.length >= 3 && fut.some((t) => t.future_track === 'advance_study' && t.career_level_only), `FS28 AC1: ${fut.length} future-role templates published (ADVANCE study is career-level only)`);
  ok(fut.every((t) => t.steps.every((s) => !['security', 'cyber', 'safeguards'].includes(s.family_id))) && (await rows('kafaa_secondments')).every((s) => !['security', 'cyber', 'safeguards'].includes(s.person_family_id ?? '')),
    'FS28 AC3: no seeded rotation step or secondment is in a security, cyber or safeguards family');
  ok((await count('k-ro', 'kafaa_rotation_templates', 'future_track is not null')) === fut.length, 'staff read the published future-role templates (drafts stay with their owner)');

  // ── RLS
  ok((await count(null, 'kafaa_time_envelopes')) === 0 && (await count(null, 'kafaa_secondments')) === 0, 'anonymous visitors read no envelopes or secondments');
  ok((await count('k-ro', 'kafaa_time_envelopes')) === T.time_envelopes.filter((e) => e.person_id === 'p-k-ro').length, 'a person reads only their own envelopes');
  ok((await count('ops-ceo', 'kafaa_time_envelopes')) === T.time_envelopes.filter((e) => [e.person_id, e.line_manager_id].includes('p-ops-ceo')).length, 'a line manager reads the envelopes of their reports');
  ok((await count('k-auditor', 'kafaa_time_envelopes')) === T.time_envelopes.length && (await count('k-auditor', 'kafaa_secondments')) === T.secondments.length, 'auditors read all envelopes and secondments');
  ok((await count('chco', 'kafaa_secondments')) === T.secondments.filter((s) => [s.person_id, s.line_manager_id].includes('p-chco')).length, 'HR reads secondments through the desk RPC, not the table');
  let direct = false;
  try { await as('k-ro', `insert into kafaa_time_envelopes (id, person_id, pct, cap_hours, period, starts_on, ends_on) values ('x', 'p-k-ro', 20, 8, '2026-Q4', '2026-10-01', '2026-12-31')`); } catch { direct = true; }
  ok(direct, 'envelopes cannot be written directly (RPC only)');

  // ── parity: validation rules
  const [cur, next] = openPeriods(today);
  const eb = { pct: 10, period: cur, channels: ['ai_pilot', 'data_cleanup'], reason: 'I want to practise governed AI checks.' };
  const envs = [eb, { ...eb, pct: 12 }, { ...eb, pct: '10' }, { ...eb, pct: 20, period: next }, { ...eb, period: '2025-Q1' }, { ...eb, period: 'Q4' }, { ...eb, channels: [] }, { ...eb, channels: ['ai_pilot', 'ai_pilot'] },
    { ...eb, channels: ['security'] }, { ...eb, channels: [...CHANNELS] }, { ...eb, reason: 'short' }, { ...eb, reason: 'x'.repeat(401) }, { ...eb, reason: 42 }, { ...eb, channels: 'ai_pilot' }, { ...eb, pct: null }];
  let ed = 0;
  for (const p of envs) { const s = (await q('select kafaa_fs27_validate_envelope($1::jsonb, current_date) v', [JSON.stringify(p)]))[0].v; if (canon(s) !== canon(validateEnvelope(p, today))) { ed++; if (ed === 1) console.log('    envelope diff', JSON.stringify(p), canon(s), canon(validateEnvelope(p, today))); } }
  ok(ed === 0, `envelope request validation: SQL = TS for ${envs.length} inputs`);
  const chans = [[null, ['sk-co-01']], ['ai_pilot', ['sk-fs-ai-verify']], ['ai_pilot', ['sk-co-01']], ['quantum', ['sk-fs-ai-verify']], ['data_cleanup', ['sk-fs-dp-paperwp']], ['advance_study', ['sk-fs-adv-smr', 'sk-co-01']], ['', []]];
  let cd = 0;
  for (const [c, g] of chans) if (canon((await q('select kafaa_fs27_channel_problem($1, $2::text[]) v', [c, g]))[0].v) !== canon(channelProblem(c, g, T.skills))) cd++;
  ok(cd === 0, `future-gig channel rule: SQL = TS for ${chans.length} inputs (unknown channel, no future skill, obsolete skill)`);

  // ── parity: envelope fit for every person with an envelope x every future gig
  const apps = await rows('kafaa_opportunity_applications');
  const envRows = await rows('kafaa_time_envelopes');
  const gigs = new Map(opps.map((o) => [o.id, o]));
  let fd = 0; let fn = 0; const codes = new Set();
  for (const pid of [...new Set(envRows.map((e) => e.person_id))]) for (const o of openFuture) {
    const s = (await q('select kafaa_fs27_envelope_fit($1, $2, current_date) v', [pid, o.id]))[0].v;
    const t = envelopeFit(pid, o, envRows, apps, gigs, today);
    fn++; codes.add(t.code);
    if (canon(s) !== canon(t)) { fd++; if (fd === 1) console.log('    fit diff', pid, o.id, canon(s), canon(t)); }
  }
  ok(fd === 0 && ['fits', 'no_envelope', 'poster_is_approver', 'over_limit'].every((c) => codes.has(c)), `envelope fit: SQL = TS for ${fn} person x gig pairs (fits, no envelope, poster is approver, over limit all covered)`);
  const ev = (await q(`select count(*)::int n from kafaa_skill_evidence e where e.kind = 'ojt' and e.ref_table = 'opportunity_applications' and e.active and exists (select 1 from kafaa_opportunity_applications a join kafaa_opportunities o on o.id = a.opportunity_id where a.id = e.ref_id and o.channel is not null)`))[0].n;
  ok(canon((await q('select kafaa_fs27_stats_compute() s'))[0].s) === canon(computeFutureStats(opps, apps, envRows, ev)), 'future-gig HR stats: SQL = TS on the seed');
  const st = (await rpc('chco', 'select kafaa_future_gig_stats() r'));
  ok(st && st.open_future >= 12 && st.envelopes.suppressed === false && (await rpc('k-ro', 'select kafaa_future_gig_stats() r')) === null, 'HR reads the future-gig stats (unsuppressed at 10+ people); staff get nothing');

  // ── parity: FS28 validation and stats
  const orgs = T.organisations.map((o) => o.id);
  const sb = { person_id: 'p-nse', host_kind: 'university', host_org_id: 'ku', host_name_en: 'Khalifa University lab', host_name_ar: 'مختبر جامعة خليفة', host_country: 'AE', supervisor_en: 'Lab director (host role)', supervisor_ar: 'مدير المختبر (دور مضيف)',
    objectives: [{ skill_id: 'sk-fs-ai-dataeng', level: 2, text_en: 'Build a data pipeline', text_ar: 'بناء مسار بيانات' }], future_role_id: 'fr-digital-twin', track: 'data_office', start_on: plus(today, 20), months: 6 };
  const secs = [sb, { ...sb, person_id: 'p-sec-compliance' }, { ...sb, objectives: [{ skill_id: 'sk-sa-01', level: 1, text_en: 'Security work', text_ar: 'عمل أمني' }] }, { ...sb, future_role_id: 'security-officer' }, { ...sb, person_id: 'p-nope' },
    { ...sb, host_kind: 'agency' }, { ...sb, host_country: 'uae' }, { ...sb, host_name_ar: 'x' }, { ...sb, supervisor_en: '' }, { ...sb, objectives: [] }, { ...sb, objectives: [{ ...sb.objectives[0], level: 4 }] },
    { ...sb, objectives: [sb.objectives[0], sb.objectives[0]] }, { ...sb, start_on: plus(today, -1) }, { ...sb, start_on: plus(today, 400) }, { ...sb, months: 25 }, { ...sb, months: 2.5 }, { ...sb, start_on: '2026-02-30' },
    { ...sb, host_org_id: 'nope' }, { ...sb, future_role_id: 'nope' }, { ...sb, track: 'space' }, { ...sb, host_org_id: null, future_role_id: '', track: null }, { ...sb, objectives: [null] }];
  let sd = 0;
  for (const p of secs) { const s = (await q('select kafaa_fs28_validate_secondment($1::jsonb, current_date) v', [JSON.stringify(p)]))[0].v; const t = validateSecondment(p, { people: T.people, skills: T.skills, roles: T.job_roles, orgs }, today); if (canon(s) !== canon(t)) { sd++; if (sd === 1) console.log('    secondment diff', JSON.stringify(p).slice(0, 160), canon(s), canon(t)); } }
  ok(sd === 0, `secondment validation: SQL = TS for ${secs.length} inputs (restricted person, skill and role refused first)`);
  const tags = [{ template_id: 'x', track: 'digital_twin', future_role_ids: ['fr-digital-twin'] }, { template_id: 'x', track: null, future_role_ids: [] }, { template_id: 'x', track: 'space', future_role_ids: [] },
    { template_id: 'x', track: 'data_office', future_role_ids: ['cyber-security-engineer'] }, { template_id: 'x', track: 'data_office', future_role_ids: ['a', 'b', 'c', 'd', 'e'] }, { template_id: 'x', track: 'data_office', future_role_ids: ['fr-digital-twin', 'fr-digital-twin'] }, { template_id: 'x', track: 'data_office', future_role_ids: 'fr-x' }];
  let td = 0;
  for (const p of tags) if (canon((await q('select kafaa_fs28_validate_tag($1::jsonb) v', [JSON.stringify(p)]))[0].v) !== canon(validateTag(p, T.job_roles))) td++;
  ok(td === 0, `future-rotation tag validation: SQL = TS for ${tags.length} inputs`);
  const live = T.secondments.find((s) => s.status === 'planned' && s.start_on <= today);
  const closes = [['return', { returned_on: today, outcome_note: 'Back with three lessons for the team.', met: Object.fromEntries(live.objectives.map((o) => [o.id, true])) }], ['return', { returned_on: plus(today, 1), outcome_note: 'Back with lessons.', met: {} }],
    ['return', { returned_on: today, outcome_note: 'short', met: {} }], ['return', { returned_on: today, outcome_note: 'Back with three lessons.', met: { o1: 'yes' } }], ['return', { returned_on: today, outcome_note: 'Back with three lessons.', met: { ...Object.fromEntries(live.objectives.map((o) => [o.id, true])), o9: true } }],
    ['cancel', { outcome_note: 'Host postponed' }], ['cancel', { outcome_note: 'no' }], ['archive', {}], ['return', { returned_on: plus(today, -45), outcome_note: 'Back with three lessons.', met: {} }]];
  let cl = 0;
  for (const [d, p] of closes) if (canon((await q('select kafaa_fs28_validate_close(s, $2, $3::jsonb, current_date) v from kafaa_secondments s where id = $1', [live.id, d, JSON.stringify(p)]))[0].v) !== canon(validateClose(live, d, p, today))) cl++;
  ok(cl === 0, `secondment close validation: SQL = TS for ${closes.length} inputs`);
  const sessions = new Map((await rows('kafaa_capture_sessions')).map((c) => [c.id, c]));
  ok(canon((await q('select kafaa_fs28_stats(current_date) s'))[0].s) === canon(secondmentStats(await rows('kafaa_secondments'), sessions, today)), 'secondment stats (phases, transfer obligations, suppressed host cells): SQL = TS on the seed');
  const desk = await rpc('k-hr-analyst', 'select kafaa_secondment_desk() r');
  ok(desk && desk.rows.length === T.secondments.length && desk.can_edit === true && (await rpc('k-ro', 'select kafaa_secondment_desk() r')) === null && (await rpc('k-auditor', 'select kafaa_secondment_desk() r')).can_edit === false,
    'the HR desk lists every secondment; auditors read it without edit; staff get nothing');
  ok((await rpc('k-ro', 'select kafaa_secondment_overview() r')).total === T.secondments.length && (await rpc(null, 'select kafaa_secondment_overview() r').catch(() => null)) == null, 'staff see the suppressed overview; anonymous visitors cannot call it');

  // The flows run in a transaction that is rolled back, so the validators after this one see the seed unchanged.
  await db.exec('begin');
  try {
  // ── flows: FS27 envelope request -> approve (maker-checker) -> apply inside the envelope (no per-gig release) -> select -> complete (F08 evidence)
  // A fresh person (cpo's report nse) asks for this quarter.
  const req = await rpc('nse', 'select kafaa_request_envelope($1::jsonb) r', [JSON.stringify({ pct: 10, period: cur, channels: ['ai_pilot', 'data_cleanup', 'digital_innovation'], reason: 'Supplier data clean-up and AI checks.' })]);
  ok(req.ok && req.data.line_manager_id === 'p-cpo' && req.data.cap_hours === 4, 'a staff member asks once for a time envelope; it goes to their line manager of record');
  ok((await rpc('nse', 'select kafaa_request_envelope($1::jsonb) r', [JSON.stringify({ pct: 10, period: cur, channels: ['ai_pilot'], reason: 'Second request for the quarter.' })])).code === 'conflict', 'one live envelope per quarter');
  ok((await rpc('nse', 'select kafaa_approve_envelope($1, $2) r', [req.data.id, 'approve'])).code === 'maker_checker', 'maker-checker: nobody approves their own envelope');
  ok((await rpc('ops-ceo', 'select kafaa_approve_envelope($1, $2) r', [req.data.id, 'approve'])).code === 'not_found' && (await rpc('cap-chair', 'select kafaa_approve_envelope($1, $2) r', [req.data.id, 'approve'])).code === 'not_found',
    'a manager who is not the line manager cannot see or approve it');
  ok((await rpc('cpo', 'select kafaa_approve_envelope($1, $2, $3) r', [req.data.id, 'decline', 'no'])).code === 'invalid', 'declining needs a reason');
  const appr = await rpc('cpo', 'select kafaa_approve_envelope($1, $2) r', [req.data.id, 'approve']);
  ok(appr.ok, 'the line manager approves the envelope once (ledger row)');
  const gig = openFuture.find((o) => o.channel === 'ai_pilot' && o.hours_week <= 4 && o.posted_by !== 'p-cpo' && (o.eligible_families ?? []).length === 0);
  const ap = await rpc('nse', 'select kafaa_apply_opportunity($1, $2) r', [gig.id, 'Inside my envelope.']);
  const row = (await q('select * from kafaa_opportunity_applications where id = $1', [ap.data.id]))[0];
  ok(ap.ok && row.status === 'released' && row.envelope_id === req.data.id && row.released_by === 'p-cpo' && ap.data.envelope_id === req.data.id, 'FS27 AC2: an application inside the approved envelope skips the per-gig release (released at once)');
  const over = openFuture.find((o) => ['ai_pilot', 'data_cleanup', 'digital_innovation'].includes(o.channel) && o.id !== gig.id && o.posted_by !== 'p-cpo' && o.hours_week + gig.hours_week > 4);
  const ap2 = await rpc('nse', 'select kafaa_apply_opportunity($1, $2) r', [over.id, '']);
  ok(ap2.ok && (await q('select status, envelope_id from kafaa_opportunity_applications where id = $1', [ap2.data.id]))[0].status === 'applied' && ap2.data.envelope_id === null,
    'FS27 AC2: beyond the envelope limit the ordinary per-gig release applies');
  const plain = opps.find((o) => !o.channel && o.status === 'open' && (o.eligible_families ?? []).length === 0 && o.posted_by !== 'p-cpo' && !apps.some((a) => a.person_id === 'p-nse' && a.opportunity_id === o.id));
  ok((await rpc('nse', 'select kafaa_apply_opportunity($1, $2) r', [plain.id, ''])).data.envelope_id === null, 'gigs outside the future-skills channels always need the per-gig release');
  const posterRole = Object.entries(ROLE).find(([k]) => `p-${k}` === gig.posted_by)?.[0] ?? ({ 'p-training-mgr': 'training-mgr' })[gig.posted_by];
  if (posterRole) {
    const sel = await rpc(posterRole, 'select kafaa_select_applicant($1, $2) r', [ap.data.id, 'selected']);
    const fin = await rpc(posterRole, 'select kafaa_complete_opportunity($1, $2::jsonb, $3) r', [ap.data.id, JSON.stringify({ [gig.skills_gained[0]]: 2 }), 'Checked 40 AI suggestions and logged every error.']);
    const evs = await q(`select * from kafaa_skill_evidence where ref_table = 'opportunity_applications' and ref_id = $1`, [ap.data.id]);
    ok(sel.ok && fin.ok && evs.length === 1 && evs[0].kind === 'ojt' && evs[0].skill_id === gig.skills_gained[0] && evs[0].basis === 'evidenced', 'FS27 AC3: completing a future gig writes ojt evidence against the posted skill (existing F08 path)');
  } else ok(false, `no test persona for poster ${gig.posted_by}`);
  ok((await rpc('nse', 'select kafaa_approve_envelope($1, $2) r', [req.data.id, 'withdraw'])).ok, 'the person can withdraw an approved envelope');
  // posting a future gig
  const post = (extra) => rpc('ops-ceo', 'select kafaa_post_opportunity($1::jsonb) r', [JSON.stringify({ kind: 'project', title_en: 'AI pilot review', title_ar: 'مراجعة تجربة الذكاء', summary_en: 'Review AI suggestions against records.', summary_ar: 'مراجعة اقتراحات الذكاء الاصطناعي مقابل السجلات.',
    skills_needed: [], skills_gained: ['sk-fs-ai-verify'], hours_week: 2, start_on: plus(today, 7), end_on: plus(today, 60), seats: 1, location_type: 'office', ...extra })]);
  const pg = await post({ channel: 'ai_pilot' });
  ok(pg.ok && (await q('select channel from kafaa_opportunities where id = $1', [pg.data.id]))[0].channel === 'ai_pilot', 'a manager posts a future gig in a channel');
  ok((await post({ channel: 'ai_pilot', skills_gained: ['sk-co-01'] })).code === 'invalid' && (await post({ channel: 'moonshot' })).code === 'invalid', 'a future gig must name a known channel and grow a future skill');

  // ── flows: FS28
  const tagSec = await rpc('chco', 'select kafaa_tag_future_rotation($1::jsonb) r', [JSON.stringify({ template_id: 'rt-cross-ops-eng', track: 'data_office', future_role_ids: ['cyber-security-engineer'] })]);
  const tagOk = await rpc('chco', 'select kafaa_tag_future_rotation($1::jsonb) r', [JSON.stringify({ template_id: 'rt-cross-ops-eng', track: 'advance_study', future_role_ids: ['fr-owners-engineer'] })]);
  ok(tagSec.code === 'restricted_kind' && tagOk.ok && (await q(`select career_level_only from kafaa_rotation_templates where id = 'rt-cross-ops-eng'`))[0].career_level_only === true
    && (await rpc('k-ro', 'select kafaa_tag_future_rotation($1::jsonb) r', [JSON.stringify({ template_id: 'rt-cross-ops-eng', track: null, future_role_ids: [] })])).code === 'forbidden',
    'programme owners tag future-role rotations (ADVANCE = career level only); security roles refused; staff cannot tag');
  await rpc('chco', 'select kafaa_tag_future_rotation($1::jsonb) r', [JSON.stringify({ template_id: 'rt-cross-ops-eng', track: null, future_role_ids: [] })]);
  const auditBefore = (await q(`select count(*)::int n from kafaa_audit_events where action = 'secondment.plan' and outcome = 'refused'`))[0].n;
  const restricted = await rpc('chco', 'select kafaa_plan_secondment($1::jsonb) r', [JSON.stringify({ ...sb, person_id: 'p-sec-compliance' })]);
  ok(restricted.code === 'restricted_kind' && (await q(`select count(*)::int n from kafaa_audit_events where action = 'secondment.plan' and outcome = 'refused'`))[0].n === auditBefore + 1, 'FS28 AC3: a security-area secondment is refused and audited');
  ok((await rpc('k-ro', 'select kafaa_plan_secondment($1::jsonb) r', [JSON.stringify(sb)])).code === 'forbidden', 'only HR plans secondments');
  const plan = await rpc('chco', 'select kafaa_plan_secondment($1::jsonb) r', [JSON.stringify(sb)]);
  ok(plan.ok && plan.data.line_manager_id === 'p-cpo' && (await rpc('chco', 'select kafaa_plan_secondment($1::jsonb) r', [JSON.stringify(sb)])).code === 'conflict', 'HR plans a secondment (line manager recorded); overlapping dates are refused');
  ok((await count('nse', 'kafaa_secondments', `id = '${plan.data.id}'`)) === 1 && (await count('cpo', 'kafaa_secondments', `id = '${plan.data.id}'`)) === 1, 'the person and their line manager read the secondment');
  const close = await rpc('chco', 'select kafaa_close_secondment($1, $2, $3::jsonb) r', [live.id, 'return', JSON.stringify({ returned_on: today, outcome_note: 'Back with three lessons for the team.', met: Object.fromEntries(live.objectives.map((o) => [o.id, true])) })]);
  const cs = (await q('select * from kafaa_capture_sessions where id = $1', [close.data?.capture_session_id]))[0];
  const dueDays = Math.round((Date.parse(close.data?.transfer_due_on) - Date.parse(today)) / 86_400_000);
  ok(close.ok && cs && cs.sme_id === live.person_id && cs.interviewer_id === live.line_manager_id && cs.status === 'planned' && String(cs.planned_on instanceof Date ? cs.planned_on.toISOString().slice(0, 10) : cs.planned_on) <= String(close.data.transfer_due_on) && dueDays === 60,
    'FS28 AC2: closing a secondment creates the knowledge-capture session, due within 60 days of return');
  ok((await count(live.person_id === 'p-fuel-pm' ? 'fuel-pm' : 'k-auditor', 'kafaa_capture_sessions', `id = '${cs?.id}'`)) === 1, 'the returning person sees the capture session in the knowledge studio');
  ok((await rpc('chco', 'select kafaa_close_secondment($1, $2, $3::jsonb) r', [live.id, 'cancel', JSON.stringify({ outcome_note: 'Too late now' })])).code === 'invalid', 'a closed secondment cannot be closed again');

  } finally { await db.exec('rollback'); }

  // ── grants
  const g = await q(`select p.proname, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u from pg_proc p where p.proname like 'kafaa_fs27_%' or p.proname like 'kafaa_fs28_%'
    or p.proname in ('kafaa_request_envelope', 'kafaa_approve_envelope', 'kafaa_future_gig_stats', 'kafaa_tag_future_rotation', 'kafaa_plan_secondment', 'kafaa_close_secondment', 'kafaa_secondment_desk', 'kafaa_secondment_overview')`);
  ok(g.every((r) => !r.a) && g.filter((r) => r.u).length === 8, `grants: anon executes none of the ${g.length} FS41 functions; authenticated executes only the 8 RPCs`);
}
