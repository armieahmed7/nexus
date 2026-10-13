/** FS82 Rolling mobility micro-grants + FS83 UAE energy consortium trainee cohort (FS wave I · E4, M36): one named test per acceptance
 *  criterion on the local path (fixed clock 12 Oct 2026), plus the shared rules, RBAC, the seed, routes, benchmarks and i18n. The SQL path
 *  (kafaa_gr_* = grants.ts, kafaa_cc_* = consortium.ts, the fourteen RPCs, RLS, grants, seed rows) is proved by
 *  scripts/validate/fs94-grants-consortium.mjs (PGlite). The partner trainee-only flows of a partner without Kafa'a access and the
 *  k-lo-trainee / k-hr-analyst flows run on the local backend only (Kafa'a-only personas have no NEXUS account). */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { grantsFor } from '../../src/auth/policy';
import en from '../../src/i18n/m36.en.json';
import ar from '../../src/i18n/m36.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m36/routes';
import { CONTACT_PATTERN as M31_CONTACT } from '../../src/modules/m31/literacy';
import {
  CONTACT_PATTERN as GR_CONTACT, MIN_GROUP, addDays, applicationProblem, cellOf, committedIn, decisionProblem, eligibility, grantStats, nextRoundSlot, openRound, outputLevel, outputState, roundPhase,
  scheduleProblem,
} from '../../src/modules/m36/grants';
import {
  CONTACT_PATTERN as CC_CONTACT, cohortPhase, confirmRoute, consortiumOrg, consortiumStats, enecTraineeEligible, memberDecisionProblem, nominationProblem, partnerOf, traineeCode, visitLevel, visitProblem,
} from '../../src/modules/m36/consortium';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const DAY0 = '2026-10-12';
const clock = (d: string) => vi.setSystemTime(new Date(`${d}T08:00:00Z`));
vi.useFakeTimers({ toFake: ['Date'] });
clock(DAY0);
afterAll(() => { vi.useRealTimers(); });

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => (b.raw(t as never) as unknown as Row[]);
const audits = (action: string, outcome = 'ok') => raw('audit_events').filter((a) => a.action === action && a.outcome === outcome);
const fresh = async () => { clock(DAY0); await b.reset(); };
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

const SKILL = 'sk-fs-dp-dic';
const application = (over: Row = {}) => ({
  kind: 'short_course', title: 'Digital instrumentation short course', purpose: 'Learn the basics of digital instrumentation and control for plant upgrades.',
  destination: 'Abu Dhabi training institute (synthetic)', starts_on: '2027-01-12', ends_on: '2027-01-14',
  costs: [{ item: 'transport', amount: 1200 }, { item: 'registration', amount: 4200 }], skill_id: SKILL, output_kind: 'report', ...over,
});
const ctxSkills = Object.fromEntries(T.skills.map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }]));
const rounds = () => T.grant_rounds.slice().sort((a, c) => (a.closes_on < c.closes_on ? -1 : 1));

