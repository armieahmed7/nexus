/** F25 Training effectiveness (Kirkpatrick L1-L4) and F26 Training needs forecast (W4 · E1, M25): every acceptance criterion on the
 *  local path, the rules shared with SQL, RBAC, the seed, routes and i18n. The SQL path is checked by
 *  scripts/validate/w4e1-effectiveness.mjs (PGlite: SQL = TS for every card, the demand of four quarters and the report).
 *
 *  F25  A1 instructors never see an individual L1 response; course results only at n >= 10
 *       A2 L3 observations are scheduled 90 days after completion of qualifying courses
 *       A3 L2 gain uses only released attempts
 *       A4 the L4 panel always shows the caveat and SAMPLE tags
 *  F26  B1 each demand number decomposes into its sources (drill-down sums match)
 *       B2 cells below 10 are suppressed in exports but used in totals
 *       B3 proposed sessions are drafts (shown on /training/schedule) and never published
 *       B4 changing a roadmap (F06) changes next quarter's demand after recompute */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { hasKey } from '../../src/i18n';
import { grantsFor, type PlatformRole } from '../../src/auth/policy';
import { checkGuard } from '../../src/auth/guards';
import { SCHEMA } from '../../src/data/schema';
import { todayIso } from '../../src/domain/rules';
import {
  addDaysIso, completionsOf, courseCard, kpiTrend, l1Open, l3DueOn, l3Status, l3Template, l3ToSchedule, packRows, rdiv, scorecard, validL3Items, validRatings, MIN_N,
  type CourseCard, type ScoreInput,
} from '../../src/modules/m25/eff';
import {
  addMonthsIso, applyIntake, computeDemand, exportRows, needQuarter, needsReport, periodsFrom, proposalDates, proposalSize, quarterBounds, quarterOfIso, SOURCES, type DemandInput,
} from '../../src/modules/m25/needs';
import { MSG } from '../../src/modules/m25/backend/local';
import { routes } from '../../src/modules/m25/routes';
import seed from '../../src/seed/seed.json';
import type { DemandReportResult, EffectivenessReport, L3Board } from '../../src/modules/m25/backend/rpc';

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
const S = seed as unknown as { tables: Record<string, any[]>; personas: { persona: string; roles: PlatformRole[] }[]; meta: { demo_today: string } };
const T = S.tables;
const NOW = S.meta.demo_today;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const raw = (t: string) => b.raw(t as never) as unknown as Record<string, any>[];
const lastAudit = () => [...b.raw('audit_events')].sort((x, y) => x.seq - y.seq).pop()!;
const X = (): ScoreInput => ({ courses: T.courses, surveys: T.eval_surveys, completions: completionsOf(T.training_records, T.enrolments), responses: T.eval_responses, attempts: T.attempts,
  observations: T.l3_observations, kpis: T.course_kpi_links, flags: T.redesign_flags });
const DI = (): DemandInput => ({ people: T.people, courses: T.courses, curriculum_rules: T.curriculum_rules, training_records: T.training_records, enrolments: T.enrolments,
  qual_records: T.qual_records, qual_standards: T.qual_standards, links: T.needs_links, roadmaps: T.roadmaps, coach_feedback: T.coach_feedback, future_interest: T.future_interest,
  future_resources: T.future_resources, klra_actions: T.klra_actions, klra_positions: T.klra_positions });
const counts = (c: CourseCard) => [c.completions, c.l1.n, c.l1.rate, c.l1.recommend, c.l2.pairs, c.l3.scheduled, c.l3.done, c.l3.overdue];

