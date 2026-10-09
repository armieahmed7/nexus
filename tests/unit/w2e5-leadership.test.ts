/** F16 Leadership journeys and F17 Communities of practice (W2 · E5, M22): every acceptance criterion on the local path, the
 *  rules shared with SQL, the seed and i18n. The SQL path is checked by scripts/validate/w2e5-leadership.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { lintRanked } from '../../src/domain/engines';
import { SearchIndex } from '../../src/domain/search';
import { hasKey } from '../../src/i18n';
import { MIN_GROUP_SIZE } from '../../src/auth/policy';
import { detectGuard } from '../../src/modules/m13/dalil/guard';
import {
  BEHAVIOURS, BEHAVIOUR_IDS, LEAD_SKILLS, MIN_360_RATERS, POST_FLOOR, computeLeadershipStats, cycleOf, hasContactDetails, leadershipReadiness, normPost, postGuard,
  rankExperts, rankProgrammes, requiredFor, sessionDoc, stepOf, summarise360, validScores, type ExpertRow,
} from '../../src/modules/m22/domain';
import { routes } from '../../src/modules/m22/routes';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const P = (id: string) => T.people.find((p) => p.id === id);
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const lastAudit = () => [...b.raw('audit_events')].sort((x, y) => x.seq - y.seq).pop()!;
const scores = (v = 4) => Object.fromEntries(BEHAVIOUR_IDS.map((x) => [x, v]));
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

describe('F16 programme facts (acceptance: every fact links to the CNS report with an as-of date)', () => {
  it('every programme cites the CNS national report with an https URL and an as-of date', () => {
    expect(T.leadership_programmes).toHaveLength(11);
    for (const g of T.leadership_programmes) {
      expect(g.sources.length, g.id).toBeGreaterThan(0);
      for (const s of g.sources) {
        expect(s.id).toBe('cns10');
        expect(s.url).toMatch(/^https:\/\/www\.iaea\.org\/.*cns-10th/);
        expect(s.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      expect(g.duration_en && g.duration_ar, g.id).toBeTruthy();
    }
  });
  it('carries the published 2024 completions (INTILAQA 285, ESTADAD 62, FAS 419, CLD 326, ONE 52, master classes 32, INPO 19)', () => {
    const c = Object.fromEntries(T.leadership_programmes.filter((g) => g.completions_year === 2024).map((g) => [g.code, g.completions]));
    expect(c).toMatchObject({ INTILAQA: 285, ESTADAD: 62, FAS: 419, CLD: 326, ONE: 52, MASTERCLASS: 32, INPO: 19 });
    expect(T.leadership_programmes.find((g) => g.code === 'INTILAQA').duration_days).toBe(4);
    expect(T.leadership_programmes.find((g) => g.code === 'ESTADAD').duration_days).toBe(8);
  });
});

describe('F16 shift supervisor track (acceptance: shift-supervisor-track people see INTILAQA/LET as required)', () => {
  it('k-ro (RO) and sro (shift supervisor) see INTILAQA and LET as required for their track; a QC inspector does not', () => {
    const int = T.leadership_programmes.find((g) => g.id === 'prog-intilaqa');
    const let_ = T.leadership_programmes.find((g) => g.id === 'prog-let');
    for (const pid of ['p-k-ro', 'p-sro', 'w-sro-01']) {
      expect(requiredFor(int, P(pid)), pid).toBe('track');
      expect(requiredFor(let_, P(pid)), pid).toBe('track');
    }
    expect(requiredFor(let_, P('p-qc-inspector'))).toBeNull();
    expect(requiredFor(int, P('p-qc-inspector'))).toBe('step'); // mandatory first-line programme for the step ahead
  });
  it('ranks the required programmes first with a "required on the shift supervisor track" reason (lint clean)', () => {
    const levels = new Map(T.person_skills.filter((s) => s.person_id === 'p-k-ro').map((s) => [s.skill_id, { level: s.level }]));
    const ranked = rankProgrammes(T.leadership_programmes, P('p-k-ro'), levels, T.leadership_nominations, new Set());
    expect(lintRanked(ranked)).toEqual([]);
    expect(ranked.slice(0, 2).map((r) => r.id).sort()).toEqual(['prog-intilaqa', 'prog-let']);
    expect(ranked[0].reasons[0].code).toBe('required_track');
    for (const r of ranked) for (const x of r.reasons) expect(hasKey(x.key), x.key).toBe(true);
  });
  it('places people on the ladder deterministically', () => {
    expect(stepOf(P('p-k-ro'))).toBe('ic');
    expect(stepOf(P('p-sro'))).toBe('first_line');
    expect(stepOf(P('p-chco'))).toBe('manager');
    expect(stepOf(P('p-group-ceo'))).toBe('executive');
  });
});

describe('F16 readiness and self check-in', () => {
  it('readiness covers the leadership competencies with reasons for every skill', () => {
    const levels = new Map(T.person_skills.filter((s) => s.person_id === 'p-sro').map((s) => [s.skill_id, { level: s.level, basis: s.basis }]));
    const r = leadershipReadiness(levels, 'manager');
    expect(r.rows).toHaveLength(LEAD_SKILLS.length);
    expect(r.score).toBeGreaterThan(0);
    expect(r.reasons).toHaveLength(LEAD_SKILLS.length + 1);
    for (const x of r.reasons) expect(hasKey(x.key), x.key).toBe(true);
  });
  it('a self check-in is a claimed rating through the F03 claimSkill RPC', async () => {
    await as('k-ro');
    const res = await b.rpc.claimSkill({ skill_id: 'sk-ld-01-coach', level: 2, note: 'Coached two new operators this month' });
    expect(res.ok).toBe(true);
    expect(b.raw('skill_evidence').some((e) => e.person_id === 'p-k-ro' && e.skill_id === 'sk-ld-01-coach' && e.kind === 'rating' && e.basis === 'claimed')).toBe(true);
  });
});

describe('F16 nominations (acceptance: a nominee cannot nominate themselves)', () => {
  it('self-nomination is refused with self_nominate and audited, for an employee and for a manager', async () => {
    await as('k-ro');
    const a = await b.rpc.nominateLeader('p-k-ro', 'prog-estadad', 'I would like to grow as a leader in the crew');
    expect(a.code).toBe('self_nominate');
    expect(lastAudit()).toMatchObject({ action: 'leadership.nominate', outcome: 'refused' });
    await as('sro');
    expect((await b.rpc.nominateLeader('p-sro', 'prog-cld', 'Ready for the next leadership step')).code).toBe('self_nominate');
  });
  it('managers nominate people they manage (scope), once per programme; others cannot', async () => {
    await as('qc-inspector');
    expect((await b.rpc.nominateLeader('w-qa-01', 'prog-intilaqa', 'Ready to lead the inspection team')).code).toBe('forbidden');
    await as('sro');
    expect((await b.rpc.nominateLeader('p-qc-inspector', 'prog-estadad', 'Strong questioning attitude')).code).toBe('not_in_scope');
    expect((await b.rpc.nominateLeader('p-k-ro', 'prog-let', 'Ready to lead a control-room team')).code).toBe('conflict');
    expect((await b.rpc.nominateLeader('w-ro-01', 'prog-mentoring', 'Would benefit from a mentor')).code).toBe('invalid');
    const ok = await b.rpc.nominateLeader('w-ro-01', 'prog-fas', 'Acts as peer checker for new operators; ready for FAS');
    expect(ok.ok).toBe(true);
    expect(b.rawGet('notifications', `nt-${ok.data!.id}-nominated`)?.person_id).toBe('w-ro-01');
  });
  it('maker-checker: HR or the training manager decides, never the nominator or the nominee; approval writes the ledger', async () => {
    await as('sro');
    const n = await b.rpc.nominateLeader('w-ro-01', 'prog-fas', 'Acts as peer checker for new operators; ready for FAS');
    expect((await b.rpc.decideNomination(n.data!.id, 'approved')).code).toBe('forbidden');
    b.rawInsert('leadership_nominations', { id: 'ln-t1', person_id: 'w-corp-01', programme_id: 'prog-estadad', nominated_by: 'p-chco', reason: 'Test nomination by HR', cycle: '2026-H2', status: 'nominated', history: [] } as never);
    b.rawInsert('leadership_nominations', { id: 'ln-t2', person_id: 'p-training-mgr', programme_id: 'prog-cld', nominated_by: 'p-ops-ceo', reason: 'Test nomination of the decider', cycle: '2026-H2', status: 'nominated', history: [] } as never);
    await as('chco');
    expect((await b.rpc.decideNomination('ln-t1', 'approved')).code).toBe('maker_checker');
    await as('training-mgr');
    expect((await b.rpc.decideNomination('ln-t2', 'approved')).code).toBe('maker_checker');
    expect((await b.rpc.decideNomination(n.data!.id, 'declined', '')).code).toBe('invalid');
    const led0 = b.raw('ledger_local').length;
    const ok = await b.rpc.decideNomination(n.data!.id, 'approved', 'Welcome to FAS');
    expect(ok.ok).toBe(true);
    expect(b.raw('ledger_local').length).toBe(led0 + 1);
    expect((await b.rpc.decideNomination(n.data!.id, 'declined', 'Changed my mind')).code).toBe('invalid');
  });
  it('nominations are readable by the nominee, the nominator, managers in scope, HR and the training manager only', async () => {
    await as('k-ro');
    expect((await b.list('leadership_nominations')).every((n) => n.person_id === 'p-k-ro')).toBe(true);
    await as('chco');
    expect(await b.list('leadership_nominations')).toHaveLength(T.leadership_nominations.length);
    await as('gulfhydro-qa');
    expect(await b.list('leadership_nominations')).toHaveLength(0);
  });
});

describe('F16 leadership 360 (acceptance: results only with at least 5 raters; otherwise "not enough responses")', () => {
  it('shows aggregates for sro (5+ responses) and nothing for k-ro (3 responses)', async () => {
    await as('sro');
    const s = await b.rpc.my360(null);
    expect(s.enough).toBe(true);
    expect(s.responded).toBeGreaterThanOrEqual(MIN_360_RATERS);
    expect(s.behaviours).toHaveLength(BEHAVIOUR_IDS.length);
    await as('k-ro');
    const k = await b.rpc.my360(null);
    expect(k.enough).toBe(false);
    expect(k.responded).toBeLessThan(MIN_360_RATERS);
    expect(k.behaviours).toBeNull();
  });
  it('the threshold is exactly five responses, self excluded (pure rule)', () => {
    const reqs = ['a', 'b', 'c', 'd', 'e', 's'].map((r) => ({ id: `q-${r}`, cycle: '2026-H2', subject_id: 's', rater_id: r, rater_kind: r === 's' ? 'self' : 'peer', status: 'submitted' }));
    const names = new Map();
    const mk = (n: number, self = true) => [...reqs.slice(0, n).map((q) => ({ cycle: q.cycle, subject_id: 's', rater_kind: 'peer', scores: scores(3) })), ...(self ? [{ cycle: '2026-H2', subject_id: 's', rater_kind: 'self', scores: scores(5) }] : [])];
    expect(summarise360('s', null, reqs, mk(4), names).behaviours).toBeNull();
    const five = summarise360('s', null, reqs, mk(5), names);
    expect(five.enough).toBe(true);
    expect(five.behaviours![0]).toMatchObject({ others: 3, self: 5, low: 3, high: 3 });
  });
  it('raw responses are unreadable, carry no rater id, and the rating is submitted once by the invited rater', async () => {
    await as('sro');
    expect(await b.list('leadership_360')).toHaveLength(0);
    expect((await b.rpc.submit360('l3q-2026-H2-p-k-ro-p-sro', { 'b-safety-values': 6 })).code).toBe('invalid');
    expect((await b.rpc.submit360('l3q-2026-H2-p-k-ro-p-sro', scores())).ok).toBe(true);
    expect((await b.rpc.submit360('l3q-2026-H2-p-k-ro-p-sro', scores())).code).toBe('conflict');
    const row = b.raw('leadership_360').find((x) => x.subject_id === 'p-k-ro' && x.rater_kind === 'manager')!;
    expect(JSON.stringify(row)).not.toContain('p-sro');
    await as('k-ro');
    expect((await b.rpc.submit360('l3q-2026-H2-w-sro-01-p-training-mgr', scores())).code).toBe('not_found');
    expect((await b.rpc.my360(null)).responded).toBe(4);
  });
  it('requests need 5 to 12 colleagues, never yourself; validScores rejects incomplete sheets', async () => {
    await as('head-sq');
    const four = ['w-ro-01', 'w-ro-02', 'w-ro-03', 'w-ro-04'].map((id) => ({ person_id: id, kind: 'peer' as const }));
    expect((await b.rpc.request360(four)).code).toBe('too_few');
    expect((await b.rpc.request360([...four, { person_id: 'p-head-sq', kind: 'peer' }])).code).toBe('invalid');
    const ok = await b.rpc.request360([...four, { person_id: 'p-sq-lead', kind: 'report' }]);
    expect(ok.ok && ok.data!.invited).toBe(5);
    expect(b.raw('leadership_360_requests').filter((q) => q.subject_id === 'p-head-sq' && q.rater_kind === 'self')).toHaveLength(1);
    expect(validScores({ 'b-safety-values': 3 })).toBeNull();
    expect(validScores(scores(5))).toEqual(scores(5));
  });
  it('HR aggregates suppress grades with fewer than 10 subjects and are null for employees', async () => {
    const st = computeLeadershipStats(T.leadership_360, T.people, T.leadership_nominations, MIN_GROUP_SIZE);
    expect(st.cycle).toBe('2026-H1');
    expect(st.by_level.every((l) => (l.suppressed ? l.subjects === null && l.scores === null : l.subjects! >= MIN_GROUP_SIZE))).toBe(true);
    expect(st.by_level.some((l) => !l.suppressed)).toBe(true);
    await as('k-ro');
    expect(await b.rpc.leadershipStats()).toBeNull();
    await as('chco');
    expect(await b.rpc.leadershipStats()).not.toBeNull();
  });
  it('every behaviour is linked to a seeded INPO safety-culture trait', () => {
    for (const x of BEHAVIOURS) expect(T.sc_traits.some((t) => t.id === x.trait), x.trait).toBe(true);
    expect(cycleOf('2026-10-09')).toBe('2026-H2');
  });
});

describe('F17 expert finder (acceptance: people who did not opt in never appear)', () => {
  it('returns only visible opt-ins with level >= 3 on listed skills, never the caller', async () => {
    await as('qc-inspector');
    const all = await b.rpc.findExperts(null);
    const vis = new Set(T.expert_optin.filter((o) => o.visible).map((o) => o.person_id));
    expect(all.length).toBeGreaterThan(10);
    expect(all.every((e) => vis.has(e.person_id) && e.person_id !== 'p-qc-inspector' && e.skills.every((s) => s.level >= 3))).toBe(true);
    expect(all.some((e) => e.person_id === 'w-eng-04' || e.person_id === 'w-lo-01' || e.person_id === 'p-k-ro')).toBe(false);
    expect(lintRanked(rankExperts(all as ExpertRow[], null))).toEqual([]);
  });
  it('opting in needs level 3 and never a security skill; hiding removes the person at once', async () => {
    await as('k-ro');
    expect((await b.rpc.setExpertOptin(['sk-sa-01'], true)).code).toBe('security_restricted');
    expect((await b.rpc.setExpertOptin(['sk-ch-02'], true)).code).toBe('level_too_low');
    expect((await b.rpc.setExpertOptin(['sk-co-02'], true, 'Shift turnover practice')).ok).toBe(true);
    await as('qc-inspector');
    expect((await b.rpc.findExperts('sk-co-02')).some((e) => e.person_id === 'p-k-ro')).toBe(true);
    await as('k-ro');
    await b.rpc.setExpertOptin(['sk-co-02'], false);
    await as('qc-inspector');
    expect((await b.rpc.findExperts('sk-co-02')).some((e) => e.person_id === 'p-k-ro')).toBe(false);
    expect((await b.list('expert_optin')).some((o) => !o.visible)).toBe(false);
  });
  it('expert requests stay in-app: never to yourself or a hidden expert, no phone numbers; only the expert answers', async () => {
    await as('qc-inspector');
    const r = await b.rpc.requestExpert('p-sro', 'sk-co-02', 'Could you explain how you structure the turnover brief?');
    expect(r.ok).toBe(true);
    expect((await b.rpc.requestExpert('w-eng-04', 'sk-en-02', 'Could you help with design reviews please?')).code).toBe('not_found');
    expect((await b.rpc.requestExpert('p-sro', 'sk-co-03', 'Please call me on 050 123 4567 tomorrow')).code).toBe('contact_details');
    expect((await b.rpc.answerExpertRequest(r.data!.id, 'accepted')).code).toBe('forbidden');
    await as('sro');
    expect((await b.rpc.requestExpert('p-sro', 'sk-co-02', 'Asking myself a question here')).code).toBe('conflict');
    expect((await b.rpc.answerExpertRequest(r.data!.id, 'accepted', 'Yes, after the Tuesday crew brief.')).ok).toBe(true);
  });
});

describe('F17 posting rules (acceptance: security posts refused with guidance; audit stores the category, not the text)', () => {
  it('refuses security, safeguards and cyber content in English and Arabic and audits only the category', async () => {
    await as('k-ro');
    const sec = await b.rpc.postThread({ community_id: 'cop-ops', title: 'Plant question', body: 'Where are the CCTV cameras near the perimeter fence?' });
    expect(sec.code).toBe('restricted_content');
    expect(sec.message).toMatch(/security content is not allowed.*careers, learning/);
    const a = lastAudit();
    expect(a.outcome).toBe('refused');
    expect(a.reason).toMatch(/security/);
    expect(a.reason).not.toMatch(/cctv|camera|perimeter|fence/i);
    expect((await b.rpc.postThread({ community_id: 'cop-ops', title: 'سؤال عن المحطة', body: 'ما هي الترتيبات الأمنية في المحطة بالتفصيل؟' })).code).toBe('restricted_content');
    expect((await b.rpc.postThread({ community_id: 'cop-ops', title: 'Fuel question', body: 'Does anyone know the nuclear material inventory figures?' })).message).toMatch(/safeguards/);
    expect((await b.rpc.postThread({ community_id: 'cop-ops', title: 'Access question', body: 'What is the password for the training network?' })).message).toMatch(/cyber/);
  });
  it('reuses the G5 Dalil refusal floor: every floor pattern the guard refuses for security, safeguards or cyber is blocked in posts', () => {
    for (const pats of Object.values(POST_FLOOR)) {
      for (const p of pats) {
        const text = `Question about ${p} please`;
        expect(postGuard(text)).not.toBeNull();
        const g = detectGuard(text, []);
        expect(g, p).not.toBeNull();
      }
    }
    expect(postGuard('Tips for shift turnover notes')).toBeNull();
    expect(normPost('الإجراءات الأمنيّة')).toBe(normPost('الاجراءات الامنية'));
  });
  it('members only; first posts wait for a steward who publishes them (never their own)', async () => {
    await as('qc-inspector');
    expect((await b.rpc.postThread({ community_id: 'cop-ops', title: 'A question for operations', body: 'How do you plan a long surveillance?' })).code).toBe('not_member');
    await as('outage-planner');
    await b.rpc.joinCommunity('cop-maint', true);
    const first = await b.rpc.postThread({ community_id: 'cop-maint', title: 'Outage scope for digital I&C work', body: 'How do you estimate troubleshooting time for digital I&C work?' });
    expect(first.data?.status).toBe('held');
    await as('k-ro');
    expect(await b.rpc.moderationQueue()).toHaveLength(0);
    expect((await b.rpc.moderatePost(first.data!.post_id, 'publish')).code).toBe('forbidden');
    await as('work-control');
    expect((await b.rpc.moderationQueue()).some((x) => x.post_id === first.data!.post_id)).toBe(true);
    expect((await b.rpc.moderatePost(first.data!.post_id, 'publish')).ok).toBe(true);
    await as('sro');
    expect((await b.rpc.moderatePost('po-001-2', 'hide', 'Testing own post')).code).toBe('maker_checker');
    expect((await b.rpc.moderatePost('po-001-3', 'hide', '')).code).toBe('invalid');
    expect((await b.rpc.joinCommunity('cop-ops', false)).code).toBe('conflict');
  });
});

describe('F17 session search (acceptance: search returns sessions by keyword in EN and AR)', () => {
  const idx = new SearchIndex(T.ks_sessions.map(sessionDoc));
  it.each([
    ['outage', 'ks-02'], ['radiation', 'ks-06'], ['main control room', 'ks-05'],
    ['الذكاء الاصطناعي', 'ks-04'], ['فترة الإيقاف', 'ks-02'], ['الوقاية من الإشعاع', 'ks-06'], ['تحليل البيانات', 'ks-07'],
  ])('"%s" finds %s', (q, id) => {
    expect(idx.search(q, 5).map((h) => h.doc.id)).toContain(id);
  });
});

describe('F17 privacy (acceptance: no email or phone in any payload)', () => {
  it('no M22 seed row and no M22 RPC payload carries an email address or phone number', async () => {
    for (const t of ['leadership_programmes', 'leadership_nominations', 'leadership_360_requests', 'communities', 'community_members', 'threads', 'posts', 'expert_optin', 'expert_requests', 'ks_sessions']) {
      for (const r of T[t]) {
        const s = JSON.stringify(r);
        expect(EMAIL.test(s), `${t} ${r.id}`).toBe(false);
        expect(hasContactDetails(Object.values(r).filter((v) => typeof v === 'string').join(' ')), `${t} ${r.id}`).toBe(false);
      }
    }
    await as('qc-inspector');
    expect(EMAIL.test(JSON.stringify(await b.rpc.findExperts(null)))).toBe(false);
    await as('sro');
    expect(EMAIL.test(JSON.stringify(await b.rpc.my360(null)))).toBe(false);
    await as('k-ro');
    expect((await b.rpc.postThread({ community_id: 'cop-ops', title: 'Contact me', body: 'Message me at someone@example.com for notes' })).code).toBe('contact_details');
  });
});

describe('M22 routes and i18n', () => {
  it('every route has an English and Arabic title and purpose', () => {
    expect(routes.length).toBe(10);
    for (const r of routes) {
      expect(hasKey(`m22.routes.${r.id}.title`), r.id).toBe(true);
      expect(hasKey(`m22.routes.${r.id}.purpose`), r.id).toBe(true);
    }
  });
});
