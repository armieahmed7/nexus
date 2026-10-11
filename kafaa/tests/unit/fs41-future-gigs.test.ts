/** FS27 Future-skills gig channel with a time envelope + FS28 Future-role rotations and external secondments (FS wave D · E1, M20):
 *  one test per acceptance criterion on the local path, plus the rules shared with SQL, RBAC, the seed, routes and i18n. The SQL path
 *  (SQL = TS parity, RLS, live RPC flows, grants) is checked by scripts/validate/fs41-future-gigs.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import en from '../../src/i18n/m20.en.json';
import ar from '../../src/i18n/m20.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m20/routes';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { publicTextIsClean } from '../../src/domain/future';
import { CHANNELS, capHours, channelProblem, computeFutureStats, envelopeFit, envelopeView, openPeriods, quarterBounds, quarterOf, rankFutureGigs, validateEnvelope, type EnvRow, type GigRow } from '../../src/modules/m20/futureGigs';
import { capturePlannedOn, endOf, phaseOf, secondmentStats, transferDue, transferState, validateClose, validateSecondment, validateTag, TRANSFER_DAYS } from '../../src/modules/m20/secondment';
import { lintRanked } from '../../src/domain/engines/rank';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const flat = (o: Row, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
const today = new Date().toISOString().slice(0, 10);
const plus = (d: string, k: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
}, 120000);

describe('FS27 acceptance', () => {
  it('AC1: at least 12 open future gigs across the 5 channels, each growing a future skill', () => {
    const open = T.opportunities.filter((o) => o.channel && o.status === 'open' && o.listed);
    expect(open.length).toBeGreaterThanOrEqual(12);
    for (const c of CHANNELS) expect(open.filter((o) => o.channel === c).length, c).toBeGreaterThanOrEqual(2);
    for (const o of open) expect(channelProblem(o.channel, o.skills_gained, T.skills as never), o.id).toBeNull();
  });
  it('AC2: an approved envelope lets an application skip the per-gig release while within the limit, and only then', async () => {
    await as('k-ro');
    const env = (await b.list('time_envelopes')).find((e) => e.person_id === 'p-k-ro' && e.status === 'approved')!;
    expect(env.approver_id).toBe('p-sro');
    const inside = await b.rpc.applyOpportunity('fg-ai-cap-triage-review', 'Inside my envelope');
    expect(inside.ok).toBe(true);
    expect(inside.data!.envelope_id).toBe(env.id);
    const a1 = b.rawGet('opportunity_applications', inside.data!.id)!;
    expect(a1.status).toBe('released');
    expect(a1.released_by).toBe('p-sro');
    expect(b.rawGet('notifications', `nt-${a1.id}-applied`)).toBeUndefined();
    // 2 of 4 h/week used: a 3 h gig would go over, so the ordinary release applies
    const over = await b.rpc.applyOpportunity('fg-data-equipment-tags', '');
    expect(over.ok).toBe(true);
    expect(over.data!.envelope_id).toBeNull();
    expect(b.rawGet('opportunity_applications', over.data!.id)!.status).toBe('applied');
    // a gig outside the future-skills channels always needs the release
    const plain = await b.rpc.applyOpportunity('opp-oe-review-2026-q4', '');
    expect(plain.ok && plain.data!.envelope_id).toBe(null);
  }, 60000);
  it('AC2: the envelope is asked for once and approved once by the line manager of record (maker-checker, ledger)', async () => {
    await as('nse');
    const [cur] = openPeriods(today);
    expect((await b.rpc.requestEnvelope({ pct: 12, period: cur, channels: ['ai_pilot'], reason: 'Supplier data and AI checks.' })).code).toBe('invalid');
    const r = await b.rpc.requestEnvelope({ pct: 10, period: cur, channels: ['ai_pilot', 'data_cleanup'], reason: 'Supplier data and AI checks.' });
    expect(r.ok && r.data!.line_manager_id).toBe('p-cpo');
    expect(r.data!.cap_hours).toBe(4);
    expect((await b.rpc.requestEnvelope({ pct: 5, period: cur, channels: ['ai_pilot'], reason: 'A second request for the quarter.' })).code).toBe('conflict');
    expect((await b.rpc.approveEnvelope(r.data!.id, 'approve')).code).toBe('maker_checker');
    await as('ops-ceo');
    expect((await b.rpc.approveEnvelope(r.data!.id, 'approve')).code).toBe('not_found');
    await as('cpo');
    expect((await b.rpc.approveEnvelope(r.data!.id, 'decline', 'no')).code).toBe('invalid');
    const ok = await b.rpc.approveEnvelope(r.data!.id, 'approve');
    expect(ok.ok).toBe(true);
    expect(b.rawGet('time_envelopes', r.data!.id)!.approver_id).toBe('p-cpo');
    expect(b.raw('ledger_local').some((l: Row) => l.action === 'kafaa.envelope.approve')).toBe(true);
    expect((await b.rpc.approveEnvelope(r.data!.id, 'approve')).code).toBe('invalid');
    await as('nse');
    expect((await b.rpc.approveEnvelope(r.data!.id, 'withdraw')).ok).toBe(true);
  }, 60000);
  it('AC3: completing a future gig writes ojt evidence against the posted skills (existing F08 path)', async () => {
    await as('k-ro');
    const app = await b.rpc.applyOpportunity('fg-ai-cap-triage-review', '');
    await as('cap-chair');
    expect((await b.rpc.selectApplicant(app.data!.id, 'selected')).ok).toBe(true);
    const done = await b.rpc.completeOpportunity(app.data!.id, { 'sk-fs-ai-verify': 2, 'sk-fs-ai-use': 1 }, 'Checked 40 suggestions and logged every disagreement.');
    expect(done.ok).toBe(true);
    const ev = b.raw('skill_evidence').filter((e) => e.ref_id === app.data!.id);
    expect(ev.map((e) => e.skill_id).sort()).toEqual(['sk-fs-ai-use', 'sk-fs-ai-verify']);
    expect(ev.every((e) => e.kind === 'ojt' && e.basis === 'evidenced' && e.ref_table === 'opportunity_applications')).toBe(true);
    await as('chco');
    expect((await b.rpc.futureGigStats())!.evidence_rows).toBe(2);
  }, 60000);
  it('posting: a future gig names a known channel and grows a future skill', async () => {
    await as('ops-ceo');
    const base = { kind: 'project', title_en: 'AI pilot review', title_ar: 'مراجعة تجربة الذكاء', summary_en: 'Review AI suggestions against records.', summary_ar: 'مراجعة اقتراحات الذكاء الاصطناعي مقابل السجلات.',
      skills_needed: [], skills_gained: ['sk-fs-ai-verify'], hours_week: 2, start_on: plus(today, 7), end_on: plus(today, 60), seats: 1, location_type: 'office' };
    const ok = await b.rpc.postOpportunity({ ...base, channel: 'ai_pilot' });
    expect(ok.ok && b.rawGet('opportunities', ok.data!.id)!.channel).toBe('ai_pilot');
    expect((await b.rpc.postOpportunity({ ...base, channel: 'ai_pilot', skills_gained: ['sk-co-01'] })).code).toBe('invalid');
    expect((await b.rpc.postOpportunity({ ...base, channel: 'moonshot' })).code).toBe('invalid');
    expect((await b.rpc.postOpportunity({ ...base })).ok).toBe(true);
  }, 60000);
});

describe('FS27 rules', () => {
  const gigs = new Map(T.opportunities.map((o) => [o.id, o as never]));
  const env = (x: Partial<EnvRow>): EnvRow => ({ id: 'e1', person_id: 'p1', approver_id: 'm1', pct: 10, cap_hours: 4, period: quarterOf(today), starts_on: quarterBounds(quarterOf(today))!.start, ends_on: quarterBounds(quarterOf(today))!.end, channels: [...CHANNELS], status: 'approved', ...x });
  const gig = (x: Partial<GigRow>): GigRow => ({ id: 'g1', posted_by: 'p9', channel: 'ai_pilot', hours_week: 2, start_on: today, end_on: plus(today, 30), ...x });
  it('envelope fit: fits, over the limit, poster is the approver, channel or dates outside, ended or not approved', () => {
    expect(envelopeFit('p1', gig({}), [env({})], [], gigs, today).code).toBe('fits');
    expect(envelopeFit('p1', gig({ hours_week: 5 }), [env({})], [], gigs, today).code).toBe('over_limit');
    expect(envelopeFit('p1', gig({ posted_by: 'm1' }), [env({})], [], gigs, today).code).toBe('poster_is_approver');
    expect(envelopeFit('p1', gig({ channel: 'data_cleanup' }), [env({ channels: ['ai_pilot'] })], [], gigs, today).code).toBe('no_envelope');
    expect(envelopeFit('p1', gig({ start_on: plus(today, 400), end_on: plus(today, 430) }), [env({})], [], gigs, today).code).toBe('no_envelope');
    expect(envelopeFit('p1', gig({}), [env({ status: 'requested' })], [], gigs, today).code).toBe('no_envelope');
    expect(envelopeFit('p1', gig({ channel: null }), [env({})], [], gigs, today).code).toBe('not_future');
    const used = new Map([['gx', { hours_week: 3 }]]);
    expect(envelopeFit('p1', gig({}), [env({})], [{ id: 'a', opportunity_id: 'gx', person_id: 'p1', status: 'released', envelope_id: 'e1' }], used, today).code).toBe('over_limit');
    expect(envelopeFit('p1', gig({}), [env({})], [{ id: 'a', opportunity_id: 'gx', person_id: 'p1', status: 'withdrawn', envelope_id: 'e1' }], used, today).code).toBe('fits');
    expect(envelopeView(env({}), [{ id: 'a', opportunity_id: 'gx', person_id: 'p1', status: 'selected', envelope_id: 'e1' }], used, today)).toMatchObject({ used: 3, remaining: 1, phase: 'running' });
  });
  it('envelope request validation, caps and quarters', () => {
    const [cur, next] = openPeriods('2026-10-11');
    expect([cur, next]).toEqual(['2026-Q4', '2027-Q1']);
    expect(quarterBounds('2027-Q1')).toEqual({ start: '2027-01-01', end: '2027-03-31' });
    expect([5, 10, 15, 20].map(capHours)).toEqual([2, 4, 6, 8]);
    const ok = { pct: 10, period: '2026-Q4', channels: ['ai_pilot'], reason: 'Ten characters at least.' };
    expect(validateEnvelope(ok, '2026-10-11')).toBeNull();
    expect(validateEnvelope({ ...ok, period: '2026-Q3' }, '2026-10-11')!.code).toBe('invalid');
    expect(validateEnvelope({ ...ok, channels: ['security'] }, '2026-10-11')!.code).toBe('invalid');
    expect(validateEnvelope({ ...ok, reason: 'short' }, '2026-10-11')!.code).toBe('invalid');
  });
  it('future gigs are ranked with reasons (lintRanked) and the HR stats suppress people below 10', () => {
    const open = T.opportunities.filter((o) => o.channel && o.status === 'open');
    const ranked = rankFutureGigs(open as never, T.skills as never, new Map(), () => ({ code: 'no_envelope', fits: false, envelope_id: null, used: 0, cap: 0, after: 0 }));
    expect(ranked.length).toBe(open.length);
    expect(lintRanked(ranked)).toEqual([]);
    expect(ranked.every((r) => r.reasons.some((x) => x.code === 'grows' || x.code === 'deepens'))).toBe(true);
    const small = computeFutureStats([{ id: 'o', status: 'open', channel: 'ai_pilot' }], [{ person_id: 'p', status: 'released', envelope_id: 'e', opportunity_id: 'o' }], [{ person_id: 'p', status: 'approved', pct: 10 }], 0);
    expect(small.envelopes.suppressed && small.envelopes.people === null && small.via_envelope.applications === null).toBe(true);
    const full = computeFutureStats(T.opportunities as never, T.opportunity_applications as never, T.time_envelopes as never, 0);
    expect(full.envelopes.suppressed).toBe(false);
    expect(full.via_envelope.suppressed).toBe(false);
  });
  it('RBAC: HR and auditors read the stats; staff do not; envelopes are private to the person and their line manager', async () => {
    await as('k-ro');
    expect(await b.rpc.futureGigStats()).toBeNull();
    expect((await b.list('time_envelopes')).every((e) => e.person_id === 'p-k-ro')).toBe(true);
    await as('sro');
    expect((await b.list('time_envelopes')).every((e) => e.person_id === 'p-sro' || e.line_manager_id === 'p-sro')).toBe(true);
    await as('k-hr-analyst');
    expect((await b.rpc.futureGigStats())!.open_future).toBeGreaterThanOrEqual(12);
    await as('k-auditor');
    expect((await b.list('time_envelopes')).length).toBe(T.time_envelopes.length);
    await as(null);
    expect((await b.rpc.requestEnvelope({ pct: 10, period: openPeriods(today)[0], channels: ['ai_pilot'], reason: 'Anonymous request here.' })).code).toBe('not_signed_in');
  }, 60000);
  it('seed: future-gig application events come after the last fairness snapshot (2026-10-08), and no future gig is security work', () => {
    const fut = new Set(T.opportunities.filter((o) => o.channel).map((o) => o.id));
    const apps = T.opportunity_applications.filter((a) => fut.has(a.opportunity_id));
    expect(apps.length).toBeGreaterThan(0);
    expect(apps.every((a) => (a.history as Row[]).every((h) => h.at > '2026-10-08T23:59:59Z'))).toBe(true);
    const area = new Map(T.skills.map((s) => [s.id, s.area]));
    expect(T.opportunities.filter((o) => o.channel).every((o) => [...o.skills_needed, ...o.skills_gained].every((s: string) => area.get(s) !== 'security'))).toBe(true);
    expect(T.time_envelopes.filter((e) => e.status === 'approved').every((e) => e.approver_id === e.line_manager_id && e.approver_id !== e.person_id)).toBe(true);
  });
});

describe('FS28 acceptance', () => {
  it('AC1: at least 3 future-role templates are published; ADVANCE study is career-level only with clean public text', () => {
    const pub = T.rotation_templates.filter((t) => t.future_track && t.status === 'active' && t.listed);
    expect(pub.length).toBeGreaterThanOrEqual(3);
    expect(new Set(pub.map((t) => t.future_track))).toEqual(new Set(['digital_twin', 'data_office', 'advance_study']));
    const adv = pub.find((t) => t.future_track === 'advance_study')!;
    expect(adv.career_level_only).toBe(true);
    expect(adv.summary_en).toMatch(/no deployment decision is implied/);
    expect(publicTextIsClean(pub.flatMap((t) => [t.title_en, t.title_ar, t.summary_en, t.summary_ar]))).toBe(true);
    const roles = new Map(T.job_roles.map((r) => [r.id, r]));
    expect(pub.every((t) => t.future_role_ids.length >= 1 && t.future_role_ids.every((r: string) => roles.get(r)?.lifecycle === 'concept'))).toBe(true);
  });
  it('AC2: closing a secondment on return creates the knowledge-capture task, due within 60 days of return', async () => {
    const s = T.secondments.find((x) => x.status === 'planned' && x.start_on <= today)!;
    await as('chco');
    const met = Object.fromEntries((s.objectives as Row[]).map((o) => [o.id, true]));
    const r = await b.rpc.closeSecondment(s.id, 'return', { returned_on: today, outcome_note: 'Back with three lessons for the team.', met });
    expect(r.ok).toBe(true);
    expect(r.data!.transfer_due_on).toBe(plus(today, TRANSFER_DAYS));
    const cs = b.rawGet('capture_sessions', r.data!.capture_session_id!)!;
    expect(cs.sme_id).toBe(s.person_id);
    expect(cs.interviewer_id).toBe(s.line_manager_id);
    expect(cs.status).toBe('planned');
    expect(cs.planned_on >= today && cs.planned_on <= r.data!.transfer_due_on!).toBe(true);
    expect(b.raw('ledger_local').some((l: Row) => l.action === 'kafaa.secondment.return')).toBe(true);
    expect((await b.rpc.closeSecondment(s.id, 'cancel', { outcome_note: 'Too late now' })).code).toBe('invalid');
    const sec = b.rawGet('secondments', s.id)!;
    expect(transferState(sec as never, cs as never, today)).toBe('due');
  }, 60000);
  it('AC3: no security-area placement is offered: refused (restricted_kind) and audited, and none is seeded', async () => {
    await as('chco');
    const base = { person_id: 'p-nse', host_kind: 'university', host_org_id: 'ku', host_name_en: 'Khalifa University lab', host_name_ar: 'مختبر جامعة خليفة', host_country: 'AE', supervisor_en: 'Lab director (host role)', supervisor_ar: 'مدير المختبر (دور مضيف)',
      objectives: [{ skill_id: 'sk-fs-ai-dataeng', level: 2, text_en: 'Build a data pipeline', text_ar: 'بناء مسار بيانات' }], future_role_id: null, track: 'data_office', start_on: plus(today, 20), months: 6 };
    const before = b.raw('audit_events').length;
    expect((await b.rpc.planSecondment({ ...base, person_id: 'p-sec-compliance' })).code).toBe('restricted_kind');
    expect((await b.rpc.planSecondment({ ...base, future_role_id: 'security-officer' })).code).toBe('restricted_kind');
    const secSkill = T.skills.find((x) => x.area === 'security')!.id;
    expect((await b.rpc.planSecondment({ ...base, objectives: [{ ...base.objectives[0], skill_id: secSkill }] })).code).toBe('restricted_kind');
    expect(b.raw('audit_events').slice(before).filter((a: Row) => a.action === 'secondment.plan' && a.outcome === 'refused').length).toBe(3);
    expect((await b.rpc.tagFutureRotation({ template_id: 'rt-cross-ops-eng', track: 'data_office', future_role_ids: ['cyber-security-engineer'] })).code).toBe('restricted_kind');
    const restricted = ['security', 'cyber', 'safeguards'];
    expect(T.secondments.every((x) => !restricted.includes(x.person_family_id))).toBe(true);
    expect(T.rotation_templates.filter((t) => t.future_track).every((t) => (t.steps as Row[]).every((st) => !restricted.includes(st.family_id)))).toBe(true);
    const ok = await b.rpc.planSecondment(base);
    expect(ok.ok && ok.data!.line_manager_id).toBe('p-cpo');
    expect((await b.rpc.planSecondment(base)).code).toBe('conflict');
  }, 60000);
});

describe('FS28 rules and RBAC', () => {
  it('validation rules, dates, phases and the suppressed overview', () => {
    const ref = { people: T.people as never, skills: T.skills as never, roles: T.job_roles as never, orgs: T.organisations.map((o) => o.id) };
    const base = { person_id: 'p-nse', host_kind: 'iaea', host_name_en: 'IAEA section', host_name_ar: 'قسم الوكالة', host_country: 'AT', supervisor_en: 'Section head', supervisor_ar: 'رئيس القسم', objectives: [{ skill_id: 'sk-fs-ai-verify', level: 1, text_en: 'Learn to verify', text_ar: 'تعلّم التحقق' }], start_on: plus(today, 10), months: 3 };
    expect(validateSecondment(base, ref, today)).toBeNull();
    expect(validateSecondment({ ...base, host_country: 'Austria' }, ref, today)!.code).toBe('invalid');
    expect(validateSecondment({ ...base, months: 30 }, ref, today)!.code).toBe('invalid');
    expect(endOf('2026-01-31', 1)).toBe('2026-02-27');
    expect(transferDue('2026-10-01')).toBe('2026-11-30');
    expect(capturePlannedOn('2026-10-01', '2026-10-05')).toBe('2026-10-22');
    expect(capturePlannedOn('2026-08-01', '2026-10-11')).toBe('2026-09-30');
    expect(phaseOf({ status: 'planned', start_on: '2026-01-01', end_on: '2026-02-01' }, '2026-10-11')).toBe('return_due');
    expect(validateClose({ status: 'planned', start_on: '2026-01-01', end_on: '2026-02-01', objectives: [{ id: 'o1' }] }, 'return', { returned_on: today, outcome_note: 'Back with lessons learned.', met: { o1: 'yes' } }, today)!.code).toBe('invalid');
    expect(validateTag({ template_id: 'x', track: 'digital_twin', future_role_ids: ['fr-digital-twin'] }, T.job_roles as never)).toBeNull();
    const st = secondmentStats(T.secondments as never, new Map(T.capture_sessions.map((c) => [c.id, c])) as never, today);
    expect(st.total).toBe(T.secondments.length);
    expect(st.by_host.every((h) => h.suppressed === (h.n === null))).toBe(true);
    expect(st.transfer.done).toBeGreaterThanOrEqual(2);
  });
  it('RBAC: only HR plans and closes; the desk is HR and auditors only; staff read their own secondments', async () => {
    await as('k-ro');
    expect(await b.rpc.secondmentDesk()).toBeNull();
    expect((await b.rpc.secondmentOverview())!.total).toBe(T.secondments.length);
    expect((await b.list('secondments')).every((s) => s.person_id === 'p-k-ro' || s.line_manager_id === 'p-k-ro')).toBe(true);
    const s = T.secondments.find((x) => x.status === 'planned' && x.start_on <= today)!;
    expect((await b.rpc.closeSecondment(s.id, 'cancel', { outcome_note: 'Not allowed here' })).code).toBe('forbidden');
    expect((await b.rpc.tagFutureRotation({ template_id: 'rt-cross-ops-eng', track: null, future_role_ids: [] })).code).toBe('forbidden');
    await as('k-auditor');
    expect((await b.rpc.secondmentDesk())!.can_edit).toBe(false);
    await as('k-hr-analyst');
    const desk = (await b.rpc.secondmentDesk())!;
    expect(desk.can_edit).toBe(true);
    expect(desk.rows.length).toBe(T.secondments.length);
    expect(desk.people.every((p) => !['security', 'cyber', 'safeguards'].includes(String(p.family_id)))).toBe(true);
    await as('training-mgr');
    const tag = await b.rpc.tagFutureRotation({ template_id: 'rt-cross-ops-eng', track: 'advance_study', future_role_ids: ['fr-owners-engineer'] });
    expect(tag.ok && b.rawGet('rotation_templates', 'rt-cross-ops-eng')!.career_level_only).toBe(true);
  }, 60000);
});

describe('FS27/FS28 routes, chips and i18n', () => {
  it('six routes with the card RBAC, each page showing its benchmark chips', () => {
    const r = Object.fromEntries(routes.map((x) => [x.id, x]));
    expect(r['opportunities-future'].guard).toMatchObject({ grant: { res: 'opportunities', levels: ['R'] } });
    expect(r['opportunities-envelope'].guard).toMatchObject({ grant: { res: 'opportunities', levels: ['Own'] } });
    expect(r['opportunities-envelopes'].guard).toMatchObject({ grant: { res: 'opportunities', levels: ['A'] } });
    expect(r['rotations-future'].path).toBe('/opportunities/rotations/future');
    expect(r.secondments.path).toBe('/opportunities/secondments');
    expect(r['secondments-desk'].guard).toMatchObject({ anyRole: ['hr_analyst', 'hr_director', 'auditor'] });
    expect(FEATURE_BENCHMARKS.FS27).toEqual(expect.arrayContaining(['CORP', 'NEA']));
    expect(FEATURE_BENCHMARKS.FS28).toEqual(expect.arrayContaining(['NEA', 'NUC-NET', 'SMR-WF']));
    for (const [f, feat] of [['FutureGigsPage', 'FS27'], ['EnvelopePage', 'FS27'], ['TeamEnvelopesPage', 'FS27'], ['FutureRotationsPage', 'FS28'], ['SecondmentsPage', 'FS28'], ['SecondmentDeskPage', 'FS28']])
      expect(readFileSync(`src/modules/m20/${f}.tsx`, 'utf8')).toContain(`<BenchmarkChips feature="${feat}" />`);
  });
  it('every FS27/FS28 string exists in English and Arabic, with the same placeholders', () => {
    const e = Object.fromEntries(flat({ fs: (en as Row).fs, sec: (en as Row).sec }));
    const a = Object.fromEntries(flat({ fs: (ar as Row).fs, sec: (ar as Row).sec }));
    expect(Object.keys(e).length).toBeGreaterThan(300);
    expect(Object.keys(a).sort()).toEqual(Object.keys(e).sort());
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const k of Object.keys(e)) { expect(a[k].trim().length, k).toBeGreaterThan(0); expect(ph(a[k]), k).toBe(ph(e[k])); }
  });
});