// ═════════════════════════════════ FS82
describe('FS82 · rounds open and close on schedule (acceptance 1)', () => {
  it('the seeded rounds are contiguous bi-monthly windows: the 10th of an even month, decisions 14 days later, the next opens the day after', () => {
    const rs = rounds();
    expect(rs.map((r) => r.id)).toEqual(['gr-2026-06', 'gr-2026-08', 'gr-2026-10', 'gr-2026-12']);
    rs.forEach((r, i) => {
      expect(r.closes_on.slice(8, 10)).toBe('10');
      expect(Number(r.closes_on.slice(5, 7)) % 2).toBe(0);
      expect(r.decide_by).toBe(addDays(r.closes_on, 14));
      if (i > 0) expect(r.opens_on).toBe(addDays(rs[i - 1].closes_on, 1));
    });
    expect(nextRoundSlot('2026-12-10', DAY0)).toEqual({ id: 'gr-2027-02', opens_on: '2026-12-11', closes_on: '2027-02-10', decide_by: '2027-02-24' });
  });
  it('phases come from the dates only: on 10 Oct the round to 10 Oct is open, on 11 Oct it is closed and the round to 10 Dec is open', () => {
    const r10 = T.grant_rounds.find((r) => r.id === 'gr-2026-10')!;
    const r12 = T.grant_rounds.find((r) => r.id === 'gr-2026-12')!;
    expect([roundPhase(r10, '2026-10-10'), roundPhase(r10, '2026-10-11')]).toEqual(['open', 'closed']);
    expect([roundPhase(r12, '2026-10-10'), roundPhase(r12, '2026-10-11'), roundPhase(r12, '2026-12-10'), roundPhase(r12, '2026-12-11')]).toEqual(['scheduled', 'open', 'open', 'closed']);
    expect(openRound(T.grant_rounds, DAY0)?.id).toBe('gr-2026-12');
    expect(openRound(T.grant_rounds, '2026-12-11')).toBeNull();
  });
  it('on a fixed clock: applying works in the open round, is refused once it closes (no_round), and HR scheduling reopens the cycle (audit + ledger)', async () => {
    await fresh();
    await as('nse');
    const ok = await b.rpc.applyGrant(application());
    expect(ok.ok).toBe(true);
    expect(ok.data?.round_id).toBe('gr-2026-12');
    expect((await b.rpc.applyGrant(application())).code).toBe('duplicate');
    clock('2026-12-11');
    await as('qc-inspector');
    expect((await b.rpc.applyGrant(application({ starts_on: '2027-03-01', ends_on: '2027-03-03' }))).code).toBe('no_round');
    await as('qc-inspector');
    expect((await b.rpc.scheduleGrantRound({ budget: 150000, max_award: 15000 })).code).toBe('forbidden');
    await as('k-hr-analyst');
    const l0 = raw('ledger_local').length;
    const s = await b.rpc.scheduleGrantRound({ budget: 150000, max_award: 15000, note: 'Spring conference season.' });
    expect(s.ok).toBe(true);
    expect(s.data).toEqual({ id: 'gr-2027-02', opens_on: '2026-12-11', closes_on: '2027-02-10', decide_by: '2027-02-24' });
    expect(audits('grant.round.schedule').length).toBe(1);
    expect(raw('ledger_local').length).toBe(l0); // k-hr-analyst is a Kafa'a-only persona: the ledger mirror skips it (SQL writes kafaa.grant.round)
    // gr-2027-02 opens today, so the round after it may be scheduled; once that one waits to open, scheduling again is refused
    expect((await b.rpc.scheduleGrantRound({ budget: 120000, max_award: 15000 })).data?.id).toBe('gr-2027-04');
    expect(roundPhase(raw('grant_rounds').find((r) => r.id === 'gr-2027-04')!, '2026-12-11')).toBe('scheduled');
    expect((await b.rpc.scheduleGrantRound({ budget: 150000, max_award: 15000 })).code).toBe('exists');
    await as('qc-inspector');
    const late = await b.rpc.applyGrant(application({ starts_on: '2027-03-01', ends_on: '2027-03-03' }));
    expect(late.ok).toBe(true);
    expect(late.data?.round_id).toBe('gr-2027-02');
    expect(raw('grant_rounds').find((r) => r.id === 'gr-2027-02')?.simulated).toBe(true);
  }, 60000);
  it('decisions wait for the deadline and are made by the HR director only; every decision and refusal is audited, with a ledger row', async () => {
    await fresh();
    await as('k-hr-analyst');
    expect((await b.rpc.decideGrant({ application_id: 'ga-2026-10-01', decision: 'approve', award: 7000 })).code).toBe('forbidden');
    expect(audits('grant.decide', 'refused').length).toBe(1);
    await as('chco');
    expect((await b.rpc.decideGrant({ application_id: 'ga-2026-12-02', decision: 'approve' })).code).toBe('round_open');
    const l0 = raw('ledger_local').length;
    const r = await b.rpc.decideGrant({ application_id: 'ga-2026-10-01', decision: 'approve', award: 7000 });
    expect(r.ok).toBe(true);
    expect(r.data).toMatchObject({ status: 'approved', awarded: 7000, committed: 7000 });
    expect(audits('grant.decide').length).toBe(1);
    expect(raw('ledger_local').length).toBe(l0 + 1);
    expect(raw('ledger_local').at(-1)?.action).toBe('kafaa.grant.decide');
    expect(raw('notifications').some((n) => n.id === 'nt-gr-ga-2026-10-01-decided' && n.person_id === 'p-buyer')).toBe(true);
    expect((await b.rpc.decideGrant({ application_id: 'ga-2026-10-01', decision: 'decline', note: 'Again' })).code).toBe('decided');
    expect((await b.rpc.decideGrant({ application_id: 'ga-2026-10-02', decision: 'decline', note: 'no' })).code).toBe('invalid');
    const d = await b.rpc.decideGrant({ application_id: 'ga-2026-10-02', decision: 'decline', note: 'Please apply again with a shorter course.' });
    expect(d.data?.status).toBe('declined');
    expect(raw('grant_applications').find((a) => a.id === 'ga-2026-10-02')?.decision_note).toBe('Please apply again with a shorter course.');
  }, 60000);
  it('the HR director never takes a round over its SIMULATED budget (refused "budget"), and never decides their own application', async () => {
    await fresh();
    await as('chco');
    const waiting = raw('grant_applications').filter((a) => a.round_id === 'gr-2026-10' && a.status === 'submitted').sort((x, y) => (x.id < y.id ? -1 : 1));
    const budget = Number(T.grant_rounds.find((r) => r.id === 'gr-2026-10')!.budget);
    expect(waiting.reduce((m, a) => m + Number(a.amount), 0)).toBeGreaterThan(budget);
    const codes: string[] = [];
    for (const a of waiting) codes.push((await b.rpc.decideGrant({ application_id: a.id, decision: 'approve' })).code);
    expect(codes).toContain('budget');
    expect(committedIn(raw('grant_applications'), 'gr-2026-10')).toBeLessThanOrEqual(budget);
    const app: Row = { ...T.grant_applications.find((a) => a.id === 'ga-2026-10-03')!, person_id: 'p-chco' };
    const r10 = T.grant_rounds.find((r) => r.id === 'gr-2026-10')!;
    expect(decisionProblem({ application_id: app.id, decision: 'approve', award: 400 }, app, r10, 0, DAY0)).toBe('award');
    expect(decisionProblem({ application_id: app.id, decision: 'approve', award: 20000 }, app, r10, 0, DAY0)).toBe('award');
    const left = raw('grant_applications').find((a) => a.round_id === 'gr-2026-10' && a.status === 'submitted')!;
    b.rawUpdate('grant_applications' as never, left.id, { person_id: 'p-chco' } as never);
    expect((await b.rpc.decideGrant({ application_id: left.id, decision: 'decline', note: 'Own application test.' })).code).toBe('maker_checker');
  }, 60000);
});

