/** F18 Talent review and F19 Succession planning (W3 · E1, M23): every acceptance criterion on the local path, the rules shared
 *  with SQL, the seed, routes and i18n. The SQL path is checked by scripts/validate/w3e1-talent.mjs (PGlite, SQL = TS parity). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { hasKey } from '../../src/i18n';
import { MIN_GROUP_SIZE, grantsFor, type PlatformRole } from '../../src/auth/policy';
import { checkGuard } from '../../src/auth/guards';
import { lintRanked } from '../../src/domain/engines';
import {
  EVIDENCE_WEIGHTS, MSG, benchCounts, boxOf, candidateReasons, critId, cutsOf, evidenceOf, flagsOf, gatesMet, hardGatesOf, isHipo, membersOf, normActions,
  perfFromRating, potentialOf, readinessOf, slateFlags, successionAggregatesOf, talentAggregatesOf, type SuccessorLite,
} from '../../src/modules/m23/domain';
import { routes } from '../../src/modules/m23/routes';
import seed from '../../src/seed/seed.json';
import type { BoardMember, TalentBoard } from '../../src/modules/m23/backend/rpc';

const S = seed as unknown as { tables: Record<string, any[]>; personas: { persona: string; roles: PlatformRole[] }[]; meta: { demo_today: string } };
const T = S.tables;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const audits = () => b.raw('audit_events').length;
const lastAudit = () => [...b.raw('audit_events')].sort((x, y) => x.seq - y.seq).pop()!;
const board = async (cycle: string) => { const r = await b.rpc.talentBoard(cycle); expect(r.ok, r.message).toBe(true); return r.data as TalentBoard; };
const ratingOf = (pid: string) => T.perf_ratings.filter((r) => r.person_id === pid).sort((a, c) => (a.period < c.period ? 1 : -1))[0]?.rating;

describe('F18 rules (shared with SQL)', () => {
  it('evidence index: integer points per component, at most 100, self-claims never count as growth or agility', () => {
    expect(EVIDENCE_WEIGHTS.reduce((s, [, , p]) => s + p, 0)).toBe(100);
    const skills = [{ id: 'a', key_level: 2 }, { id: 'b', key_level: 3 }];
    const ev = evidenceOf({ states: [{ skill_id: 'a', level: 3 }, { skill_id: 'b', level: 2 }], skills,
      evidence: [
        { skill_id: 'a', kind: 'rating', basis: 'claimed', level: 3, observed_on: '2026-09-01', ref_id: 'x' },
        { skill_id: 'b', kind: 'ojt', basis: 'evidenced', level: 3, observed_on: '2026-08-01', ref_id: 'opp-1' },
        { skill_id: 'a', kind: 'rating', basis: 'validated', level: 2, observed_on: '2024-01-01', ref_id: 'chk' },
      ] }, '2026-10-08');
    expect(ev).toMatchObject({ breadth: 2, depth: 1, growth: 1, validated: 1, opportunities: 1, agility: 1 });
    expect(ev.index).toBe(Object.values(ev.points).reduce((s, x) => s + x, 0));
    for (const p of T.people.filter((x) => x.kind === 'staff')) {
      const e = evidenceOf({ states: T.person_skills.filter((s) => s.person_id === p.id), evidence: T.skill_evidence.filter((s) => s.person_id === p.id), skills: T.skills }, '2026-10-08');
      expect(e.index).toBeGreaterThanOrEqual(0);
      expect(e.index).toBeLessThanOrEqual(100);
    }
  });
  it('acceptance: outlier flags appear when potential is 3 and the evidence index is in the bottom third', () => {
    const cuts = cutsOf([10, 20, 30, 40, 50, 60, 70, 80, 90])!;
    expect(cuts).toEqual({ low: 30, high: 70 });
    expect(flagsOf(3, 30, cuts)).toEqual(['potential_high_evidence_low']);
    expect(flagsOf(3, 31, cuts)).toEqual([]);
    expect(flagsOf(2, 10, cuts)).toEqual([]);
    expect(flagsOf(1, 75, cuts)).toEqual(['potential_low_evidence_high']);
    expect(cutsOf([1, 2])).toBeNull();
  });
  it('potential is the median of three anchors; performance maps from the HR field; 9-box and HiPo', () => {
    expect(potentialOf({ agility: 3, influence: 1, drive: 2 })).toBe(2);
    expect(potentialOf({ agility: 3, influence: 3, drive: 1 })).toBe(3);
    expect(potentialOf({ agility: 3, influence: 4, drive: 1 })).toBeNull();
    expect([1, 2, 3, 4, 5].map(perfFromRating)).toEqual([1, 1, 2, 3, 3]);
    expect(boxOf(3, 3)).toBe(9);
    expect(boxOf(1, 1)).toBe(1);
    expect(isHipo(2, 3) && isHipo(3, 3) && !isHipo(1, 3) && !isHipo(3, 2)).toBe(true);
    expect(normActions([{ kind: 'nope', title_en: 'x' }])).toBeNull();
    expect(normActions([{ kind: 'training', title_ar: 'دورة' }])).toEqual([{ kind: 'training', title_en: 'دورة', title_ar: 'دورة', ref_table: null, ref_id: null }]);
  });
  it('acceptance: aggregate exports suppress cells under 10, including women and Emirati splits', () => {
    const agg = talentAggregatesOf(null, T.review_placements as never, T.people as never, T.review_cycles.map((c) => c.id));
    for (const c of agg.cells) for (const v of [c.n, c.women, c.emirati]) expect(v === null || v >= MIN_GROUP_SIZE).toBe(true);
    expect(agg.women).toBeNull();
    expect(agg.cells.some((c) => c.n === null)).toBe(true);
    const small = talentAggregatesOf(null, (T.review_placements as never[]).slice(0, 7), T.people as never, []);
    expect(small.suppressed && small.n === null && small.cells.every((c) => c.n === null)).toBe(true);
  });
  it('cycle membership never includes the HR director', () => {
    const ids = membersOf(['corporate', 'operations'], T.people as never, T.role_assignments as never, '2026-10-08');
    expect(ids).not.toContain('p-chco');
    expect(ids).toContain('p-k-ro');
  });
});

describe('F18 RBAC (acceptance: managers only in scope; employees never their own placement)', () => {
  it('a line manager reads no placement directly and the board holds only people in scope, never the manager', async () => {
    await as('sro');
    expect(await b.list('review_placements')).toHaveLength(0);
    const d = await board('trc-2026h2-ops');
    const crewB = new Set(T.people.filter((p) => p.crew === 'B' || p.manager_id === 'p-sro').map((p) => p.id));
    expect(d.members.length).toBeGreaterThan(0);
    expect(d.members.every((m) => crewB.has(m.person_id))).toBe(true);
    expect(d.members.some((m) => m.person_id === 'p-sro')).toBe(false);
    expect(d.members_total).toBeGreaterThan(d.members.length);
    const other = await b.rpc.talentBoard('trc-2026h1-tsv');
    expect(other.code).toBe('not_found');
  });
  it('an employee cannot read their own placement (table, board and aggregates), only agreed priorities without any box field', async () => {
    await as('qc-inspector');
    expect(T.review_placements.some((p) => p.person_id === 'p-qc-inspector')).toBe(true);
    expect(await b.list('review_placements')).toHaveLength(0);
    expect((await b.rpc.talentBoard('trc-2026h1-tsv')).code).toBe('forbidden');
    expect((await b.rpc.talentAggregates(null)).code).toBe('forbidden');
    const pr = await b.list('talent_priorities');
    expect(pr.length).toBe(1);
    expect(pr.every((r) => r.person_id === 'p-qc-inspector')).toBe(true);
    for (const k of ['box', 'perf', 'potential', 'hipo', 'evidence_index']) expect(k in pr[0]).toBe(false);
  });
  it('the HR director reads everything; the HR BP calibrates in scope; auditors see only the audit log', async () => {
    await as('chco');
    expect(await b.list('review_placements')).toHaveLength(T.review_placements.length);
    await as('k-hr-analyst');
    expect(await b.list('review_placements')).toHaveLength(0);
    const d = await board('trc-2026h2-mne');
    expect(d.can.calibrate && !d.can.place && d.can.lock_blocker === null).toBe(true);
    await as('k-auditor');
    expect(await b.list('review_placements')).toHaveLength(0);
    expect((await b.rpc.talentCycles()).code).toBe('forbidden');
  });
  it('observer and partner personas get 403 on every talent route; employees too; managers and HR get in', () => {
    const roles = (p: string) => S.personas.find((x) => x.persona === p)!.roles;
    for (const r of routes.filter((x) => x.path.startsWith('/talent'))) {
      for (const p of ['k-observer', 'alnoor-gm', 'alnoor-qaqc', 'k-contractor', 'k-university', 'k-ro', 'k-auditor']) expect(checkGuard(r.guard, { status: 'signed_in', roles: roles(p) }), `${r.id} ${p}`).toBe('forbidden');
      for (const p of ['sro', 'chco', 'k-hr-analyst', 'ops-ceo']) expect(checkGuard(r.guard, { status: 'signed_in', roles: roles(p) }), `${r.id} ${p}`).toBe(r.id === 'talent-review-insights' && ['sro', 'ops-ceo'].includes(p) ? 'forbidden' : 'ok');
    }
    for (const role of ['observer', 'partner_user', 'partner_admin', 'university', 'employee', 'auditor'] as PlatformRole[]) expect(grantsFor([role], 'talent_review').size).toBe(0);
    const mine = routes.find((r) => r.id === 'my-development-priorities')!;
    expect(checkGuard(mine.guard, { status: 'signed_in', roles: roles('k-ro') })).toBe('ok');
  });
});

describe('F18 flows: placement, locked cycle, calibration and lock (every change audited)', () => {
  it('a manager places someone in scope with an evidence snapshot; out-of-scope, self and unexplained rating changes are refused and audited', async () => {
    await as('sro');
    const sug = perfFromRating(ratingOf('p-k-ro'))!;
    const a0 = audits();
    const r = await b.rpc.placeTalent({ cycle_id: 'trc-2026h2-ops', person_id: 'p-k-ro', perf: sug, anchors: { agility: 3, influence: 2, drive: 3 }, actions: [{ kind: 'training', title_en: 'SRO pre-licensing', title_ar: 'ما قبل الترخيص' }] });
    expect(r.ok, r.message).toBe(true);
    expect(lastAudit()).toMatchObject({ action: 'talent.place', outcome: 'ok', entity_id: 'tp:trc-2026h2-ops:p-k-ro' });
    const row = b.rawGet('review_placements', 'tp:trc-2026h2-ops:p-k-ro')!;
    expect(row.placed_by).toBe('p-sro');
    expect((row.evidence_snapshot as { index: number }).index).toBe(row.evidence_index);
    expect((await b.rpc.placeTalent({ cycle_id: 'trc-2026h2-ops', person_id: 'w-ro-03', perf: 2, anchors: { agility: 2, influence: 2, drive: 2 } })).code).toBe('not_in_scope');
    expect((await b.rpc.placeTalent({ cycle_id: 'trc-2026h2-ops', person_id: 'p-sro', perf: 2, anchors: { agility: 2, influence: 2, drive: 2 } })).code).toBe('self');
    const s2 = perfFromRating(ratingOf('w-ro-02'))!;
    expect((await b.rpc.placeTalent({ cycle_id: 'trc-2026h2-ops', person_id: 'w-ro-02', perf: s2 === 3 ? 1 : 3, anchors: { agility: 2, influence: 2, drive: 2 } })).code).toBe('note_required');
    expect((await b.rpc.placeTalent({ cycle_id: 'trc-2026h2-ops', person_id: 'w-ro-02', perf: s2 === 3 ? 1 : 3, anchors: { agility: 2, influence: 2, drive: 2 }, note: 'Covered two outages as acting SRO this half.' })).ok).toBe(true);
    expect(audits() - a0).toBe(5);
  });
  it('acceptance: the outlier flag is raised for potential 3 when the evidence index is in the bottom third', async () => {
    await as('ops-ceo');
    const d = await board('trc-2026h2-ops');
    // FS wave C QA: rank by the live evidence a new placement freezes (a seeded placement keeps its older snapshot; wave C added
    // capstone and assessment evidence for some of those people after their placement)
    const low = [...d.members].filter((m) => m.can_place).sort((x, y) => x.evidence.index - y.evidence.index)[0] as BoardMember;
    expect(low.evidence.index).toBeLessThanOrEqual(d.cuts!.low);
    const sug = low.suggested_perf ?? 2;
    const r = await b.rpc.placeTalent({ cycle_id: 'trc-2026h2-ops', person_id: low.person_id, perf: sug, anchors: { agility: 3, influence: 3, drive: 3 } });
    expect(r.ok, r.message).toBe(true);
    expect(r.data!.flags).toContain('potential_high_evidence_low');
    const after = await board('trc-2026h2-ops');
    expect(after.members.find((m) => m.person_id === low.person_id)!.flags).toContain('potential_high_evidence_low');
  });
  it('acceptance: a locked cycle refuses changes (cycle_locked) and every refusal is audited', async () => {
    await as('rp-lead');
    const a0 = audits();
    expect((await b.rpc.placeTalent({ cycle_id: 'trc-2026h1-tsv', person_id: 'w-rp-01', perf: 2, anchors: { agility: 2, influence: 2, drive: 2 } })).code).toBe('cycle_locked');
    await as('k-hr-analyst');
    expect((await b.rpc.calibrateCycle('trc-2026h1-tsv', [], true)).code).toBe('cycle_locked');
    await as('chco');
    expect((await b.rpc.lockCycle('trc-2026h1-tsv', '')).code).toBe('cycle_locked');
    expect(audits() - a0).toBe(3);
    expect(lastAudit()).toMatchObject({ action: 'talent.lock', outcome: 'refused' });
  });
  it('calibration needs reasons and complete placement; the HR director cannot lock what they calibrated; lock publishes priorities, pool and a ledger row', async () => {
    await as('k-hr-analyst');
    expect((await b.rpc.calibrateCycle('trc-2026h2-ops', [], true)).code).toBe('incomplete');
    const someone = T.review_placements.find((p) => p.cycle_id === 'trc-2026h2-mne')!;
    expect((await b.rpc.calibrateCycle('trc-2026h2-mne', [{ person_id: someone.person_id, perf: 2, potential: 2, note: 'short' }], false)).code).toBe('note_required');
    await as('chco');
    expect((await b.rpc.calibrateCycle('trc-2026h2-mne', [{ person_id: someone.person_id, perf: 2, potential: 2, note: 'Evidence supports a moderate placement.' }], true)).ok).toBe(true);
    expect((await b.rpc.lockCycle('trc-2026h2-mne', '')).code).toBe('maker_checker');
    await as('k-hr-analyst');
    expect((await b.rpc.lockCycle('trc-2026h2-mne', '')).code).toBe('forbidden');
    expect((await b.rpc.calibrateCycle('trc-2026h2-mne', [{ person_id: someone.person_id, perf: 2, potential: 3, note: 'Re-confirmed in the calibration session.' }], true)).ok).toBe(true);
    await as('chco');
    const l0 = b.raw('ledger_local').length;
    const r = await b.rpc.lockCycle('trc-2026h2-mne', 'Agreed with function heads');
    expect(r.ok, r.message).toBe(true);
    const n = T.review_placements.filter((p) => p.cycle_id === 'trc-2026h2-mne').length;
    expect(r.data!.priorities).toBe(n);
    expect(b.raw('talent_priorities').filter((x) => x.cycle_id === 'trc-2026h2-mne')).toHaveLength(n);
    expect(b.raw('talent_pool').filter((x) => x.cycle_id === 'trc-2026h2-mne')).toHaveLength(r.data!.hipo);
    expect(b.raw('notifications').filter((x) => x.kind === 'talent' && String(x.id).startsWith('nt-tpr-trc-2026h2-mne'))).toHaveLength(n);
    expect(b.raw('ledger_local').length).toBe(l0 + 1);
    expect(lastAudit()).toMatchObject({ action: 'talent.lock', outcome: 'ok' });
    expect((await b.rpc.calibrateCycle('trc-2026h2-mne', [], false)).code).toBe('cycle_locked');
  });
  it('HR aggregates are suppressed under 10 and refused to line managers', async () => {
    await as('k-hr-analyst');
    const a = await b.rpc.talentAggregates(null);
    expect(a.ok).toBe(true);
    for (const c of a.data!.cells) for (const v of [c.n, c.women, c.emirati]) expect(v === null || v >= 10).toBe(true);
    await as('sro');
    expect((await b.rpc.talentAggregates(null)).code).toBe('forbidden');
  });
});

describe('F19 Succession', () => {
  const slates = () => T.succession_slates;
  it('acceptance: nobody is ready now with a hard gate not met (seed, rules and RPC)', async () => {
    for (const x of T.successors.filter((s) => s.readiness === 'ready_now')) expect(gatesMet(x.gates), x.id).toBe(true);
    const gates = hardGatesOf('senior-reactor-operator', { person: { id: 'p-k-ro', job_role_id: 'reactor-operator' }, licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records }, { band: 'ready_in', gate_status: 'met', primary_route: 'ro-sro' }, '2026-10-08');
    expect(gates.find((g) => g.code === 'licence')!.met).toBe(false);
    expect(readinessOf({ score: 0.99, months: 0, path_only: false }, gates)).not.toBe('ready_now');
    expect(candidateReasons(null, gates).some((r) => r.key === 'm23.reasons.gate_licence_not_met')).toBe(true);
    await as('chco');
    const r = await b.rpc.proposeSuccessor({ slate_id: 'ss-shift-supervisor-2026h2', person_id: 'w-sro-03', readiness: 'ready_now', note: 'Strong performer in every outage.' });
    expect(r.code).toBe('gate_not_met');
    expect(r.message).toBe(MSG.gate_not_met);
  });
  it('candidates carry computed readiness, gates and readable reasons; earlier-than-computed needs a reason', async () => {
    await as('chco');
    const c = await b.rpc.successionCandidates('ss-shift-supervisor-2026h2');
    expect(c.ok).toBe(true);
    expect(lintRanked(c.data!.map((x) => ({ id: x.person_id, score: x.pct ?? 0, reasons: x.reasons })))).toEqual([]);
    for (const x of c.data!.filter((y) => y.reasons.length)) for (const r of x.reasons) expect(hasKey(r.key), r.key).toBe(true);
    const w2 = c.data!.find((x) => x.person_id === 'w-sro-02')!;
    expect(w2.gates_met).toBe(true);
    if (w2.readiness !== 'ready_now') expect((await b.rpc.proposeSuccessor({ slate_id: 'ss-shift-supervisor-2026h2', person_id: 'w-sro-02', readiness: 'ready_now' })).code).toBe('optimistic_note');
    const ok = await b.rpc.proposeSuccessor({ slate_id: 'ss-shift-supervisor-2026h2', person_id: 'w-sro-02', readiness: 'ready_now', note: 'Acting shift supervisor for six months in 2026.', actions: [{ kind: 'training', title_en: 'ESTADAD', title_ar: 'استعداد', ref_table: 'courses', ref_id: 'c-estadad' }] });
    expect(ok.ok, ok.message).toBe(true);
    expect(lastAudit()).toMatchObject({ action: 'succession.propose', outcome: 'ok' });
    await as('k-hr-analyst');
    expect((await b.rpc.proposeSuccessor({ slate_id: 'ss-shift-supervisor-2026h2', person_id: 'w-sro-05' })).code).toBe('forbidden');
  });
  it('acceptance: the roll-up updates critical_roles qualified/in_training/pipeline for the period with an audit and a ledger row', async () => {
    await as('chco');
    expect((await b.rpc.proposeSuccessor({ slate_id: 'ss-shift-supervisor-2026h2', person_id: 'w-sro-02', readiness: 'ready_now', note: 'Acting shift supervisor for six months in 2026.' })).ok).toBe(true);
    const conf = await b.rpc.confirmSlate('ss-shift-supervisor-2026h2', 'Agreed with the operations CEO');
    expect(conf.ok, conf.message).toBe(true);
    expect(b.rawGet('critical_roles', critId('shift-supervisor', '2026-H2'))).toBeUndefined();
    const a0 = audits();
    const l0 = b.raw('ledger_local').length;
    const r = await b.rpc.rollupBench('2026-H2');
    expect(r.ok, r.message).toBe(true);
    expect(audits() - a0).toBe(1);
    expect(b.raw('ledger_local').length).toBe(l0 + 1);
    const row = b.rawGet('critical_roles', 'crit-shift-supervisor-2026h2')!;
    const k = benchCounts('ss-shift-supervisor-2026h2', b.raw('successors') as unknown as SuccessorLite[]);
    expect(row).toMatchObject({ period: '2026-H2', qualified: k.qualified, in_training: k.in_training, pipeline: k.pipeline });
    expect(k.qualified).toBeGreaterThanOrEqual(1);
    expect(b.rawGet('bench_rollups', 'br:2026-H2:shift-supervisor')).toBeTruthy();
    expect((await b.rpc.rollupBench('2026-Q4')).code).toBe('invalid');
    await as('k-hr-analyst');
    expect((await b.rpc.rollupBench('2026-H2')).code).toBe('forbidden');
  });
  it('acceptance: the flags "no ready-now" and "successor on more than 2 slates" display; Emirati/women shares only as aggregates of 10+', async () => {
    const flags = slates().flatMap((s) => slateFlags(s.id, T.successors as never));
    expect(flags).toContain('no_ready_now');
    expect(flags).toContain('successor_overloaded');
    expect(flags).toContain('external_cover');
    await as('chco');
    const d = await b.rpc.successionBoard();
    expect(d.ok).toBe(true);
    expect(d.data!.slates.find((s) => s.id === 'ss-shift-supervisor-2026h2')!.flags).toEqual(expect.arrayContaining(['no_ready_now', 'successor_overloaded']));
    const agg = successionAggregatesOf(slates() as never, T.successors as never, T.people as never);
    expect(agg.women === null || agg.women >= 10).toBe(true);
    expect(d.data!.aggregates).toEqual(agg);
    await as('ops-ceo');
    const ex = await b.rpc.successionBoard();
    expect(ex.data!.view).toBe('function');
    expect(ex.data!.aggregates).toBeNull();
    await as('sro');
    expect((await b.rpc.successionBoard()).data!.slates).toHaveLength(0);
    await as('alnoor-gm');
    expect((await b.rpc.successionBoard()).code).toBe('forbidden');
  });
  it('seed: 3 cycles in every stage, rich slates, roll-up rows in M07 for 2026-H2 only, synthetic people only', () => {
    expect(T.review_cycles.map((c) => c.status).sort()).toEqual(['calibration', 'locked', 'open']);
    expect(T.review_placements.length).toBeGreaterThan(50);
    expect(slates()).toHaveLength(11);
    expect(T.successors.some((s) => s.cover_source === 'khnp') && T.successors.some((s) => s.cover_source === 'contractor')).toBe(true);
    const crit = T.critical_roles.filter((c) => c.period === '2026-H2');
    expect(crit.length).toBe(slates().filter((s) => s.critical && s.status === 'confirmed').length);
    expect([...new Set(T.critical_roles.map((c) => c.period))].sort().at(-1)).toBe('2026-Q3');
    const people = new Set(T.people.filter((p) => p.synthetic).map((p) => p.id));
    for (const x of [...T.review_placements, ...T.successors.filter((s) => s.person_id)]) expect(people.has(x.person_id)).toBe(true);
    expect(T.successors.filter((s) => s.cover_source !== 'internal').every((s) => s.person_id === null)).toBe(true);
  });
});

describe('M23 routes and i18n', () => {
  it('every route has a title and purpose in English and Arabic', () => {
    for (const r of routes) {
      expect(hasKey(`m23.routes.${r.id}.title`), r.id).toBe(true);
      expect(hasKey(`m23.routes.${r.id}.purpose`), r.id).toBe(true);
    }
    expect(routes.map((r) => r.path)).toEqual(expect.arrayContaining(['/talent/review', '/talent/succession', '/my/development-priorities']));
  });
});
