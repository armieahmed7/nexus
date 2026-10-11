/** F31 Instructor and SME qualification pipeline (W4 · E5, M02): every acceptance criterion on the local path, the card's RBAC, the pure
 *  rules (stages, observation sets, checklist scoring, annual currency, notices), the SME finder, the seed, routes and i18n. The SQL path is
 *  checked by scripts/validate/w4e5-instructors.mjs (PGlite, SQL = TS parity and the same flows). */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { lintRanked } from '../../src/domain/engines';
import { qualView } from '../../src/domain/rules';
import { hasKey } from '../../src/i18n';
import {
  INSMSG, INS_RULES, OBS_ITEMS, OBS_KEYS, addDays, addMonths, coTeachPair, currencyView, deriveStage, monthlyHours, observationGate, poolSummary, qualifyingSet,
  scoreObservation, sessionHours, standardSkills, validateHours, validateNomination, validateObservation, type HoursRow, type ObsRow,
} from '../../src/modules/m02/instructors';
import { rankSmeCandidates } from '../../src/modules/m02/instructorMatch';
import { makeSupabaseM02 } from '../../src/modules/m02/backend/supabase';
import { routes } from '../../src/modules/m02/routes';
import seed from '../../src/seed/seed.json';
import arJson from '../../src/i18n/m02.ar.json';
import enJson from '../../src/i18n/m02.en.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const DEMO = (seed as unknown as { meta: { demo_today?: string } }).meta?.demo_today ?? '2026-10-08';
const today = new Date().toISOString().slice(0, 10);
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const audits = (action: string, outcome?: string) => b.raw('audit_events').filter((a) => a.action === action && (!outcome || a.outcome === outcome));
const items = (rating = 'met') => OBS_KEYS.map((k) => ({ key: k, rating }));
const obs = (id: string, kind: string, observer: string, on: string, result: 'pass' | 'fail' = 'pass'): ObsRow => ({ id, track_id: 't', observer_person_id: observer, kind, observed_on: on, items: [], score: result === 'pass' ? 90 : 50, result });
const track = (id: string) => b.rawGet('instructor_tracks', id)!;

describe('F31 seed', () => {
  it('seeds a pool and a pipeline in every stage with synthetic people, never a security family', () => {
    const tr = T.instructor_tracks;
    expect(new Set(tr.map((t) => t.status))).toEqual(new Set(['qualified', 'lapsed', 'active', 'declined', 'withdrawn']));
    expect(new Set(tr.filter((t) => t.status === 'active').map((t) => t.stage))).toEqual(new Set(['nominated', 'initial_training', 'co_teach', 'solo', 'ready']));
    expect(tr.filter((t) => t.status === 'qualified').length).toBeGreaterThanOrEqual(10);
    expect(tr.some((t) => t.route === 'asip')).toBe(true);
    const fam = new Map(T.people.map((p) => [p.id, p.job_family_id]));
    expect(tr.every((t) => !['security', 'cyber', 'safeguards'].includes(fam.get(t.person_id)))).toBe(true);
    const sec = new Set(T.qual_standards.filter((s) => s.security_restricted).map((s) => s.id));
    expect(tr.every((t) => t.standard_ids.every((s: string) => !sec.has(s)))).toBe(true);
  });
  it('stored stages equal the derived stages; observation scores equal the checklist rule; qualified sets have three different observers', () => {
    for (const t of T.instructor_tracks.filter((x) => x.status === 'active')) {
      const o = T.instructor_observations.filter((x) => x.track_id === t.id);
      expect(deriveStage(t, o, t.initial_done_on), t.id).toBe(t.stage);
    }
    for (const o of T.instructor_observations) expect(scoreObservation(o.items)).toMatchObject({ score: o.score, result: o.result });
    for (const t of T.instructor_tracks.filter((x) => x.status === 'qualified' || x.status === 'lapsed')) {
      const set = qualifyingSet(T.instructor_observations.filter((x) => x.track_id === t.id));
      expect(set, t.id).not.toBeNull();
      expect(new Set([set!.co[0].observer_person_id, set!.co[1].observer_person_id, set!.solo.observer_person_id]).size).toBe(3);
      expect([set!.co[0], set!.co[1], set!.solo].every((x) => x.observer_person_id !== t.person_id)).toBe(true);
    }
  });
  it('currency fields match the rule at the demo date; evaluator rows follow the currency; notices exist for short instructors', () => {
    for (const t of T.instructor_tracks.filter((x) => x.status === 'qualified' || x.status === 'lapsed')) {
      const cv = currencyView(t, T.teaching_hours.filter((h) => h.person_id === t.person_id), DEMO)!;
      expect(cv.status, t.id).toBe(t.currency_status);
      expect(cv.due).toBe(t.currency_due);
      for (const s of t.standard_ids) expect(T.evaluator_quals.find((e) => e.id === `eq-ins-${t.person_id}-${s}`)?.valid_to).toBe(t.status === 'lapsed' ? t.lapsed_on : t.currency_due);
      if (cv.notice) expect(T.notifications.some((n) => n.id === `nt-ins-${t.id}-${cv.due}-${cv.notice}`)).toBe(true);
    }
    const st = new Set(T.instructor_tracks.map((t) => t.currency_status).filter(Boolean));
    expect(st).toEqual(new Set(['current', 'due', 'at_risk', 'lapsed']));
  });
});