describe('FS82 · budgets are labelled SIMULATED (acceptance 2)', () => {
  it('every round and every award is SIMULATED (simulated flag, AED, demo labels), and the refusal texts say so', async () => {
    expect(T.grant_rounds.every((r) => r.simulated === true && r.currency === 'AED' && r.sample === true)).toBe(true);
    expect(T.grant_applications.every((a) => a.sample === true)).toBe(true);
    expect(en.gr.simNote).toMatch(/SIMULATED/);
    expect(ar.gr.simNote).toMatch(/مُحاكاة/);
    expect(en.grh.committed).toMatch(/SIMULATED/);
    expect(en.gr.problem.decision.budget).toMatch(/SIMULATED/);
    await fresh();
    await as('chco');
    const r = await b.rpc.grantStats();
    expect(r.ok).toBe(true);
    expect(r.data!.rounds.map((x) => x.budget)).toEqual(rounds().map((x) => Number(x.budget)));
  });
});

describe('FS82 · statistics under 10 are suppressed (acceptance 3)', () => {
  it('grantStats: every count is 0 or 10+ or suppressed; a rate needs 10 decided; money committed needs 10 awards; no person field', async () => {
    expect([0, 1, 9, 10, 37].map((v) => cellOf(v))).toEqual([{ value: 0, suppressed: false }, { value: null, suppressed: true }, { value: null, suppressed: true }, { value: 10, suppressed: false }, { value: 37, suppressed: false }]);
    expect(MIN_GROUP).toBe(10);
    await fresh();
    await as('nse');
    const r = await b.rpc.grantStats();
    expect(r.ok).toBe(true);
    const g = r.data!;
    expect(g).toEqual(grantStats(T.grant_rounds, T.grant_applications, DAY0));
    const cells = [g.totals.applications, g.totals.approved, g.totals.outputs_accepted, ...g.rounds.flatMap((x) => [x.applications, x.approved, x.declined, x.outputs_submitted]), ...g.by_kind.map((k) => k.applications), ...g.by_output.map((k) => k.promised)];
    for (const c of cells) expect(c.value === null ? c.suppressed : c.value === 0 || c.value >= 10).toBe(true);
    expect(cells.some((c) => c.suppressed)).toBe(true);
    expect(g.totals.applications.value).toBe(T.grant_applications.filter((a) => a.status !== 'withdrawn').length); // withdrawn ones are not counted
    for (const x of g.rounds) if (x.committed != null) expect(T.grant_applications.filter((a) => a.round_id === x.round_id && a.status === 'approved').length).toBeGreaterThanOrEqual(10);
    expect(JSON.stringify(g)).not.toMatch(/person_id|initials|p-nse/);
    await as('alnoor-gm');
    expect((await b.rpc.grantStats()).code).toBe('forbidden');
    await as(null);
    expect((await b.rpc.grantStats()).code).toBe('not_signed_in');
  });
});

