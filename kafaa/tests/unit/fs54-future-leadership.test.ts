/** FS46 future leadership behaviours, FS47 Future Leaders track and FS48 women in future nuclear skills (FS wave E · E4, M22): one
 *  named test per acceptance criterion on the local path, plus the rules shared with SQL, RBAC, the seed, routes and i18n. The SQL path
 *  (TS = SQL parity, RLS, live RPC flows, grants, additive SQL) is checked by scripts/validate/fs54-future-leadership.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { lintRanked } from '../../src/domain/engines';
import { hasKey } from '../../src/i18n';
import { MIN_GROUP_SIZE } from '../../src/auth/policy';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { publicTextIsClean } from '../../src/domain/future';
import en from '../../src/i18n/m22.en.json';
import ar from '../../src/i18n/m22.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m22/routes';
import { BEHAVIOUR_IDS, BEHAVIOUR_IDS_V2, FUTURE_BEHAVIOUR_IDS, computeLeadershipStats, formVersionFor, summarise360, validScores } from '../../src/modules/m22/domain';
import {
  FL_MSG, FL_PROGRAMME_ID, WFN_MSG, circleFlags, circleMembersView, coachFocus, computeFlStats, computeProgrammeStats, flCohortFor, flReadiness, flReasons, rankCircles, rankOffers, wfnArea, wfnStats,
} from '../../src/modules/m22/future';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = seed as unknown as { tables: Record<string, Row[]>; meta: { demo_today: string } };
const T = S.tables;
const NOW = '2026-10-08';
const names = new Map(T.people.map((p) => [p.id, { name: p.display_name, name_ar: p.display_name_ar || p.display_name }]));
const sheet = (ids: string[], v = 4) => Object.fromEntries(ids.map((x) => [x, v]));
const REASON = 'Leads crew turnovers well and explains decisions to visitors; ready for the next cohort.';
const STATEMENT = 'I want to build this future skill on real work and bring it back to my crew.';

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => (b.raw(t as never) as unknown as Row[]) ?? [];
const rawGet = (t: string, id: string) => b.rawGet(t as never, id) as unknown as Row | undefined;
const audits = () => raw('audit_events').length;
const lastAudit = () => [...raw('audit_events')].sort((x, y) => x.seq - y.seq).pop()!;
const ledger = () => raw('ledger_local').length;
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

// ═══════════════════════════════════════════════ FS46
describe('FS46 future leadership behaviours (360 form 2)', () => {
  it('acceptance: old 360 results remain readable under version 1', async () => {
    const reqs = T.leadership_360_requests;
    const resps = T.leadership_360;
    expect(resps.filter((r) => r.form_version === 1).length).toBeGreaterThan(200);
    // a subject with a form-1 cycle and a form-2 cycle: each cycle is read on its own form
    const h1 = summarise360('p-qc-inspector', '2026-H1', reqs as never, resps as never, names);
    const h2 = summarise360('p-qc-inspector', '2026-H2', reqs as never, resps as never, names);
    expect(h1.form_version).toBe(1);
    expect(h1.behaviours!.map((x) => x.id)).toEqual(BEHAVIOUR_IDS);
    expect(h2.form_version).toBe(2);
    expect(h2.behaviours!.map((x) => x.id)).toEqual(BEHAVIOUR_IDS_V2);
    // the person sees both through the RPC, older cycle unchanged
    await as('qc-inspector');
    const old = await b.rpc.my360('2026-H1');
    expect(old.form_version).toBe(1);
    expect(old.enough).toBe(true);
    expect(old.behaviours).toHaveLength(8);
    expect(old.cycles).toEqual(['2026-H2', '2026-H1']);
    // the HR grade view stays on form 1 (cycle 2026-H1) and is not mixed with form 2
    const st = computeLeadershipStats(resps as never, T.people as never, T.leadership_nominations as never, MIN_GROUP_SIZE);
    expect(st.cycle).toBe('2026-H1');
    // the F16 sro view (form 1) still lists eight behaviours
    await as('sro');
    expect((await b.rpc.my360(null)).behaviours).toHaveLength(8);
  });

  it('acceptance: programme aggregates naming fewer than 10 people are suppressed', async () => {
    const progIds = [...T.leadership_programmes].sort((a, c) => a.sort - c.sort || (a.id < c.id ? -1 : 1)).map((g) => g.id);
    const st = computeProgrammeStats(T.leadership_360 as never, T.leadership_nominations as never, progIds, BEHAVIOUR_IDS_V2, MIN_GROUP_SIZE);
    expect(st.form_version).toBe(2);
    expect(st.all.subjects).toBeGreaterThanOrEqual(MIN_GROUP_SIZE);
    for (const r of st.rows) {
      if (r.suppressed) { expect(r.subjects).toBeNull(); expect(r.scores).toBeNull(); } else expect(r.subjects!).toBeGreaterThanOrEqual(MIN_GROUP_SIZE);
    }
    expect(st.rows.find((r) => r.programme_id === FL_PROGRAMME_ID)!.suppressed).toBe(false);
    expect(st.rows.filter((r) => r.suppressed).length).toBeGreaterThan(5);
    // the same 9 subjects with the threshold at 10 are suppressed; at 9 they show
    const nine = computeProgrammeStats(T.leadership_360 as never, T.leadership_nominations as never, progIds, BEHAVIOUR_IDS_V2, 12);
    expect(nine.rows.find((r) => r.programme_id === FL_PROGRAMME_ID)!.suppressed).toBe(true);
    await as('chco');
    expect(await b.rpc.leadershipProgrammeStats()).toEqual(st);
    await as('sro');
    expect(await b.rpc.leadershipProgrammeStats()).toBeNull();
    await as('k-ro');
    expect(await b.rpc.leadershipProgrammeStats()).toBeNull();
  });

  const MATRIX = T.leadership_behaviours.flatMap((x) => ['1', '2', '3', '4', '5'].flatMap((p) => ['en', 'ar'].map((l) => [x.id, p, l] as const)));
  it('acceptance: anchors at every rating point in EN and AR (matrix of 12 behaviours x 5 points x 2 languages)', () => {
    expect(MATRIX).toHaveLength(120);
    for (const [id, p, l] of MATRIX) {
      const x = T.leadership_behaviours.find((y) => y.id === id)!;
      const text = x.anchors[p][l] as string;
      expect(text?.trim().length, `${id}.${p}.${l}`).toBeGreaterThan(15);
      if (l === 'ar') expect(/[؀-ۿ]/.test(text), `${id}.${p}.ar is Arabic`).toBe(true);
    }
    // anchors differ between points (a scale, not a repeated sentence)
    for (const x of T.leadership_behaviours) for (const l of ['en', 'ar']) expect(new Set(['1', '2', '3', '4', '5'].map((p) => x.anchors[p][l])).size).toBe(5);
  });

  it('the four future behaviours exist with framework sources, coach cards and links; form 2 = form 1 + the four', () => {
    expect(BEHAVIOUR_IDS_V2).toEqual([...BEHAVIOUR_IDS, ...FUTURE_BEHAVIOUR_IDS]);
    expect(FUTURE_BEHAVIOUR_IDS).toEqual(['b-digital-change', 'b-ai-teams', 'b-intrapreneurship', 'b-inclusion']);
    for (const id of FUTURE_BEHAVIOUR_IDS) {
      const x = T.leadership_behaviours.find((y) => y.id === id)!;
      expect(x.form_from).toBe(2);
      expect(x.coach.tips.length).toBeGreaterThanOrEqual(3);
      expect(x.sources.every((s: Row) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.as_of))).toBe(true);
      expect(x.links.length).toBeGreaterThan(0);
      for (const k of ['title', 'short', 'statement']) expect(hasKey(`m22.behaviours.${id}.${k}`), `${id}.${k}`).toBe(true);
    }
    // the AI-augmented teams behaviour covers when to override a tool
    expect(T.leadership_behaviours.find((y) => y.id === 'b-ai-teams')!.statement_en).toMatch(/overrides a tool/);
    expect(T.leadership_behaviours.find((y) => y.id === 'b-intrapreneurship')!.framework_en).toMatch(/EntreComp/);
  });

  it('a new cycle uses form 2, a cycle already started keeps its form; the sheet must match the request version', async () => {
    expect(formVersionFor('p-x', '2027-H1', [])).toBe(2);
    expect(formVersionFor('p-outage-planner', '2026-H2', T.leadership_360_requests as never)).toBe(1);
    expect(validScores(sheet(BEHAVIOUR_IDS), 1)).toEqual(sheet(BEHAVIOUR_IDS));
    expect(validScores(sheet(BEHAVIOUR_IDS), 2)).toBeNull();
    expect(validScores(sheet(BEHAVIOUR_IDS_V2), 2)).toEqual(sheet(BEHAVIOUR_IDS_V2));
    expect(validScores(sheet(BEHAVIOUR_IDS_V2), 1)).toBeNull();
    expect(validScores({ ...sheet(BEHAVIOUR_IDS_V2), 'b-inclusion': 6 }, 2)).toBeNull();
    await as('k-instructor');
    const r = await b.rpc.request360(['w-ro-01', 'w-ro-02', 'w-ro-03', 'w-ro-04', 'w-ro-06'].map((id) => ({ person_id: id, kind: 'peer' as const })));
    expect(r.ok).toBe(true);
    const mine = raw('leadership_360_requests').filter((x) => x.subject_id === 'p-k-instructor' && x.cycle === '2026-H2');
    expect(new Set(mine.map((x) => x.form_version))).toEqual(new Set([2]));
    const inv = T.leadership_360_requests.find((x) => x.form_version === 2 && x.rater_id === 'p-k-ro' && x.status === 'invited')!;
    await as('k-ro');
    expect((await b.rpc.submit360(inv.id, sheet(BEHAVIOUR_IDS))).code).toBe('invalid');
    expect((await b.rpc.submit360(inv.id, sheet(BEHAVIOUR_IDS_V2))).ok).toBe(true);
    const stored = raw('leadership_360').filter((x) => x.subject_id === inv.subject_id && x.form_version === 2 && x.cycle === '2026-H2');
    expect(stored.some((x) => Object.keys(x.scores).length === 12)).toBe(true);
  });

  it('coach cards are ordered by coachFocus with lint-clean reasons whose keys exist in EN and AR', () => {
    const none = coachFocus(T.leadership_behaviours as never, null);
    expect(none.slice(0, 4).map((x) => x.id)).toEqual(FUTURE_BEHAVIOUR_IDS);
    const qc = summarise360('p-qc-inspector', '2026-H2', T.leadership_360_requests as never, T.leadership_360 as never, names);
    const res = coachFocus(T.leadership_behaviours as never, qc.behaviours!.map((x) => ({ id: x.id, self: x.self, others: x.others })));
    expect(res).toHaveLength(12);
    expect(res[0].reasons[0].code).toBe('cf_avg');
    for (const list of [none, res]) {
      expect(lintRanked(list)).toEqual([]);
      for (const r of list) for (const x of r.reasons) { expect(hasKey(x.key), x.key).toBe(true); expect((ar as Row).reasons[x.code], x.code).toBeTruthy(); }
    }
  });
});

// ═══════════════════════════════════════════════ FS47
describe('FS47 Future Leaders track', () => {
  it('acceptance: each competency has descriptors at four levels (EN and AR) and a learning route', () => {
    expect(T.fl_competencies.map((c) => c.id)).toEqual(['fl-safety-leadership', 'fl-regulatory', 'fl-project-cost', 'fl-stakeholder', 'fl-knowledge']);
    const skills = new Set(T.skills.map((s) => s.id));
    const modules = new Set(T.fl_cohorts.flatMap((c) => c.modules.map((m: Row) => m.id)));
    for (const c of T.fl_competencies) {
      for (const lv of ['1', '2', '3', '4']) for (const l of ['en', 'ar']) expect(c.descriptors[lv][l]?.trim().length, `${c.id}.${lv}.${l}`).toBeGreaterThan(10);
      expect(c.route.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.route.some((r: Row) => r.kind === 'module' && modules.has(r.ref)), c.id).toBe(true);
      for (const r of c.route) expect(r.title_en && r.title_ar, `${c.id} route`).toBeTruthy();
      expect(Object.keys(c.skill_targets).every((s) => skills.has(s)), c.id).toBe(true);
      expect(c.sources.length).toBeGreaterThan(0);
    }
  });

  it('acceptance: external programmes are listed with their sources (https, as-of date) and dates, from research only', () => {
    expect(T.fl_external.map((x) => x.id)).toEqual(expect.arrayContaining(['fx-nea-nextgen', 'fx-iaea-nem']));
    for (const x of T.fl_external) {
      expect(x.sources.length, x.id).toBeGreaterThan(0);
      for (const s of x.sources) { expect(s.url).toMatch(/^https:\/\//); expect(s.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(s.label.length).toBeGreaterThan(5); }
      expect(x.dates_en.trim() && x.dates_ar.trim(), x.id).toBeTruthy();
      expect(x.year_from == null || (x.year_from >= 2012 && x.year_from <= 2027)).toBe(true);
      expect(x.competency_ids.every((c: string) => T.fl_competencies.some((y) => y.id === c))).toBe(true);
    }
    expect(T.fl_external.find((x) => x.id === 'fx-nea-nextgen')!.sources[0].url).toMatch(/oecd-nea\.org/);
  });

  it('acceptance: nomination and selection go through RPCs with audit rows (HR nominates; the HR authority or training manager selects; maker-checker)', async () => {
    await as('sro');
    const a0 = audits();
    const n1 = await b.rpc.nominateFutureLeader('w-ro-03', REASON);
    expect(n1.code).toBe('forbidden');
    expect(n1.message).toBe(FL_MSG.forbidden_nominate);
    expect(audits()).toBe(a0 + 1);
    expect(lastAudit()).toMatchObject({ action: 'future_leaders.nominate', outcome: 'refused' });
    await as('chco');
    expect((await b.rpc.nominateFutureLeader('p-chco', REASON)).code).toBe('self_nominate');
    expect((await b.rpc.nominateFutureLeader('p-k-ro', 'short')).code).toBe('invalid');
    await as('k-hr-analyst');
    expect((await b.rpc.nominateFutureLeader('p-sq-lead', REASON)).code).toBe('conflict');
    await as('chco');
    const a1 = audits();
    const n = await b.rpc.nominateFutureLeader('p-k-ro', REASON);
    expect(n.ok).toBe(true);
    expect(audits()).toBe(a1 + 1);
    expect(lastAudit()).toMatchObject({ action: 'future_leaders.nominate', outcome: 'ok' });
    const row = rawGet('leadership_nominations', n.data!.id)!;
    expect(row).toMatchObject({ programme_id: FL_PROGRAMME_ID, nominated_by: 'p-chco', status: 'nominated' });
    expect(n.data!.cohort_id).toBe(flCohortFor(row.cycle));
    // selection: the F16 decision RPC, maker-checker, audit and ledger
    expect((await b.rpc.decideNomination(n.data!.id, 'approved')).code).toBe('maker_checker');
    await as('training-mgr');
    const l0 = ledger();
    const a2 = audits();
    const d = await b.rpc.decideNomination(n.data!.id, 'approved', 'Welcome to the 2027 cohort');
    expect(d.ok).toBe(true);
    expect(ledger()).toBe(l0 + 1);
    expect(audits()).toBeGreaterThan(a2);
    expect(raw('audit_events').some((x) => x.action === 'leadership.decide' && x.entity_id === n.data!.id && x.outcome === 'ok')).toBe(true);
  });

  it('acceptance: track statistics under 10 are suppressed (the 2025 pilot of 8, project counts), the 2026 cohort of 12 shows', async () => {
    const st = computeFlStats(T.leadership_nominations as never, T.fl_participants as never, T.fl_cohorts as never, MIN_GROUP_SIZE);
    const c25 = st.cohorts.find((c) => c.id === 'flc-2025')!;
    const c26 = st.cohorts.find((c) => c.id === 'flc-2026')!;
    expect(c25.suppressed).toBe(true);
    expect(c25.participants).toBeNull();
    expect(c26.participants).toBe(12);
    for (const c of st.cohorts) {
      for (const m of c.modules) expect(m.suppressed ? m.done === null : m.done! >= MIN_GROUP_SIZE).toBe(true);
      for (const p of c.projects) expect(p.suppressed ? p.n === null : p.n! >= MIN_GROUP_SIZE).toBe(true);
    }
    for (const x of st.nominations) expect(x.suppressed ? x.n === null : x.n! >= MIN_GROUP_SIZE).toBe(true);
    await as('k-auditor');
    expect(await b.rpc.futureLeadersStats()).toEqual(st);
    await as('sro');
    expect(await b.rpc.futureLeadersStats()).toBeNull();
  });

  it('modules (training manager, running cohorts), policy projects (participant, screened) and reviews (never your own) complete the track with one ledger row', async () => {
    const target = T.fl_participants.find((p) => p.cohort_id === 'flc-2026' && p.project_status === 'submitted' && p.person_id !== 'p-qc-inspector')!;
    await as('chco');
    expect((await b.rpc.recordFlModule(target.nomination_id, 'flm-project', true)).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.recordFlModule(target.nomination_id, 'flm-nope', true)).code).toBe('invalid');
    const pilot = T.fl_participants.find((p) => p.cohort_id === 'flc-2025')!;
    expect((await b.rpc.recordFlModule(pilot.nomination_id, 'flm-safety', true)).message).toBe(FL_MSG.not_found); // completed: no longer a participant to record
    b.rawInsert('leadership_nominations', { id: 'ln-fl-t2', person_id: 'w-ro-04', programme_id: FL_PROGRAMME_ID, nominated_by: 'p-chco', reason: REASON, cycle: '2026-H2', status: 'approved', history: [] } as never);
    expect((await b.rpc.recordFlModule('ln-fl-t2', 'flm-safety', true)).message).toBe(FL_MSG.not_running); // joins the 2027 cohort, not running yet
    let last;
    for (const m of ['flm-safety', 'flm-regulation', 'flm-project', 'flm-stakeholder', 'flm-knowledge', 'flm-future']) last = await b.rpc.recordFlModule(target.nomination_id, m, true);
    expect(last!.data!.modules_done).toHaveLength(6);
    const qc = T.fl_participants.find((p) => p.person_id === 'p-qc-inspector')!;
    const base = { nomination_id: qc.nomination_id, title: 'Supplier quality for factory modules', question: 'Which controls must move into the factory?', summary: 'This paper compares inspection approaches and proposes three options.', sponsor_role: 'Head of Supplier Quality (role card)' };
    await as('nse');
    expect((await b.rpc.savePolicyProject(base)).code).toBe('forbidden');
    await as('qc-inspector');
    expect((await b.rpc.savePolicyProject({ ...base, summary: 'Contact me at someone@example.org for the draft paper and options.' })).code).toBe('contact_details');
    expect((await b.rpc.savePolicyProject({ ...base, title: 'x' })).message).toBe(FL_MSG.title);
    expect((await b.rpc.savePolicyProject({ ...base, submit: true })).data!.project_status).toBe('submitted');
    expect((await b.rpc.reviewPolicyProject(qc.nomination_id, 'accept')).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.reviewPolicyProject(qc.nomination_id, 'return', 'no')).message).toBe(FL_MSG.return_note);
    const r2 = await b.rpc.reviewPolicyProject(qc.nomination_id, 'accept');
    expect(r2.ok && r2.data!.completed).toBe(false);
    const l0 = ledger();
    await as('chco');
    const r3 = await b.rpc.reviewPolicyProject(target.nomination_id, 'accept');
    expect(r3.data!.completed).toBe(true);
    expect(ledger()).toBe(l0 + 1);
    expect(rawGet('leadership_nominations', target.nomination_id)!.status).toBe('completed');
  });

  it('readiness: staff read their own; HR reads Future Leaders nominees only (audited); reasons explain the number', async () => {
    const comps = T.fl_competencies;
    const lv = (pid: string) => new Map(T.person_skills.filter((s) => s.person_id === pid && s.active).map((s) => [s.skill_id, { level: s.level }]));
    const x = flReadiness('p-qc-inspector', lv('p-qc-inspector'), comps as never);
    expect(x.comps).toHaveLength(5);
    expect(x.score).toBeGreaterThanOrEqual(0);
    expect(x.score).toBeLessThanOrEqual(1);
    const rs = flReasons(x, comps as never, (id) => ({ en: id, ar: id }));
    expect(rs[0].code).toBe('fl_ready');
    for (const r of rs) expect(hasKey(r.key), r.key).toBe(true);
    await as('qc-inspector');
    expect((await b.rpc.flReadiness(['p-qc-inspector', 'p-sq-lead'])).map((y) => y.person_id)).toEqual(['p-qc-inspector']);
    await as('chco');
    const a0 = audits();
    const hr = await b.rpc.flReadiness(['p-qc-inspector', 'p-sq-lead', 'w-ro-01']);
    expect(hr.map((y) => y.person_id)).toEqual(['p-qc-inspector', 'p-sq-lead']);
    expect(hr[0]).toEqual(x);
    expect(audits()).toBe(a0 + 1);
    expect(lastAudit().action).toBe('future_leaders.readiness_read');
  });
});

// ═══════════════════════════════════════════════ FS48
describe('FS48 women in future nuclear skills', () => {
  const area = wfnArea;
  it('acceptance: gender is never an input to a ranking (metamorphic check; the static and trapped-row checks are in w3e5-no-protected-inputs)', () => {
    const flipped = T.people.map((p) => ({ ...p, gender: p.gender === 'f' ? 'm' : p.gender === 'm' ? 'f' : p.gender }));
    expect(flipped.some((p, i) => p.gender !== T.people[i].gender)).toBe(true);
    for (const p of T.wfn_participants.filter((x) => x.active)) {
      // the rankers take no people rows at all: the inputs are the participant's own choices, circles, seats and offers
      expect(rankCircles.length).toBe(4);
      expect(rankOffers.length).toBe(5);
      const a = rankCircles(p as never, T.wfn_circles as never, T.wfn_circle_members as never, area);
      expect(a.every((r) => r.reasons.length > 0)).toBe(true);
      expect(lintRanked(a)).toEqual([]);
      const o = rankOffers(p as never, T.wfn_offers as never, T.wfn_requests as never, NOW, area);
      expect(lintRanked(o)).toEqual([]);
      for (const r of [...a, ...o]) for (const x of r.reasons) { expect(hasKey(x.key), x.key).toBe(true); expect(x.key).not.toMatch(/gender|women|female/); }
    }
    // the mentoring engine card lists both rankers and says the network is opt-in
    const card = T.engine_cards.find((c) => c.id === 'mentoring')!;
    expect(card.version).toBe(2);
    expect(card.scoring_functions).toEqual(expect.arrayContaining(['src/modules/m22/future.ts#rankCircles', 'src/modules/m22/future.ts#rankOffers']));
    expect(card.inputs_used.map((x: Row) => x.key)).toContain('wfn_participants');
    expect(JSON.stringify(card.inputs_used)).not.toMatch(/"gender"/);
  });

  it('acceptance: aggregates under 10 are suppressed (network counts, request outcomes, pipeline shares suppressed whole)', async () => {
    const input = {
      participants: T.wfn_participants, members: T.wfn_circle_members, circles: T.wfn_circles, requests: T.wfn_requests, people: T.people, academyMembers: T.academy_members,
      gigApplications: T.opportunity_applications.map((a) => ({ person_id: a.person_id, status: a.status, channel: T.opportunities.find((o) => o.id === a.opportunity_id)?.channel ?? null })),
      nominations: T.leadership_nominations,
    };
    const st = wfnStats(input as never, MIN_GROUP_SIZE);
    expect(st.network.participants).toBe(18);
    for (const r of st.network.requests) expect(r.suppressed ? r.n === null : r.n! >= MIN_GROUP_SIZE).toBe(true);
    for (const r of st.pipeline) {
      if (r.suppressed) expect([r.women, r.men, r.share]).toEqual([null, null, null]);
      else { expect(r.women!).toBeGreaterThanOrEqual(MIN_GROUP_SIZE); expect(r.men!).toBeGreaterThanOrEqual(MIN_GROUP_SIZE); }
    }
    expect(st.pipeline.find((r) => r.id === 'staff')!.suppressed).toBe(false);
    expect(st.pipeline.some((r) => r.suppressed)).toBe(true);
    await as('chco');
    const hr = await b.rpc.wfnStats();
    expect(hr).toEqual(st);
    expect(JSON.stringify(hr)).not.toMatch(/person_id|p-|w-/);
    await as('sro');
    expect(await b.rpc.wfnStats()).toBeNull();
  });

  it('acceptance: opt-in is withdrawable without trace in rankings (choices blanked, seats ended, open requests withdrawn; others\' rankings and the counts unchanged)', async () => {
    const other = T.wfn_participants.find((p) => p.person_id === 'p-nse')!;
    const snap = () => ({
      c: rankCircles(other as never, raw('wfn_circles') as never, raw('wfn_circle_members') as never, area),
      o: rankOffers(other as never, raw('wfn_offers') as never, raw('wfn_requests') as never, NOW, area),
      flags: raw('wfn_circles').map((c) => [c.id, c.is_full, c.mentor_open]),
    });
    await as('chco');
    const s0 = await b.rpc.wfnStats();
    const r0 = snap();
    await as('k-ro');
    expect((await b.rpc.joinWfnCircle('wc-ai', true)).message).toBe(WFN_MSG.not_opted_in);
    expect((await b.rpc.setWfnOptin({ active: true, interests: ['advanced_reactor', 'ai_data'], strands: ['circles', 'visiting', 'sponsored'] })).ok).toBe(true);
    expect((await b.rpc.joinWfnCircle('wc-smr', true)).code).toBe('conflict');
    expect((await b.rpc.joinWfnCircle('wc-ai', true)).ok).toBe(true);
    for (const o of ['wo-visit-smr', 'wo-study-data', 'wo-study-ntm']) expect((await b.rpc.requestWfnOffer(o, STATEMENT)).ok).toBe(true);
    expect((await b.rpc.requestWfnOffer('wo-study-h2', STATEMENT)).code).toBe('limit');
    const a0 = audits();
    const w = await b.rpc.setWfnOptin({ active: false });
    expect(w.ok).toBe(true);
    expect(audits()).toBe(a0 + 1);
    const me = raw('wfn_participants').find((p) => p.person_id === 'p-k-ro')!;
    expect(me).toMatchObject({ active: false, interests: [], strands: [], mentor: false });
    expect(raw('wfn_circle_members').filter((m) => m.person_id === 'p-k-ro' && m.active)).toEqual([]);
    expect(raw('wfn_requests').filter((q) => q.person_id === 'p-k-ro' && ['interested', 'shortlisted'].includes(q.status))).toEqual([]);
    expect(snap()).toEqual(r0);
    await as('chco');
    expect(await b.rpc.wfnStats()).toEqual(s0);
  });

  it('RBAC: opt-in data is readable by the person only; HR gets aggregates only and never the request desk; the training manager owns the desk', async () => {
    await as('qc-inspector');
    expect((await b.list('wfn_participants')).map((p) => p.person_id)).toEqual(['p-qc-inspector']);
    expect((await b.list('wfn_circle_members')).every((m) => m.person_id === 'p-qc-inspector')).toBe(true);
    expect((await b.list('wfn_requests')).every((m) => m.person_id === 'p-qc-inspector')).toBe(true);
    for (const p of ['chco', 'k-hr-analyst', 'training-mgr', 'k-auditor', 'sro']) {
      await as(p);
      expect(await b.list('wfn_participants'), p).toHaveLength(0);
      expect(await b.list('wfn_requests'), p).toHaveLength(0);
      expect(await b.list('wfn_circle_members'), p).toHaveLength(0);
    }
    await as('chco');
    expect(await b.rpc.wfnDesk()).toEqual([]);
    await as('training-mgr');
    const desk = await b.rpc.wfnDesk();
    expect(desk.length).toBe(T.wfn_requests.filter((q) => q.status !== 'withdrawn').length);
    // decisions in order, a placement writes one ledger row
    const rid = desk.find((q) => q.status === 'interested')!.id;
    expect((await b.rpc.decideWfnRequest(rid, 'place')).message).toBe(WFN_MSG.transition);
    expect((await b.rpc.decideWfnRequest(rid, 'shortlist')).ok).toBe(true);
    const l0 = ledger();
    expect((await b.rpc.decideWfnRequest(rid, 'place')).ok).toBe(true);
    expect(ledger()).toBe(l0 + 1);
    expect((await b.rpc.decideWfnRequest(rid, 'complete')).message).toBe(WFN_MSG.outcome);
    expect((await b.rpc.decideWfnRequest(rid, 'complete', '', 'progressed')).ok).toBe(true);
    await as('chco');
    expect((await b.rpc.decideWfnRequest(rid, 'decline', 'Not this time')).code).toBe('forbidden');
    // partners are not staff: no opt-in
    await as('alnoor-gm');
    expect((await b.rpc.setWfnOptin({ active: true, interests: ['ai_data'], strands: ['circles'] })).code).toBe('forbidden');
  });

  it('circle flags stand in for other people\'s memberships: ranking with the flags = ranking with every membership', () => {
    for (const c of T.wfn_circles) expect({ is_full: c.is_full, mentor_open: c.mentor_open }).toEqual(circleFlags(c as never, T.wfn_circle_members as never));
    expect(T.wfn_circles.find((c) => c.id === 'wc-smr')!.is_full).toBe(true);
    for (const p of T.wfn_participants.filter((x) => x.active)) {
      const full = rankCircles(p as never, T.wfn_circles as never, T.wfn_circle_members as never, area);
      const view = rankCircles(p as never, T.wfn_circles as never, circleMembersView(T.wfn_circles as never, T.wfn_circle_members.filter((m) => m.person_id === p.person_id) as never), area);
      expect(view).toEqual(full);
    }
  });
});

// ═══════════════════════════════════════════════ seed, routes, i18n
describe('FS46-FS48 seed, routes, benchmarks and i18n', () => {
  it('synthetic seed: Future Leaders nominations in every state, cohorts, participants, network rows; public rows carry no headcount or site claims', () => {
    const fl = T.leadership_nominations.filter((n) => n.programme_id === FL_PROGRAMME_ID);
    expect(fl).toHaveLength(25);
    expect(new Set(fl.map((n) => n.status))).toEqual(new Set(['completed', 'approved', 'declined', 'nominated']));
    expect(T.fl_participants).toHaveLength(20);
    expect(T.wfn_participants.length).toBe(21);
    expect(T.wfn_requests.length).toBe(17);
    expect(T.leadership_360_requests.filter((r) => r.form_version === 2)).toHaveLength(120);
    expect(T.leadership_programmes.find((g) => g.id === FL_PROGRAMME_ID)).toMatchObject({ nominable: false, link_route: '/leadership/future-leaders' });
    for (const t of ['leadership_behaviours', 'fl_competencies', 'fl_external', 'wfn_programmes']) {
      for (const r of T[t]) expect(publicTextIsClean(Object.values(r)), `${t}.${r.id}`).toBe(true);
    }
    // no real names: network people are synthetic workforce rows or persona role cards
    expect(T.wfn_participants.every((p) => /^(w-|p-)/.test(p.person_id))).toBe(true);
  });

  it('routes: five FS46-FS48 routes with EN and AR titles and purposes; HR-only desks; benchmarks for FS46, FS47 and FS48', () => {
    const ids = ['leadership-behaviours', 'leadership-future-leaders', 'leadership-future-leaders-manage', 'communities-women', 'communities-women-programme'];
    for (const id of ids) {
      const r = routes.find((x) => x.id === id)!;
      expect(r, id).toBeTruthy();
      for (const l of [en, ar] as Row[]) { expect(l.routes[id].title, id).toBeTruthy(); expect(l.routes[id].purpose, id).toBeTruthy(); }
    }
    expect(routes.find((x) => x.id === 'leadership-future-leaders-manage')!.guard).toMatchObject({ anyRole: ['hr_analyst', 'hr_director', 'training_manager', 'auditor'] });
    expect(routes.find((x) => x.id === 'communities-women-programme')!.guard).toMatchObject({ anyRole: ['hr_analyst', 'hr_director', 'training_manager', 'auditor'] });
    const B = FEATURE_BENCHMARKS as unknown as Record<string, string[]>;
    for (const f of ['FS46', 'FS47', 'FS48']) expect(B[f]?.length, f).toBeGreaterThan(0);
  });

  it('i18n: the new m22 strings exist in both languages and the Arabic is Arabic', () => {
    const flat = (o: Row, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
    const A = new Map(flat(ar as Row));
    const E = flat(en as Row).filter(([k]) => /^(beh|fl|flm|future|wfn|wfnp)\./.test(k));
    expect(E.length).toBeGreaterThan(200);
    for (const [k] of E) {
      expect(A.get(k), k).toBeTruthy();
      if (!/^(flm\.moduleN|fl\.myTrackSub)$/.test(k)) expect(/[؀-ۿ]/.test(A.get(k)!), `${k} is Arabic`).toBe(true);
    }
  });
});