describe('F25 rules (shared with SQL)', () => {
  it('rounding, dates, windows and validation', () => {
    expect([rdiv(25, 10), rdiv(-25, 10), rdiv(24, 10), rdiv(0, 7)]).toEqual([3, -3, 2, 0]);
    expect(addDaysIso('2026-01-31', 90)).toBe('2026-05-01');
    expect(l3DueOn('2026-07-27')).toBe('2026-10-25');
    expect(l1Open({ completed_on: '2026-07-11' }, '2026-10-09')).toBe(true);
    expect(l1Open({ completed_on: '2026-07-10' }, '2026-10-09')).toBe(false);
    expect([l3Status({ status: 'scheduled', due_on: '2026-12-01' }, '2026-10-09'), l3Status({ status: 'scheduled', due_on: '2026-11-01' }, '2026-10-09'),
      l3Status({ status: 'scheduled', due_on: '2026-10-01' }, '2026-10-09'), l3Status({ status: 'done', due_on: '2026-10-01' }, '2026-10-09')]).toEqual(['scheduled', 'due', 'overdue', 'done']);
    expect(validRatings({ relevance: 5, objectives: 4, delivery: 3, confidence: 2, time: 1 })).toBe(true);
    expect(validRatings({ relevance: 6, objectives: 4, delivery: 3, confidence: 2, time: 1 })).toBe(false);
    expect(validRatings({ relevance: 4.5, objectives: 4, delivery: 3, confidence: 2, time: 1 })).toBe(false);
    const tpl = l3Template(T.courses.find((c) => c.id === 'c-get'));
    expect(tpl.length).toBe(4);
    expect(validL3Items(tpl.map((i) => ({ key: i.key, rating: 'yes' })), tpl)).toBe(true);
    expect(validL3Items(tpl.map((i) => ({ key: i.key, rating: 'na' })), tpl)).toBe(false);
    expect(validL3Items(tpl.slice(1).map((i) => ({ key: i.key, rating: 'yes' })), tpl)).toBe(false);
    expect([kpiTrend([{ value: 3 }, { value: 2 }], 'lower_better'), kpiTrend([{ value: 3 }, { value: 4 }], 'lower_better'), kpiTrend([{ value: 1 }], 'higher_better')]).toEqual(['improving', 'worsening', 'flat']);
  });
  it('A1: course results show only at n >= 10; every count on every card is suppressed or >= 10', () => {
    const cards = scorecard(X(), NOW);
    expect(cards.length).toBe(T.eval_surveys.length);
    for (const c of cards) for (const v of [c.completions, c.l1.n, c.l2.pairs, c.l3.scheduled, c.l3.done, c.l3.overdue]) expect(v === null || v >= MIN_N).toBe(true);
    const small = cards.find((c) => c.course_id === 'c-coct')!;
    expect(T.eval_responses.filter((r) => r.course_id === 'c-coct').length).toBeGreaterThan(0);
    expect(small.l1.suppressed && small.l1.n === null && Object.values(small.l1.items).every((v) => v === null)).toBe(true);
    expect(small.reasons.map((r) => r.code)).toContain('l1_small');
    const big = cards.find((c) => c.course_id === 'c-get')!;
    expect(big.l1.n).toBeGreaterThanOrEqual(10);
  });
  it('A3: L2 gain uses only released attempts', () => {
    const x = X();
    const base = courseCard('c-get', x, NOW);
    const post = x.attempts.filter((a) => a.form_id === 'form-l2-post-c-get' && a.released);
    const unreleased = x.attempts.map((a) => (a.id === post[0].id ? { ...a, released: false, status: 'graded' } : a));
    const after = courseCard('c-get', { ...x, attempts: unreleased }, NOW);
    expect(after.l2.pairs).toBe((base.l2.pairs ?? 0) - 1);
    expect(after.l2.unreleased_excluded).toBe(true);
    // an unreleased attempt with a perfect score does not change the means
    const extra = [...x.attempts, { ...post[1], id: 'at-x', person_id: post[1].person_id, score: 100, status: 'graded', released: false, submitted_at: '2026-10-08T10:00:00Z' }];
    expect(courseCard('c-get', { ...x, attempts: extra }, NOW).l2.post).toBe(base.l2.post);
  });
  it('A4: the L4 panel always carries SAMPLE and the caveat; a worsening KPI is association only and never triggers redesign', () => {
    const cards = scorecard(X(), NOW);
    expect(cards.every((c) => c.l4.sample === true && c.l4.caveat === true)).toBe(true);
    const mnt = cards.find((c) => c.course_id === 'c-mnt-cont')!;
    expect(mnt.reasons.some((r) => r.code === 'kpi_worse')).toBe(true);
    expect(mnt.redesign).toBe(false);
    expect(T.course_kpi_links.every((k) => k.sample === true)).toBe(true);
  });
  it('redesign candidates carry their evidence as reasons (security awareness: low relevance and low gain; HU: low transfer)', () => {
    const cards = scorecard(X(), NOW);
    const sec = cards.find((c) => c.course_id === 'c-sec-aw')!, hu = cards.find((c) => c.course_id === 'c-hu')!;
    expect(sec.redesign && sec.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(['low_relevance', 'low_gain']));
    expect(hu.redesign && hu.reasons.some((r) => r.code === 'low_transfer')).toBe(true);
    for (const c of cards) for (const r of c.reasons) expect(hasKey(r.key)).toBe(true);
  });
  it('A2: L3 observations are due 90 days after completion, for qualifying courses only', () => {
    const qual = new Set(T.courses.filter((c) => c.qualifying).map((c) => c.id));
    expect(T.l3_observations.length).toBeGreaterThan(100);
    for (const o of T.l3_observations) { expect(o.due_on).toBe(l3DueOn(o.completed_on)); expect(qual.has(o.course_id)).toBe(true); }
    const next = l3ToSchedule([{ ref: 'tr:x', person_id: 'w-ro-01', course_id: 'c-scwe', completed_on: '2026-09-01' }, { ref: 'tr:y', person_id: 'w-ro-01', course_id: 'c-hu', completed_on: '2026-09-01' }], T.courses, T.eval_surveys, new Set());
    expect(next.map((n) => [n.c.course_id, n.due_on])).toEqual([['c-hu', '2026-11-30']]);
  });
  it('committee pack prints suppressed cells as <10', () => {
    const rows = packRows(scorecard(X(), NOW), (id) => ({ code: id, title: id }), (k) => k.kpi, 'yes', 'no');
    const coct = rows.find((r) => r.code === 'c-coct')!;
    expect(coct.l1_n).toBe('<10');
    expect(rows.find((r) => r.code === 'c-get')!.relevance).toMatch(/^\d\.\d$/);
  });
});