describe('FS82 · applications, eligibility, outputs as evidence', () => {
  it('eligibility: early-career staff (under 10 years), placement students through HR only; experienced staff and partners are refused', async () => {
    const p = (o: Row) => ({ kind: 'staff', status: 'active', hire_date: '2018-01-01', ...o });
    expect(eligibility(p({}), DAY0, false)).toMatchObject({ eligible: true, basis: 'early_career', years: 8 });
    expect(eligibility(p({ hire_date: '2016-10-12' }), DAY0, false)).toMatchObject({ eligible: false, years: 10 });
    expect(eligibility({ kind: 'applicant', status: 'active' }, DAY0, true)).toMatchObject({ eligible: true, basis: 'placement' });
    expect(eligibility({ kind: 'applicant', status: 'active' }, DAY0, false).eligible).toBe(false);
    await fresh();
    await as('alnoor-gm');
    expect((await b.rpc.applyGrant(application())).code).toBe('forbidden');
    await as('k-student');
    expect((await b.rpc.applyGrant(application())).code).toBe('forbidden');
  });
  it('a light application: activity after the deadline, cost lines up to the round maximum, a current non-security skill, no contact details', () => {
    const ctx = { closes_on: '2026-12-10', max_award: 15000, skills: ctxSkills };
    expect(applicationProblem(application(), ctx)).toBeNull();
    expect(applicationProblem(application({ starts_on: '2026-12-01', ends_on: '2026-12-02' }), ctx)).toBe('dates');
    expect(applicationProblem(application({ costs: [{ item: 'transport', amount: 9000 }, { item: 'registration', amount: 7000 }] }), ctx)).toBe('costs');
    expect(applicationProblem(application({ purpose: 'Call me on 050 123 4567 to discuss the course details.' }), ctx)).toBe('purpose');
    const sec = T.skills.find((s) => s.area === 'security')!;
    expect(applicationProblem(application({ skill_id: sec.id }), ctx)).toBe('skill');
    expect(applicationProblem(application({ output_kind: 'poster' }), ctx)).toBe('output');
  });
  it('an accepted output becomes validated evidence on the named skill (rating, ref grant_applications); a returned one does not; maker-checker', async () => {
    await fresh();
    await as('qc-inspector');
    const out = { application_id: 'ga-2026-08-01', kind: 'presentation', title: 'What I learned on site', summary: 'A short briefing for the team on the inspection methods I saw and how we can adopt them.' };
    expect(outputState(raw('grant_applications').find((a) => a.id === 'ga-2026-08-01')!, DAY0)).toBe('due');
    expect((await b.rpc.submitGrantOutput(out)).ok).toBe(true);
    expect((await b.rpc.reviewGrantOutput({ application_id: 'ga-2026-08-01', decision: 'accept' })).code).toBe('forbidden');
    await as('k-hr-analyst');
    expect((await b.rpc.reviewGrantOutput({ application_id: 'ga-2026-08-01', decision: 'return', note: 'no' })).code).toBe('invalid');
    const app = raw('grant_applications').find((a) => a.id === 'ga-2026-08-01')!;
    const before = raw('skill_evidence').filter((e) => e.ref_table === 'grant_applications').length;
    const r = await b.rpc.reviewGrantOutput({ application_id: 'ga-2026-08-01', decision: 'accept' });
    expect(r.data).toMatchObject({ output_status: 'accepted', level: outputLevel('presentation'), profile_evidence: true });
    expect(outputLevel('report')).toBe(1);
    const ev = raw('skill_evidence').find((e) => e.id === `se:rating:ga-2026-08-01:${app.skill_id}`)!;
    expect(ev).toMatchObject({ person_id: 'p-qc-inspector', skill_id: app.skill_id, kind: 'rating', basis: 'validated', ref_table: 'grant_applications', level: 2 });
    expect(raw('skill_evidence').filter((e) => e.ref_table === 'grant_applications').length).toBe(before + 1);
    expect(raw('person_skills').some((s) => s.person_id === 'p-qc-inspector' && s.skill_id === app.skill_id)).toBe(true);
    expect(audits('grant.output.review').length).toBe(1);
  }, 60000);
  it('HR files for a placement student with a consent reference (on behalf); the student\'s own placement outputs stay on the application', async () => {
    const placed = T.grant_applications.filter((a) => a.on_behalf);
    expect(placed.length).toBe(2);
    expect(placed.every((a) => a.consent_ref && a.output_status === 'accepted' && a.profile_evidence === false && a.output_reviewed_by === 'p-chco')).toBe(true);
    await fresh();
    await as('k-hr-analyst');
    const scholar = raw('scholars').find((s) => s.status === 'in_study' && !raw('grant_applications').some((a) => a.person_id === s.person_id && a.round_id === 'gr-2026-12'));
    expect(scholar).toBeTruthy();
    expect((await b.rpc.applyGrant(application({ person_id: scholar!.person_id, consent_ref: '' }))).code).toBe('invalid');
    const r = await b.rpc.applyGrant(application({ person_id: scholar!.person_id, consent_ref: 'EP-CONSENT-2026-099' }));
    expect(r.ok).toBe(true);
    expect(raw('grant_applications').find((a) => a.id === r.data!.id)).toMatchObject({ on_behalf: true, basis: 'placement', consent_ref: 'EP-CONSENT-2026-099' });
    expect((await b.rpc.applyGrant(application({ person_id: 'p-nse', consent_ref: 'EP-CONSENT-2026-100' }))).code).toBe('invalid');
  }, 60000);
  it('the applicant withdraws a submitted application; nobody else can (not found)', async () => {
    await fresh();
    await as('buyer');
    expect((await b.rpc.withdrawGrant('ga-2026-10-03')).code).toBe('not_found');
    expect((await b.rpc.withdrawGrant('ga-2026-10-01')).data?.status).toBe('withdrawn');
    expect(scheduleProblem({ budget: 5000, max_award: 1000 }, T.grant_rounds, DAY0)).toBe('budget');
  });
  it('RLS: an applicant reads only their own applications; HR and auditors read all; partners and the public read none', async () => {
    await fresh();
    await as('outage-planner');
    const mine = await b.list('grant_applications' as never) as unknown as Row[];
    expect(mine.length).toBe(T.grant_applications.filter((a) => a.person_id === 'p-outage-planner').length);
    expect(mine.every((a) => a.person_id === 'p-outage-planner')).toBe(true);
    await as('k-hr-analyst');
    expect((await b.list('grant_applications' as never)).length).toBe(T.grant_applications.length);
    await as('k-auditor');
    expect((await b.list('grant_applications' as never)).length).toBe(T.grant_applications.length);
    for (const p of ['alnoor-gm', null]) { await as(p); expect(await b.list('grant_applications' as never)).toHaveLength(0); }
    await as('nse');
    const direct = await b.insert('grant_applications' as never, { id: 'ga-x', person_id: 'p-nse' } as never).catch(() => ({ ok: false }));
    expect((direct as { ok: boolean }).ok).toBe(false);
  });
});