describe('F31 rules', () => {
  it('scores the checklist: met 2, partly 1, not met 0; pass needs 75% and no critical item not met', () => {
    expect(scoreObservation(items('met'))).toEqual({ score: 100, result: 'pass', critical_failed: [] });
    expect(scoreObservation(items('partly'))).toMatchObject({ score: 50, result: 'fail' });
    const crit = OBS_KEYS.map((k) => ({ key: k, rating: k === 'safety' ? 'not_met' : 'met' }));
    expect(scoreObservation(crit)).toEqual({ score: 88, result: 'fail', critical_failed: ['safety'] });
    const minor = OBS_KEYS.map((k) => ({ key: k, rating: k === 'oe' ? 'not_met' : 'met' }));
    expect(scoreObservation(minor).result).toBe('pass');
    expect(OBS_ITEMS.filter((i) => i.critical).map((i) => i.key)).toEqual(['accuracy', 'safety', 'assessment']);
  });
  it('acceptance: qualification requires two co-teach and one solo observation by different observers', () => {
    expect(qualifyingSet([obs('a', 'co_teach', 'x', '2026-01-01'), obs('b', 'co_teach', 'x', '2026-02-01'), obs('c', 'solo', 'y', '2026-03-01')])).toBeNull();
    expect(qualifyingSet([obs('a', 'co_teach', 'x', '2026-01-01'), obs('b', 'co_teach', 'y', '2026-02-01'), obs('c', 'solo', 'y', '2026-03-01')])).toBeNull();
    expect(qualifyingSet([obs('a', 'co_teach', 'x', '2026-01-01'), obs('b', 'co_teach', 'y', '2026-02-01'), obs('c', 'solo', 'z', '2026-03-01', 'fail')])).toBeNull();
    const ok = qualifyingSet([obs('a', 'co_teach', 'x', '2026-01-01'), obs('b', 'co_teach', 'y', '2026-02-01'), obs('c', 'solo', 'x', '2026-03-01'), obs('d', 'solo', 'z', '2026-04-01')]);
    expect(ok?.co.map((o) => o.id)).toEqual(['a', 'b']);
    expect(ok?.solo.id).toBe('d');
    // excluding an observer (maker-checker) can remove the only set
    expect(qualifyingSet([obs('a', 'co_teach', 'x', '2026-01-01'), obs('b', 'co_teach', 'y', '2026-02-01'), obs('d', 'solo', 'z', '2026-04-01')], 'x')).toBeNull();
    expect(coTeachPair([obs('a', 'co_teach', 'x', '2026-01-01'), obs('b', 'co_teach', 'x', '2026-02-01')])).toBeNull();
  });
  it('derives stages and gates observations in order', () => {
    const t = { status: 'active', stage: 'nominated', accepted_on: null as string | null };
    expect(deriveStage(t, [], null)).toBe('nominated');
    expect(deriveStage({ ...t, accepted_on: '2026-01-01' }, [], null)).toBe('initial_training');
    expect(deriveStage({ ...t, accepted_on: '2026-01-01' }, [], '2026-02-01')).toBe('co_teach');
    const two = [obs('a', 'co_teach', 'x', '2026-03-01'), obs('b', 'co_teach', 'y', '2026-04-01')];
    expect(deriveStage({ ...t, accepted_on: '2026-01-01' }, two, '2026-02-01')).toBe('solo');
    expect(deriveStage({ ...t, accepted_on: '2026-01-01' }, [...two, obs('c', 'solo', 'z', '2026-05-01')], '2026-02-01')).toBe('ready');
    expect(observationGate({ status: 'active', accepted_on: null }, 'co_teach', [], null, today)?.code).toBe('wrong_stage');
    expect(observationGate({ status: 'active', accepted_on: '2026-01-01' }, 'co_teach', [], null, today)?.message).toBe(INSMSG.needs_initial);
    expect(observationGate({ status: 'active', accepted_on: '2026-01-01' }, 'solo', [], '2026-02-01', today)?.message).toBe(INSMSG.needs_co_teach);
    expect(observationGate({ status: 'qualified', accepted_on: '2026-01-01' }, 'co_teach', [], '2026-02-01', today)?.message).toBe(INSMSG.currency_only);
    expect(observationGate({ status: 'active', accepted_on: '2026-05-01' }, 'co_teach', [], '2026-02-01', '2026-04-01')?.message).toBe(INSMSG.before_acceptance);
  });
  it('acceptance: currency lapses when the hours in a 12-month window fall below the minimum, and a notice is due at 30 days', () => {
    const q = '2025-03-10';
    const monthly = (from: string, n: number, h: number, kind = 'delivery'): HoursRow[] => Array.from({ length: n }, (_, i) => ({ person_id: 'p', kind, delivered_on: addDays(addMonths(from, i), 3), hours: h }));
    const t = { status: 'qualified', qualified_on: q, lapsed_on: null, currency_due: null };
    // first window met (12 x 4 h, 2 x 4.5 h CPD), second window short (12 x 3 h = 36 h)
    const hrs = [...monthly(q, 12, 4), ...monthly(addMonths(q, 12), 12, 3), { person_id: 'p', kind: 'cpd', delivered_on: '2025-06-01', hours: 4.5 }, { person_id: 'p', kind: 'cpd', delivered_on: '2025-11-01', hours: 4.5 },
      { person_id: 'p', kind: 'cpd', delivered_on: '2026-06-01', hours: 4.5 }, { person_id: 'p', kind: 'cpd', delivered_on: '2026-11-01', hours: 4.5 }];
    const before = currencyView(t, hrs, '2027-02-10')!;
    expect(before).toMatchObject({ status: 'at_risk', due: '2027-03-10', days: 28, notice: 30, met: false, renewals: 1 });
    expect(before.notice).toBe(qualView({ status: 'qualified', expires_on: before.due }, new Date('2027-02-10T12:00:00Z')).notice);
    expect(currencyView(t, hrs, '2026-12-20')).toMatchObject({ status: 'due', notice: 90 });
    expect(currencyView(t, hrs, '2026-06-01')).toMatchObject({ status: 'current', notice: null });
    const after = currencyView(t, hrs, '2027-03-10')!;
    expect(after).toMatchObject({ status: 'lapsed', lapsed_on: '2027-03-10', hours: 36, short_hours: 4 });
    // enough hours: renewed, no lapse and no notice
    const full = [...hrs, ...monthly(addMonths(q, 12), 2, 4)];
    expect(currencyView(t, full, '2027-02-10')).toMatchObject({ status: 'current', met: true, notice: null });
    expect(currencyView(t, full, '2027-03-11')).toMatchObject({ status: 'current', due: '2028-03-10', renewals: 2 });
    // a stored lapse stays until reinstatement
    expect(currencyView({ status: 'lapsed', qualified_on: q, lapsed_on: '2027-03-10', currency_due: '2027-03-10' }, full, '2027-06-01')).toMatchObject({ status: 'lapsed', lapsed_on: '2027-03-10' });
  });
  it('validates inputs, hours and session hours; adds months like SQL', () => {
    expect(validateObservation({ track_id: 'x', kind: 'co_teach', observed_on: today, items: items() }, today)).toBeNull();
    expect(validateObservation({ track_id: 'x', kind: 'co_teach', observed_on: addDays(today, 1), items: items() }, today)?.code).toBe('invalid');
    expect(validateObservation({ track_id: 'x', kind: 'co_teach', observed_on: today, items: items().slice(1) }, today)?.code).toBe('invalid');
    expect(validateNomination({ person_id: 'p', route: 'sme', standard_ids: ['qs-sec'] }, T.qual_standards, T.skills)?.code).toBe('security_restricted');
    expect(validateNomination({ person_id: 'p', route: 'sme', standard_ids: ['qs-ro'] }, T.qual_standards, T.skills)).toBeNull();
    expect(validateHours({ kind: 'cpd', hours: 0.3, delivered_on: today }, today)?.code).toBe('invalid');
    expect(validateHours({ kind: 'cpd', hours: 2.5, delivered_on: today }, today)).toBeNull();
    expect(sessionHours('2026-10-01T08:00:00Z', '2026-10-01T15:40:00Z')).toBe(7.5);
    expect(sessionHours('2026-10-01T08:00:00Z', '2026-10-02T08:00:00Z')).toBe(INS_RULES.maxEntryHours);
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2025-03-10', -12)).toBe('2024-03-10');
    expect(standardSkills(['qs-sec'], T.skills)).toEqual([]);
    const mh = monthlyHours([{ person_id: 'p', kind: 'delivery', delivered_on: today, hours: 3 }], today);
    expect(mh.length).toBe(12);
    expect(mh[11].delivery).toBe(3);
  });
  it('pool summary counts the currency states and the pipeline', () => {
    const s = poolSummary([{ status: 'qualified', stage: 'qualified', currency: { status: 'at_risk' } as never }, { status: 'active', stage: 'ready', currency: null }]);
    expect(s).toMatchObject({ qualified: 1, at_risk: 1, pipeline: { ready: 1 } });
  });
});

