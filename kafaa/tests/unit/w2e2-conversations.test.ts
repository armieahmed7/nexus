/**
 * W2 · E2 acceptance: F12 Career conversations and aspirations. Local path (LocalBackend RPCs and RLS mirror) plus the pure rules;
 * the SQL path is scripts/validate/w2e2-conversations.mjs (PGlite, SQL = TS parity and the same acceptance cases).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import {
  addMonthsIso, buildAgenda, cadenceOf, cadenceState, conversationInsightsOf, lastHeldOf, normActions, normPrep, pairsOf, suggestActions, teamRowsOf, aspirationOf,
  type ConvRow, type Agenda,
} from '../../src/modules/m18/conversations';
import { agendaTablesFrom } from '../../src/modules/m18/backend/local';
import { lineManagerOf } from '../../src/modules/m20/domain';
import { lintRanked } from '../../src/domain/engines';
import { todayIso } from '../../src/domain/rules';
import { checkGuard } from '../../src/auth/guards';
import { ROUTES } from '../../src/routes/registry';
import { hasKey } from '../../src/i18n';
import seed from '../../src/seed/seed.json';


// cold LocalBackend start-up (seed parse) can exceed the 5 s default on a loaded machine
vi.setConfig({ testTimeout: 90000, hookTimeout: 90000 }); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
const T = (seed as unknown as { tables: Record<string, any[]>; meta: { demo_today: string } }).tables;
const NOW = (seed as unknown as { meta: { demo_today: string } }).meta.demo_today;
const CONVS = T.career_conversations as ConvRow[];
const PREP = { aspirations: ['grow_vertical', 'lead'], mobility: 'current_site', leadership: 'ready', goal_12m: 'Be ready for SRO at the next intake', support: ['coaching'], include: { targets: true, roadmap: true, coach: true } };
const ACTIONS = [
  { kind: 'course', title: { en: 'SRO systems refresher', ar: 'دورة تنشيطية لأنظمة كبير المشغلين' }, due_on: '2027-02-28' },
  { kind: 'mentoring', title: { en: 'Shadow the shift supervisor', ar: 'مرافقة مشرف الوردية' }, owner: 'manager' },
];

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const today = () => todayIso();
const kroDraft = () => CONVS.find((c) => c.person_id === 'p-k-ro' && c.status === 'draft')!;

describe('F12 rules', () => {
  it('cadence: six months from the last conversation held (end-of-month clamp), else from the hire date; due soon within 30 days', () => {
    expect(addMonthsIso('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonthsIso('2025-12-31', 6)).toBe('2026-06-30');
    expect(cadenceOf('2026-04-14', '2019-01-01', '2026-10-08')).toMatchObject({ due_on: '2026-10-14', state: 'due_soon', days: 6 });
    expect(cadenceState('2026-03-01', null, '2026-10-08')).toBe('overdue');
    expect(cadenceState(null, '2026-06-01', '2026-10-08')).toBe('ok');
    expect(cadenceState(null, null, '2026-10-08')).toBe('overdue');
  });

  it('preparation: up to three aspirations from the list, a 12-month goal to share, booleans and texts checked; agreed actions checked', () => {
    expect(normPrep({}, false)).toMatchObject({ aspirations: [], mobility: 'current_site', include: { targets: true, roadmap: true, coach: true }, share_with_talent_review: false });
    expect(normPrep({}, true)).toBeNull();
    expect(normPrep({ aspirations: ['lead', 'lead'], goal_12m: ' Lead ' }, true)).toMatchObject({ aspirations: ['lead'], goal_12m: 'Lead' });
    expect(normPrep({ aspirations: ['lead', 'specialise', 'stay_deepen', 'move_lateral'] }, false)).toBeNull();
    expect(normPrep({ aspirations: ['astronaut'] }, false)).toBeNull();
    expect(normPrep({ shift_ok: 'yes' }, false)).toBeNull();
    expect(normPrep({ goal_12m: 'x'.repeat(501) }, false)).toBeNull();
    const ok = normActions(ACTIONS, () => true)!;
    expect(ok.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(ok[1].owner).toBe('manager');
    expect(normActions([{ kind: 'course', title: { en: 'x' }, course_id: 'c-none' }], () => false)).toBeNull();
    expect(normActions(Array.from({ length: 9 }, () => ({ kind: 'reading', title: { en: 'x' } })), () => true)).toBeNull();
    expect(normActions([{ kind: 'reading', title: { en: '', ar: 'قراءة' } }], () => true)![0].title).toEqual({ en: 'قراءة', ar: 'قراءة' });
  });

  it('suggested actions carry at least one human-readable reason each (F02 lint) and answer the aspiration', () => {
    const roleT = (id: string) => ({ en: id, ar: id });
    let n = 0;
    for (const c of CONVS.filter((x) => x.status !== 'draft' && x.agenda && (x.agenda as Agenda).passport)) {
      const s = suggestActions(c.agenda as Agenda, c.prep as never, T.courses, roleT, roleT, roleT, new Set(), NOW);
      expect(lintRanked(s.map((x) => ({ id: x.id, score: x.score, reasons: x.reasons })))).toEqual([]);
      for (const r of s.flatMap((x) => x.reasons)) expect(hasKey(r.key), r.key).toBe(true);
      n += s.length;
    }
    expect(n).toBeGreaterThan(100);
    const lead = suggestActions(null, { aspirations: ['lead'] }, T.courses, roleT, roleT, roleT, new Set(), NOW);
    expect(lead[0].item.course_id).toBe('c-intilaqa');
  });

  it('the agenda never lists a security skill or a security-restricted qualification, and the manager view holds only shared targets and no coach data', () => {
    const sec = new Set(T.skills.filter((s) => s.area === 'security' || T.competencies.find((c) => c.id === s.competency_id)?.domain === 'security').map((s) => s.id));
    const secStd = new Set(T.qual_standards.filter((s) => s.security_restricted).map((s) => s.id));
    for (const p of T.people.filter((x) => x.kind === 'staff')) {
      const a = buildAgenda(agendaTablesFrom(b, p.id), p.id, { targets: true, roadmap: true, coach: true, sharedOnly: false }, NOW);
      expect(a.passport.some((x) => sec.has(x.skill_id))).toBe(false);
      expect(a.quals.some((x) => secStd.has(x.standard_id))).toBe(false);
    }
    const m = buildAgenda(agendaTablesFrom(b, 'p-k-ro'), 'p-k-ro', { targets: true, roadmap: true, coach: false, sharedOnly: true }, NOW);
    const unshared = T.career_targets.filter((x) => x.person_id === 'p-k-ro' && x.active && !x.shared).map((x) => x.role_id);
    expect(unshared.length).toBeGreaterThan(0);
    expect(m.targets.some((x) => unshared.includes(x.role_id))).toBe(false);
    expect(m.coach).toBeNull();
  });
});

describe('F12 seed', () => {
  it('every active staff member with a line manager of record has a conversation history or an overdue reminder; every state is represented', () => {
    const pairs = pairsOf(T.people, T.role_assignments, NOW);
    expect(pairs.length).toBeGreaterThan(90);
    const month = NOW.slice(0, 7);
    for (const { person_id, manager_id } of pairs) {
      const rows = CONVS.filter((c) => c.person_id === person_id);
      const l = lastHeldOf(CONVS, person_id);
      const overdue = cadenceState(l?.held_on ?? null, T.people.find((p) => p.id === person_id)?.hire_date ?? null, NOW) === 'overdue';
      expect(rows.length > 0 || overdue, person_id).toBe(true);
      if (overdue) {
        expect(T.notifications.some((n) => n.id === `nt-cc-due-${person_id}-${month}` && n.person_id === person_id)).toBe(true);
        expect(T.notifications.some((n) => n.id === `nt-cc-due-${person_id}-${month}-m` && n.person_id === manager_id)).toBe(true);
      }
      for (const r of rows) if (r.manager_read_id) expect(r.manager_read_id).toBe(r.manager_person_id);
    }
    const states = new Set(CONVS.map((c) => (c.status === 'draft' ? (c.prep_submitted_at ? 'shared' : 'draft') : c.status === 'acknowledged' ? (c.employee_agrees === false ? 'disagreed' : 'acknowledged') : c.status)));
    expect([...states].sort()).toEqual(['acknowledged', 'disagreed', 'draft', 'held', 'shared']);
    // held conversations: their actions are in a development plan as activities
    for (const c of CONVS.filter((x) => x.status !== 'draft' && Array.isArray(x.actions) && (x.actions as unknown[]).length && x.plan_id)) {
      const acts = T.plan_activities.filter((a) => a.plan_id === c.plan_id && a.id.startsWith(`pa-cc-${c.id}-`));
      expect(acts.length, c.id).toBe((c.actions as unknown[]).length);
    }
    // synthetic people only: every conversation names a seeded person
    for (const c of CONVS) expect(T.people.some((p) => p.id === c.person_id && p.synthetic !== false)).toBe(true);
  });
});

describe('F12 acceptance (local path)', () => {
  it('a draft stays private; sharing makes it visible to the line manager of record (with the server-built agenda) and notifies them', async () => {
    await as('k-ro');
    const bad = await b.rpc.submitPrep({ aspirations: [] }, true);
    expect(bad.code).toBe('invalid');
    const d1 = await b.rpc.submitPrep(PREP as never, false);
    expect(d1.ok && d1.data!.id).toBe(kroDraft().id);
    expect(d1.data!.submitted).toBe(false);
    await as('sro');
    expect((await b.list('career_conversations', { filter: { id: d1.data!.id } })).length).toBe(0);
    await as('k-ro');
    const d2 = await b.rpc.submitPrep({ ...PREP, share_with_talent_review: true } as never, true);
    expect(d2.ok && d2.data!.submitted).toBe(true);
    await as('sro');
    const seen = await b.list('career_conversations', { filter: { id: d1.data!.id } });
    expect(seen.length).toBe(1);
    expect((seen[0].agenda as Agenda).passport.length).toBeGreaterThan(0);
    expect((seen[0].prep as Record<string, unknown>).share_with_talent_review).toBeUndefined();
    expect((await b.list('notifications', { filter: { person_id: 'p-sro' } })).some((n) => n.id === `nt-cc-${d1.data!.id}-prep`)).toBe(true);
  });

  it('agreed actions appear in the employee\'s development plan as draft activities (and amending does not duplicate them); ledgered', async () => {
    await as('k-ro');
    await b.rpc.submitPrep(PREP as never, true);
    const id = kroDraft().id;
    await as('sro');
    const led0 = b.raw('ledger_local').length;
    const r = await b.rpc.recordConversation({ conversation_id: id, held_on: today(), notes: 'Agreed the SRO route.', actions: ACTIONS, focus_role_id: 'senior-reactor-operator', coach_hours: 4 });
    expect(r.ok).toBe(true);
    expect(r.data!.created).toBe(2);
    expect(b.raw('ledger_local').length).toBe(led0 + 1);
    await as('k-ro');
    const acts = await b.list('plan_activities', { filter: { person_id: 'p-k-ro' } });
    const mine = acts.filter((a) => a.id.startsWith(`pa-cc-${id}-`));
    expect(mine.map((a) => a.title_en).sort()).toEqual(['SRO systems refresher', 'Shadow the shift supervisor']);
    expect(mine.every((a) => a.status === 'planned')).toBe(true);
    const plan = (await b.list('dev_plans', { filter: { id: r.data!.plan_id! } }))[0];
    expect(plan.status).toBe('draft');
    expect(plan.target_role_id).toBe('senior-reactor-operator');
    await as('sro');
    const r2 = await b.rpc.recordConversation({ conversation_id: id, held_on: today(), notes: 'Amended.', actions: ACTIONS, focus_role_id: 'senior-reactor-operator', coach_hours: 4 });
    expect(r2.data).toMatchObject({ created: 0, updated: 2, plan_id: r.data!.plan_id });
    expect((await (async () => { await as('k-ro'); return b.list('notifications', { filter: { person_id: 'p-k-ro' } }); })()).some((n) => n.id === `nt-cc-${id}-held`)).toBe(true);
  });

  it('a manager cannot mark a conversation acknowledged on the employee\'s behalf; the employee can, disagreeing only with a comment', async () => {
    await as('k-ro');
    await b.rpc.submitPrep(PREP as never, true);
    const id = kroDraft().id;
    await as('sro');
    await b.rpc.recordConversation({ conversation_id: id, held_on: today(), notes: 'x', actions: ACTIONS, focus_role_id: 'senior-reactor-operator', coach_hours: 4 });
    const refusedBefore = b.raw('audit_events').filter((e) => e.action === 'conversation.acknowledge' && e.outcome === 'refused').length;
    const mgr = await b.rpc.acknowledgeConversation(id, true, '', false);
    expect(mgr.ok).toBe(false);
    expect(mgr.code).toBe('not_person');
    expect(b.raw('audit_events').filter((e) => e.action === 'conversation.acknowledge' && e.outcome === 'refused').length).toBe(refusedBefore + 1);
    expect(b.rawGet('career_conversations', id)!.status).toBe('held');
    await as('k-ro');
    expect((await b.rpc.acknowledgeConversation(id, false, '  ', true)).code).toBe('invalid');
    const ack = await b.rpc.acknowledgeConversation(id, false, 'The timeline is shorter.', true);
    expect(ack.ok && ack.data!.coach_updated).toBe(true);
    const row = b.rawGet('career_conversations', id)!;
    expect(row).toMatchObject({ status: 'acknowledged', employee_agrees: false, employee_comment: 'The timeline is shorter.' });
    const goal = b.raw('learning_goals').find((g) => g.person_id === 'p-k-ro')!;
    expect(goal.focus_role_ids).toContain('senior-reactor-operator');
    expect(Number(goal.hours_per_week)).toBe(4);
    await as('sro');
    expect((await b.rpc.recordConversation({ conversation_id: id, held_on: today(), notes: 'late', actions: [] })).code).toBe('locked');
  });

  it('only the line manager of record records: employees, other managers and future dates are refused; security roles are not a focus', async () => {
    await as('k-ro');
    expect((await b.rpc.recordConversation({ person_id: 'p-k-ro', held_on: today(), notes: '', actions: [] })).code).toBe('forbidden');
    await as('sro');
    expect((await b.rpc.recordConversation({ person_id: 'p-qc-inspector', held_on: today(), notes: '', actions: [] })).code).toBe('not_manager');
    expect((await b.rpc.recordConversation({ person_id: 'p-sro', held_on: today(), notes: '', actions: [] })).code).toBe('self_record');
    expect((await b.rpc.recordConversation({ person_id: 'p-k-ro', held_on: '2099-01-01', notes: '', actions: [] })).code).toBe('invalid');
    expect((await b.rpc.recordConversation({ person_id: 'p-k-ro', held_on: today(), notes: '', actions: [], focus_role_id: 'security-officer' })).code).toBe('invalid');
    // recording by person with no shared preparation creates a new held row (the private draft stays private)
    const r = await b.rpc.recordConversation({ person_id: 'p-k-ro', held_on: today(), notes: 'Short check-in.', actions: [] });
    expect(r.ok).toBe(true);
    expect(r.data!.id).not.toBe(kroDraft().id);
    expect(b.rawGet('career_conversations', kroDraft().id)!.manager_read_id).toBeNull();
  });

  it('with consent off, talent review gets "aspiration not shared" (and nothing else); with consent on, the aspiration; scope applies', async () => {
    await as('chco');
    const r = await b.rpc.talentAspirations(['p-buyer', 'p-qc-inspector', 'p-nse']);
    const by = Object.fromEntries(r.data!.map((x) => [x.person_id, x]));
    expect(by['p-buyer']).toMatchObject({ shared: true, reason: 'shared' });
    expect(by['p-buyer'].aspirations!.length).toBeGreaterThan(0);
    expect(by['p-qc-inspector']).toEqual({ person_id: 'p-qc-inspector', shared: false, reason: 'not_shared' });
    expect(by['p-nse']).toEqual({ person_id: 'p-nse', shared: false, reason: 'none' });
    // the employee switches consent off on their latest conversation: talent review sees "not shared" at once
    const latest = lastHeldOf(CONVS, 'p-buyer')!;
    await as('buyer');
    expect((await b.rpc.setAspirationSharing(latest.id, false)).ok).toBe(true);
    await as('chco');
    expect((await b.rpc.talentAspirations(['p-buyer'])).data![0]).toEqual({ person_id: 'p-buyer', shared: false, reason: 'not_shared' });
    // a line manager (talent_review Scope) only within scope; employees are refused
    await as('sro');
    expect((await b.rpc.talentAspirations(['p-k-ro', 'p-qc-inspector'])).data!.map((x) => x.person_id)).toEqual(['p-k-ro']);
    await as('k-ro');
    expect((await b.rpc.talentAspirations(['p-k-ro'])).code).toBe('forbidden');
    await as('sro');
    expect((await b.rpc.setAspirationSharing(latest.id, true)).code).toBe('not_found');
    expect(aspirationOf(CONVS, 'p-buyer').shared).toBe(true); // pure rule on the pristine seed
  });

  it('the 6-monthly reminder appears in notifications for overdue pairs, once a month, on both sides', async () => {
    const t0 = today();
    const month = t0.slice(0, 7);
    const people = T.people;
    const overdue = pairsOf(people, T.role_assignments, t0).filter(({ person_id }) => cadenceState(lastHeldOf(CONVS, person_id)?.held_on ?? null, people.find((p) => p.id === person_id)!.hire_date, t0) === 'overdue');
    expect(overdue.length).toBeGreaterThan(10);
    await as('training-mgr');
    const r1 = await b.rpc.conversationReminders();
    expect(r1.ok).toBe(true);
    expect(r1.data!.overdue).toBe(overdue.length);
    const r2 = await b.rpc.conversationReminders();
    expect(r2.data!.created).toBe(0);
    for (const { person_id, manager_id } of overdue) {
      expect(b.rawGet('notifications', `nt-cc-due-${person_id}-${month}`)?.person_id).toBe(person_id);
      expect(b.rawGet('notifications', `nt-cc-due-${person_id}-${month}-m`)?.person_id).toBe(manager_id);
    }
    // the employee sees it in their own notifications (outage-planner is overdue in the seed)
    expect(overdue.some((x) => x.person_id === 'p-outage-planner')).toBe(true);
    await as('outage-planner');
    expect((await b.list('notifications', { filter: { person_id: 'p-outage-planner' } })).some((n) => n.id === `nt-cc-due-p-outage-planner-${month}` && n.kind === 'career_conversation')).toBe(true);
    // a pair that is up to date gets none; employees cannot sweep
    const fine = pairsOf(people, T.role_assignments, t0).find(({ person_id }) => !overdue.some((o) => o.person_id === person_id))!;
    expect(b.rawGet('notifications', `nt-cc-due-${fine.person_id}-${month}`)).toBeUndefined();
    await as('k-ro');
    expect((await b.rpc.conversationReminders()).code).toBe('forbidden');
  });

  it('HR sees aggregates only: no individual row, families under 10 suppressed, every shown aspiration count is 10 or more', async () => {
    await as('k-hr-analyst');
    expect((await b.list('career_conversations')).filter((c) => c.person_id !== 'p-k-hr-analyst').length).toBe(0);
    const r = await b.rpc.conversationInsights();
    expect(r.ok).toBe(true);
    const ins = r.data!;
    expect(ins).toEqual(conversationInsightsOf(b.raw('career_conversations') as never, b.raw('people') as never, b.raw('role_assignments') as never, today()));
    expect(ins.by_family.some((c) => c.suppressed && c.people === null)).toBe(true);
    for (const c of [ins.total, ...ins.by_family]) for (const v of [...Object.values(c.aspirations), ...Object.values(c.mobility)]) expect(v === null || v >= 10).toBe(true);
    expect(Object.values(ins.total.aspirations).some((v) => v !== null)).toBe(true);
    await as('k-ro');
    expect((await b.rpc.conversationInsights()).code).toBe('forbidden');
    await as('k-auditor');
    expect((await b.list('career_conversations')).filter((c) => c.person_id !== 'p-k-auditor' && c.manager_read_id !== 'p-k-auditor').length).toBe(0);
  });

  it('the team view lists the reports of record with cadence; the agenda RPC gives the manager the shared-only preview', async () => {
    await as('sro');
    const team = await b.rpc.teamConversations();
    expect(team.ok).toBe(true);
    const lm = (pid: string) => lineManagerOf(pid, T.people, T.role_assignments, today());
    expect(team.data!.map((x) => x.person_id).sort()).toEqual(T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && lm(p.id) === 'p-sro').map((p) => p.id).sort());
    expect(team.data).toEqual(teamRowsOf('p-sro', b.raw('career_conversations') as never, b.raw('people') as never, b.raw('role_assignments') as never, today()));
    const ag = await b.rpc.conversationAgenda('p-k-ro');
    expect(ag.ok && ag.data!.shared_only).toBe(true);
    expect(ag.data!.coach).toBeNull();
    await as('head-sq');
    expect((await b.rpc.conversationAgenda('p-k-ro')).code).toBe('forbidden');
    await as('k-ro');
    const own = await b.rpc.conversationAgenda('p-k-ro');
    expect(own.ok && !own.data!.shared_only && own.data!.coach !== null).toBe(true);
    expect((await b.rpc.teamConversations()).code).toBe('forbidden');
    await as(null);
    expect((await b.rpc.submitPrep(PREP as never, false)).code).toBe('not_signed_in');
  });

  it('routes: employees prepare, line managers hold conversations, HR sees the aggregate page; anonymous visitors sign in; every key exists in EN and AR', () => {
    const r = (id: string) => ROUTES.find((x) => x.id === id)!;
    for (const id of ['my-career-conversations', 'team-conversations', 'workforce-career-conversations']) expect(checkGuard(r(id).guard, { status: 'anon', roles: ['public'] })).toBe('signin');
    expect(checkGuard(r('my-career-conversations').guard, { status: 'signed_in', roles: ['employee'] })).toBe('ok');
    expect(checkGuard(r('my-career-conversations').guard, { status: 'signed_in', roles: ['partner_admin'] })).toBe('forbidden');
    expect(checkGuard(r('team-conversations').guard, { status: 'signed_in', roles: ['employee'] })).toBe('forbidden');
    expect(checkGuard(r('team-conversations').guard, { status: 'signed_in', roles: ['employee', 'manager'] })).toBe('ok');
    expect(checkGuard(r('team-conversations').guard, { status: 'signed_in', roles: ['employee', 'hr_analyst'] })).toBe('forbidden');
    expect(checkGuard(r('workforce-career-conversations').guard, { status: 'signed_in', roles: ['employee', 'hr_analyst'] })).toBe('ok');
    expect(checkGuard(r('workforce-career-conversations').guard, { status: 'signed_in', roles: ['employee', 'manager'] })).toBe('forbidden');
    for (const k of ['m18.cc.signal.notShared', 'm18.cc.refuse.not_person', 'm18.cc.asp.lead', 'm18.routes.team-conversations.title']) expect(hasKey(k)).toBe(true);
  });
});