// ═════════════════════════════════ FS83
const cc26 = () => T.consortium_cohorts.find((c) => c.id === 'cc-2026')!;
const cc27 = () => T.consortium_cohorts.find((c) => c.id === 'cc-2027')!;

describe('FS83 · each partner sees only its own trainees (acceptance 1)', () => {
  it('partner administrators and users read their own organisation\'s trainees and visits only; an ENEC trainee reads their own; HR reads all', async () => {
    await fresh();
    for (const [persona, org] of [['alnoor-gm', 'org-alnoor'], ['alnoor-qaqc', 'org-alnoor'], ['gulfhydro-qa', 'org-gulfhydro']] as const) {
      await as(persona);
      const ms = await b.list('consortium_members' as never) as unknown as Row[];
      const vs = await b.list('consortium_visits' as never) as unknown as Row[];
      expect(ms.length).toBe(T.consortium_members.filter((m) => m.org_id === org).length);
      expect(ms.length).toBeGreaterThan(0);
      expect(ms.every((m) => m.org_id === org)).toBe(true);
      expect(vs.every((v) => v.org_id === org)).toBe(true);
      expect(vs.length).toBe(T.consortium_visits.filter((v) => v.org_id === org).length);
    }
    await as('k-contractor');
    expect(await b.list('consortium_members' as never)).toHaveLength(0);
    await as('k-lo-trainee');
    const own = await b.list('consortium_members' as never) as unknown as Row[];
    expect(own.map((m) => m.id)).toEqual(['cm-cc-2026-en-26-01']);
    expect(((await b.list('consortium_visits' as never)) as unknown as Row[]).every((v) => v.person_id === 'p-k-lo-trainee')).toBe(true);
    await as('chco');
    expect((await b.list('consortium_members' as never)).length).toBe(T.consortium_members.length);
    await as(null);
    expect(await b.list('consortium_members' as never)).toHaveLength(0);
    expect((await b.list('consortium_cohorts' as never)).length).toBe(2);
  });
  it('a host sees the visits it hosts through rpc.consortiumHostVisits only: trainee code and visiting organisation, never a person or member id', async () => {
    await fresh();
    await as('alnoor-gm');
    const r = await b.rpc.consortiumHostVisits();
    expect(r.ok).toBe(true);
    expect(r.data!.length).toBe(T.consortium_visits.filter((v) => v.host_org_id === 'org-alnoor').length);
    expect(r.data!.every((v) => v.host_org_id === 'org-alnoor' && v.route === 'host')).toBe(true);
    for (const v of r.data!) expect(Object.keys(v)).not.toEqual(expect.arrayContaining(['person_id']));
    expect(Object.keys(r.data![0])).not.toContain('member_id');
    expect(r.data!.some((v) => v.org_id === 'enec-ops')).toBe(true);
    await as('nse');
    expect((await b.rpc.consortiumHostVisits()).code).toBe('forbidden');
  });
  it('nominations: a partner nominates for its own organisation only (a code, no person); HR nominates eligible ENEC staff; the HR director decides', async () => {
    await fresh();
    const c = cc27();
    expect(cohortPhase(c, DAY0)).toBe('nominating');
    await as('alnoor-gm');
    expect((await b.rpc.nominateConsortiumTrainee({ cohort_id: 'cc-2027', discipline: 'mechanical', org_id: 'org-gulfhydro' })).code).toBe('invalid');
    expect((await b.rpc.nominateConsortiumTrainee({ cohort_id: 'cc-2027', discipline: 'mechanical', person_id: 'p-alnoor-qaqc' })).code).toBe('invalid');
    const n = await b.rpc.nominateConsortiumTrainee({ cohort_id: 'cc-2027', discipline: 'mechanical' });
    expect(n.ok).toBe(true);
    expect(n.data!.trainee_code).toBe('AN-27-02');
    expect(raw('consortium_members').find((m) => m.id === n.data!.id)).toMatchObject({ org_id: 'org-alnoor', person_id: null, status: 'nominated' });
    expect((await b.rpc.nominateConsortiumTrainee({ cohort_id: 'cc-2026', discipline: 'mechanical' })).code).toBe('invalid');
    await as('chco');
    const taken = new Set(raw('consortium_members').filter((m) => m.cohort_id === 'cc-2027').map((m) => m.person_id));
    const pick = raw('people').find((p) => p.org_id === 'enec-ops' && enecTraineeEligible(p, DAY0) && !taken.has(p.id) && p.id.startsWith('w-'))!;
    const experienced = raw('people').find((p) => p.kind === 'staff' && p.status === 'active' && p.level !== 'entry' && !enecTraineeEligible(p, DAY0))!;
    expect((await b.rpc.nominateConsortiumTrainee({ cohort_id: 'cc-2027', discipline: 'operations', person_id: experienced.id })).code).toBe('invalid');
    const e = await b.rpc.nominateConsortiumTrainee({ cohort_id: 'cc-2027', discipline: 'operations', person_id: pick.id });
    expect(e.ok).toBe(true);
    expect(e.data!.trainee_code.startsWith('EN-27-')).toBe(true);
    const member = raw('consortium_members').find((m) => m.id === n.data!.id)!;
    const sameOrgMentor = c.mentors.find((m: Row) => m.org_id === 'org-alnoor').id;
    expect(memberDecisionProblem({ member_id: member.id, decision: 'accept', mentor_id: sameOrgMentor, team: 'A' }, member, c)).toBe('mentor');
    await as('k-hr-analyst');
    expect((await b.rpc.decideConsortiumMember({ member_id: member.id, decision: 'accept', mentor_id: 'mt-en-1', team: 'A' })).code).toBe('forbidden');
    await as('chco');
    expect((await b.rpc.decideConsortiumMember({ member_id: member.id, decision: 'accept', mentor_id: sameOrgMentor, team: 'A' })).code).toBe('invalid');
    const l0 = raw('ledger_local').length;
    const d = await b.rpc.decideConsortiumMember({ member_id: member.id, decision: 'accept', mentor_id: 'mt-en-1', team: 'A' });
    expect(d.data?.status).toBe('accepted');
    expect(audits('consortium.member.decide').length).toBe(1);
    expect(raw('ledger_local').length).toBe(l0 + 1);
  }, 60000);
});