describe('F31 SME finder (engine shape)', () => {
  it('ranks colleagues with reasons, never people on the track or in security families', () => {
    const onTrack = new Set(T.instructor_tracks.filter((t) => ['active', 'qualified', 'lapsed'].includes(t.status)).map((t) => t.person_id));
    const ranked = rankSmeCandidates({ standardIds: ['qs-eng'], skills: T.skills, people: T.people, states: T.person_skills, smeProfiles: T.sme_profiles, smeMentors: T.mentors, onTrack, today: DEMO });
    expect(ranked.length).toBeGreaterThan(0);
    expect(lintRanked(ranked)).toEqual([]);
    expect(ranked.some((r) => onTrack.has(r.id))).toBe(false);
    const fam = new Map(T.people.map((p) => [p.id, p.job_family_id]));
    expect(ranked.some((r) => ['security', 'cyber', 'safeguards'].includes(fam.get(r.id)))).toBe(false);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    for (const r of ranked) for (const x of r.reasons) expect(hasKey(x.key)).toBe(true);
  });
});

describe('F31 RPCs on the local backend', () => {
  /** k-ro volunteers; training-mgr accepts; INSTR-101 recorded; returns the track id. */
  async function acceptedTrack() {
    await as('k-ro');
    const r = await b.rpc.nominateInstructor({ person_id: 'p-k-ro', route: 'sme', standard_ids: ['qs-ro'], motivation: 'I explain the RCS well' });
    expect(r.ok, r.message).toBe(true);
    await as('training-mgr');
    const a = await b.rpc.decideInstructorNomination(r.data!.id, 'accept', null);
    expect(a.ok, a.message).toBe(true);
    expect(a.data?.stage).toBe('initial_training');
    expect(b.rawGet('enrolments', `en-ins-${r.data!.id}`)?.course_id).toBe('c-instr');
    return r.data!.id;
  }
  const observe = (track_id: string, kind: string, rating = 'met') => b.rpc.recordInstructorObservation({ track_id, kind, observed_on: today, items: items(rating), note: 'Observed' });

  it('acceptance: two co-teach and one solo by three different observers, then the training manager qualifies (evaluator rows, credential evidence, ledger)', async () => {
    const id = await acceptedTrack();
    await as('k-instructor');
    expect((await observe(id, 'co_teach')).message).toBe(INSMSG.needs_initial);
    b.rawInsert('training_records', { id: 'tr-test-kro', person_id: 'p-k-ro', course_id: 'c-instr', completed_on: addDays(today, -2), hours: 80, result: 'passed' } as never);
    expect((await observe(id, 'co_teach')).ok).toBe(true);
    const c2 = await observe(id, 'co_teach');
    expect(c2.data?.stage).toBe('co_teach'); // same observer twice
    await as('sq-lead');
    expect((await observe(id, 'solo')).message).toBe(INSMSG.needs_co_teach);
    expect((await observe(id, 'co_teach', 'partly')).data?.result).toBe('fail');
    expect((await observe(id, 'co_teach')).data?.stage).toBe('solo');
    await as('k-instructor');
    expect((await observe(id, 'solo')).data?.stage).toBe('solo'); // solo by a co-teach observer does not complete the set
    await as('training-mgr');
    const q0 = await b.rpc.qualifyInstructor(id, null);
    expect(q0.code).toBe('not_ready');
    await as('ep-manager');
    expect((await observe(id, 'solo')).data?.stage).toBe('ready');
    await as('training-mgr');
    const q = await b.rpc.qualifyInstructor(id, 'Panel agreed');
    expect(q.ok, q.message).toBe(true);
    expect(track(id)).toMatchObject({ status: 'qualified', stage: 'qualified', currency_due: addMonths(today, 12), currency_status: 'current' });
    expect(b.rawGet('evaluator_quals', 'eq-ins-p-k-ro-qs-ro')?.valid_to).toBe(addMonths(today, 12));
    expect(b.rawGet('skill_evidence', `se:credential:${id}:sk-ld-01-instruct`)).toMatchObject({ kind: 'credential', level: 3, status: 'current' });
    expect(b.raw('person_skills').find((s) => s.id === 'ps:p-k-ro:sk-ld-01-instruct')?.level).toBeGreaterThanOrEqual(3);
    expect(b.raw('ledger_local').some((l) => String(l.action).includes('kafaa.instructor.qualify'))).toBe(true);
    expect((await b.rpc.qualifyInstructor(id, null)).code).toBe('invalid_state');
  });
  it('acceptance: an observer cannot observe themselves (refused and audited)', async () => {
    await as('ep-manager');
    const r = await b.rpc.recordInstructorObservation({ track_id: 'it-p-ep-manager', kind: 'currency', observed_on: today, items: items() });
    expect(r.code).toBe('self_observation');
    expect(r.message).toBe(INSMSG.self_observation);
    expect(audits('instructor.observe', 'refused').some((a) => String(a.reason).startsWith('self_observation'))).toBe(true);
  });
  it('maker-checker: the training manager cannot qualify a candidate they observed, nor decide their own track; instructors cannot qualify', async () => {
    await as('training-mgr');
    expect((await b.rpc.qualifyInstructor('it-w-rp-02', null)).code).toBe('maker_checker');
    expect((await b.rpc.qualifyInstructor('it-w-ro-02', null)).ok).toBe(true);
    expect((await b.rpc.qualifyInstructor('it-p-training-mgr', null)).code).toBe('maker_checker');
    await as('k-instructor');
    expect((await b.rpc.qualifyInstructor('it-w-rp-02', null)).code).toBe('forbidden');
    expect((await b.rpc.decideInstructorNomination('it-w-mnt-03', 'accept', null)).code).toBe('forbidden');
  });
  it('acceptance: the sweep lapses a short window (evaluator rows end, credential lapses, notice) and sends a 30-day notice when hours are short', async () => {
    b.rawUpdate('instructor_tracks', 'it-w-instr-02', { qualified_on: addMonths(today, -13), currency_due: addMonths(today, -1) } as never);
    b.rawUpdate('instructor_tracks', 'it-p-sq-lead', { qualified_on: addMonths(addDays(today, 20), -12), currency_due: addDays(today, 20) } as never);
    await as('training-mgr');
    const r = await b.rpc.instructorCurrencySweep();
    expect(r.ok, r.message).toBe(true);
    expect(r.data!.lapsed).toBeGreaterThanOrEqual(1);
    const lap = track('it-w-instr-02');
    expect(lap.status).toBe('lapsed');
    expect(lap.lapsed_on).toBe(addMonths(addMonths(today, -13), 12));
    for (const e of b.raw('evaluator_quals').filter((x) => x.id.startsWith('eq-ins-w-instr-02-'))) expect(e.valid_to <= lap.lapsed_on!).toBe(true);
    expect(b.rawGet('notifications', `nt-ins-it-w-instr-02-lapsed-${lap.lapsed_on}`)).toBeTruthy();
    expect(b.rawGet('notifications', `nt-ins-it-p-sq-lead-${addDays(today, 20)}-30`)?.severity).toBe('warn');
    expect(track('it-p-sq-lead').currency_status).toBe('at_risk');
    const again = await b.rpc.instructorCurrencySweep();
    expect(again.data).toMatchObject({ lapsed: 0, notices: 0 });
    // reinstatement needs a passed currency observation after the lapse by another observer
    expect((await b.rpc.qualifyInstructor('it-w-instr-02', null)).code).toBe('not_ready');
    await as('k-instructor');
    expect((await observe('it-w-instr-02', 'currency')).ok).toBe(true);
    await as('training-mgr');
    const re = await b.rpc.qualifyInstructor('it-w-instr-02', 'Currency observation passed');
    expect(re.ok && re.data?.reinstated).toBe(true);
  });
  it('RBAC: self-nomination, line manager in scope, training manager; employees cannot nominate others; security and ASIP rules', async () => {
    await as('k-ro');
    expect((await b.rpc.nominateInstructor({ person_id: 'w-lo-07', route: 'sme', standard_ids: ['qs-lo-aux'] })).code).toBe('forbidden');
    expect((await b.rpc.nominateInstructor({ person_id: 'p-k-ro', route: 'sme', standard_ids: ['qs-sec'] })).code).toBe('security_restricted');
    expect((await b.rpc.nominateInstructor({ person_id: 'p-k-ro', route: 'asip', standard_ids: ['qs-ro'] })).code).toBe('not_eligible');
    await as('training-mgr');
    expect((await b.rpc.nominateInstructor({ person_id: 'w-sec-01', route: 'sme', standard_ids: ['qs-get'] })).code).toBe('security_restricted');
    expect((await b.rpc.nominateInstructor({ person_id: 'w-instr-01', route: 'sme', standard_ids: ['qs-get'] })).code).toBe('already_active');
    await as('chem-sup');
    const m = await b.rpc.nominateInstructor({ person_id: 'w-chem-03', route: 'sme', standard_ids: ['qs-chem'] });
    expect(m.ok, m.message).toBe(true);
    expect(track(m.data!.id)).toMatchObject({ nomination_kind: 'manager', nominated_by: 'p-chem-sup', stage: 'nominated' });
    expect(b.rawGet('notifications', `nt-ins-${m.data!.id}-nominated`)?.person_id).toBe('w-chem-03');
    expect(b.rawGet('notifications', `nt-ins-${m.data!.id}-tm-p-training-mgr`)).toBeTruthy();
    expect((await b.rpc.nominateInstructor({ person_id: 'w-mnt-05', route: 'sme', standard_ids: ['qs-mech'] })).code).toBe('forbidden'); // outside scope
    await as('training-mgr');
    expect((await b.rpc.decideInstructorNomination(m.data!.id, 'decline', 'no')).code).toBe('invalid');
    expect((await b.rpc.decideInstructorNomination(m.data!.id, 'decline', 'Not this year, reapply in 2027')).ok).toBe(true);
    expect(track(m.data!.id).status).toBe('declined');
  });
  it('reads: a candidate sees their own track only; instructors, the training manager and auditors the whole pool; HR analysts none', async () => {
    await as('sme-reviewer');
    expect((await b.list('instructor_tracks')).map((t) => t.person_id)).toEqual(['p-sme-reviewer']);
    await as('k-ro');
    expect(await b.list('instructor_tracks')).toEqual([]);
    for (const p of ['training-mgr', 'k-instructor', 'k-auditor']) {
      await as(p);
      expect((await b.list('instructor_tracks')).length, p).toBe(T.instructor_tracks.length);
    }
    await as('k-hr-analyst');
    expect(await b.list('instructor_observations')).toEqual([]);
  });
  it('hours: own continuing development, training-manager delivery hours, attended sessions synced once', async () => {
    await as('k-instructor');
    expect((await b.rpc.logTeachingHours({ person_id: 'p-k-instructor', kind: 'cpd', hours: 3.5, delivered_on: today, note: 'SAT refresher' })).ok).toBe(true);
    expect((await b.rpc.logTeachingHours({ person_id: 'p-k-instructor', kind: 'delivery', hours: 3, delivered_on: today })).code).toBe('forbidden');
    expect((await b.rpc.syncTeachingHours('w-instr-01')).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.logTeachingHours({ person_id: 'w-instr-01', kind: 'delivery', hours: 0.3, delivered_on: today })).code).toBe('invalid');
    expect((await b.rpc.logTeachingHours({ person_id: 'p-k-lo-trainee', kind: 'delivery', hours: 2, delivered_on: today })).code).toBe('not_found');
    const start = new Date(Date.now() - 3 * 86_400_000);
    b.rawInsert('sessions', { id: 's-test-past', course_id: 'c-loct', starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 460 * 60_000).toISOString(), location: 'Simulator', instructor_person_id: 'w-instr-01', capacity: 6, kind: 'class', status: 'completed' } as never);
    b.rawInsert('enrolments', { id: 'en-test-att', person_id: 'p-k-ro', course_id: 'c-loct', session_id: 's-test-past', status: 'completed', source: 'manager', attendance: 'present' } as never);
    const y1 = await b.rpc.syncTeachingHours(null);
    expect(y1.data?.added).toBeGreaterThanOrEqual(1);
    expect(b.rawGet('teaching_hours', 'th-ses-s-test-past')).toMatchObject({ person_id: 'w-instr-01', hours: 7.5, source: 'session' });
    expect((await b.rpc.syncTeachingHours(null)).data?.added).toBe(0);
  });
  it('closing a qualified track ends its evaluator rows today and lapses the credential', async () => {
    await as('training-mgr');
    expect((await b.rpc.qualifyInstructor('it-w-ro-02', null)).ok).toBe(true);
    await as('k-instructor');
    expect((await b.rpc.withdrawInstructorTrack('it-w-ro-02', 'Not mine to close')).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.withdrawInstructorTrack('it-w-ro-02', 'x')).code).toBe('invalid');
    expect((await b.rpc.withdrawInstructorTrack('it-w-ro-02', 'Moved to another unit')).ok).toBe(true);
    expect(b.rawGet('evaluator_quals', 'eq-ins-w-ro-02-qs-lo-aux')?.valid_to).toBe(today);
    expect(b.rawGet('skill_evidence', 'se:credential:it-w-ro-02:sk-ld-01-instruct')?.status).toBe('lapsed');
    expect((await b.rpc.withdrawInstructorTrack('it-w-ro-02', 'Again please')).code).toBe('invalid_state');
  });
});

