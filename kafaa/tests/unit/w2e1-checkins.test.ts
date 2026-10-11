/** F10 Skill check-ins and F11 Team capability heatmap: acceptance on the LocalBackend path (SQL path: scripts/validate/w2e1-checkins.mjs). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { lintRanked } from '../../src/domain/engines';
import { hasKey } from '../../src/i18n';
import { MIN_GROUP_SIZE } from '../../src/auth/policy';
import { securityComps } from '../../src/modules/m17/badgeRules';
import {
  MIN_GROUP, coverage, crews, groupsOf, heatmapCsv, lineManagerOf, peerPool, raterOffsets, stateMapOf, teamActions, checkinBlock, distributions, type SkillRowLite,
} from '../../src/modules/m17/checkins';
import seed from '../../src/seed/seed.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, any[]>; meta: { demo_today: string } }).tables;
const NOW = (seed as unknown as { meta: { demo_today: string } }).meta.demo_today;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const last = () => b.raw('audit_events')[b.raw('audit_events').length - 1] as unknown as Record<string, unknown>;
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const crewB = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && p.crew === 'B').map((p) => p.id).sort();

describe('F10 rules', () => {
  it('MIN_GROUP mirrors MIN_GROUP_SIZE; line managers and peer pools follow the scope rules', () => {
    expect(MIN_GROUP).toBe(MIN_GROUP_SIZE);
    expect(lineManagerOf('p-k-ro', T.people, T.role_assignments, NOW)).toBe('p-sro');
    expect(lineManagerOf('p-qc-inspector', T.people, T.role_assignments, NOW)).toBe('p-head-sq');
    const pool = peerPool('p-k-ro', T.people, T.role_assignments, NOW);
    expect(pool.basis).toBe('team');
    expect(pool.peers.map((p) => p.id)).not.toContain('p-sro');
    expect(pool.peers.every((p) => p.team_id === 'ops-crew-b')).toBe(true);
    const qc = peerPool('p-qc-inspector', T.people, T.role_assignments, NOW);
    expect(qc.basis).toBe('family');
    expect(qc.peers.map((p) => p.id)).toEqual(expect.arrayContaining(['w-qa-01', 'w-qa-02']));
    expect(qc.peers.map((p) => p.id)).not.toContain('p-head-sq');
  });
  it('qualification-standard skills, skills held by a current qualification and security skills are blocked', () => {
    const sec = securityComps(T.competencies);
    const std = new Set(T.qual_standards.map((q) => q.id));
    const sk = (id: string) => T.skills.find((s) => s.id === id) as SkillRowLite;
    const ctx = { secComps: sec, standardIds: std, evidence: T.skill_evidence, person: 'p-k-ro' };
    expect(checkinBlock(sk('sk-sa-01'), ctx)).toBe('security_restricted');
    expect(checkinBlock(sk('sk-co-01-eop'), ctx)).toBe('qualification_only');
    expect(checkinBlock(sk('sk-co-01'), ctx)).toBe('qualification_only');
    expect(checkinBlock(sk('sk-da-01'), ctx)).toBeNull();
  });
});

describe('F10 requestCheckin / submitRating / validateCheckin (local)', () => {
  it('a peer cannot see the requester\'s other skills or other raters\' answers', async () => {
    await as('sro');
    const r = await b.rpc.requestCheckin({ skills: [{ skill_id: 'sk-da-02', self_level: 2, note: 'Reviewed AI-drafted shift notes' }, { skill_id: 'sk-en-01-project', self_level: 3, note: 'Ran the crew training plan' }], peer_ids: ['p-k-ro'], message: 'Two quick ratings please' });
    expect(r.ok).toBe(true);
    const id = r.data!.id;
    expect(r.data!.manager_id).toBe('p-ops-ceo');
    await as('k-ro');
    expect(await b.list('skill_checkins', { filter: { person_id: 'p-sro' } })).toHaveLength(0);
    const rows = await b.list('skill_ratings', { filter: { checkin_id: id } });
    expect(rows).toHaveLength(2);
    expect(rows.every((x) => x.rater_kind === 'peer' && x.rater_person_id === 'p-k-ro')).toBe(true);
    expect(await b.list('person_skills', { filter: { person_id: 'p-sro' } })).toHaveLength(0);
    const inbox = (await b.rpc.checkinInbox()).find((x) => x.checkin_id === id)!;
    expect(inbox.items.map((x) => x.skill_id).sort()).toEqual(['sk-da-02', 'sk-en-01-project']);
    expect(JSON.stringify(inbox)).not.toMatch(/self_level|Reviewed AI-drafted/);
    const ok = await b.rpc.submitRating({ checkin_id: id, ratings: [{ skill_id: 'sk-da-02', level: 2, example: 'Saw the checklist review on nights' }, { skill_id: 'sk-en-01-project', level: 0 }] });
    expect(ok.ok).toBe(true);
    expect((await b.rpc.submitRating({ checkin_id: id, ratings: [{ skill_id: 'sk-da-01', level: 2, example: 'not mine' }] })).code).toBe('invalid');
    await as('k-lo-trainee');
    expect((await b.rpc.submitRating({ checkin_id: id, ratings: [{ skill_id: 'sk-da-02', level: 2, example: 'hello there' }] })).code).toBe('not_found');
  });
  it('the person cannot validate their own check-in (self_validate), and peers cannot validate', async () => {
    await as('k-ro');
    const self = await b.rpc.validateCheckin({ checkin_id: 'chk-s-k-ro', decisions: [{ skill_id: 'sk-da-01', outcome: 'validate' }, { skill_id: 'sk-sc-02', outcome: 'validate' }] });
    expect(self.code).toBe('self_validate');
    expect(last().outcome).toBe('refused');
    expect(last().action).toBe('skills.checkin.validate');
    await as('k-lo-trainee');
    expect((await b.rpc.validateCheckin({ checkin_id: 'chk-s-k-ro', decisions: [] })).code).toBe('forbidden');
  });
  it('a qualification-standard skill cannot be raised by a check-in', async () => {
    await as('k-ro');
    expect((await b.rpc.requestCheckin({ skills: [{ skill_id: 'sk-co-01-eop', self_level: 4, note: 'I know the EOPs well' }], peer_ids: [] })).code).toBe('qualification_only');
    expect((await b.rpc.requestCheckin({ skills: [{ skill_id: 'sk-co-01', self_level: 4, note: 'Procedure use every shift' }], peer_ids: [] })).code).toBe('qualification_only');
    expect((await b.rpc.requestCheckin({ skills: [{ skill_id: 'sk-sa-01', self_level: 2, note: 'Security awareness' }], peer_ids: [] })).code).toBe('security_restricted');
    // a crafted check-in that names a qualification skill: the manager's adjustment never becomes evidence
    const before = b.rawGet('person_skills', 'ps:p-k-ro:sk-co-01-eop');
    b.rawInsert('skill_checkins', { id: 'chk-crafted', person_id: 'p-k-ro', manager_id: 'p-sro', peer_ids: [], skills: [{ skill_id: 'sk-co-01-eop', self_level: 3, note: 'crafted' }], message: null, status: 'open', requested_at: `${NOW}T08:00:00Z`, due_on: NOW, decided_by: null, decided_at: null, decision_note: null } as never);
    await as('sro');
    const v = await b.rpc.validateCheckin({ checkin_id: 'chk-crafted', decisions: [{ skill_id: 'sk-co-01-eop', outcome: 'adjust', level: 4, reason: 'trying to raise it' }] });
    expect(v.ok).toBe(true);
    expect(v.data!.written).toBe(0);
    expect(b.raw('skill_evidence').some((e) => e.ref_id === 'chk-crafted')).toBe(false);
    expect(b.rawGet('person_skills', 'ps:p-k-ro:sk-co-01-eop')?.level).toBe(before?.level);
    expect(((b.rawGet('skill_checkins', 'chk-crafted') as Record<string, any>).skills)[0].outcome).toBe('qualification_only');
  });
  it('the manager validates or adjusts with a reason: validated evidence, claim decided, state recomputed, audit and ledger', async () => {
    await as('sro');
    const bad = await b.rpc.validateCheckin({ checkin_id: 'chk-s-k-ro', decisions: [{ skill_id: 'sk-da-01', outcome: 'validate' }, { skill_id: 'sk-sc-02', outcome: 'adjust', level: 3, reason: 'same' }] });
    expect(bad.code).toBe('invalid');
    const ledger0 = b.raw('ledger_local').length;
    const v = await b.rpc.validateCheckin({ checkin_id: 'chk-s-k-ro', decisions: [{ skill_id: 'sk-da-01', outcome: 'validate' }, { skill_id: 'sk-sc-02', outcome: 'adjust', level: 2, reason: 'Good, one level lower for now' }] });
    expect(v.ok).toBe(true);
    expect(v.data).toEqual({ status: 'adjusted', written: 2 });
    const claim = b.raw('skill_claims').find((c) => c.id === 'scl-k-ro-2')!;
    expect(claim.status).toBe('validated');
    expect(b.rawGet('skill_evidence', 'se:rating:scl-k-ro-2:sk-da-01')?.basis).toBe('validated');
    expect(b.rawGet('skill_evidence', 'se:rating:chk-s-k-ro:sk-sc-02')).toMatchObject({ basis: 'validated', level: 2 });
    expect(b.rawGet('person_skills', 'ps:p-k-ro:sk-da-01')?.basis).toBe('validated');
    expect(b.raw('ledger_local').length).toBe(ledger0 + 1);
    expect(last()).toMatchObject({ action: 'skills.checkin.validate', outcome: 'ok' });
    expect(b.raw('skill_ratings').filter((r) => r.checkin_id === 'chk-s-k-ro' && r.status === 'pending')).toHaveLength(0);
    expect((await b.rpc.validateCheckin({ checkin_id: 'chk-s-k-ro', decisions: [] })).code).toBe('conflict');
  });
  it('peers must be same-team colleagues; one open check-in per skill; the person withdraws', async () => {
    await as('k-ro');
    expect((await b.rpc.requestCheckin({ skills: [{ skill_id: 'sk-hu-02', self_level: 3, note: 'Led two pre-job briefs' }], peer_ids: ['w-rp-01'] })).code).toBe('not_peer');
    expect((await b.rpc.requestCheckin({ skills: [{ skill_id: 'sk-hu-02', self_level: 3, note: 'Led two pre-job briefs' }], peer_ids: ['p-sro'] })).code).toBe('not_peer');
    expect((await b.rpc.requestCheckin({ skills: [{ skill_id: 'sk-da-01', self_level: 2, note: 'Dashboard work' }], peer_ids: [] })).code).toBe('conflict');
    const r = await b.rpc.requestCheckin({ skills: [{ skill_id: 'sk-hu-02', self_level: 3, note: 'Led two pre-job briefs' }], peer_ids: ['w-ro-01'] });
    expect(r.ok).toBe(true);
    expect(b.raw('notifications').filter((n) => String(n.id).startsWith(`nt-${r.data!.id}`))).toHaveLength(2);
    await as('sro');
    expect((await b.rpc.withdrawCheckin(r.data!.id)).code).toBe('not_found');
    await as('k-ro');
    expect((await b.rpc.withdrawCheckin(r.data!.id, 'Asked too early')).ok).toBe(true);
    expect(b.rawGet('skill_checkins', r.data!.id)?.status).toBe('withdrawn');
  });
});

describe('F10 calibration', () => {
  it('the calibration view suppresses distributions for teams under 10', async () => {
    await as('sro');
    const c = await b.rpc.checkinCalibration(null);
    expect(c.group).toBe('team:ops-crew-b');
    expect(c.size).toBeLessThan(10);
    expect(c.suppressed).toBe(true);
    expect(c.distributions.length).toBeGreaterThan(0);
    expect(c.distributions.every((d) => d.dist === null && d.means === null)).toBe(true);
  });
  it('a group of 10+ shows distributions and flags raters systematically above or below the evidence', async () => {
    await as('ops-ceo');
    const c = await b.rpc.checkinCalibration('family:operations');
    expect(c.size).toBeGreaterThanOrEqual(10);
    expect(c.suppressed).toBe(false);
    expect(c.distributions.some((d) => Array.isArray(d.dist) && d.dist.reduce((a, x) => a + x, 0) === c.size)).toBe(true);
    expect(c.raters.some((r) => r.flag === 'high' || r.flag === 'low')).toBe(true);
    expect(c.raters.every((r) => r.n >= 1 && typeof r.offset === 'number')).toBe(true);
  });
  it('rater offsets are deterministic means against independent evidence', () => {
    const ev = new Map([['a|s1', 2], ['b|s1', 3], ['c|s1', 1]]);
    const rs = [
      { checkin_id: 'c1', subject_id: 'a', rater_person_id: 'r1', rater_kind: 'peer' as const, skill_id: 's1', level: 3, status: 'submitted' },
      { checkin_id: 'c2', subject_id: 'b', rater_person_id: 'r1', rater_kind: 'peer' as const, skill_id: 's1', level: 4, status: 'submitted' },
      { checkin_id: 'c3', subject_id: 'c', rater_person_id: 'r1', rater_kind: 'peer' as const, skill_id: 's1', level: 2, status: 'submitted' },
      { checkin_id: 'c3', subject_id: 'c', rater_person_id: 'r2', rater_kind: 'manager' as const, skill_id: 's1', level: 1, status: 'submitted' },
      { checkin_id: 'c3', subject_id: 'z', rater_person_id: 'r3', rater_kind: 'peer' as const, skill_id: 's1', level: 1, status: 'submitted' },
    ];
    expect(raterOffsets(rs, ev)).toEqual([
      { rater_id: 'r1', kind: 'peer', n: 3, offset: 1, flag: 'high' },
      { rater_id: 'r2', kind: 'manager', n: 1, offset: 0, flag: 'few' },
    ]);
    expect(distributions(['s1'], ['a', 'b'], new Map(), rs, true)[0]).toEqual({ skill_id: 's1', dist: null, means: null, ratings: 5 });
  });
  it('HR reads no individual check-ins or ratings and cannot open calibration', async () => {
    await as('k-hr-analyst');
    expect(await b.list('skill_ratings')).toHaveLength(0);
    expect(await b.list('skill_checkins')).toHaveLength(0);
    await expect(b.rpc.checkinCalibration(null)).rejects.toThrow();
  });
});

describe('F11 team capability heatmap (local)', () => {
  it('the heatmap shows only people in the manager\'s scope (a manager from another team sees none of crew B)', async () => {
    await as('sro');
    const own = await b.rpc.teamCoverage(null);
    expect(own.group).toBe('team:ops-crew-b');
    expect(own.mode).toBe('people');
    expect(own.members.map((m) => m.id)).toEqual(crewB);
    expect(new Set(own.cells.map((c) => c.p))).toEqual(new Set(own.members.map((m) => m.id).filter((id) => own.cells.some((c) => c.p === id))));
    await as('rp-lead');
    const other = await b.rpc.teamCoverage('team:ops-crew-b');
    expect(other.members).toHaveLength(0);
    expect(other.cells).toHaveLength(0);
    expect(other.groups.every((g) => g.key !== 'team:ops-crew-b')).toBe(true);
    expect((await b.list('person_skills')).some((s) => crewB.includes(s.person_id))).toBe(false);
  });
  it('a skill with exactly one qualified person at the target level shows a single-point-of-failure flag', async () => {
    await as('sro');
    const c = await b.rpc.teamCoverage('team:ops-crew-b');
    const row = c.coverage.find((x) => x.skill_id === 'sk-sc-02')!;
    expect(row).toMatchObject({ n: 1, spof: true, target_set: true });
    expect(row.holders).toHaveLength(1);
    expect(c.coverage.every((x) => x.spof === (x.n === 1))).toBe(true);
    // pure rule: one counted holder = SPOF; a claimed level does not count
    const sk = [{ id: 's', competency_id: 'c', area: 'x', key_level: 3, evidence_keys: [] }];
    const st = stateMapOf([{ person_id: 'a', skill_id: 's', level: 3, basis: 'verified' }, { person_id: 'b', skill_id: 's', level: 4, basis: 'claimed' }, { person_id: 'c', skill_id: 's', level: 2, basis: 'validated' }]);
    expect(coverage(sk, ['a', 'b', 'c'], st, [{ team_id: 't', skill_id: 's', min_people: 2, min_level: 3 }])[0]).toMatchObject({ n: 1, claimed_n: 1, status: 'thin', spof: true });
  });
  it('the crew view exposes no medical or licence fields (payload test)', async () => {
    await as('ops-ceo');
    const c = await b.rpc.teamCoverage('family:operations');
    expect(c.crews.map((x) => x.crew)).toEqual(['A', 'B', 'C', 'D', 'E']);
    const keys = new Set<string>();
    const walk = (v: unknown) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x); } };
    walk(c.crews);
    expect([...keys].sort()).toEqual(['available', 'available_n', 'crew', 'headcount', 'min_level', 'min_people', 'n', 'skill_id', 'skills', 'status', 'unknown']);
    expect(JSON.stringify(c.crews)).not.toMatch(/medical|licen|due_on|expir|cert|fit|SYN-|person|name/i);
    // the pure crew rule counts only (availability as a count)
    const profile = [{ team_id: 'crew:profile', skill_id: 's', min_people: 1, min_level: 2 }];
    const out = crews([{ id: 'a', crew: 'X' }, { id: 'b', crew: 'X' }], stateMapOf([{ person_id: 'a', skill_id: 's', level: 3, basis: 'verified' }]), profile, new Map([['a', true], ['b', null]]), []);
    expect(out).toEqual([{ crew: 'X', headcount: 2, available: 1, unknown: 1, skills: [{ skill_id: 's', min_people: 1, min_level: 2, n: 1, available_n: 1, status: 'covered' }] }]);
  });
  it('the what-if toggle is computed in the browser and persists nothing', async () => {
    await as('sro');
    const c = await b.rpc.teamCoverage('team:ops-crew-b');
    const snap = JSON.stringify([b.raw('team_skill_targets'), b.raw('person_skills'), b.raw('skill_checkins')]);
    const holder = c.coverage.find((x) => x.skill_id === 'sk-sc-02')!.holders![0];
    const skills = c.skills.map((id) => T.skills.find((s) => s.id === id)) as SkillRowLite[];
    const states = stateMapOf(c.cells.map((x) => ({ person_id: x.p, skill_id: x.s, level: x.l, basis: x.b })));
    const sim = coverage(skills, c.members.map((m) => m.id), states, c.targets, { holders: true, exclude: new Set([holder]) });
    expect(sim.find((x) => x.skill_id === 'sk-sc-02')).toMatchObject({ n: 0, status: 'uncovered', spof: false });
    expect(JSON.stringify([b.raw('team_skill_targets'), b.raw('person_skills'), b.raw('skill_checkins')])).toBe(snap);
    expect(b.raw('audit_events').filter((a) => String(a.action).startsWith('skills.target'))).toHaveLength(0);
  });
  it('HR sees aggregates only (no names, cells or holders; groups under 10 suppressed); employees are refused', async () => {
    await as('k-hr-analyst');
    const small = await b.rpc.teamCoverage('team:rp');
    expect(small).toMatchObject({ mode: 'aggregate', suppressed: true, members: [], cells: [], crews: [] });
    expect(small.coverage.every((x) => x.n === null && x.status === 'suppressed')).toBe(true);
    const big = await b.rpc.teamCoverage('family:operations');
    expect(big.suppressed).toBe(false);
    expect(big.coverage.some((x) => x.n != null)).toBe(true);
    expect(JSON.stringify(big)).not.toContain('holders');
    await as('k-ro');
    await expect(b.rpc.teamCoverage(null)).rejects.toThrow();
  });
  it('setTeamTarget: managers in scope and the training manager only; never security skills; audited', async () => {
    await as('rp-lead');
    expect((await b.rpc.setTeamTarget({ team_id: 'team:ops-crew-b', skill_id: 'sk-da-01', min_people: 3, min_level: 2 })).code).toBe('forbidden');
    await as('k-hr-analyst');
    expect((await b.rpc.setTeamTarget({ team_id: 'team:rp', skill_id: 'sk-da-01', min_people: 3, min_level: 2 })).code).toBe('forbidden');
    await as('sro');
    expect((await b.rpc.setTeamTarget({ team_id: 'team:ops-crew-b', skill_id: 'sk-sa-01', min_people: 3, min_level: 2 })).code).toBe('security_restricted');
    expect((await b.rpc.setTeamTarget({ team_id: 'team:ops-crew-b', skill_id: 'sk-da-01', min_people: 11, min_level: 2 })).code).toBe('invalid');
    const ok = await b.rpc.setTeamTarget({ team_id: 'team:ops-crew-b', skill_id: 'sk-da-01', min_people: 3, min_level: 2, note: 'Dashboard rollout' });
    expect(ok.ok).toBe(true);
    expect(last()).toMatchObject({ action: 'skills.target.set', outcome: 'ok' });
    expect((await b.rpc.teamCoverage('team:ops-crew-b')).coverage.find((x) => x.skill_id === 'sk-da-01')).toMatchObject({ min_people: 3, target_set: true });
    await as('training-mgr');
    expect((await b.rpc.setTeamTarget({ team_id: 'crew:profile', skill_id: 'sk-co-02', min_people: 2, min_level: 3 })).ok).toBe(true);
  });
  it('suggested actions carry readable reasons (F02 lint) and the CSV is watermarked with role and date', async () => {
    await as('sro');
    const c = await b.rpc.teamCoverage('team:ops-crew-b');
    const states = stateMapOf(c.cells.map((x) => ({ person_id: x.p, skill_id: x.s, level: x.l, basis: x.b })));
    const bi = (s: string) => ({ en: s, ar: s });
    const list = teamActions({ rows: c.coverage, members: c.members.map((m) => ({ ...m, kind: 'staff', status: 'active' })), states, skills: T.skills, courses: T.courses, secComps: securityComps(T.competencies), name: bi, skillName: bi, courseName: (x) => bi(x.code) });
    expect(list.length).toBeGreaterThan(2);
    expect(lintRanked(list)).toEqual([]);
    expect(list.flatMap((x) => x.reasons).every((r) => hasKey(r.key))).toBe(true);
    expect(new Set(list.map((x) => x.item!.kind))).toEqual(new Set(['course', 'opportunity', 'mentoring']));
    const csv = heatmapCsv({ watermark: 'Kafa\'a internal · exported by manager on 8 Oct 2026', skills: [{ id: 'sk-da-01', label: 'Digital' }], members: c.members.map((m) => ({ id: m.id, label: m.name_en })), states, basisLabel: (x) => x });
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('exported by manager on 8 Oct 2026');
    expect(lines[lines.length - 1]).toBe(lines[0]);
    expect(lines).toHaveLength(c.members.length + 3);
    expect(groupsOf(T.people.filter((p) => crewB.includes(p.id)))[0]).toMatchObject({ key: 'team:ops-crew-b', size: crewB.length });
  });
});