describe('FS83 · visits write evidence after host confirmation (acceptance 2)', () => {
  it('a logged visit writes no evidence; only the host confirms; the confirmation writes validated ojt evidence on the host site\'s focus skill', async () => {
    await fresh();
    const vid = 'cv-cc-2026-039'; // EN-26-02 (w-lo-02, ENEC staff) at Al Noor, logged by the programme office
    const v = raw('consortium_visits').find((x) => x.id === vid)!;
    expect(v.status).toBe('logged');
    expect(raw('skill_evidence').some((e) => e.ref_id === vid)).toBe(false);
    await as('gulfhydro-qa');
    expect((await b.rpc.confirmConsortiumVisit({ visit_id: vid, decision: 'confirm' })).code).toBe('forbidden');
    await as('k-hr-analyst'); // the programme office logged it, and Al Noor has Kafa'a access: only Al Noor confirms
    expect((await b.rpc.confirmConsortiumVisit({ visit_id: vid, decision: 'confirm' })).code).toBe('forbidden');
    await as('alnoor-gm');
    const r = await b.rpc.confirmConsortiumVisit({ visit_id: vid, decision: 'confirm' });
    expect(r.ok).toBe(true);
    const skill = partnerOf(cc26(), 'org-alnoor')!.visit_skill;
    expect(r.data).toMatchObject({ status: 'confirmed', profile_evidence: true });
    const ev = raw('skill_evidence').find((e) => e.id === `se:ojt:${vid}:${skill}`)!;
    expect(ev).toMatchObject({ person_id: 'w-lo-02', skill_id: skill, kind: 'ojt', basis: 'validated', ref_table: 'consortium_visits', ref_id: vid });
    expect(raw('consortium_visits').find((x) => x.id === vid)).toMatchObject({ status: 'confirmed', confirmed_via: 'host', decided_by: 'p-alnoor-gm' });
    expect(audits('consortium.visit.decide').length).toBe(1);
    expect((await b.rpc.confirmConsortiumVisit({ visit_id: vid, decision: 'confirm' })).code).toBe('invalid');
  }, 60000);
  it('a host without Kafa\'a access: the programme office confirms on its behalf with the host\'s reference; never the visitor or whoever logged it', async () => {
    await fresh();
    const vid = 'cv-cc-2026-033'; // EN-26-01 (k-lo-trainee) at Sahel Grid (no Kafa'a access), self-logged
    await as('k-lo-trainee');
    expect((await b.rpc.confirmConsortiumVisit({ visit_id: vid, decision: 'confirm', host_ref: 'SGS-1' })).code).toBe('forbidden');
    await as('k-hr-analyst');
    expect((await b.rpc.confirmConsortiumVisit({ visit_id: vid, decision: 'confirm' })).code).toBe('invalid');
    const r = await b.rpc.confirmConsortiumVisit({ visit_id: vid, decision: 'confirm', host_ref: 'SGS-HOST-CONF-2026-10-09' });
    expect(r.ok).toBe(true);
    expect(raw('consortium_visits').find((x) => x.id === vid)).toMatchObject({ confirmed_via: 'on_behalf', host_ref: 'SGS-HOST-CONF-2026-10-09' });
    expect(raw('skill_evidence').some((e) => e.ref_id === vid && e.person_id === 'p-k-lo-trainee' && e.kind === 'ojt')).toBe(true);
    // the trainee logs a new visit (logged, no evidence) and withdraws it; a declined visit writes nothing
    await as('k-lo-trainee');
    const lg = await b.rpc.logConsortiumVisit({ member_id: 'cm-cc-2026-en-26-01', host_org_id: 'org-cx-solar', visit_on: '2026-10-08', hours: 6, note: 'Shadowed the solar control room shift.' });
    expect(lg.ok).toBe(true);
    expect(raw('skill_evidence').some((e) => e.ref_id === lg.data!.id)).toBe(false);
    expect((await b.rpc.logConsortiumVisit({ member_id: 'cm-cc-2026-en-26-01', host_org_id: 'enec-ops', visit_on: '2026-10-08', hours: 6 })).code).toBe('invalid');
    expect((await b.rpc.withdrawConsortiumVisit(lg.data!.id)).data?.status).toBe('withdrawn');
    await as('chco');
    const dec = await b.rpc.confirmConsortiumVisit({ visit_id: 'cv-cc-2026-034', decision: 'decline', reason: 'The module attendance list does not show this visit.' });
    expect(dec.data).toMatchObject({ status: 'declined', profile_evidence: false });
    expect(raw('skill_evidence').some((e) => e.ref_id === 'cv-cc-2026-034')).toBe(false);
  }, 60000);
  it('evidence level 2 from the second confirmed visit to the same host with 12 hours or more; confirmRoute names who may confirm', () => {
    expect(visitLevel([], { host_org_id: 'org-cx-grid', hours: 18 })).toBe(1);
    expect(visitLevel([{ host_org_id: 'org-cx-grid', hours: 6 }], { host_org_id: 'org-cx-grid', hours: 6 })).toBe(2);
    expect(visitLevel([{ host_org_id: 'org-cx-grid', hours: 4 }], { host_org_id: 'org-cx-grid', hours: 6 })).toBe(1);
    expect(visitLevel([{ host_org_id: 'org-alnoor', hours: 20 }], { host_org_id: 'org-cx-grid', hours: 6 })).toBe(1);
    const c = cc26();
    expect(confirmRoute({ host_org_id: 'org-alnoor' }, c, { org: 'org-alnoor', orgw: true, hr: false })).toBe('host');
    expect(confirmRoute({ host_org_id: 'org-alnoor' }, c, { org: null, orgw: false, hr: true })).toBeNull();
    expect(confirmRoute({ host_org_id: 'enec-ops' }, c, { org: 'enec', orgw: false, hr: true })).toBe('enec_host');
    expect(confirmRoute({ host_org_id: 'org-cx-grid' }, c, { org: 'enec', orgw: false, hr: true })).toBe('on_behalf');
    expect(confirmRoute({ host_org_id: 'org-cx-grid' }, c, { org: 'org-gulfhydro', orgw: true, hr: false })).toBeNull();
    const m = T.consortium_members.find((x) => x.id === 'cm-cc-2026-en-26-01')!;
    expect(visitProblem({ member_id: m.id, host_org_id: 'enec-ops', visit_on: '2026-10-01', hours: 6 }, c, m, DAY0)).toBe('same_org');
    expect(visitProblem({ member_id: m.id, host_org_id: 'org-cx-solar', visit_on: '2026-10-13', hours: 6 }, c, m, DAY0)).toBe('date');
    expect(visitProblem({ member_id: m.id, host_org_id: 'org-cx-solar', visit_on: '2026-10-01', hours: 6.3 }, c, m, DAY0)).toBe('hours');
    expect(visitProblem({ member_id: m.id, host_org_id: 'org-cx-solar', visit_on: '2026-10-01', hours: 6, module_id: 'm2' }, c, m, DAY0)).toBe('module');
    for (const v of T.consortium_visits.filter((x) => x.status === 'confirmed')) {
      expect(v.level).toBeGreaterThanOrEqual(1);
      expect(v.evidence).toEqual([{ skill_id: v.skill_id, level: v.level }]);
      expect(v.profile_evidence).toBe(false); // seeded confirmations belong to partner trainees (no Kafa'a skills profile)
    }
    expect(T.consortium_visits.some((v) => v.level === 2)).toBe(true);
    expect(T.skill_evidence.some((e) => e.ref_table === 'consortium_visits' || e.ref_table === 'grant_applications')).toBe(false);
  });
});

