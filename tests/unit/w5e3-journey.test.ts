/**
 * W5 · E3 acceptance: F34 Student-to-career journey (M06). Pure rules (src/modules/m06/journey.ts), the seed, and the local path
 * (LocalBackend RPCs and read rules). The SQL path is scripts/validate/w5e3-journey.mjs (PGlite: SQL = TS on every seeded journey,
 * the aggregate, the validation messages and every refusal). Page behaviour is in w5e3-pages.test.tsx.
 *
 * Card acceptance (BACKLOG F34):
 *   A1 A school leaver reaches the DNT step from the journey in two clicks in either language        -> pages test (+ board model here)
 *   A2 The quiz stores nothing for anonymous users (network test)                                      -> pages test (+ RPC refusals here)
 *   A3 Every programme fact on the board has a source and an as-of date (DNT 24 months; cohort of 20)   -> here (seed) + pages test
 *   A4 No score or rank is shown to the student                                                        -> pages test (+ copy check here)
 * RBAC: public read for the explorer; applicant Own; HR Agg (>= 10); university sees only consenting scholars (existing rule).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import {
  JOURNEY_ROUTES, PREP_ITEMS, ROUTE_ROLES, STAGE_ROUTES, STAGE_STEP, cellOf, computeJourneyAggregate, eligibilityView, exploreInterests, explorerFamilies, journeyPayload,
  liveJourney, nextStep, noScoreText, prepKey, starterEligible, starterRow, suggestRoute, validateAnswers, validateChecklist, validateJourneyInput, type JourneyQuestionRow,
} from '../../src/modules/m06/journey';
import { familyRanked } from '../../src/modules/m06/journeyUi';
import { lintRanked } from '../../src/domain/engines';
import { checkGuard } from '../../src/auth/guards';
import { MIN_GROUP_SIZE } from '../../src/auth/policy';
import { ROUTES } from '../../src/routes/registry';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m06.en.json';
import ar from '../../src/i18n/m06.ar.json';
import seed from '../../src/seed/seed.json';

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const QS = T.journey_questions as unknown as JourneyQuestionRow[];
const FS: Record<string, number> = Object.fromEntries(T.job_families.map((f: any) => [f.id, f.sort]));
const get = (k: string, o: any): any => k.split('.').reduce((v, p) => (v == null ? v : v[p]), o);

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('F34 rules: interest explorer (deterministic, non-scoring)', () => {
  it('10 questions, every option names job families that exist, and the study-length question suggests routes', () => {
    expect(QS).toHaveLength(10);
    const fams = new Set(T.job_families.map((f: any) => f.id));
    for (const q of QS) for (const o of (q.options as any[])) {
      expect(o.en && o.ar).toBeTruthy();
      for (const f of o.families) expect(fams.has(f)).toBe(true);
      if (o.route) expect(JOURNEY_ROUTES).toContain(o.route);
    }
    expect(explorerFamilies(QS, FS).length).toBeGreaterThan(12);
  });
  it('maps answers to at most three families: hits first, then job-family order; extra families need two answers', () => {
    expect(exploreInterests(QS, {}, FS)).toEqual({ families: [], route: null, answered: 0 });
    const one = exploreInterests(QS, { q03: 'a' }, FS);
    expect(one.families.map((f) => f.id)).toEqual(['operations']);
    const ops = exploreInterests(QS, { q01: 'a', q02: 'b', q03: 'a', q04: 'a', q05: 'a', q09: 'a' }, FS);
    expect(ops.families[0]).toMatchObject({ id: 'operations', hits: 6 });
    expect(ops.families.every((f, i) => i === 0 || f.hits >= 2)).toBe(true);
    expect(ops.families.length).toBeLessThanOrEqual(3);
    expect(ops.route).toBe('dnt');
    // tie: chemistry (5) before radiation-protection (4) before environment (17) by job-family order, each with one hit
    const tie = exploreInterests(QS, { q01: 'b' }, FS);
    expect(tie.families.map((f) => f.id)).toEqual(['radiation-protection']);
    expect(exploreInterests(QS, { q04: 'c', q09: 'd' }, FS)).toEqual({ families: [], route: null, answered: 2 });
  });
  it('the result is reproducible (same answers, same order) and each family is explained by the answers pointing to it (F02 lint)', () => {
    const a = { q01: 'c', q02: 'b', q07: 'c', q10: 'c', q06: 'a' };
    const x = exploreInterests(QS, a, FS);
    expect(exploreInterests(QS, { ...a }, FS)).toEqual(x);
    const ranked = familyRanked(QS, a, x);
    expect(lintRanked(ranked)).toEqual([]);
    expect(ranked[0].reasons.every((r) => r.key === 'm06.reasons.answer' && r.vars?.q && r.vars?.a)).toBe(true);
    expect(ranked[0].reasons).toHaveLength(x.families[0].hits);
  });
  it('validates answers, checklists and input the same way as SQL (order-independent messages)', () => {
    expect(validateAnswers(QS, { q01: 'a' })).toBeNull();
    expect(validateAnswers(QS, { q99: 'a', q01: 'z' })).toBe('Unknown question');
    expect(validateAnswers(QS, { q01: 'z' })).toBe('Unknown answer');
    expect(validateAnswers(QS, [])).toMatch(/object/);
    expect(validateChecklist({ 'prep:dnt:apply': 'done', 'elig:dnt:0': 'yes' })).toBeNull();
    expect(validateChecklist({ 'Bad Key': 'done' })).toBe('Unknown checklist item');
    expect(validateChecklist({ 'prep:dnt:x': 'maybe' })).toBe('Unknown checklist value');
    expect(validateChecklist(Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`k${i}`, 'done'])))).toMatch(/At most 40/);
    expect(validateJourneyInput(QS, { stage: 'nursery' })).toBe('Unknown stage');
    expect(validateJourneyInput(QS, { route: 'ku-msc' })).toBe('Unknown route');
    expect(validateJourneyInput(QS, { clear: true, stage: 'nursery' })).toBeNull();
    expect(validateJourneyInput(QS, null)).toBe('Nothing to save');
  });
});

describe('F34 rules: board, route suggestion and readiness (non-binding)', () => {
  it('A1 model: a school leaver stands at the route step, DNT is suggested first and leads to Local Operator', () => {
    expect(STAGE_STEP.finishing_school).toBe('route');
    expect(STAGE_ROUTES.finishing_school[0]).toBe('dnt');
    const s = suggestRoute('finishing_school', null, exploreInterests(QS, {}, FS));
    expect(s).toMatchObject({ route: 'dnt', why: ['stage'] });
    expect(ROUTE_ROLES.dnt).toContain('local-operator');
  });
  it('the student\'s own choice wins over the explorer, which wins over the stage; matched families explain the fit', () => {
    const ex = exploreInterests(QS, { q09: 'b', q01: 'a', q02: 'd', q08: 'd' }, FS);
    expect(suggestRoute('finishing_school', null, ex)).toMatchObject({ route: 'energy-pioneers', why: ['study', 'family'] });
    expect(suggestRoute('finishing_school', 'gpo', ex).route).toBe('gpo');
    expect(suggestRoute(null, null, exploreInterests(QS, {}, FS)).route).toBeNull();
  });
  it('readiness shows the next step instead of any progress score, and eligibility is a non-binding reading', () => {
    expect(nextStep('dnt', {})).toBe(PREP_ITEMS.dnt[0]);
    expect(nextStep('dnt', { [prepKey('dnt', 'finish_g12')]: 'done' })).toBe('certificate');
    expect(nextStep('dnt', Object.fromEntries(PREP_ITEMS.dnt.map((i) => [prepKey('dnt', i), 'done'])))).toBeNull();
    expect([eligibilityView([]), eligibilityView(['yes', undefined]), eligibilityView(['yes', 'yes']), eligibilityView(['yes', 'no']), eligibilityView(['unsure', 'yes'])]).toEqual(['unanswered', 'unanswered', 'meets', 'check', 'unsure']);
  });
  it('A4 copy: student-facing journey text carries no score, rank or percentage, in English and Arabic', () => {
    const texts = (o: any): string[] => (typeof o === 'string' ? [o] : Object.values(o ?? {}).flatMap(texts));
    for (const lang of [en, ar] as any[]) {
      for (const k of ['journey', 'jparents', 'reasons']) for (const s of texts(lang[k])) expect(noScoreText(s), s).toBe(true);
      for (const k of ['pathways-journey', 'pathways-journey-parents']) for (const s of texts(lang.routes[k])) expect(noScoreText(s), s).toBe(true);
    }
    for (const q of QS) for (const s of [q.prompt_en, q.prompt_ar, ...(q.options as any[]).flatMap((o) => [o.en, o.ar])]) expect(noScoreText(s)).toBe(true);
    expect(noScoreText('Your score: 80%')).toBe(false);
  });
});

describe('F34 seed', () => {
  it('A3: every board fact cites a registered source and an as-of date; the DNT facts state 24 months and the cohort of 20 (June 2026)', () => {
    const src = new Map(T.sources.map((s: any) => [s.id, s]));
    expect(T.journey_facts.length).toBeGreaterThanOrEqual(15);
    for (const f of T.journey_facts) {
      expect(src.get(f.source_id)?.url, f.id).toMatch(/^https:\/\//);
      expect(f.as_of, f.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['day', 'month', 'year']).toContain(f.precision);
    }
    const dnt = T.journey_facts.filter((f: any) => f.programme_id === 'dnt');
    expect(dnt.some((f: any) => /24 months/.test(f.text_en) && /24 شهراً/.test(f.text_ar))).toBe(true);
    expect(dnt.some((f: any) => /cohort of 20 graduated on 17 June 2026/.test(f.text_en) && f.as_of === '2026-06-17' && f.source_id === 'enec-dnt-grad')).toBe(true);
    for (const step of ['explore', 'mustaqbali', 'route', 'first_role']) expect(T.journey_facts.some((f: any) => f.step === step)).toBe(true);
    for (const r of JOURNEY_ROUTES) expect(T.journey_facts.some((f: any) => f.programme_id === r)).toBe(true);
  });
  it('seeded journeys are synthetic applicants whose stored families equal the explorer on their answers', () => {
    const people = new Map(T.people.map((p: any) => [p.id, p]));
    expect(T.student_journeys.length).toBeGreaterThan(100);
    for (const j of T.student_journeys) {
      expect((people.get(j.person_id) as any)?.synthetic).toBe(true);
      expect(j.open_read).toBe(false);
      if (j.cleared_at) continue;
      expect(j.interests.families).toEqual(exploreInterests(QS, j.interests.answers, FS).families.map((f) => f.id));
      expect(journeyPayload(QS, { stage: j.stage, route: j.route, answers: j.interests.answers, checklist: j.milestones.checklist }, FS).interests.families).toEqual(j.interests.families);
    }
    expect(T.student_journeys.find((j: any) => j.person_id === 'p-k-student')).toMatchObject({ stage: 'finishing_school', route: 'dnt' });
  });
  it('the starter portfolio: 7 of 10 accepted Mustaqbali participants hold a credential, 3 wait for the HR director; never a FANR certification', () => {
    const waiting = starterEligible(T.applications, T.student_portfolio);
    expect(waiting).toHaveLength(3);
    const creds = T.student_portfolio.filter((p: any) => p.kind === 'microcred');
    expect(creds).toHaveLength(8);
    for (const p of T.student_portfolio) expect(`${p.title_en} ${p.evidence_en} ${p.issuer_en}`).not.toMatch(/FANR|certif(ied|ication)|licen[cs]e/i);
    expect(starterRow('a-01', '2026-10-09')).toMatchObject({ id: 'spf-a-01-mustaqbali', microcred_def_id: 'mc-student-mustaqbali', sample: true, status: 'issued' });
  });
  it('the HR aggregate on the seed: cells under 10 are suppressed (both kinds present)', () => {
    const a = computeJourneyAggregate({ journeys: T.student_journeys, applications: T.applications, portfolio: T.student_portfolio, families: explorerFamilies(QS, FS) }, false);
    const cells = [a.total, a.routed, a.applied, a.credentials, ...a.by_stage, ...a.by_route, ...a.by_family];
    expect(cells.every((c) => (c.suppressed ? c.n === null : (c.n ?? 0) >= MIN_GROUP_SIZE))).toBe(true);
    expect(cells.some((c) => c.suppressed) && cells.some((c) => !c.suppressed)).toBe(true);
    expect(a.credentials).toEqual({ n: null, suppressed: true }); // 8 people
    expect(a.pending_credentials).toBeNull();
    expect(cellOf(0)).toEqual({ n: null, suppressed: true });
    expect(liveJourney({ cleared_at: '2026-10-01T09:00:00Z', stage: 'school' })).toBe(false);
  });
});

describe('F34 local backend: RBAC and RPCs', () => {
  it('public read for the explorer and the board facts; no journey or portfolio row for anonymous visitors', async () => {
    await as(null);
    expect(await b.list('journey_questions', {})).toHaveLength(10);
    expect((await b.list('journey_facts', {})).length).toBe(T.journey_facts.length);
    expect(await b.list('student_journeys', {})).toEqual([]);
    expect(await b.list('student_portfolio', {})).toEqual([]);
  });
  it('A2 (RPC side): an anonymous save is refused before anything is written', async () => {
    await as(null);
    const before = b.raw('student_journeys').length;
    const r = await b.rpc.saveStudentJourney({ answers: { q01: 'a' } });
    expect(r).toMatchObject({ ok: false, code: 'not_signed_in' });
    expect(b.raw('student_journeys').length).toBe(before);
  });
  it('applicant Own: the student reads only their own journey and portfolio; HR, auditors, training staff and universities read none', async () => {
    await as('k-student');
    const mine = await b.list('student_journeys', {});
    expect(mine.map((j) => j.person_id)).toEqual(['p-k-student']);
    expect((await b.list('student_portfolio', {})).every((p) => p.person_id === 'p-k-student')).toBe(true);
    for (const p of ['chco', 'k-hr-analyst', 'k-auditor', 'training-mgr', 'k-university', 'sro']) {
      await as(p);
      expect((await b.list('student_journeys', {})).filter((j) => j.person_id !== b.identity().personId), p).toEqual([]);
      expect(await b.list('student_portfolio', {}), p).toEqual([]);
    }
  });
  it('university sees only consenting scholars (existing M10 rule, unchanged)', async () => {
    await as('k-university');
    const sch = await b.list('scholars', {});
    expect(sch.length).toBeGreaterThan(0);
    expect(sch.every((s) => s.consent_university)).toBe(true);
  });
  it('saving recomputes the families on the server, ignores client-sent families, audits without a ledger row, and clearing never removes the row', async () => {
    await as('k-student');
    const led0 = b.raw('ledger_local').length;
    const input = { stage: 'finishing_school', route: 'dnt', answers: { q01: 'a', q03: 'b', q06: 'a', q09: 'a', q02: 'a' }, checklist: { 'prep:dnt:practice': 'done' } };
    const r = await b.rpc.saveStudentJourney({ ...input, interests: { families: ['security'] } } as never);
    expect(r.ok).toBe(true);
    const row = b.rawGet('student_journeys', 'sj-p-k-student')!;
    expect((row.interests as any).families).toEqual(exploreInterests(QS, input.answers, FS).families.map((f) => f.id));
    expect(r.data?.families).toEqual((row.interests as any).families);
    expect((row.milestones as any).checklist).toEqual({ 'prep:dnt:practice': 'done' });
    const aud = b.raw('audit_events').at(-1)!;
    expect(aud).toMatchObject({ action: 'journey.save', outcome: 'ok', ledger_status: 'not_applicable' });
    expect(aud.reason).toBe(`stage finishing_school, route dnt, ${(row.interests as any).families.length} families, 1 checklist items`);
    expect(b.raw('ledger_local').length).toBe(led0);
    const bad = await b.rpc.saveStudentJourney({ answers: { q01: 'z' } });
    expect(bad).toMatchObject({ ok: false, code: 'invalid', message: 'Unknown answer' });
    const c = await b.rpc.saveStudentJourney({ clear: true });
    expect(c.ok && c.data?.cleared).toBe(true);
    const after = b.rawGet('student_journeys', 'sj-p-k-student')!;
    expect(after).toMatchObject({ stage: null, route: null, interests: {}, milestones: {} });
    expect(after.cleared_at).toBeTruthy();
  });
  it('partners cannot save a journey; an employee (applications Own) can, for themselves only', async () => {
    await as('k-university');
    expect(await b.rpc.saveStudentJourney({ stage: 'graduate' })).toMatchObject({ ok: false, code: 'forbidden' });
    await as('nse');
    const r = await b.rpc.saveStudentJourney({ stage: 'graduate', answers: { q09: 'c' } });
    expect(r.ok).toBe(true);
    expect(r.data?.route).toBeNull();
    expect((await b.list('student_journeys', {})).map((j) => j.person_id)).toEqual([b.identity().personId]);
  });
  it('HR Agg (>= 10): analysts and auditors read the suppressed aggregate; the director also sees the credential queue; students and managers are refused', async () => {
    await as('k-hr-analyst');
    const hr = await b.rpc.journeyAggregate();
    expect(hr.ok).toBe(true);
    const cells = [hr.data!.total, ...hr.data!.by_stage, ...hr.data!.by_route, ...hr.data!.by_family];
    expect(cells.every((c) => (c.suppressed ? c.n === null : c.n! >= 10))).toBe(true);
    expect(hr.data!.pending_credentials).toBeNull();
    expect(JSON.stringify(hr.data)).not.toMatch(/"p-|"a-\d|"ap-\d/);
    await as('chco');
    expect((await b.rpc.journeyAggregate()).data!.pending_credentials).toBe(3);
    await as('k-auditor');
    expect((await b.rpc.journeyAggregate()).ok).toBe(true);
    for (const p of ['k-student', 'sro', 'training-mgr']) {
      await as(p);
      expect(await b.rpc.journeyAggregate(), p).toMatchObject({ ok: false, code: 'forbidden' });
    }
    await as(null);
    expect(await b.rpc.journeyAggregate()).toMatchObject({ ok: false, code: 'not_signed_in' });
  });
  it('the HR director issues the starter credentials (portfolio rows, notices, ledger); the analyst is refused; nothing is issued twice', async () => {
    await as('k-hr-analyst');
    expect(await b.rpc.issueStarterCredentials()).toMatchObject({ ok: false, code: 'forbidden' });
    await as('chco');
    const led0 = b.raw('ledger_local').length;
    const waiting = starterEligible(b.raw('applications'), b.raw('student_portfolio'));
    const r = await b.rpc.issueStarterCredentials();
    expect(r).toMatchObject({ ok: true, data: { issued: 3 } });
    for (const p of waiting) {
      expect(b.rawGet('student_portfolio', `spf-${p}-mustaqbali`)).toMatchObject({ status: 'issued', microcred_def_id: 'mc-student-mustaqbali', sample: true });
      expect(b.rawGet('notifications', `nt-spf-${p}-mustaqbali`)).toMatchObject({ person_id: p, link: '/pathways/journey#portfolio' });
    }
    expect(b.raw('ledger_local').length).toBe(led0 + 1);
    expect(b.raw('audit_events').at(-1)).toMatchObject({ action: 'journey.starter_credentials', outcome: 'ok', reason: 'issued 3' });
    expect(await b.rpc.issueStarterCredentials()).toMatchObject({ ok: false, code: 'not_found' });
  });
  it('routes: the journey and the parent view are public; insights need applications Agg, A or R', () => {
    const r = (id: string) => ROUTES.find((x) => x.id === id)!;
    expect(r('pathways-journey').path).toBe('/pathways/journey');
    expect(checkGuard(r('pathways-journey').guard, { status: 'anon', roles: ['public'] } as never)).toBe('ok');
    expect(checkGuard(r('pathways-journey-parents').guard, { status: 'anon', roles: ['public'] } as never)).toBe('ok');
    const g = (roles: string[]) => checkGuard(r('workforce-journeys').guard, { status: 'signed_in', roles } as never);
    expect([g(['hr_analyst']), g(['hr_director']), g(['auditor'])]).toEqual(['ok', 'ok', 'ok']);
    expect(g(['applicant'])).not.toBe('ok');
    expect(g(['manager', 'employee'])).not.toBe('ok');
  });
  it('schema: journeys and portfolio are RPC-only, own-only (open_read), and the board data is public talent content', () => {
    expect(SCHEMA.student_journeys.write.mode).toBe('rpc');
    expect(SCHEMA.student_portfolio.write.mode).toBe('rpc');
    expect(SCHEMA.student_journeys.read).toEqual([{ res: 'applications', person: 'person_id', where: 'open_read' }]);
    expect(SCHEMA.journey_questions.read).toEqual([{ res: 'talent_content' }]);
    for (const k of ['routes.pathways-journey.title', 'routes.workforce-journeys.title', 'journey.asOf', 'jparents.ar.journeyTitle', 'jinsights.suppressed', 'reasons.answer']) {
      expect(get(k, en), k).toBeTruthy();
      expect(get(k, ar), k).toBeTruthy();
    }
  });
});
