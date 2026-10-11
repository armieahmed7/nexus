// [W2 · E2] PGlite checks for 20261009122001_kafaa_w2e2_conversations.sql (F12 Career conversations): SQL = TS parity of the
// preparation and action checks, the agenda builder (every staff member), cadence and the HR aggregates; RLS (private drafts,
// manager of record, no HR or auditor rows); the RPC flow prepare → share → record → acknowledge with every F12 acceptance case.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export default async function w2e2Checks({ db, as, one, count, ok, uid }) {
  const C = await import('../../src/modules/m18/conversations.ts');
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const now = seed.meta.demo_today;
  // test identities (disjoint uid range 1221+)
  let n = 1220;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['qc-inspector', 'QC Inspector'], ['head-sq', 'Head of Supplier Quality'], ['outage-manager', 'Outage Manager'], ['outage-planner', 'Outage Planner'], ['nse', 'Specification Engineer'], ['buyer', 'Buyer']]) {
    const row = (await db.query('select user_id from profiles where persona_id = $1', [persona])).rows[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  const norm = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));

  // ── parity on a fresh database (pristine seed)
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const q1 = async (sql, params) => (await fresh.query(sql, params)).rows[0];

  // preparation and action checks
  const preps = [
    [{}, false], [{}, true], [{ aspirations: ['lead'], goal_12m: 'Lead a crew task' }, true], [{ aspirations: ['lead', 'lead', 'specialise'], goal_12m: '  Grow  ', support: ['time', 'course'] }, true],
    [{ aspirations: ['x'] }, false], [{ aspirations: ['lead', 'specialise', 'stay_deepen', 'move_lateral'] }, false], [{ mobility: 'mars' }, false], [{ mobility: 'any', leadership: 'ready', shift_ok: true }, false],
    [{ shift_ok: 'yes' }, false], [{ include: { coach: false, roadmap: null } }, false], [{ include: [] }, false], [{ goal_12m: 'x'.repeat(501) }, false], [{ goal_3y: 5 }, false],
    [{ aspirations: ['grow_vertical'], goal_12m: 'ab' }, true], [{ share_with_talent_review: true, aspirations: null, topics: null }, false], [[], false], ['text', false],
  ];
  let prepDiff = 0;
  for (const [p, s] of preps) {
    const sql = (await q1('select kafaa_cc_prep_norm($1::jsonb, $2) as r', [JSON.stringify(p), s])).r;
    if (norm(sql) !== norm(C.normPrep(p, s))) prepDiff++;
  }
  const courseIds = new Set(T.courses.map((c) => c.id));
  const acts = [
    [], null, [{ kind: 'course', title: { en: 'Do X', ar: '' }, course_id: T.courses[0].id, due_on: '2027-01-31' }], [{ kind: 'ojt', title: { en: '', ar: 'مرافقة' }, owner: 'manager' }],
    [{ kind: 'nope', title: { en: 'x' } }], [{ kind: 'course', title: { en: 'x' }, course_id: 'c-missing' }], [{ kind: 'reading', title: { en: 'x' }, due_on: '2027-02-30' }],
    [{ id: 'a1', kind: 'reading', title: { en: 'x' } }, { id: 'a1', kind: 'reading', title: { en: 'y' } }], [{ kind: 'reading', title: 'x' }], [{ kind: 'reading', title: { en: 'x' }, owner: 'hr' }],
    Array.from({ length: 9 }, () => ({ kind: 'reading', title: { en: 'x' } })), [{ id: 'Bad Id', kind: 'reading', title: { en: 'x' } }], [{ kind: 'project', title: { en: '  Lead it  ', ar: 'قيادة' }, due_on: '', course_id: '' }],
  ];
  let actDiff = 0;
  for (const a of acts) {
    const sql = (await q1('select kafaa_cc_actions_norm($1::jsonb) as r', [JSON.stringify(a)])).r;
    if (norm(sql) !== norm(C.normActions(a, (id) => courseIds.has(id)))) actDiff++;
  }
  ok(prepDiff === 0 && actDiff === 0, `preparation and agreed-action checks: SQL equals TS on ${preps.length} + ${acts.length} inputs (valid and invalid)`);

  // cadence: month arithmetic clamps like Postgres
  const dates = ['2026-08-31', '2026-02-28', '2025-12-31', '2026-03-31', '2026-04-08', '2026-04-09', '2026-04-10', '2026-05-07'];
  let cadDiff = 0;
  for (const d of dates) {
    const r = await q1('select kafaa_cc_due_on($1::date, null)::text as due, kafaa_cc_state($1::date, null, $2::date) as st', [d, now]);
    if (r.due !== C.dueOn(d, null) || r.st !== C.cadenceState(d, null, now)) cadDiff++;
  }
  const neverSql = (await q1(`select kafaa_cc_state(null, null, $1::date) as st`, [now])).st;
  ok(cadDiff === 0 && neverSql === 'overdue', 'cadence: due date (six months, end-of-month clamp) and state equal in SQL and TS; never held and no hire date is overdue');

  // agenda: every staff member, full view and the manager's shared-only view
  const staff = T.people.filter((p) => p.kind === 'staff');
  const tablesFor = (pid) => ({
    people: T.people, roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills,
    states: T.person_skills.filter((s) => s.person_id === pid), licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records, programmes: T.programmes,
    courses: T.courses, trainingRecords: T.training_records, enrolments: T.enrolments, weights: T.engine_settings.find((s) => s.id === 'recommend')?.weights,
    skillRows: T.skills, competencyRows: T.competencies, personSkills: T.person_skills, targets: T.career_targets, roadmaps: T.roadmaps, qualRows: T.qual_records,
    standardRows: T.qual_standards, goals: T.learning_goals, feedback: T.coach_feedback, training: T.training_records, conversations: T.career_conversations,
  });
  let agDiff = 0, agFirst = '', withTargets = 0;
  for (const p of staff) {
    for (const shared of [false, true]) {
      const sql = (await q1('select kafaa_cc_agenda($1, true, true, $2, $3, $4::date) as r', [p.id, !shared, shared, now])).r;
      const ts = C.buildAgenda(tablesFor(p.id), p.id, { targets: true, roadmap: true, coach: !shared, sharedOnly: shared }, now);
      if (!shared && ts.targets.length) withTargets++;
      if (norm(sql) !== norm(ts)) { agDiff++; if (!agFirst) agFirst = `${p.id}/${shared ? 'shared' : 'full'}`; }
    }
  }
  ok(agDiff === 0 && withTargets > 30, `agenda: SQL equals TS for ${staff.length} staff × (own view, manager view)${agDiff ? `; ${agDiff} differ, first ${agFirst}` : ''} (${withTargets} with targets)`);
  const kro = C.buildAgenda(tablesFor('p-k-ro'), 'p-k-ro', { targets: true, roadmap: true, coach: false, sharedOnly: true }, now);
  const unsharedK = T.career_targets.filter((t) => t.person_id === 'p-k-ro' && t.active && !t.shared).map((t) => t.role_id);
  const secSkills = new Set(T.skills.filter((s) => s.area === 'security' || T.competencies.find((c) => c.id === s.competency_id)?.domain === 'security').map((s) => s.id));
  const allAg = staff.map((p) => C.buildAgenda(tablesFor(p.id), p.id, { targets: true, roadmap: true, coach: true, sharedOnly: false }, now));
  const secStd = new Set(T.qual_standards.filter((s) => s.security_restricted).map((s) => s.id));
  ok(unsharedK.length > 0 && kro.targets.every((t) => !unsharedK.includes(t.role_id)) && kro.coach === null && allAg.every((a) => a.passport.every((x) => !secSkills.has(x.skill_id)) && a.quals.every((q) => !secStd.has(q.standard_id))),
    "the manager's agenda holds only shared targets and no coach data; no agenda lists a security skill or a security-restricted qualification");

  // HR aggregates
  const insSql = (await q1('select kafaa_cc_insights_compute($1::date) as r', [now])).r;
  const insTs = C.conversationInsightsOf(T.career_conversations, T.people, T.role_assignments, now);
  const small = insTs.by_family.filter((c) => c.suppressed);
  const cellsOk = [insTs.total, ...insTs.by_family].every((c) => c.suppressed ? c.people === null && Object.values(c.aspirations).every((v) => v === null) : Object.values(c.aspirations).every((v) => v === null || v >= 10));
  ok(norm(insSql) === norm(insTs) && small.length > 0 && !insTs.total.suppressed && cellsOk,
    `HR aggregates: SQL equals TS; ${small.length} families under 10 suppressed; every shown aspiration count is 10 or more`);
  await fresh.close();

  // ── RLS (shared database; earlier checks changed some rows but not conversations)
  ok((await count(null, 'kafaa_career_conversations')) === 0, 'anonymous visitors read no career conversation');
  const ownK = T.career_conversations.filter((c) => c.person_id === 'p-k-ro').length;
  ok((await count('k-ro', 'kafaa_career_conversations')) === ownK, 'k-ro reads their own conversations, including the private draft');
  const sroK = await as('sro', `select id, status, prep_submitted_at from kafaa_career_conversations where person_id = 'p-k-ro'`);
  ok(sroK.length === ownK - 1 && sroK.every((r) => r.status !== 'draft'), "the line manager of record reads k-ro's held conversations but not the private draft");
  ok((await count('k-hr-analyst', 'kafaa_career_conversations', `person_id <> kafaa_me()`)) === 0 && (await count('chco', 'kafaa_career_conversations', `person_id <> kafaa_me() and manager_read_id is distinct from kafaa_me()`)) === 0
    && (await count('k-auditor', 'kafaa_career_conversations', `person_id <> kafaa_me() and manager_read_id is distinct from kafaa_me()`)) === 0 && (await count('training-mgr', 'kafaa_career_conversations', `person_id = 'p-k-ro'`)) === 0 && (await count('gulfhydro-qa', 'kafaa_career_conversations')) === 0,
    'HR, the CHCO office, auditors, other managers and partners read no individual conversation');
  let direct = false;
  try { await as('k-ro', `update kafaa_career_conversations set status = 'acknowledged' where person_id = 'p-k-ro'`); direct = (await count('k-ro', 'kafaa_career_conversations', `status = 'acknowledged'`)) > T.career_conversations.filter((c) => c.person_id === 'p-k-ro' && c.status === 'acknowledged').length; } catch { direct = false; }
  ok(!direct, 'no direct writes: conversations change only through the RPCs');

  // ── RPC flow: k-ro prepares (private), shares, sro records, sro cannot acknowledge, k-ro acknowledges with a comment
  const prep = { aspirations: ['grow_vertical', 'lead'], mobility: 'current_site', leadership: 'ready', goal_12m: 'Be ready for SRO at the next intake', support: ['coaching'], include: { targets: true, roadmap: true, coach: true } };
  const bad = (await one('k-ro', `select kafaa_submit_prep($1::jsonb, true) as r`, [JSON.stringify({ aspirations: [] })])).r;
  const d1 = (await one('k-ro', `select kafaa_submit_prep($1::jsonb, false) as r`, [JSON.stringify(prep)])).r;
  const hidden = await count('sro', 'kafaa_career_conversations', `id = '${d1.data?.id}'`);
  const d2 = (await one('k-ro', `select kafaa_submit_prep($1::jsonb, true) as r`, [JSON.stringify({ ...prep, share_with_talent_review: true })])).r;
  const seen = await as('sro', `select prep, agenda, share_with_talent_review from kafaa_career_conversations where id = $1`, [d1.data?.id]);
  ok(!bad.ok && bad.code === 'invalid' && d1.ok && !d1.data.submitted && hidden === 0 && d2.ok && d2.data.id === d1.data.id && d2.data.submitted && seen.length === 1
    && seen[0].agenda.passport.length > 0 && seen[0].prep.share_with_talent_review === undefined && seen[0].share_with_talent_review === true,
    'submitPrep: a draft stays private; sharing makes the same row (with its pre-filled agenda) visible to the line manager of record; incomplete preparation is refused');
  const nPrepRows = (await db.query(`select count(*)::int n from kafaa_notifications where id = $1 and person_id = 'p-sro'`, [`nt-cc-${d1.data.id}-prep`])).rows[0].n;
  ok(nPrepRows === 1, 'the manager is notified when the preparation is shared');

  const actions = [{ kind: 'course', title: { en: 'Complete SRO systems refresher', ar: 'إتمام دورة تنشيطية لأنظمة كبير مشغلي المفاعل' }, due_on: '2027-02-28', course_id: null },
    { kind: 'mentoring', title: { en: 'Shadow the shift supervisor on two outages', ar: 'مرافقة مشرف الوردية في فترتي صيانة' }, owner: 'manager' }];
  const today = (await db.query(`select current_date::text d`)).rows[0].d;
  const notMgr = (await one('sro', `select kafaa_record_conversation($1::jsonb) as r`, [JSON.stringify({ person_id: 'p-qc-inspector', held_on: today, notes: 'x', actions: [] })])).r;
  const selfRec = (await one('k-ro', `select kafaa_record_conversation($1::jsonb) as r`, [JSON.stringify({ conversation_id: d1.data.id, held_on: today, notes: 'x', actions: [] })])).r;
  const future = (await one('sro', `select kafaa_record_conversation($1::jsonb) as r`, [JSON.stringify({ conversation_id: d1.data.id, held_on: '2099-01-01', notes: 'x', actions: [] })])).r;
  const secFocus = (await one('sro', `select kafaa_record_conversation($1::jsonb) as r`, [JSON.stringify({ conversation_id: d1.data.id, held_on: today, notes: 'x', actions: [], focus_role_id: 'security-officer' })])).r;
  const led0 = Number((await db.query('select count(*)::int n from ledger_entries')).rows[0].n);
  const rec = (await one('sro', `select kafaa_record_conversation($1::jsonb) as r`, [JSON.stringify({ conversation_id: d1.data.id, held_on: today, notes: 'Agreed the SRO route.', actions, focus_role_id: 'senior-reactor-operator', coach_hours: 4 })])).r;
  const led1 = Number((await db.query('select count(*)::int n from ledger_entries')).rows[0].n);
  const planActs = (await db.query(`select a.status, d.status as plan_status, d.person_id from kafaa_plan_activities a join kafaa_dev_plans d on d.id = a.plan_id where a.id like $1`, [`pa-cc-${d1.data.id}-%`])).rows;
  ok(!notMgr.ok && notMgr.code === 'not_manager' && !selfRec.ok && selfRec.code === 'forbidden' && !future.ok && future.code === 'invalid' && !secFocus.ok && secFocus.code === 'invalid'
    && rec.ok && rec.data.created === 2 && planActs.length === 2 && planActs.every((x) => x.status === 'planned' && x.plan_status === 'draft' && x.person_id === 'p-k-ro') && led1 === led0 + 1,
    "recordConversation: only the line manager of record (not the employee, no future date, no security focus role); agreed actions appear in the employee's development plan as draft activities; ledgered");
  const rec2 = (await one('sro', `select kafaa_record_conversation($1::jsonb) as r`, [JSON.stringify({ conversation_id: d1.data.id, held_on: today, notes: 'Agreed the SRO route (amended).', actions, focus_role_id: 'senior-reactor-operator', coach_hours: 4 })])).r;
  ok(rec2.ok && rec2.data.created === 0 && rec2.data.updated === 2 && rec2.data.plan_id === rec.data.plan_id, 'amending the record before acknowledgement updates the same plan activities (no duplicates)');

  const audit0 = Number((await db.query(`select count(*)::int n from kafaa_audit_events where action = 'conversation.acknowledge' and outcome = 'refused'`)).rows[0].n);
  const mgrAck = (await one('sro', `select kafaa_acknowledge_conversation($1, true, '', false) as r`, [d1.data.id])).r;
  const audit1 = Number((await db.query(`select count(*)::int n from kafaa_audit_events where action = 'conversation.acknowledge' and outcome = 'refused'`)).rows[0].n);
  const stillHeld = (await db.query(`select status from kafaa_career_conversations where id = $1`, [d1.data.id])).rows[0].status;
  ok(!mgrAck.ok && mgrAck.code === 'not_person' && audit1 === audit0 + 1 && stillHeld === 'held', "a manager cannot mark a conversation acknowledged on the employee's behalf (refused and audited)");
  const noComment = (await one('k-ro', `select kafaa_acknowledge_conversation($1, false, '  ', true) as r`, [d1.data.id])).r;
  const goal0 = (await db.query(`select focus_role_ids, hours_per_week from kafaa_learning_goals where person_id = 'p-k-ro'`)).rows[0];
  const ack = (await one('k-ro', `select kafaa_acknowledge_conversation($1, false, 'I think the timeline is shorter.', true) as r`, [d1.data.id])).r;
  const after = (await db.query(`select status, employee_agrees, employee_comment from kafaa_career_conversations where id = $1`, [d1.data.id])).rows[0];
  const goal1 = (await db.query(`select focus_role_ids, hours_per_week from kafaa_learning_goals where person_id = 'p-k-ro'`)).rows[0];
  const locked = (await one('sro', `select kafaa_record_conversation($1::jsonb) as r`, [JSON.stringify({ conversation_id: d1.data.id, held_on: today, notes: 'late edit', actions: [] })])).r;
  ok(!noComment.ok && noComment.code === 'invalid' && ack.ok && after.status === 'acknowledged' && after.employee_agrees === false && /shorter/.test(after.employee_comment)
    && goal1.focus_role_ids.includes('senior-reactor-operator') && Number(goal1.hours_per_week) === 4 && (!goal0 || goal0.focus_role_ids.length <= goal1.focus_role_ids.length) && !locked.ok && locked.code === 'locked',
    'the employee acknowledges (a disagreement needs a comment); the focus role and weekly hours reach the Learning Coach; an acknowledged record is locked');

  // recording by person picks the person's shared preparation (one open conversation per person); live demo pair head-sq → qc-inspector
  const qcRow = T.career_conversations.find((c) => c.person_id === 'p-qc-inspector' && c.status === 'draft');
  const hsRec = (await one('head-sq', `select kafaa_record_conversation($1::jsonb) as r`, [JSON.stringify({ person_id: 'p-qc-inspector', held_on: today, notes: 'Agreed a procurement rotation.', focus_role_id: 'procurement-engineer', coach_hours: 3,
    actions: [{ kind: 'ojt', title: { en: 'Two-week rotation with the procurement team', ar: 'تدوير لمدة أسبوعين مع فريق المشتريات' }, owner: 'manager' }] })])).r;
  const qcAckByMgr = (await one('head-sq', `select kafaa_acknowledge_conversation($1, true, '', false) as r`, [qcRow.id])).r;
  const qcAck = (await one('qc-inspector', `select kafaa_acknowledge_conversation($1, true, '', true) as r`, [qcRow.id])).r;
  const opRow = T.career_conversations.find((c) => c.person_id === 'p-outage-planner' && c.status === 'draft');
  const omRec = (await one('outage-manager', `select kafaa_record_conversation($1::jsonb) as r`, [JSON.stringify({ person_id: 'p-outage-planner', held_on: today, notes: 'Held after the planning review.', actions: [{ kind: 'project', title: { en: 'Lead the next outage window plan', ar: 'قيادة خطة نافذة الصيانة القادمة' } }] })])).r;
  const sqHeld = T.career_conversations.find((c) => c.person_id === 'p-sq-lead' && c.status === 'held');
  ok(hsRec.ok && hsRec.data.id === qcRow.id && omRec.ok && omRec.data.id === opRow.id && !qcAckByMgr.ok && qcAckByMgr.code === 'not_person' && qcAck.ok && !!sqHeld && sqHeld.manager_read_id === 'p-head-sq',
    "recording by person picks the person's shared preparation; qc-inspector acknowledges what head-sq recorded, head-sq cannot");

  // agenda RPC: self vs manager preview vs others
  const selfAg = (await one('k-ro', `select kafaa_conversation_agenda('p-k-ro') as r`)).r;
  const mgrAg = (await one('sro', `select kafaa_conversation_agenda('p-k-ro') as r`)).r;
  const otherAg = (await one('head-sq', `select kafaa_conversation_agenda('p-k-ro') as r`)).r;
  ok(selfAg.ok && selfAg.data.coach !== null && !selfAg.data.shared_only && mgrAg.ok && mgrAg.data.shared_only && mgrAg.data.coach === null && !otherAg.ok && otherAg.code === 'forbidden',
    'conversationAgenda: the person sees everything; the line manager of record sees the shared-only preview; other managers are refused');

  // talent review (F18): consent gate
  const asp = (await one('chco', `select kafaa_talent_aspirations(array['p-k-ro', 'p-buyer', 'p-nse', 'p-qc-inspector']) as r`)).r;
  const byP = Object.fromEntries((asp.data ?? []).map((x) => [x.person_id, x]));
  const sroAsp = (await one('sro', `select kafaa_talent_aspirations(array['p-k-ro', 'p-qc-inspector']) as r`)).r;
  const roAsp = (await one('k-ro', `select kafaa_talent_aspirations(array['p-k-ro']) as r`)).r;
  const hraAsp = (await one('k-hr-analyst', `select kafaa_talent_aspirations(array['p-buyer']) as r`)).r;
  ok(asp.ok && byP['p-buyer']?.shared === true && byP['p-buyer'].aspirations.length > 0 && byP['p-qc-inspector']?.shared === false && byP['p-qc-inspector'].reason === 'not_shared' && byP['p-qc-inspector'].aspirations === undefined
    && byP['p-nse']?.reason === 'none' && byP['p-k-ro']?.shared === true && sroAsp.ok && sroAsp.data.map((x) => x.person_id).join() === 'p-k-ro' && !roAsp.ok && roAsp.code === 'forbidden' && hraAsp.ok,
    'talent review reads the aspiration only with consent ("not shared" otherwise, nothing else returned), only within its scope; employees are refused');
  const off = (await one('k-ro', `select kafaa_set_aspiration_sharing($1, false) as r`, [d1.data.id])).r;
  const after2 = (await one('chco', `select kafaa_talent_aspirations(array['p-k-ro']) as r`)).r;
  const stealShare = (await one('sro', `select kafaa_set_aspiration_sharing($1, true) as r`, [d1.data.id])).r;
  ok(off.ok && after2.data[0].reason === 'not_shared' && !stealShare.ok && stealShare.code === 'not_found', 'switching consent off hides the aspiration from talent review at once; nobody else can switch it');

  // HR insights and the team view
  const hr = (await one('k-hr-analyst', `select kafaa_conversation_insights() as r`)).r;
  const ro = (await one('k-ro', `select kafaa_conversation_insights() as r`)).r;
  const team = (await one('sro', `select kafaa_team_conversations() as r`)).r;
  const roTeam = (await one('k-ro', `select kafaa_team_conversations() as r`)).r;
  ok(hr.ok && hr.data.by_family.some((c) => c.suppressed) && !ro.ok && ro.code === 'forbidden' && team.ok && team.data.some((x) => x.person_id === 'p-k-ro') && team.data.every((x) => x.cadence && x.name) && !roTeam.ok,
    'HR reads aggregates only (small families suppressed); the team view lists the reports of record with cadence; employees are refused both');

  // reminders: overdue pairs get a notification on both sides, once per month
  const r1 = (await one('head-sq', `select kafaa_conversation_reminders() as r`)).r;
  const tmRem = (await one('training-mgr', `select kafaa_conversation_reminders() as r`)).r;
  const tmRem2 = (await one('training-mgr', `select kafaa_conversation_reminders() as r`)).r;
  const kroRem = (await one('k-ro', `select kafaa_conversation_reminders() as r`)).r;
  const month = today.slice(0, 7);
  const overdue = (await db.query(`select p.id, kafaa_opp_line_manager(p.id) as lm from kafaa_people p where p.kind = 'staff' and p.status = 'active' and kafaa_opp_line_manager(p.id) is not null
      and kafaa_cc_state((select max(c.held_on) from kafaa_career_conversations c where c.person_id = p.id and c.status in ('held', 'acknowledged')), p.hire_date, current_date) = 'overdue'`)).rows;
  const notes = new Set((await db.query(`select id || '|' || person_id as k from kafaa_notifications where id like 'nt-cc-due-%'`)).rows.map((x) => x.k));
  const both = overdue.every((x) => notes.has(`nt-cc-due-${x.id}-${month}|${x.id}`) && notes.has(`nt-cc-due-${x.id}-${month}-m|${x.lm}`));
  const upToDate = (await db.query(`select count(*)::int n from kafaa_notifications where id = $1`, [`nt-cc-due-p-k-ro-${month}`])).rows[0].n;
  ok(r1.ok && tmRem.ok && tmRem2.ok && tmRem2.data.created === 0 && tmRem.data.overdue === overdue.length && overdue.length > 0 && both && upToDate === 0 && !kroRem.ok && kroRem.code === 'forbidden' && tmRem.data.pairs > r1.data.pairs,
    `six-monthly reminders: each of the ${overdue.length} overdue pairs has a notification for the employee and the manager, up-to-date pairs none; re-running adds none; managers sweep their reports, the training manager everyone`);
}