describe('FS83 · partner organisations are synthetic and labelled as such (acceptance 3)', () => {
  it('the three new consortium organisations and every non-ENEC partner are synthetic, labelled in EN and AR, and not publicly listed', () => {
    for (const id of ['org-cx-grid', 'org-cx-solar', 'org-cx-h2']) {
      const o = T.organisations.find((x) => x.id === id)!;
      expect(o).toMatchObject({ synthetic: true, public_listed: false, category: 'synthetic' });
      expect(o.name_en).toMatch(/\(synthetic\)$/);
      expect(o.name_ar).toMatch(/\(افتراضي\)$/);
    }
    for (const c of T.consortium_cohorts) {
      expect(c).toMatchObject({ synthetic: true, simulated: true, listed: true });
      for (const p of c.partners) {
        const o = T.organisations.find((x) => x.id === p.org_id)!;
        expect(o).toBeTruthy();
        if (p.org_id === 'enec-ops') { expect(p.synthetic).toBe(false); continue; }
        expect(p.synthetic).toBe(true);
        expect(p.name_en).toMatch(/\(synthetic\)/);
        expect(p.name_ar).toMatch(/\((افتراضي|اصطناعية)\)/); // the FS68 seed organisations carry the earlier Arabic label
        expect(o.synthetic).toBe(true);
      }
      for (const m of c.mentors) expect(Object.keys(m).sort()).toEqual(['id', 'label_ar', 'label_en', 'org_id']);
      expect(c.sources.find((s: Row) => s.url.includes('fortum'))?.secondary).toBe(true);
    }
    expect(T.consortium_members.filter((m) => m.org_id !== 'enec-ops').every((m) => m.person_id === null)).toBe(true);
    expect(en.cc.syntheticChip).toMatch(/Synthetic/);
    expect(ar.cc.syntheticChip).toMatch(/افتراضية/);
  });
  it('cohort rules: phases from dates, trainee codes per partner, ENEC entities map to the ENEC partner, suppressed figures', async () => {
    expect(cohortPhase(cc26(), DAY0)).toBe('running');
    expect(cohortPhase(cc27(), DAY0)).toBe('nominating');
    expect(cohortPhase(cc27(), '2026-12-16')).toBe('confirmed');
    expect(traineeCode(cc27(), 'org-cx-solar', 3)).toBe('QS-27-03');
    expect(consortiumOrg(cc26(), 'enec')).toBe('enec-ops');
    expect(consortiumOrg(cc26(), 'org-meridia')).toBeNull();
    expect(nominationProblem({ cohort_id: 'cc-2026', discipline: 'digital' }, { cohort: cc26(), org: 'org-alnoor', byHr: false, person: null, activeForOrg: 0, duplicate: false, today: DAY0 })).toBe('phase');
    expect(nominationProblem({ cohort_id: 'cc-2027', discipline: 'digital' }, { cohort: cc27(), org: 'org-alnoor', byHr: false, person: null, activeForOrg: 3, duplicate: false, today: DAY0 })).toBe('seats');
    expect(nominationProblem({ cohort_id: 'cc-2027', discipline: 'digital' }, { cohort: cc27(), org: 'org-alnoor', byHr: true, person: null, activeForOrg: 0, duplicate: false, today: DAY0 })).toBe('org');
    expect(nominationProblem({ cohort_id: 'cc-2027', discipline: 'digital' }, { cohort: cc27(), org: 'org-cx-grid', byHr: true, person: null, activeForOrg: 0, duplicate: false, today: DAY0 })).toBeNull();
    await fresh();
    await as('alnoor-qaqc');
    const r = await b.rpc.consortiumStats();
    expect(r.ok).toBe(true);
    expect(r.data).toEqual(consortiumStats(T.consortium_cohorts, T.consortium_members, T.consortium_visits, DAY0));
    for (const c of r.data!.cohorts) for (const cell of [c.trainees, c.nominated, c.visits_confirmed, c.visits_waiting, c.evidence_rows, ...c.by_org.map((x) => x.trainees), ...c.by_host.map((x) => x.confirmed)]) {
      expect(cell.value === null ? cell.suppressed : cell.value === 0 || cell.value >= 10).toBe(true);
    }
    await as(null);
    expect((await b.rpc.consortiumStats()).code).toBe('not_signed_in');
  });
});