describe('F25 local RPCs and RBAC', () => {
  it('A1 (RLS): instructors, managers and the training manager read no individual L1 response but their own', async () => {
    for (const p of ['k-instructor', 'training-mgr', 'sro', 'chco']) {
      await as(p);
      const me = b.identity().personId;
      const rows = await b.list('eval_responses');
      expect(rows.every((r) => r.person_id === me), p).toBe(true);
      expect(rows.length).toBeLessThan(T.eval_responses.length);
    }
    expect(SCHEMA.eval_responses.read).toEqual([{ res: 'learning_analytics', person: 'person_id', where: 'open_read' }]);
    expect(T.eval_responses.every((r) => r.open_read === false)).toBe(true);
  });
  it('A1: the scorecard is for aggregate holders; employees are refused (audited)', async () => {
    await as('k-instructor');
    const r = await b.rpc.effectivenessReport(null);
    expect(r.ok).toBe(true);
    expect((r.data as EffectivenessReport).cards.every((c) => counts(c).every((v) => v === null || v >= 10))).toBe(true);
    await as('k-ro');
    const no = await b.rpc.effectivenessReport(null);
    expect(no.code).toBe('forbidden');
    expect(lastAudit().outcome).toBe('refused');
  });
  it('L1: own completion only, once, inside 90 days, ratings 1-5; submitting schedules the L3 observation of a qualifying course 90 days out', async () => {
    const today = todayIso();
    const done = addDaysIso(today, -10);
    b.rawInsert('enrolments', { id: 'en-t1', person_id: 'p-sro', course_id: 'c-hu', status: 'completed', source: 'self', enrolled_at: `${done}T08:00:00Z`, progress_pct: 100, completed_at: `${done}T08:00:00Z` } as never);
    b.rawInsert('enrolments', { id: 'en-t2', person_id: 'p-sro', course_id: 'c-hu', status: 'completed', source: 'self', enrolled_at: '2026-01-01T08:00:00Z', progress_pct: 100, completed_at: `${addDaysIso(today, -120)}T08:00:00Z` } as never);
    const R = { relevance: 4, objectives: 4, delivery: 5, confidence: 3, time: 4 };
    await as('sro');
    expect((await b.rpc.submitL1({ completion_ref: 'en:en-t1', ratings: { ...R, time: 0 }, recommend: true })).code).toBe('invalid');
    expect((await b.rpc.submitL1({ completion_ref: 'en:en-t2', ratings: R, recommend: true })).code).toBe('window_closed');
    const ok = await b.rpc.submitL1({ completion_ref: 'en:en-t1', ratings: R, recommend: true });
    expect(ok.ok, ok.message).toBe(true);
    expect(ok.data?.l3_id).toBe('l3:en:en-t1');
    const obs = raw('l3_observations').find((o) => o.id === 'l3:en:en-t1')!;
    expect(obs.due_on).toBe(addDaysIso(done, 90));
    expect(obs.observer_person_id).not.toBe('p-sro');
    expect((await b.rpc.submitL1({ completion_ref: 'en:en-t1', ratings: R, recommend: true })).code).toBe('duplicate');
    await as('k-instructor');
    expect((await b.rpc.submitL1({ completion_ref: 'en:en-t1', ratings: R, recommend: true })).code).toBe('not_found');
    expect(lastAudit().reason).toContain(MSG.completion_not_found);
  });
  it('A2: the training manager schedules missing L3 observations at +90 days; others are refused', async () => {
    const done = addDaysIso(todayIso(), -5);
    b.rawInsert('enrolments', { id: 'en-t3', person_id: 'w-ro-01', course_id: 'c-coct', status: 'completed', source: 'role_rule', enrolled_at: `${done}T08:00:00Z`, progress_pct: 100, completed_at: `${done}T08:00:00Z` } as never);
    b.rawInsert('enrolments', { id: 'en-t4', person_id: 'w-ro-01', course_id: 'c-scwe', status: 'completed', source: 'role_rule', enrolled_at: `${done}T08:00:00Z`, progress_pct: 100, completed_at: `${done}T08:00:00Z` } as never);
    await as('sro');
    expect((await b.rpc.scheduleL3(null)).code).toBe('forbidden');
    await as('training-mgr');
    const r = await b.rpc.scheduleL3(null);
    expect(r.ok && r.data!.scheduled).toBe(1);
    expect(raw('l3_observations').find((o) => o.id === 'l3:en:en-t3')!.due_on).toBe(addDaysIso(done, 90));
    expect(raw('l3_observations').some((o) => o.id === 'l3:en:en-t4')).toBe(false);
    expect((await b.rpc.scheduleL3(null)).data!.scheduled).toBe(0);
  });
  it('L3 board and record: the line manager sees their team and records from day 60 with a complete checklist (ledgered); instructors are refused', async () => {
    await as('k-instructor');
    expect((await b.rpc.l3Board()).code).toBe('forbidden');
    await as('sro');
    const board = (await b.rpc.l3Board()).data as L3Board;
    expect(board.mode).toBe('mine');
    expect(board.rows.length).toBeGreaterThan(0);
    expect(board.rows.length).toBeLessThan(T.l3_observations.length);
    const target = board.rows.find((r) => r.can_record)!;
    expect(target).toBeTruthy();
    const items = target.items.map((i, n) => ({ key: i.key, rating: (n ? 'partly' : 'yes') as 'yes' | 'partly' }));
    expect((await b.rpc.recordL3(target.id, { items: items.slice(1) })).code).toBe('invalid');
    const rec = await b.rpc.recordL3(target.id, { items, note: 'Observed on shift' });
    expect(rec.ok, rec.message).toBe(true);
    expect(lastAudit().ledger_status).not.toBe('not_applicable');
    expect((await b.rpc.recordL3(target.id, { items })).code).toBe('closed');
    await as('training-mgr');
    const all = (await b.rpc.l3Board()).data as L3Board;
    expect(all.mode).toBe('all');
    const early = all.rows.find((r) => r.view === 'scheduled');
    if (early) expect((await b.rpc.recordL3(early.id, { items: early.items.map((i) => ({ key: i.key, rating: 'yes' })) })).code).toBe('too_early');
  });
  it('redesign flag: training manager only, one open flag per course, evidence stored', async () => {
    await as('k-instructor');
    expect((await b.rpc.flagRedesign('c-hu', 'Transfer is low; add field coaching.')).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.flagRedesign('c-hu', 'short')).code).toBe('invalid');
    const r = await b.rpc.flagRedesign('c-hu', 'Transfer is low; add field coaching.');
    expect(r.ok).toBe(true);
    expect(raw('redesign_flags').find((f) => f.id === r.data!.id)!.reasons.some((x: { code: string }) => x.code === 'low_transfer')).toBe(true);
    expect((await b.rpc.flagRedesign('c-hu', 'Transfer is low; add field coaching.')).code).toBe('duplicate');
    expect((await b.rpc.flagRedesign('c-sec-aw', 'Already flagged in the seed data.')).code).toBe('duplicate');
  });
});

