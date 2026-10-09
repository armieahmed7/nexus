/** F13 Mentoring 2.0 (W2 · E3): every acceptance criterion on the local path, the matching engine, the seed and i18n.
 *  The SQL path is checked by scripts/validate/w2e3-mentoring-refreshers.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { lintRanked } from '../../src/domain/engines';
import { competencyLevels } from '../../src/domain/engines/skills';
import { hasKey, translate } from '../../src/i18n';
import { rankMentors } from '../../src/modules/m04/match';
import {
  MENTORING_TYPES, MIN_GROUP, MSG, STARTED, addDaysIso, agreementProgress, attainmentPct, cleanGoals, cleanRatings, freePlaces, ktValidation, lineManagerOf, programmeStats, reportingChain, termsError,
  type AgreementLite, type MentorRowLite,
} from '../../src/modules/m04/mentoring';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const today = new Date().toISOString().slice(0, 10);
const lm = (p: string) => lineManagerOf(p, T.people, T.role_assignments, today);
const skillMap = new Map(T.skills.map((s) => [s.id, s]));
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const audits = (action: string, outcome?: string) => b.raw('audit_events').filter((a) => a.action === action && (!outcome || a.outcome === outcome));
const pid = (persona: string) => T.people.find((p) => p.persona_id === persona)!.id;
const matchFor = (persona: string, type: '' | (typeof MENTORING_TYPES)[number] = '') => {
  const me = pid(persona);
  const person = T.people.find((p) => p.id === me)!;
  const states = T.person_skills.filter((s) => s.person_id === me && s.active !== false);
  return rankMentors({
    me, roleId: person.job_role_id, targets: T.career_targets.filter((c) => c.person_id === me && c.active !== false).map((c) => c.role_id), have: competencyLevels(states as never, T.skills as never),
    roleComps: T.role_competencies as never, competencies: T.competencies as never, roles: T.job_roles as never, skills: T.skills as never, mentors: T.mentors as never, requests: T.mentoring_requests as never,
    openWithMentorIds: T.mentoring_agreements.filter((a) => a.person_id === me && ['proposed', 'active', 'closing'].includes(a.status)).map((a) => a.mentor_id),
    lineManager: lm(me), chain: reportingChain(me, T.people, T.role_assignments, today), type,
  });
};

describe('F13 seed', () => {
  it('mentor offers carry types and non-security skills; SMEs are nominated by their own line manager', () => {
    expect(T.mentors.length).toBeGreaterThanOrEqual(20);
    for (const m of T.mentors) {
      expect(m.types.length).toBeGreaterThan(0);
      expect(m.types.every((x: string) => (MENTORING_TYPES as readonly string[]).includes(x))).toBe(true);
      expect(m.skill_ids.every((s: string) => skillMap.has(s) && skillMap.get(s)!.area !== 'security')).toBe(true);
      if (m.sme) expect(m.sme_nominated_by).toBe(lm(m.person_id));
    }
    expect(T.mentors.filter((m) => m.sme).length).toBeGreaterThanOrEqual(5);
    expect(T.mentors.filter((m) => m.khnp_paired).length).toBeGreaterThanOrEqual(3);
  });
  it('nobody is paired with their own line manager, and open pairings never exceed capacity', () => {
    for (const a of T.mentoring_agreements) expect(lm(a.person_id)).not.toBe(a.mentor_person_id);
    for (const r of T.mentoring_requests.filter((x) => x.status === 'matched')) expect(lm(r.person_id)).not.toBe(r.mentor_person_id);
    for (const m of T.mentors) expect(T.mentoring_requests.filter((r) => r.mentor_id === m.id && r.status === 'matched').length).toBeLessThanOrEqual(m.capacity);
  });
  it('covers every agreement state and type; sessions, private notes and close-outs are consistent', () => {
    expect(new Set(T.mentoring_agreements.map((a) => a.status))).toEqual(new Set(['proposed', 'active', 'closing', 'closed', 'declined']));
    expect(new Set(T.mentoring_agreements.map((a) => a.mentoring_type))).toEqual(new Set(MENTORING_TYPES));
    const ag = new Map(T.mentoring_agreements.map((a) => [a.id, a]));
    for (const s of T.mentoring_sessions) {
      const a = ag.get(s.agreement_id)!;
      expect(['active', 'closing', 'closed']).toContain(a.status);
      expect(s.held_on >= a.starts_on).toBe(true);
      expect(s.skill_ids.every((k: string) => a.goals.some((g: { skill_id: string }) => g.skill_id === k))).toBe(true);
    }
    for (const n of T.mentoring_private_notes) {
      const a = ag.get(n.agreement_id)!;
      expect([a.person_id, a.mentor_person_id]).toContain(n.author_person_id);
      expect(T.mentoring_sessions.some((s) => s.id === n.session_id && s.agreement_id === n.agreement_id)).toBe(true);
    }
    for (const a of T.mentoring_agreements.filter((x) => x.status === 'closed')) expect(a.attainment_pct).toBe(attainmentPct(a.mentee_ratings, a.mentor_ratings));
  });
  it('the programme dashboard has cells at or above 10 pairs and suppressed ones', () => {
    const p = programmeStats(T.mentoring_agreements as never, T.mentoring_sessions as never, T.mentors as never, T.mentoring_requests as never, today);
    expect(p.by_type.filter((c) => !c.suppressed).length).toBeGreaterThanOrEqual(3);
    expect(p.by_type.some((c) => c.suppressed)).toBe(true);
    for (const c of p.by_type) {
      const n = T.mentoring_agreements.filter((a) => a.mentoring_type === c.key && (STARTED as string[]).includes(a.status)).length;
      if (n < MIN_GROUP) expect([c.suppressed, c.pairs, c.attainment_pct, c.sessions]).toEqual([true, null, null, null]);
      else expect(c.pairs).toBe(n);
    }
  });
});

describe('F13 pure rules', () => {
  it('goals: one to five distinct catalogue skills, never security, level 1..4, text up to 200', () => {
    expect(cleanGoals([{ skill_id: 'sk-co-03', target_level: 3, text: ' x ' }], skillMap as never)).toEqual([{ skill_id: 'sk-co-03', target_level: 3, text: 'x' }]);
    expect(cleanGoals([], skillMap as never)).toBeNull();
    expect(cleanGoals([{ skill_id: 'sk-sa-01', target_level: 2 }], skillMap as never)).toBeNull();
    expect(cleanGoals([{ skill_id: 'sk-co-03', target_level: 5 }], skillMap as never)).toBeNull();
    expect(cleanGoals([{ skill_id: 'sk-co-03', target_level: 2 }, { skill_id: 'sk-co-03', target_level: 3 }], skillMap as never)).toBeNull();
    expect(cleanGoals(Array.from({ length: 6 }, (_, i) => ({ skill_id: T.skills[i].id, target_level: 2 })), skillMap as never)).toBeNull();
    expect(cleanGoals([{ skill_id: 'sk-co-03', target_level: 2, text: 'x'.repeat(201) }], skillMap as never)).toBeNull();
  });
  it('terms: cadence, start window and 4-week to 12-month duration', () => {
    expect(termsError('weekly', today, addDaysIso(today, 28), today)).toBeNull();
    expect(termsError('daily', today, addDaysIso(today, 60), today)).toBe('invalid_cadence');
    expect(termsError('weekly', today, addDaysIso(today, 27), today)).toBe('invalid_dates');
    expect(termsError('weekly', today, addDaysIso(today, 367), today)).toBe('invalid_dates');
    expect(termsError('weekly', addDaysIso(today, -31), addDaysIso(today, 60), today)).toBe('invalid_dates');
    expect(termsError('monthly', addDaysIso(today, 61), addDaysIso(today, 120), today)).toBe('invalid_dates');
  });
  it('ratings cover every goal once; attainment pools both sides', () => {
    const goals = [{ skill_id: 'a', target_level: 3, text: '' }, { skill_id: 'b', target_level: 2, text: '' }];
    expect(cleanRatings([{ skill_id: 'b', rating: 2 }, { skill_id: 'a', rating: 4 }], goals)).toEqual([{ skill_id: 'a', rating: 4 }, { skill_id: 'b', rating: 2 }]);
    expect(cleanRatings([{ skill_id: 'a', rating: 4 }], goals)).toBeNull();
    expect(cleanRatings([{ skill_id: 'a', rating: 5 }, { skill_id: 'b', rating: 2 }], goals)).toBeNull();
    expect(attainmentPct([{ skill_id: 'a', rating: 4 }, { skill_id: 'b', rating: 2 }], [{ skill_id: 'a', rating: 3 }, { skill_id: 'b', rating: 3 }])).toBe(75);
    expect(attainmentPct(null, undefined)).toBeNull();
  });
  it('progress follows the cadence', () => {
    const a = { cadence: 'fortnightly', starts_on: addDaysIso(today, -28), ends_on: addDaysIso(today, 56) };
    const p = agreementProgress(a, 2, today);
    expect(p.total).toBe(6);
    expect(p.due).toBe(3);
    expect(p.state).toBe('on_track');
    expect(agreementProgress(a, 1, today).state).toBe('behind');
    expect(agreementProgress(a, 4, today).state).toBe('ahead');
  });
  it('knowledge-transfer validation: SME scope, met or better, an open claim, never qualification-only skills', () => {
    const mentor: MentorRowLite = { id: 'm', person_id: 'x', capacity: 2, opt_in: true, sme: true, skill_ids: ['sk-co-03', 'sk-pf-02', 'sk-co-03-startup'], sme_skill_ids: ['sk-co-03', 'sk-co-03-startup'] };
    const goals = ['sk-co-03', 'sk-pf-02', 'sk-co-03-startup', 'sk-ld-02'].map((s) => ({ skill_id: s, target_level: 3, text: '' }));
    const claims = [{ id: 'c1', person_id: 'p', skill_id: 'sk-co-03', status: 'claimed', level: 2 }, { id: 'c2', person_id: 'p', skill_id: 'sk-co-03-startup', status: 'claimed', level: 2 }];
    const r = ktValidation({ goals, mentorRatings: goals.map((g) => ({ skill_id: g.skill_id, rating: g.skill_id === 'sk-ld-02' ? 2 : 3 })), mentor, menteeId: 'p', claims, skills: skillMap as never, standardIds: new Set(T.qual_standards.map((s) => s.id)) });
    expect(r.validated).toEqual([{ skill_id: 'sk-co-03', claim_id: 'c1' }]);
    expect(Object.fromEntries(r.skipped.map((x) => [x.skill_id, x.code]))).toEqual({ 'sk-co-03-startup': 'qual_only', 'sk-ld-02': 'not_met', 'sk-pf-02': 'not_sme_skill' });
  });
});

describe('F13 matching (F02 kernel, reasons for "Why this?")', () => {
  it('a mentee is never matched to their own line manager (acceptance)', () => {
    for (const persona of ['outage-planner', 'k-ro', 'qc-inspector', 'k-lo-trainee', 'buyer', 'nse']) {
      const me = pid(persona);
      const r = matchFor(persona);
      const boss = lm(me);
      expect([...r.ranked, ...r.full].some((x) => x.item!.mentor.person_id === boss)).toBe(false);
      if (T.mentors.some((m) => m.person_id === boss && m.opt_in)) expect(r.excluded.some((x) => x.code === 'own_manager' && x.mentor.person_id === boss)).toBe(true);
    }
    expect(matchFor('outage-planner').excluded.find((x) => x.code === 'own_manager')?.mentor.id).toBe('mt-12');
    expect(matchFor('k-ro').excluded.find((x) => x.code === 'own_manager')?.mentor.id).toBe('mt-6');
  });
  it('every suggestion carries reasons with i18n keys in English and Arabic; full mentors are listed apart', () => {
    for (const persona of ['k-ro', 'qc-inspector', 'outage-planner', 'nse', 'sro', 'buyer']) {
      for (const type of ['', 'knowledge_transfer', 'reverse'] as const) {
        const r = matchFor(persona, type);
        expect(lintRanked(r.ranked)).toEqual([]);
        expect(lintRanked(r.full)).toEqual([]);
        expect(r.ranked.every((x) => x.item!.free > 0)).toBe(true);
        expect(r.full.every((x) => x.item!.free === 0)).toBe(true);
        for (const x of [...r.ranked, ...r.full]) for (const re of x.reasons) {
          expect(hasKey(re.key)).toBe(true);
          expect(translate('ar', re.key)).not.toBe(re.key);
        }
      }
    }
  });
  it('skills that close my gaps rank first: k-ro (RO, gaps toward SRO) is pointed to reactivity and plant-physics mentors', () => {
    const r = matchFor('k-ro');
    expect(r.ranked[0].reasons.some((x) => ['gap', 'gap_role'].includes(x.code))).toBe(true);
    // k-ro is already in a knowledge-transfer agreement with mt-16 and their line manager (mt-6) is excluded; the SRO-level
    // instructor (mt-1: reactivity management and thermodynamics, SME) closes the most SRO gaps among the rest
    expect(r.ranked.slice(0, 3).map((x) => x.item!.mentor.id)).toContain('mt-1');
    expect(r.excluded.map((x) => `${x.mentor.id}:${x.code}`)).toEqual(expect.arrayContaining(['mt-6:own_manager', 'mt-16:already_open']));
    const kt = matchFor('k-ro', 'knowledge_transfer');
    expect(kt.ranked.findIndex((x) => x.item!.mentor.sme)).toBeLessThan(3);
    expect(kt.ranked.find((x) => x.item!.mentor.sme)!.reasons.some((x) => x.code === 'sme')).toBe(true);
  });
});

describe('F13 local RPCs', () => {
  it('requestMentoring: own line manager refused (audited), other refusals, success, duplicate', async () => {
    await as('outage-planner');
    const own = await b.rpc.requestMentoring({ mentor_id: 'mt-12', mentoring_type: 'career' });
    expect([own.ok, own.code, own.message]).toEqual([false, 'own_manager', MSG.own_manager]);
    expect(audits('mentoring.request', 'refused').length).toBe(1);
    expect((await b.rpc.requestMentoring({ mentor_id: 'mt-13', mentoring_type: 'gossip' as never })).code).toBe('invalid_type');
    expect((await b.rpc.requestMentoring({ mentor_id: 'mt-13', mentoring_type: 'career', skill_ids: ['sk-sa-01'] })).code).toBe('invalid_skills');
    expect((await b.rpc.requestMentoring({ mentor_id: 'mt-13', mentoring_type: 'career', message: 'x'.repeat(501) })).code).toBe('invalid_message');
    const ok = await b.rpc.requestMentoring({ mentor_id: 'mt-13', mentoring_type: 'reverse', skill_ids: ['sk-da-02-review'], message: 'AI review basics' });
    expect(ok.ok).toBe(true);
    expect(b.rawGet('mentoring_requests', ok.data!.id)).toMatchObject({ status: 'requested', mentoring_type: 'reverse', skill_ids: ['sk-da-02-review'], mentor_person_id: 'p-sme-reviewer' });
    expect(b.raw('notifications').some((n) => n.person_id === 'p-sme-reviewer' && n.kind === 'mentoring')).toBe(true);
    expect((await b.rpc.requestMentoring({ mentor_id: 'mt-13', mentoring_type: 'career' })).code).toBe('already_open');
    await as('sro');
    expect((await b.rpc.requestMentoring({ mentor_id: 'mt-6', mentoring_type: 'career' })).code).toBe('self');
    await as(null);
    expect((await b.rpc.requestMentoring({ mentor_id: 'mt-6', mentoring_type: 'career' })).code).toBe('not_signed_in');
  });
  it('respondMentoring and proposeAgreement refuse a line manager mentoring their own team member', async () => {
    await as('k-ro');
    const ins = await b.insert('mentoring_requests', { person_id: 'p-k-ro', mentor_id: 'mt-6', mentor_person_id: 'p-sro', interest: 'career', status: 'requested' } as never);
    expect(ins.ok).toBe(true);
    await as('sro');
    const acc = await b.rpc.respondMentoring(ins.data!.id, 'matched');
    expect(acc.code).toBe('own_manager');
    expect(b.rawGet('mentoring_requests', ins.data!.id)!.status).toBe('requested');
    b.rawUpdate('mentoring_requests', ins.data!.id, { status: 'matched' } as never); // a legacy match
    const prop = await b.rpc.proposeAgreement(ins.data!.id, { goals: [{ skill_id: 'sk-co-03', target_level: 3, text: '' }], cadence: 'weekly', starts_on: today, ends_on: addDaysIso(today, 60) });
    expect([prop.code, prop.message]).toEqual(['own_manager', MSG.own_manager_pair]);
  });
  it('full flow: match → propose → accept (ledger) → sessions with a private note → close-outs → closed', async () => {
    await as('k-ro');
    const req = await b.rpc.requestMentoring({ mentor_id: 'mt-13', mentoring_type: 'knowledge_transfer', skill_ids: ['sk-en-01'] });
    expect((await b.rpc.proposeAgreement(req.data!.id, { goals: [{ skill_id: 'sk-en-01', target_level: 3, text: '' }], cadence: 'weekly', starts_on: today, ends_on: addDaysIso(today, 60) })).code).toBe('not_matched');
    await as('sme-reviewer');
    expect((await b.rpc.respondMentoring(req.data!.id, 'matched')).ok).toBe(true);
    await as('k-ro');
    const terms = { goals: [{ skill_id: 'sk-en-01', target_level: 3, text: 'Screen a design change' }, { skill_id: 'sk-ns-01-psa', target_level: 2, text: '' }], cadence: 'fortnightly' as const, starts_on: today, ends_on: addDaysIso(today, 120) };
    expect((await b.rpc.proposeAgreement(req.data!.id, { ...terms, goals: [{ skill_id: 'sk-sa-01', target_level: 2, text: '' }] })).code).toBe('invalid_goals');
    expect((await b.rpc.proposeAgreement(req.data!.id, { ...terms, ends_on: addDaysIso(today, 7) })).code).toBe('invalid_dates');
    const prop = await b.rpc.proposeAgreement(req.data!.id, terms);
    expect(prop.ok).toBe(true);
    const aid = prop.data!.id;
    expect((await b.rpc.respondAgreement(aid, 'accept')).code).toBe('own_proposal');
    expect((await b.rpc.logSession(aid, { held_on: today, minutes: 60, skill_ids: ['sk-en-01'] })).code).toBe('not_active');
    await as('sme-reviewer');
    const led = b.raw('ledger_local').length;
    expect((await b.rpc.respondAgreement(aid, 'accept')).ok).toBe(true);
    expect(b.raw('ledger_local').length).toBe(led + 1);
    await as('k-ro');
    expect((await b.rpc.logSession(aid, { held_on: addDaysIso(today, 2), minutes: 60, skill_ids: ['sk-en-01'] })).code).toBe('invalid_session');
    expect((await b.rpc.logSession(aid, { held_on: today, minutes: 10, skill_ids: ['sk-en-01'] })).code).toBe('invalid_session');
    expect((await b.rpc.logSession(aid, { held_on: today, minutes: 60, skill_ids: ['sk-co-01'] })).code).toBe('invalid_session');
    const s1 = await b.rpc.logSession(aid, { held_on: today, minutes: 60, skill_ids: ['sk-en-01'], topics: 'Screening', note_shared: 'Bring an example', note_private: 'I find screening criteria confusing' });
    expect(s1.ok).toBe(true);
    expect(audits('mentoring.session', 'ok').at(-1)!.reason).not.toContain('confusing');
    // the private note: the author reads it; the counterpart, managers and admins cannot (acceptance)
    expect((await b.list('mentoring_private_notes', { filter: { agreement_id: aid } } as never)).length).toBe(1);
    for (const p of ['sme-reviewer', 'sro', 'ops-ceo', 'k-admin', 'training-mgr', 'k-auditor', 'chco']) {
      await as(p);
      expect((await b.list('mentoring_private_notes', { filter: { agreement_id: aid } } as never)).length).toBe(0);
    }
    await as('sme-reviewer');
    expect((await b.list('mentoring_sessions', { filter: { agreement_id: aid } } as never)).length).toBe(1);
    expect((await b.rpc.closeAgreement(aid, { ratings: [{ skill_id: 'sk-en-01', rating: 3 }] })).code).toBe('invalid_ratings');
    const c1 = await b.rpc.closeAgreement(aid, { ratings: [{ skill_id: 'sk-en-01', rating: 4 }, { skill_id: 'sk-ns-01-psa', rating: 2 }], note: 'Good progress' });
    expect(c1.data!.status).toBe('closing');
    expect((await b.rpc.closeAgreement(aid, { ratings: [{ skill_id: 'sk-en-01', rating: 4 }, { skill_id: 'sk-ns-01-psa', rating: 2 }] })).code).toBe('already_closed');
    await as('k-ro');
    expect((await b.rpc.closeAgreement(aid, { ratings: [{ skill_id: 'sk-en-01', rating: 3 }, { skill_id: 'sk-ns-01-psa', rating: 3 }], validate: true })).code).toBe('validate_kt_only');
    const c2 = await b.rpc.closeAgreement(aid, { ratings: [{ skill_id: 'sk-en-01', rating: 3 }, { skill_id: 'sk-ns-01-psa', rating: 3 }] });
    expect(c2.data).toMatchObject({ status: 'closed', attainment_pct: 75 });
    expect(b.rawGet('mentoring_requests', req.data!.id)!.status).toBe('closed');
    expect(audits('mentoring.close', 'ok').at(-1)!.ledger_status).not.toBe('not_applicable');
  });
  it('a knowledge-transfer close-out by a non-SME mentor cannot validate skills (acceptance); an SME one validates the open claim', async () => {
    const sroAg = T.mentoring_agreements.find((a) => a.mentor_person_id === 'p-sro' && a.status === 'proposed')!;
    await as('sro');
    expect((await b.rpc.respondAgreement(sroAg.id, 'accept')).ok).toBe(true);
    const ratings = sroAg.goals.map((g: { skill_id: string }) => ({ skill_id: g.skill_id, rating: 4 }));
    const no = await b.rpc.closeAgreement(sroAg.id, { ratings, validate: true });
    expect([no.code, no.message]).toEqual(['not_sme', MSG.not_sme]);
    expect(b.rawGet('mentoring_agreements', sroAg.id)!.mentor_closed_at).toBeNull();
    // qc-inspector's knowledge transfer with the SME supply-quality lead: the open claim on sk-qa-02-cgd becomes validated
    const qc = T.mentoring_agreements.find((a) => a.person_id === 'p-qc-inspector' && a.mentor_person_id === 'p-sq-lead')!;
    await as('sq-lead');
    const yes = await b.rpc.closeAgreement(qc.id, { ratings: qc.goals.map((g: { skill_id: string }) => ({ skill_id: g.skill_id, rating: 3 })), validate: true });
    expect(yes.ok).toBe(true);
    expect(yes.data!.validated).toEqual([{ skill_id: 'sk-qa-02-cgd', claim_id: 'scl-f13-qc-1' }]);
    expect(b.rawGet('skill_claims', 'scl-f13-qc-1')).toMatchObject({ status: 'validated', decided_by: 'p-sq-lead' });
    expect(b.rawGet('skill_evidence', 'se:rating:scl-f13-qc-1:sk-qa-02-cgd')!.basis).toBe('validated');
    expect(b.rawGet('mentoring_agreements', qc.id)!.validated_skill_ids).toEqual(['sk-qa-02-cgd']);
    expect(audits('mentoring.close', 'ok').at(-1)!.ledger_status).toBe('written');
  });
  it('agreements and sessions are readable by the pair only; nobody writes them directly', async () => {
    const qc = T.mentoring_agreements.find((a) => a.person_id === 'p-qc-inspector' && a.mentor_person_id === 'p-sq-lead')!;
    for (const [p, n] of [['qc-inspector', 1], ['sq-lead', 1], ['head-sq', 0], ['training-mgr', 0], ['k-admin', 0], ['k-hr-analyst', 0]] as const) {
      await as(p);
      expect((await b.list('mentoring_agreements', { filter: { id: qc.id } } as never)).length).toBe(n);
      expect((await b.list('mentoring_sessions', { filter: { agreement_id: qc.id } } as never)).length > 0).toBe(n === 1);
    }
    await as('qc-inspector');
    expect((await b.insert('mentoring_sessions', { agreement_id: qc.id, person_id: 'p-qc-inspector', mentor_person_id: 'p-sq-lead', held_on: today, logged_by: 'p-qc-inspector' } as never)).ok).toBe(false);
    expect((await b.update('mentoring_agreements', qc.id, { status: 'closed' } as never)).ok).toBe(false);
  });
  it('SME nomination: only the line manager or the training manager, offered skills only; a direct write cannot set it', async () => {
    await as('sro');
    expect((await b.update('mentors', 'mt-6', { sme: true } as never)).ok).toBe(false);
    expect((await b.rpc.nominateSme('mt-23', true)).code).toBe('forbidden_nominate');
    await as('head-sq');
    expect((await b.update('mentors', 'mt-23', { sme: true, sme_nominated_by: 'p-head-sq' } as never)).ok).toBe(false);
    expect((await b.rpc.nominateSme('mt-23', true, ['sk-pf-01'])).code).toBe('invalid_skills');
    const led = b.raw('ledger_local').length;
    expect((await b.rpc.nominateSme('mt-23', true, ['sk-da-01-analysis'])).ok).toBe(true);
    expect(b.rawGet('mentors', 'mt-23')).toMatchObject({ sme: true, sme_skill_ids: ['sk-da-01-analysis'], sme_nominated_by: 'p-head-sq' });
    expect(b.raw('ledger_local').length).toBe(led + 1);
    expect((await b.rpc.smeNominees()).map((n) => n.mentor_id).sort()).toEqual(T.mentors.filter((m) => m.person_id !== 'p-head-sq' && lm(m.person_id) === 'p-head-sq').map((m) => m.id).sort());
    await as('sq-lead');
    expect((await b.rpc.nominateSme('mt-8', false)).code).toBe('self_nominate');
    await as('training-mgr');
    expect((await b.rpc.nominateSme('mt-6', true)).ok).toBe(true);
    expect((await b.rpc.smeNominees()).length).toBe(T.mentors.filter((m) => m.person_id !== 'p-training-mgr').length);
    // offer edits still work for the mentor, and keep the nomination
    await as('sro');
    expect((await b.update('mentors', 'mt-6', { bio_en: 'Updated bio for the unit test.' } as never)).ok).toBe(true);
    expect(b.rawGet('mentors', 'mt-6')!.sme).toBe(true);
  });
  it('programme dashboard: training manager only, aggregates with suppression', async () => {
    await as('k-hr-analyst');
    expect((await b.rpc.mentoringProgramme()).code).toBe('forbidden');
    await as('head-sq');
    expect((await b.rpc.mentoringProgramme()).code).toBe('forbidden');
    await as('training-mgr');
    const r = await b.rpc.mentoringProgramme();
    expect(r.ok).toBe(true);
    expect(r.data!.by_type.some((c) => c.suppressed && c.pairs === null)).toBe(true);
    expect(JSON.stringify(r.data)).not.toMatch(/p-[a-z]|w-[a-z]/);
    expect(r.data!.mentors.sme).toBe(T.mentors.filter((m) => m.sme).length);
  });
  it('my reporting line comes from the F08 line-manager rule', async () => {
    await as('k-ro');
    expect(await b.rpc.myReportingLine()).toEqual({ line_manager: 'p-sro', chain: reportingChain('p-k-ro', T.people, T.role_assignments, today) });
  });
  it('existing G2 mentoring still works: the mentor accepts within capacity', async () => {
    await as('k-instructor');
    const m = b.rawGet('mentors', 'mt-1') as unknown as MentorRowLite;
    expect(freePlaces(m, b.raw('mentoring_requests') as never)).toBeGreaterThan(0);
    expect((await b.rpc.respondMentoring('mr-1', 'matched')).ok).toBe(true);
  });
  it('agreement ids follow the request; types are all translated', () => {
    for (const a of T.mentoring_agreements as AgreementLite[]) expect(a.id).toBe(`ma-${a.request_id}`);
    for (const x of MENTORING_TYPES) for (const lang of ['en', 'ar'] as const) expect(translate(lang, `m04.mtr.type.${x}`)).not.toBe(`m04.mtr.type.${x}`);
  });
});
