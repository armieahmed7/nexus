/**
 * F07 Learning Coach (W1 · E3) acceptance and behaviour. Pure engine (src/modules/m19/coach.ts, ask.ts), the LocalBackend
 * RPCs (coachFeedback, coachInsights) and RBAC. The SQL twins are checked by scripts/validate/w1e3-coach.mjs (PGlite).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { lintRanked } from '../../src/domain/engines';
import { hasKey } from '../../src/i18n';
import { checkGuard } from '../../src/auth/guards';
import { MIN_GROUP_SIZE, type PlatformRole } from '../../src/auth/policy';
import { buildCoachFeed, asRanked, coachTargets, practiceSafe, feedbackWeights, FEED_MAX, FEED_MIN, type CoachInput, type FormLite, type ItemLite } from '../../src/modules/m19/coach';
import { coachInputFrom, type CoachTables } from '../../src/modules/m19/inputs';
import { askCoach, buildAskCorpus } from '../../src/modules/m19/ask';
import { coachInsightsOf, addDaysIso } from '../../src/modules/m19/insights';
import { routes } from '../../src/modules/m19/routes';
import { TRAINING_PATHS } from '../../src/modules/m04/paths';

type Rows = Record<string, any>[];
const S = seed as unknown as { tables: Record<string, Rows>; meta: { demo_today: string }; personas: { persona: string; person_id: string; roles: PlatformRole[] }[] };
const T = S.tables;
const NOW = S.meta.demo_today;
const clone = <X,>(x: X): X => structuredClone(x);
const tablesFor = (personId: string, patch: (t: Record<string, Rows>) => void = () => {}): CoachTables => {
  const t = clone(T);
  patch(t);
  return { ...(t as never as CoachTables), person: t.people.find((p) => p.id === personId) as never };
};
const feedFor = (personId: string, patch?: (t: Record<string, Rows>) => void, now = NOW, extra: Partial<CoachInput> = {}) => {
  const input = { ...coachInputFrom(tablesFor(personId, patch), now)!, ...extra };
  return { input, res: buildCoachFeed(input) };
};
const STAFF = S.personas.filter((p) => p.roles.some((r) => ['employee', 'licensed_operator'].includes(r))).map((p) => p.person_id);
const secureIds = new Set(T.items.filter((i) => i.bank === 'secure').map((i) => i.id));
const secureStems = T.item_versions.filter((v) => secureIds.has(v.item_id)).map((v) => String(v.stem_en)).filter((s) => s.length > 12);

describe('F07 acceptance', () => {
  it('k-ro with the RO qualification within 60 days of expiry: the first card is the related requalification, with "expires in N days"', () => {
    for (const days of [59, 45, 10]) {
      const { res } = feedFor('p-k-ro', (t) => { t.qual_records.find((q) => q.id === 'qr-p-k-ro-qs-ro')!.expires_on = addDaysIso(NOW, days); });
      const first = res.feed[0];
      expect(first.kind).toBe('refresher');
      expect(first.pinned).toBe('expiry');
      expect(first.itemId).toBe('qr-p-k-ro-qs-ro');
      expect(first.reasons[0]).toMatchObject({ code: 'expires', key: 'm19.reasons.expires', vars: { n: days } });
      // the related refresher is the continuing operator training that keeps the RO card current
      expect(first.reasons.find((r) => r.code === 'refresher_course')?.ref).toEqual({ table: 'courses', id: 'c-coct' });
      // k-ro already holds a COCT seat (crew B session), so the card opens My learning instead of booking twice
      expect(first.action).toMatchObject({ type: 'link', to: '/my/learning' });
    }
    const unbooked = feedFor('p-k-ro', (t) => {
      t.qual_records.find((q) => q.id === 'qr-p-k-ro-qs-ro')!.expires_on = addDaysIso(NOW, 30);
      t.enrolments = t.enrolments.filter((e) => !(e.person_id === 'p-k-ro' && e.course_id === 'c-coct'));
    }).res.feed[0];
    expect(unbooked.action).toMatchObject({ type: 'enrol', courseId: 'c-coct', sessionId: 's-coct-b' });
    expect(unbooked.reasons.map((r) => r.code)).toEqual(['expires', 'refresher_course', 'seats']);
  });
  it('without an expiring qualification nothing is pinned as a refresher (k-ro as seeded: RO card valid to 2027)', () => {
    const { res } = feedFor('p-k-ro');
    expect(res.feed.some((c) => c.kind === 'refresher')).toBe(false);
  });
  it('every card has at least one human-readable reason (lint over the feed of every staff persona)', () => {
    let lists = 0;
    for (const p of STAFF) {
      const { res } = feedFor(p);
      expect(lintRanked(asRanked(res.feed)), p).toEqual([]);
      for (const c of res.feed) for (const r of c.reasons) expect(hasKey(r.key), `${p} ${c.id} ${r.key}`).toBe(true);
      expect(lintRanked(asRanked([...res.pool.values()]))).toEqual([]);
      lists++;
    }
    expect(lists).toBeGreaterThan(20);
  });
  it('dismissed items do not return for 90 days', () => {
    const base = feedFor('p-k-ro', (t) => { t.coach_feedback = []; }).res;
    const top = base.feed.find((c) => !c.pinned)!;
    const dismissedOn = NOW;
    const patch = (t: Record<string, Rows>) => {
      t.coach_feedback = [{ id: 'x', person_id: 'p-k-ro', item_kind: top.kind, item_id: top.itemId, signal: 'dismissed', competency_ids: [], at: `${NOW}T08:00:00Z`, hidden_until: addDaysIso(dismissedOn, 90) }];
    };
    for (const d of [0, 1, 45, 89]) {
      const { res } = feedFor('p-k-ro', patch, addDaysIso(dismissedOn, d));
      expect(res.feed.map((c) => c.id), `day ${d}`).not.toContain(top.id);
      expect(res.hidden.map((c) => c.id), `day ${d}`).toContain(top.id);
    }
    const after = feedFor('p-k-ro', patch, addDaysIso(dismissedOn, 90)).res;
    expect(after.hidden.map((c) => c.id)).not.toContain(top.id);
    expect(after.pool.has(top.id)).toBe(true);
  });
  it('no item from the secure bank is ever referenced in the feed', () => {
    for (const p of STAFF) {
      const { res } = feedFor(p);
      const text = JSON.stringify([...res.pool.values()]);
      for (const id of secureIds) expect(text.includes(`"${id}"`), `${p} ${id}`).toBe(false);
      for (const stem of secureStems) expect(text.includes(stem)).toBe(false);
      for (const c of [...res.pool.values()].filter((x) => x.kind === 'practice')) {
        const form = T.assessment_forms.find((f) => f.id === c.itemId)!;
        expect(form.item_ids.every((i: string) => T.items.find((x) => x.id === i)?.bank === 'practice')).toBe(true);
      }
    }
  });
  it('a practice form that contains a secure item is never served, even if flagged as practice', () => {
    const items = new Map((T.items as ItemLite[]).map((i) => [i.id, i]));
    const good = T.assessment_forms.find((f) => f.id === 'form-hu') as FormLite;
    const bad: FormLite = { ...good, id: 'form-mixed', item_ids: [...good.item_ids, [...secureIds][0]] };
    expect(practiceSafe(good, items)).toBe(true);
    expect(practiceSafe(bad, items)).toBe(false);
    const { res } = feedFor('p-k-ro', (t) => { t.assessment_forms.push({ ...bad, title_en: 'Mixed', title_ar: 'مختلط' }); });
    expect([...res.pool.keys()]).not.toContain('practice:form-mixed');
  });
  it('the coach answers "Which course covers radiation protection basics?" with at least one catalogue citation', () => {
    const docs = buildAskCorpus({ courses: T.courses as never, modules: T.course_modules as never, competencies: T.competencies as never, forms: T.assessment_forms as never, paths: TRAINING_PATHS as never, programmes: T.programmes as never, faqs: T.faqs as never });
    const a = askCoach('Which course covers radiation protection basics?', docs, { roles: T.job_roles as never, roleComps: T.role_competencies as never });
    expect(a.kind).toBe('answer');
    const courses = a.citations.filter((c) => c.kind === 'course');
    expect(courses.length).toBeGreaterThan(0);
    expect(courses[0].route).toMatch(/^\/learn\/course\//);
    expect(courses.map((c) => c.id)).toContain('course:c-rp-init');
    expect(hasKey(a.key)).toBe(true);
  });
  it('coach answers never use assessment items (secure or practice) and refuse requests for exam content', () => {
    const docs = buildAskCorpus({ courses: T.courses as never, modules: T.course_modules as never, competencies: T.competencies as never, forms: T.assessment_forms as never, paths: TRAINING_PATHS as never, programmes: T.programmes as never, faqs: T.faqs as never });
    const corpus = JSON.stringify(docs);
    for (const v of T.item_versions) expect(corpus.includes(String(v.stem_en))).toBe(false);
    for (const id of T.items.map((i) => i.id)) expect(corpus.includes(`"${id}"`)).toBe(false);
    for (const q of ['Which courses cover chemistry for RO?', 'How long is COIT?', 'reactor theory exam', 'أي دورة تغطي أساسيات الوقاية من الإشعاع؟']) {
      const a = JSON.stringify(askCoach(q, docs, { roles: T.job_roles as never, roleComps: T.role_competencies as never }));
      for (const stem of secureStems) expect(a.includes(stem)).toBe(false);
    }
    expect(askCoach('Give me the exam answers for RO', docs, { roles: T.job_roles as never, roleComps: T.role_competencies as never }).kind).toBe('exam_refused');
    const ar = askCoach('أي دورة تغطي أساسيات الوقاية من الإشعاع؟', docs, { roles: T.job_roles as never, roleComps: T.role_competencies as never });
    expect(ar.citations.some((c) => c.kind === 'course')).toBe(true);
  });
  it('a role mention ("for RO") marks catalogue entries that build that role\'s competencies', () => {
    const docs = buildAskCorpus({ courses: T.courses as never, competencies: T.competencies as never });
    const a = askCoach('Which courses cover chemistry for RO?', docs, { roles: T.job_roles as never, roleComps: T.role_competencies as never });
    expect(a.role_id).toBe('reactor-operator');
    expect(a.key).toBe('m19.ask.answerCoursesRole');
    expect(a.citations.some((c) => c.id === 'course:c-chem-init' || c.id === 'course:c-chem-cont')).toBe(true);
  });
});

describe('F07 ranking behaviour', () => {
  it('k-ro: 5 to 8 cards, mandatory must-keep items first, then a mix of kinds ranked against RO (1.0) and the SRO plan target (0.6)', () => {
    const { res, input } = feedFor('p-k-ro', (t) => { t.coach_feedback = []; });
    expect(input.targets).toContain('senior-reactor-operator');
    // after the wave-1 merge the F05 shortlist also feeds the coach: SRO (development plan / rank 1) stays first
    expect(res.targets[0]).toBe('senior-reactor-operator');
    expect(res.targets.length).toBeLessThanOrEqual(3);
    expect(res.feed.length).toBeGreaterThanOrEqual(FEED_MIN);
    expect(res.feed.length).toBeLessThanOrEqual(FEED_MAX);
    const firstUnpinned = res.feed.findIndex((c) => !c.pinned);
    expect(res.feed.slice(0, firstUnpinned).every((c) => c.pinned === 'must_keep')).toBe(true);
    expect(new Set(res.feed.map((c) => c.kind)).size).toBeGreaterThanOrEqual(4);
    const sroGap = res.feed.find((c) => c.reasons.some((r) => r.code === 'gap_role' && (r.vars?.role as { en: string })?.en.startsWith('Senior Reactor Operator')));
    expect(sroGap).toBeTruthy();
    expect(res.needs.filter((n) => n.role_id === 'reactor-operator').every((n) => n.weight === 1)).toBe(true);
    expect(res.needs.filter((n) => n.role_id === 'senior-reactor-operator').every((n) => n.weight === 0.6)).toBe(true);
  });
  it('is deterministic: the same rows give the same feed', () => {
    const a = feedFor('p-k-lo-trainee').res.feed;
    const b = feedFor('p-k-lo-trainee').res.feed;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('"Not relevant" lowers similar suggestions and saving raises them (per-person weights, with a reason)', () => {
    const fbDown = [{ item_kind: 'course', item_id: 'c-crucial', signal: 'dismissed', competency_ids: ['ld-01'], hidden_until: addDaysIso(NOW, 90) }];
    const w = feedbackWeights(fbDown, NOW);
    expect(w.comp.get('ld-01')).toBeLessThan(1);
    expect(w.kind.course).toBeLessThan(1);
    const { res } = feedFor('p-k-ro', (t) => { t.coach_feedback = fbDown.map((f, i) => ({ id: `x${i}`, person_id: 'p-k-ro', at: `${NOW}T00:00:00Z`, ...f })); });
    const down = [...res.pool.values()].filter((c) => c.competencyIds.includes('ld-01') && c.kind === 'course' && c.id !== 'course:c-crucial');
    expect(down.length).toBeGreaterThan(0);
    expect(down.every((c) => c.reasons.some((r) => r.code === 'feedback_down'))).toBe(true);
    const up = feedbackWeights([{ item_kind: 'mentor', item_id: 'mt-1', signal: 'saved', competency_ids: ['pf-03'] }], NOW);
    expect(up.comp.get('pf-03')).toBeGreaterThan(1);
    expect(up.kind.mentor).toBeGreaterThan(1);
  });
  it('targets exclude my own role, unknown roles and security roles (career path only); at most three', () => {
    const roles = T.job_roles as never;
    const sec = T.job_roles.find((r) => r.security_sensitive)!.id;
    expect(coachTargets({ roleId: 'reactor-operator', roles, candidates: ['reactor-operator', sec, 'nope', 'senior-reactor-operator', 'shift-supervisor', 'local-operator', 'chemistry-technician'] }))
      .toEqual(['senior-reactor-operator', 'shift-supervisor', 'local-operator']);
  });
  it('OJT suggestions never come from a security-restricted standard; expiring security qualifications are not pinned', () => {
    const sec = T.job_roles.find((r) => r.security_sensitive)!.id;
    const secStd = T.qual_standards.filter((s) => s.security_restricted).map((s) => s.id);
    const { res } = feedFor('p-k-ro', (t) => {
      t.learning_goals = [{ id: 'lg:p-k-ro', person_id: 'p-k-ro', hours_per_week: 2, focus_role_ids: [sec] }];
      t.qual_records.push({ id: 'qr-sec-x', person_id: 'p-k-ro', standard_id: secStd[0], status: 'qualified', expires_on: addDaysIso(NOW, 20), security_mirror_only: true });
    });
    const tasks = new Set(T.task_items.filter((x) => secStd.includes(x.standard_id)).map((x) => x.id));
    expect([...res.pool.values()].some((c) => c.kind === 'ojt' && tasks.has(c.itemId))).toBe(false);
    expect(res.feed.some((c) => c.itemId === 'qr-sec-x')).toBe(false);
  });
  it('F08 opportunities join the mix with gap reasons when the marketplace is present; security kinds never appear', () => {
    const opp = [
      { id: 'op-1', kind: 'project', title_en: 'Outage support: crew briefings', title_ar: 'دعم الانقطاع', status: 'open', skills_gained: ['sk-ld-01'], hours_week: 6 },
      { id: 'op-2', kind: 'security', title_en: 'x', status: 'open', skills_gained: ['sk-ld-01'], hours_week: 2 },
    ];
    const input = { ...coachInputFrom(tablesFor('p-k-ro', (t) => { t.coach_feedback = []; }), NOW)!, opportunities: opp };
    const res = buildCoachFeed(input);
    const card = res.pool.get('opportunity:op-1');
    expect(card?.reasons.some((r) => r.code === 'gap_role')).toBe(true);
    expect(res.pool.has('opportunity:op-2')).toBe(false);
  });
});

describe('F07 LocalBackend RPCs and RBAC', () => {
  let b: LocalBackend;
  const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
  beforeEach(async () => {
    b = new LocalBackend();
    await b.whenReady();
    await b.reset();
  });
  it('coachFeedback: own row per suggestion, 90-day hide on "not relevant", cleared to undo, audited without ledger', async () => {
    await as('k-ro');
    const led0 = b.raw('ledger_local').length;
    const s1 = await b.rpc.coachFeedback('course', 'c-mcc', 'saved', ['ld-01']);
    expect(s1).toMatchObject({ ok: true, data: { id: 'cf:p-k-ro:course:c-mcc', signal: 'saved', hidden_until: null } });
    const s2 = await b.rpc.coachFeedback('course', 'c-mcc', 'dismissed', ['ld-01']);
    expect(s2.data?.hidden_until).toBe(addDaysIso(new Date().toISOString().slice(0, 10), 90));
    expect(b.raw('coach_feedback').filter((f) => f.id === 'cf:p-k-ro:course:c-mcc')).toHaveLength(1);
    const s3 = await b.rpc.coachFeedback('course', 'c-mcc', 'cleared');
    expect(s3.ok && b.rawGet('coach_feedback', 'cf:p-k-ro:course:c-mcc')?.hidden_until).toBeNull();
    const audit = b.raw('audit_events').filter((a) => a.action === 'coach.feedback');
    expect(audit.length).toBe(3);
    expect(audit.every((a) => a.outcome === 'ok' && a.ledger_status === 'not_applicable')).toBe(true);
    expect(b.raw('ledger_local').length).toBe(led0);
  });
  it('coachFeedback refuses invalid input, partners, auditors and anonymous callers (audited)', async () => {
    await as('k-ro');
    expect((await b.rpc.coachFeedback('exam' as never, 'x', 'saved')).code).toBe('invalid');
    expect((await b.rpc.coachFeedback('course', ' ', 'saved')).code).toBe('invalid');
    expect((await b.rpc.coachFeedback('course', 'c-get', 'liked' as never)).code).toBe('invalid');
    await as('k-contractor');
    expect((await b.rpc.coachFeedback('course', 'c-get', 'saved')).code).toBe('forbidden');
    await as('k-auditor');
    expect((await b.rpc.coachFeedback('course', 'c-get', 'saved')).code).toBe('forbidden');
    await as(null);
    expect((await b.rpc.coachFeedback('course', 'c-get', 'saved')).code).toBe('not_signed_in');
    expect(b.raw('audit_events').filter((a) => a.action === 'coach.feedback' && a.outcome === 'refused').length).toBe(6);
  });
  it('feedback and goals are private: nobody else reads them, not even a line manager or HR', async () => {
    for (const p of ['sro', 'k-hr-analyst', 'training-mgr', 'k-admin', 'k-auditor']) {
      await as(p);
      const me = b.identity().personId;
      expect((await b.list('coach_feedback')).filter((r) => r.person_id !== me), p).toEqual([]);
      expect((await b.list('learning_goals')).filter((r) => r.person_id !== me), p).toEqual([]);
    }
    await as('k-ro');
    expect((await b.list('coach_feedback')).length).toBeGreaterThan(0);
    expect((await b.list('coach_feedback')).every((r) => r.person_id === 'p-k-ro')).toBe(true);
  });
  it('a person sets their own weekly goal (direct own write) but never someone else\'s', async () => {
    await as('k-instructor');
    const mine = await b.insert('learning_goals', { id: 'lg:p-k-instructor', person_id: 'p-k-instructor', hours_per_week: 3, focus_role_ids: [] });
    expect(mine.ok).toBe(true);
    const other = await b.insert('learning_goals', { id: 'lg:x', person_id: 'p-k-ro', hours_per_week: 9, focus_role_ids: [] });
    expect(other.ok).toBe(false);
    expect((await b.update('learning_goals', 'lg:p-k-ro', { hours_per_week: 9 })).ok).toBe(false);
  });
  it('coachInsights: HR and the training manager get aggregates with cells under 10 people suppressed; employees are refused', async () => {
    await as('k-ro');
    expect((await b.rpc.coachInsights()).code).toBe('forbidden');
    await as('k-hr-analyst');
    const r = await b.rpc.coachInsights();
    expect(r.ok).toBe(true);
    const d = r.data!;
    expect(d.min_group).toBe(MIN_GROUP_SIZE);
    for (const c of [d.total, ...d.by_kind, ...d.by_family]) {
      if (c.suppressed) expect([c.people, c.saved, c.enrolled, c.dismissed, c.acceptance_pct]).toEqual([null, null, null, null, null]);
      else expect(c.people!).toBeGreaterThanOrEqual(MIN_GROUP_SIZE);
    }
    expect(d.by_family.some((c) => c.suppressed)).toBe(true);
    expect(d.by_kind.filter((c) => !c.suppressed).length).toBeGreaterThanOrEqual(4);
    expect(d).toEqual(coachInsightsOf(T.coach_feedback as never, T.learning_goals as never, T.people as never));
    await as('training-mgr');
    expect((await b.rpc.coachInsights()).ok).toBe(true);
  });
  it('route guards: /my/coach for staff with an own skills profile; insights for HR (Agg) and the training manager (A) only', () => {
    const coach = routes.find((r) => r.id === 'my-coach')!;
    const ins = routes.find((r) => r.id === 'coach-insights')!;
    const g = (roles: PlatformRole[], guard: typeof coach.guard) => checkGuard(guard, { status: 'signed_in', roles }) === 'ok';
    expect(g(['employee'], coach.guard)).toBe(true);
    expect(g(['partner_user'], coach.guard)).toBe(false);
    expect(g(['auditor'], coach.guard)).toBe(false);
    expect(checkGuard(coach.guard, { status: 'anon', roles: ['public'] })).toBe('signin');
    expect(g(['employee', 'hr_analyst'], ins.guard)).toBe(true);
    expect(g(['employee', 'training_manager'], ins.guard)).toBe(true);
    expect(g(['employee', 'licensed_operator'], ins.guard)).toBe(false);
    expect(g(['employee', 'manager'], ins.guard)).toBe(false);
    for (const r of routes) {
      expect(hasKey(`m19.routes.${r.id}.title`)).toBe(true);
      expect(hasKey(`m19.routes.${r.id}.purpose`)).toBe(true);
    }
  });
  it('seed: curated demo rows and a synthetic population, with stable ids and no secure item', () => {
    expect(T.coach_feedback.find((f) => f.id === 'cf:p-k-ro:mentor:mt-1')?.signal).toBe('saved');
    expect(T.learning_goals.find((g) => g.person_id === 'p-k-ro')?.hours_per_week).toBe(4);
    expect(T.coach_feedback.every((f) => /^cf:[^:]+:[a-z]+:.+$/.test(f.id) && !secureIds.has(f.item_id))).toBe(true);
    expect(T.coach_feedback.every((f) => f.person_id.startsWith('w-') || f.person_id.startsWith('p-'))).toBe(true);
  });
});