describe('F26 rules (shared with SQL)', () => {
  it('quarters and month arithmetic match Postgres', () => {
    expect(addMonthsIso('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsIso('2025-11-30', 3)).toBe('2026-02-28');
    expect(quarterOfIso('2026-10-08')).toBe('2026-Q4');
    expect(quarterBounds('2027-Q1')).toEqual({ start: '2027-01-01', end: '2027-03-31' });
    expect(periodsFrom('2026-10-08')).toEqual(['2026-Q4', '2027-Q1', '2027-Q2', '2027-Q3']);
    expect(needQuarter('2025-01-01', '2026-10-08')).toBe('2026-Q4');
    expect(proposalSize(50, 16, 'classroom')).toEqual({ sessions: 3, seats_each: 16 });
    expect(proposalSize(10, 0, 'simulator')).toEqual({ sessions: 2, seats_each: 6 });
    expect(proposalDates('2027-Q1', 3)).toEqual(['2027-01-23', '2027-02-15', '2027-03-09']);
  });
  it('B1: every demand number decomposes into its sources; the drill-down sums match; the seed equals the rules', () => {
    for (const p of periodsFrom(NOW)) {
      const rows = computeDemand(DI(), p, NOW);
      expect(rows).toEqual(T.demand_snapshots.filter((s) => s.period === p).map(({ computed_at, computed_by, open_read, ...r }) => r));
      for (const r of rows) expect(r.detail.reduce((t, d) => t + d.count, 0)).toBe(r.count);
      const rep = needsReport(T.demand_snapshots, { sessions: T.sessions, simulator_slots: T.simulator_slots, proposals: T.session_proposals, courses: T.courses }, p, true);
      for (const r of rep.rows) {
        expect(SOURCES.reduce((t, s) => t + (r.sources[s] ?? 0), 0)).toBe(r.total);
        for (const s of SOURCES) expect(r.detail[s].reduce((t, d) => t + (d.count ?? 0), 0)).toBe(r.sources[s]);
      }
      expect(rep.total).toBe(rows.reduce((t, r) => t + r.count, 0));
    }
    expect(new Set(T.demand_snapshots.map((s) => s.source)).size).toBe(6);
  });
  it('a person needing a course for two reasons in one quarter is counted once, under the higher-priority source', () => {
    const p = periodsFrom(NOW)[0];
    const exp = computeDemand(DI(), p, NOW).filter((r) => r.course_id === 'c-get');
    const x = DI();
    const pid = T.qual_records.find((q) => q.standard_id === 'qs-get' && q.status === 'qualified' && needQuarter(addDaysIso(q.expires_on, -90), NOW) === p)?.person_id;
    if (pid) {
      const withCoach = { ...x, coach_feedback: [...x.coach_feedback, { id: 'cf-x', person_id: pid, item_kind: 'course', item_id: 'c-get', signal: 'saved', at: `${addDaysIso(NOW, -10)}T08:00:00Z` }] };
      expect(computeDemand(withCoach, p, NOW).filter((r) => r.course_id === 'c-get')).toEqual(exp);
    }
  });
  it('B2: cells under 10 are suppressed in exports and for aggregate viewers, but used in totals', () => {
    const p = periodsFrom(NOW)[0];
    const cap = { sessions: T.sessions, simulator_slots: T.simulator_slots, proposals: T.session_proposals, courses: T.courses };
    const exact = needsReport(T.demand_snapshots, cap, p, true), agg = needsReport(T.demand_snapshots, cap, p, false);
    expect(agg.total).toBe(exact.total);
    expect(agg.rows.map((r) => r.total)).toEqual(exact.rows.map((r) => r.total));
    for (const r of agg.rows) for (const s of SOURCES) { const v = r.sources[s]; expect(v === null || v >= 10).toBe(true); }
    const csv = exportRows(exact, (id) => ({ code: id, title: id }));
    const small = exact.rows.find((r) => SOURCES.some((s) => (r.sources[s] ?? 0) > 0 && (r.sources[s] ?? 0) < 10))!;
    const line = csv.find((c) => c.code === small.course_id)!;
    expect(Object.values(line)).toContain('<10');
    expect(line.total).toBe(String(small.total));
  });
  it('SIMULATED intake adds initial-course demand on screen only', () => {
    const p = periodsFrom(NOW)[0];
    const rep = needsReport(T.demand_snapshots, { sessions: T.sessions, simulator_slots: T.simulator_slots, proposals: [], courses: T.courses }, p, true);
    const sim = applyIntake(rep, { dnt: 20, gpo: 10 }, T.courses);
    expect(sim.simulated).toBe(true);
    expect(sim.total).toBe(rep.total + 20 * 5 + 10 * 5);
    expect(sim.rows.find((r) => r.course_id === 'c-loit-sys')!.total).toBe((rep.rows.find((r) => r.course_id === 'c-loit-sys')?.total ?? 0) + 20);
  });
});

describe('F26 local RPCs and RBAC', () => {
  it('report: exact for the training manager, suppressed cells for HR; employees refused', async () => {
    await as('training-mgr');
    const tm = (await b.rpc.demandReport(null)).data as DemandReportResult;
    expect(tm.exact && tm.can_compute).toBe(true);
    expect(tm.periods).toEqual(periodsFrom(todayIso()));
    await as('chco');
    const hr = (await b.rpc.demandReport(null)).data as DemandReportResult;
    expect(hr.exact || hr.can_compute).toBe(false);
    expect(hr.total).toBe(tm.total);
    expect(hr.rows.flatMap((r) => SOURCES.map((s) => r.sources[s])).every((v) => v === null || v >= 10)).toBe(true);
    await as('k-ro');
    expect((await b.rpc.demandReport(null)).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.demandReport('2025-Q1')).code).toBe('invalid');
  });
  it('B3: proposals are drafts in their own table; no session is created or published; withdraw and link rules', async () => {
    const next = periodsFrom(todayIso())[1];
    const sessions = raw('sessions').length;
    await as('sro');
    expect((await b.rpc.proposeSessions(next, 'c-get')).code).toBe('forbidden');
    await as('training-mgr');
    const rep = (await b.rpc.demandReport(next)).data as DemandReportResult;
    const row = rep.rows.find((r) => r.shortfall > r.draft_seats)!;
    const r = await b.rpc.proposeSessions(next, row.course_id, 'note');
    expect(r.ok, r.message).toBe(true);
    const p = raw('session_proposals').find((x) => x.id === r.data!.id)!;
    expect(p.status).toBe('draft');
    expect(p.sessions * p.seats_each).toBeGreaterThanOrEqual(row.shortfall - row.draft_seats);
    expect(raw('sessions').length).toBe(sessions);
    const again = await b.rpc.proposeSessions(next, row.course_id);
    expect(again.code).toBe('no_shortfall');
    expect((await b.rpc.linkProposal(r.data!.id, 's-coct-b')).code).toBe('invalid');
    expect((await b.rpc.withdrawProposal(r.data!.id)).ok).toBe(true);
    expect((await b.rpc.withdrawProposal(r.data!.id)).code).toBe('closed');
  });
  it('B3: a draft links to a real session of the same course in its quarter (created through the M04 path)', async () => {
    const draft = T.session_proposals[0];
    const b0 = quarterBounds(draft.period);
    b.rawInsert('sessions', { id: 's-w4e1', course_id: draft.course_id, starts_at: `${b0.start.slice(0, 8)}20T08:00:00Z`, ends_at: `${b0.start.slice(0, 8)}20T16:00:00Z`, location: 'Training Centre', capacity: 16, kind: 'class', priority: 'mandatory', audience: 'staff', public_summary: false, status: 'scheduled' } as never);
    await as('training-mgr');
    const r = await b.rpc.linkProposal(draft.id, 's-w4e1');
    expect(r.ok, r.message).toBe(true);
    expect(raw('session_proposals').find((x) => x.id === draft.id)!.status).toBe('scheduled');
  });
  it('B4: changing a roadmap (F06) changes next quarter\'s demand after recompute', async () => {
    const next = periodsFrom(todayIso())[1];
    const rm = T.roadmaps.find((r) => r.active !== false && T.people.find((p) => p.id === r.person_id)?.kind === 'staff')!;
    await as('training-mgr');
    expect((await b.rpc.computeDemand(next)).ok).toBe(true);
    const before = raw('demand_snapshots').find((s) => s.id === `dm:${next}:c-mcc:roadmap`)?.count ?? 0;
    const start = addDaysIso(quarterBounds(next).start, 20);
    b.rawUpdate('roadmaps', rm.id, { plan: [...(rm.plan as unknown[]), { id: 'dev-course-c-mcc', lane: 'development', kind: 'course', course_id: 'c-mcc', start, end: start }] } as never);
    const r = await b.rpc.computeDemand(next);
    expect(r.ok).toBe(true);
    expect(raw('demand_snapshots').find((s) => s.id === `dm:${next}:c-mcc:roadmap`)!.count).toBe(before + 1);
    // removing it again sets the cell back (never removed: count kept as a row)
    b.rawUpdate('roadmaps', rm.id, { plan: rm.plan } as never);
    await b.rpc.computeDemand(next);
    expect(raw('demand_snapshots').find((s) => s.id === `dm:${next}:c-mcc:roadmap`)!.count).toBe(before);
    await as('chco');
    expect((await b.rpc.computeDemand(next)).code).toBe('forbidden');
  });
});

describe('M25 routes, guards and i18n', () => {
  const roles = (p: string) => S.personas.find((x) => (x as unknown as { id?: string; persona?: string }).id === p || x.persona === p)?.roles ?? [];
  it('every route has EN and AR titles; guards follow learning_analytics', () => {
    for (const r of routes) { expect(hasKey(`m25.routes.${r.id}.title`)).toBe(true); expect(hasKey(`m25.routes.${r.id}.purpose`)).toBe(true); }
    const g = (id: string) => routes.find((r) => r.id === id)!.guard;
    const can = (rs: PlatformRole[], id: string) => checkGuard(g(id), { status: 'signed_in', roles: rs } as never) === 'ok';
    expect(can(['employee', 'instructor'] as PlatformRole[], 'training-effectiveness')).toBe(true);
    expect(can(['employee'] as PlatformRole[], 'training-effectiveness')).toBe(false);
    expect(can(['employee', 'manager'] as PlatformRole[], 'training-observations')).toBe(true);
    expect(can(['employee', 'instructor'] as PlatformRole[], 'training-observations')).toBe(false);
    expect(can(['employee'] as PlatformRole[], 'my-learning-feedback')).toBe(true);
    expect(can(['partner_user'] as PlatformRole[], 'my-learning-feedback')).toBe(false);
    expect(can(['hr_analyst'] as PlatformRole[], 'training-needs')).toBe(true);
    expect(grantsFor(['employee'], 'learning_analytics').has('Own')).toBe(true);
    void roles;
  });
});