describe('F31 wiring, routes and i18n', () => {
  it('four routes with the card guards; the param route has a smoke sample', () => {
    const ids = ['training-instructors', 'training-instructor', 'my-instructor', 'team-instructors'];
    for (const id of ids) expect(routes.some((r) => r.id === id), id).toBe(true);
    expect(routes.find((r) => r.id === 'training-instructors')?.guard).toMatchObject({ grant: { res: 'sat' } });
    expect(JSON.parse(readFileSync('src/modules/m02/smoke.json', 'utf8'))['training-instructor'].trackId).toBe('it-w-ro-02');
    for (const id of ids) for (const k of ['title', 'purpose']) {
      expect((enJson as any).routes[id][k]).toBeTruthy();
      expect((arJson as any).routes[id][k]).toBeTruthy();
    }
  });
  it('the three tables are RPC-only and readable by own / scope / sat only', () => {
    for (const t of ['instructor_tracks', 'instructor_observations', 'teaching_hours']) {
      expect(SCHEMA[t].write.mode).toBe('rpc');
      expect(SCHEMA[t].read.map((r) => r.res).sort()).toEqual(['own_profile', 'qual_records', 'sat']);
    }
  });
  it('every RPC is mapped for the Supabase backend; the migration is additive', () => {
    const calls: string[] = [];
    const m = makeSupabaseM02({ call: async (fn) => { calls.push(fn); return { ok: true, code: 'ok', message: '', data: null } as never; }, rpc: async () => null as never });
    for (const k of Object.keys(m)) (m as any)[k]({ person_id: 'x' }, 'accept', null);
    expect(calls.filter((c) => !['kafaa_log_practice', 'kafaa_ack_practice', 'kafaa_request_evaluation', 'kafaa_close_evaluation_request', /* fsCe4: FS23/FS24 calls checked in fs34-descriptors.test.ts */ 'kafaa_save_descriptor', 'kafaa_set_level_range', 'kafaa_recognise_authority'].includes(c)).sort()).toEqual(['kafaa_decide_instructor_nomination', // W5E1: F38 calls checked in w5e1-ojt.test.ts
      'kafaa_instructor_currency_sweep', 'kafaa_log_teaching_hours', 'kafaa_nominate_instructor', 'kafaa_qualify_instructor', 'kafaa_record_instructor_observation', 'kafaa_sync_teaching_hours', 'kafaa_withdraw_instructor_track']);
    const sql = readFileSync('supabase/migrations/20261009145001_kafaa_w4e5_instructors.sql', 'utf8');
    expect(/\b(drop|delete|truncate)\b/i.test(sql)).toBe(false);
    for (const msg of Object.values(INSMSG)) expect(sql.includes(`'${msg.replace(/'/g, "''")}'`), msg).toBe(true);
  });
  it('the i18n namespace has every F31 key in English and Arabic', () => {
    const walk = (o: any, p: string[] = []): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? walk(v, [...p, k]) : [[...p, k].join('.')]));
    const en = walk({ ins: (enJson as any).ins, reasons: (enJson as any).reasons });
    const ar = new Set(walk({ ins: (arJson as any).ins, reasons: (arJson as any).reasons }));
    for (const k of en) expect(ar.has(k), k).toBe(true);
    expect(en.length).toBeGreaterThan(200);
  });
});