describe('FS82 / FS83 · routes, RBAC, benchmarks, i18n and the shared contact pattern', () => {
  it('six new M36 routes with their guards; titles in EN and AR; FS82/FS83 benchmarks from the cards; no new grant', () => {
    const ids = ['my-grants', 'ecosystem-grants', 'workforce-grants', 'ecosystem-consortium', 'ecosystem-consortium-cohort', 'my-consortium'];
    const rs = routes.filter((r) => ids.includes(r.id));
    expect(rs.map((r) => r.id)).toEqual(ids);
    for (const r of rs) {
      expect((en.routes as Record<string, { title: string; purpose: string }>)[r.id].purpose).toBeTruthy();
      expect((ar.routes as Record<string, { title: string }>)[r.id].title).toMatch(/[؀-ۿ]/);
    }
    const by = Object.fromEntries(rs.map((r) => [r.id, r]));
    expect(by['ecosystem-consortium'].guard).toEqual({});
    expect(by['my-grants'].guard).toMatchObject({ signedIn: true, grant: { res: 'ecosystem', levels: ['Own'] } });
    expect(by['workforce-grants'].guard).toMatchObject({ anyRole: ['auditor'], grant: { res: 'workforce_strategy', levels: ['W', 'A'] } });
    expect(FEATURE_BENCHMARKS.FS82).toEqual(['NUC-NET']);
    expect(FEATURE_BENCHMARKS.FS83).toEqual(['NUC-NET', 'UAE-PEERS']);
    expect([...grantsFor(['hr_director'], 'ecosystem')]).toEqual(expect.arrayContaining(['A', 'W', 'Own']));
    expect(grantsFor(['hr_analyst'], 'ecosystem').has('A')).toBe(false);
    expect(grantsFor(['partner_admin'], 'ecosystem').has('OrgW')).toBe(true);
    expect(grantsFor(['partner_user'], 'ecosystem').has('OrgW')).toBe(false);
  });
  it('the contact-detail pattern is the FS39 one, unchanged, in both rule files', () => {
    expect(GR_CONTACT).toBe(M31_CONTACT);
    expect(CC_CONTACT).toBe(M31_CONTACT);
  });
});
