/** F08 Opportunity Marketplace (W1 · E4): every acceptance criterion on the local path, the match engine, the seed and i18n.
 *  The SQL path is checked by scripts/validate/w1e4-opportunities.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { lintRanked } from '../../src/domain/engines';
import { hasKey, translate } from '../../src/i18n';
import { matchOpportunities, NEED_LEVEL } from '../../src/modules/m20/match';
import { MIN_GROUP, OPP_KINDS, RESTRICTED_KINDS, cleanLevels, computeStats, lineManagerOf, releaserFor, validateOpportunity, type OpportunityInput } from '../../src/modules/m20/domain';
import { skillReasons } from '../../src/domain/skills';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const iso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const today = iso(0);
const base: OpportunityInput = {
  kind: 'project', title_en: 'Unit test project', title_ar: 'مشروع اختبار الوحدة', summary_en: 'A short synthetic project used by the unit tests.', summary_ar: 'مشروع اصطناعي قصير تستخدمه اختبارات الوحدة.',
  skills_needed: ['sk-hu-01'], skills_gained: ['sk-hu-02-brief', 'sk-ld-01-coach'], hours_week: 4, start_on: iso(1), end_on: iso(40), seats: 1, location_type: 'office', eligible_families: [], priority_flags: [], status: 'open',
};
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const audits = (action: string, outcome?: string) => b.raw('audit_events').filter((a) => a.action === action && (!outcome || a.outcome === outcome));

describe('F08 seed', () => {
  it('has 25 synthetic opportunities across all seven kinds, none restricted, posted by people who may post', () => {
    expect(T.opportunities).toHaveLength(25);
    expect(new Set(T.opportunities.map((o) => o.kind))).toEqual(new Set(OPP_KINDS));
    expect(T.opportunities.some((o) => RESTRICTED_KINDS.includes(o.kind) || o.location_type === 'protected_area')).toBe(false);
    const secSkills = new Set(T.skills.filter((s) => s.area === 'security').map((s) => s.id));
    expect(T.opportunities.some((o) => [...o.skills_needed, ...o.skills_gained].some((s: string) => secSkills.has(s)))).toBe(false);
    const posters = new Set(T.role_assignments.filter((r) => ['manager', 'training_manager'].includes(r.role) && r.status === 'active').map((r) => r.person_id));
    expect(T.opportunities.every((o) => posters.has(o.posted_by))).toBe(true);
    expect(T.opportunities.every((o) => o.seats_taken === T.opportunity_applications.filter((a) => a.opportunity_id === o.id && ['selected', 'completed'].includes(a.status)).length)).toBe(true);
  });
  it('every application is routed by the shared rule and covers every state of the flow', () => {
    expect(new Set(T.opportunity_applications.map((a) => a.status))).toEqual(new Set(['applied', 'released', 'declined_release', 'selected', 'not_selected', 'completed', 'withdrawn']));
    for (const a of T.opportunity_applications) {
      const o = T.opportunities.find((x) => x.id === a.opportunity_id);
      const r = releaserFor(a.person_id, o.posted_by, T.people, T.role_assignments, '2026-10-08');
      expect([a.releaser_id, a.skip_level], a.id).toEqual([r.releaser, r.skipLevel]);
      expect(a.releaser_id).not.toBe(a.poster_id);
    }
    expect(T.opportunity_applications.some((a) => a.skip_level)).toBe(true);
  });
  it('completed applications carry ojt evidence that the F03 passport state includes (k-ro)', () => {
    const done = T.opportunity_applications.filter((a) => a.status === 'completed');
    expect(done.length).toBeGreaterThanOrEqual(8);
    for (const a of done) for (const id of a.evidence_ids) expect(T.skill_evidence.find((e) => e.id === id && e.kind === 'ojt' && e.basis === 'evidenced'), id).toBeTruthy();
    const kro = T.person_skills.filter((s) => s.person_id === 'p-k-ro' && s.reasons.some((r: any) => r.code === 'ojt'));
    expect(kro.map((s) => s.skill_id).sort()).toEqual(['sk-hu-02-brief', 'sk-sc-02']);
    for (const s of kro) for (const r of skillReasons(s.reasons)) expect(hasKey(r.key), r.key).toBe(true);
  });
});

describe('F08 match engine', () => {
  const states = T.person_skills.filter((s) => s.person_id === 'p-k-ro');
  const run = (target: string | null = 'senior-reactor-operator', family = 'operations') =>
    matchOpportunities({ opps: T.opportunities.filter((o) => o.status !== 'draft'), states, skills: T.skills, roleComps: T.role_competencies, currentRole: 'reactor-operator', targetRole: target, family });
  it('every card carries reasons with i18n keys in English and Arabic (lintRanked)', () => {
    const r = run();
    expect(r).toHaveLength(24);
    expect(lintRanked(r)).toEqual([]);
    for (const x of r) for (const reason of x.reasons) {
      expect(hasKey(reason.key), reason.key).toBe(true);
      expect(translate('ar', reason.key)).not.toBe(translate('en', reason.key));
    }
  });
  it('is deterministic, bounded 0..1, and ranks eligible opportunities first', () => {
    const a = run(), c = run();
    expect(a.map((x) => [x.id, x.score])).toEqual(c.map((x) => [x.id, x.score]));
    expect(a.every((x) => x.score >= 0 && x.score <= 1)).toBe(true);
    const firstIneligible = a.findIndex((x) => !x.item!.eligible);
    if (firstIneligible >= 0) expect(a.slice(firstIneligible).every((x) => !x.item!.eligible)).toBe(true);
    expect(a.find((x) => x.id === 'opp-rp-dose-desk')!.item!.eligible).toBe(true);
    expect(run(null, 'corporate').find((x) => x.id === 'opp-sim-scenario-pilot')!.item!.eligible).toBe(false);
  });
  it('skills fit is the projection of my levels on the needed vector; development rewards gaps; the target role adds a bonus', () => {
    const opp = { id: 'x', skills_needed: ['sk-a', 'sk-b'], skills_gained: ['sk-c'], eligible_families: [] };
    const skills = ['sk-a', 'sk-b', 'sk-c'].map((id) => ({ id, competency_id: id.replace('sk-', 'c-'), core: true, key_level: 2, name_en: id, name_ar: id }));
    const rc = [{ role_id: 'r1', competency_id: 'c-c', required_level: 3 }, { role_id: 't1', competency_id: 'c-a', required_level: 3 }];
    const m = (lv: Record<string, number>, target: string | null = null) => matchOpportunities({ opps: [opp], states: Object.entries(lv).map(([skill_id, level]) => ({ skill_id, level })), skills, roleComps: rc, currentRole: 'r1', targetRole: target })[0];
    expect(m({ 'sk-a': NEED_LEVEL, 'sk-b': NEED_LEVEL }).item!.skills).toBe(1);
    expect(m({ 'sk-a': NEED_LEVEL }).item!.skills).toBe(0.5);
    expect(m({ 'sk-a': 1, 'sk-b': 1 }).item!.skills).toBe(0.5);
    expect(m({}).item!.skills).toBe(0);
    expect(m({}).item!.development).toBe(1); // sk-c: 0 -> 3 needed by the current role, a gap of 2+ counts fully
    expect(m({ 'sk-c': 3 }).item!.development).toBe(0);
    expect(m({}, 't1').item!.target).toBeGreaterThan(0);
    expect(m({}, 't1').reasons.some((r) => r.code === 'target')).toBe(true);
  });
});

describe('F08 rules', () => {
  const skills = T.skills;
  const fams = T.job_families.map((f) => f.id);
  it('refuses security, cyber, safeguards and protected-area work, and security-area skills', () => {
    for (const kind of ['security', 'protected_area', 'cyber', 'safeguards']) expect(validateOpportunity({ ...base, kind }, skills, fams, today)?.code).toBe('restricted_kind');
    expect(validateOpportunity({ ...base, location_type: 'protected_area' }, skills, fams, today)?.code).toBe('restricted_kind');
    expect(validateOpportunity({ ...base, skills_gained: ['sk-sa-01'] }, skills, fams, today)?.code).toBe('restricted_kind');
    expect(validateOpportunity(base, skills, fams, today)).toBeNull();
    expect(validateOpportunity({ ...base, hours_week: 30 }, skills, fams, today)?.code).toBe('invalid');
    expect(validateOpportunity({ ...base, skills_gained: [] }, skills, fams, today)?.code).toBe('invalid');
    expect(validateOpportunity({ ...base, start_on: iso(-1) }, skills, fams, today)?.code).toBe('invalid');
  });
  it('routes the release to the line manager, or skip-level when the line manager is the poster', () => {
    expect(lineManagerOf('p-k-ro', T.people, T.role_assignments, today)).toBe('p-sro');
    expect(lineManagerOf('w-rp-01', T.people, T.role_assignments, today)).toBe('p-rp-lead');
    expect(releaserFor('p-k-ro', 'p-training-mgr', T.people, T.role_assignments, today)).toEqual({ lineManager: 'p-sro', releaser: 'p-sro', skipLevel: false });
    expect(releaserFor('p-k-ro', 'p-sro', T.people, T.role_assignments, today)).toEqual({ lineManager: 'p-sro', releaser: 'p-ops-ceo', skipLevel: true });
  });
  it('sign-off levels: only skills gained, 0..3, at least one', () => {
    expect(cleanLevels({ a: 2, b: 0 }, ['a', 'b'])).toEqual({ a: 2 });
    expect(cleanLevels({ a: 4 }, ['a'])).toBeNull();
    expect(cleanLevels({ z: 2 }, ['a'])).toBeNull();
    expect(cleanLevels({ a: 0 }, ['a'])).toBeNull();
  });
});

describe('F08 acceptance (local backend)', () => {
  it('an opportunity of kind security or protected_area cannot be created (refused and audited)', async () => {
    await as('training-mgr');
    const before = b.raw('opportunities').length;
    const r1 = await b.rpc.postOpportunity({ ...base, kind: 'security' });
    const r2 = await b.rpc.postOpportunity({ ...base, kind: 'protected_area' });
    expect([r1.code, r2.code]).toEqual(['restricted_kind', 'restricted_kind']);
    expect(b.raw('opportunities')).toHaveLength(before);
    expect(audits('opportunity.post', 'refused').filter((a) => String(a.reason).startsWith('restricted_kind'))).toHaveLength(2);
    await as('k-ro');
    expect((await b.rpc.postOpportunity(base)).code).toBe('forbidden');
  });

  it("the applicant's own manager must release before the poster can select (release_required); the poster cannot release (maker_checker)", async () => {
    await as('training-mgr');
    const post = await b.rpc.postOpportunity(base);
    expect(post.ok).toBe(true);
    const id = post.data!.id;
    await as('k-ro');
    const app = await b.rpc.applyOpportunity(id, 'Keen to help');
    expect(app.ok).toBe(true);
    expect(app.data).toMatchObject({ releaser_id: 'p-sro', skip_level: false });
    expect((await b.rpc.applyOpportunity(id, '')).code).toBe('conflict');
    await as('training-mgr');
    expect((await b.rpc.selectApplicant(app.data!.id, 'selected')).code).toBe('release_required');
    expect((await b.rpc.releaseDecision(app.data!.id, 'release')).code).toBe('maker_checker');
    await as('ops-ceo');
    expect((await b.rpc.releaseDecision(app.data!.id, 'release')).code).toBe('not_found');
    await as('sro');
    expect((await b.rpc.releaseDecision(app.data!.id, 'decline', '')).code).toBe('invalid');
    expect((await b.rpc.releaseDecision(app.data!.id, 'release', 'Fine with two days a week')).ok).toBe(true);
    await as('training-mgr');
    const sel = await b.rpc.selectApplicant(app.data!.id, 'selected');
    expect(sel.ok && sel.data!.filled).toBe(true);
    expect(sel.ledger_seq).not.toBeNull();
    expect(b.rawGet('opportunities', id)!.status).toBe('filled');
    expect(b.raw('notifications').some((n) => n.person_id === 'p-k-ro' && n.id.endsWith('-selected'))).toBe(true);
  });

  it('a poster cannot release their own direct report onto their own opportunity (maker_checker): the skip-level manager decides', async () => {
    await as('sro');
    const id = (await b.rpc.postOpportunity({ ...base, eligible_families: ['operations'] })).data!.id;
    await as('k-ro');
    const app = await b.rpc.applyOpportunity(id, '');
    expect(app.data).toMatchObject({ releaser_id: 'p-ops-ceo', skip_level: true });
    await as('sro');
    expect((await b.rpc.releaseDecision(app.data!.id, 'release')).code).toBe('maker_checker');
    await as('ops-ceo');
    expect((await b.rpc.releaseDecision(app.data!.id, 'release')).ok).toBe(true);
    await as('sro');
    expect((await b.rpc.selectApplicant(app.data!.id, 'selected')).ok).toBe(true);
  });

  it("completion sign-off adds an ojt evidence row and the applicant's F03 passport shows it", async () => {
    await as('training-mgr');
    const id = (await b.rpc.postOpportunity(base)).data!.id;
    await as('k-ro');
    const appId = (await b.rpc.applyOpportunity(id, '')).data!.id;
    await as('sro');
    await b.rpc.releaseDecision(appId, 'release');
    await as('training-mgr');
    await b.rpc.selectApplicant(appId, 'selected');
    expect((await b.rpc.completeOpportunity(appId, { 'sk-pf-01': 2 }, 'Done')).code).toBe('invalid');
    expect((await b.rpc.completeOpportunity(appId, { 'sk-ld-01-coach': 3 }, '')).code).toBe('invalid');
    const done = await b.rpc.completeOpportunity(appId, { 'sk-ld-01-coach': 3, 'sk-hu-02-brief': 0 }, 'Ran two capture interviews');
    expect(done.ok).toBe(true);
    expect(done.data!.evidence_ids).toEqual([`se:ojt:${appId}:sk-ld-01-coach`]);
    expect(done.ledger_seq).not.toBeNull();
    await as('k-ro');
    const ev = await b.list('skill_evidence', { filter: { ref_id: appId } });
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ kind: 'ojt', basis: 'evidenced', level: 3, person_id: 'p-k-ro' });
    const state = (await b.list('person_skills', { filter: { person_id: 'p-k-ro', skill_id: 'sk-ld-01-coach' } }))[0];
    expect(state.reasons.some((r: any) => r.code === 'ojt' && r.evidence_id === ev[0].id)).toBe(true);
    expect(state.level).toBeGreaterThanOrEqual(3);
    expect((await b.list('opportunity_applications', { filter: { id: appId } }))[0].status).toBe('completed');
  });

  it('match reasons on every card, and HR aggregates (applications by family) are suppressed below 10', async () => {
    await as('k-hr-analyst');
    const s = (await b.rpc.opportunityStats())!;
    expect(s.min_group).toBe(MIN_GROUP);
    expect(s.by_family.some((f) => f.suppressed && f.applicants === null && f.applications === null)).toBe(true);
    expect(s.by_family.every((f) => f.suppressed || (f.applicants ?? 0) >= 10)).toBe(true);
    expect(s.by_family.find((f) => f.family_id === 'operations')).toMatchObject({ suppressed: false });
    expect(computeStats([], [{ person_id: 'a', status: 'applied', applicant_family_id: 'x' }], 0).funnel.suppressed).toBe(true);
    expect(await b.list('opportunity_applications')).toHaveLength(0);
    await as('k-ro');
    expect(await b.rpc.opportunityStats()).toBeNull();
  });

  it('row access: drafts stay with their poster; staff read only their own applications; saves are private', async () => {
    await as('k-ro');
    const opps = await b.list('opportunities');
    expect(opps.some((o) => o.status === 'draft')).toBe(false);
    expect((await b.list('opportunity_applications')).every((a) => a.person_id === 'p-k-ro')).toBe(true);
    expect((await b.list('opportunity_saves')).every((s) => s.person_id === 'p-k-ro')).toBe(true);
    await as('sro');
    expect((await b.list('opportunities')).some((o) => o.status === 'draft' && o.posted_by === 'p-sro')).toBe(true);
    expect((await b.list('opportunity_applications')).every((a) => [a.person_id, a.poster_id, a.releaser_id, a.line_manager_id].includes('p-sro'))).toBe(true);
    await as('alnoor-gm');
    expect(await b.list('opportunities')).toHaveLength(0);
    await as('k-auditor');
    expect(await b.list('opportunity_applications')).toHaveLength(T.opportunity_applications.length);
  });

  it('withdraw, save and close behave and are audited', async () => {
    await as('k-ro');
    const app = T.opportunity_applications.find((a) => a.person_id === 'p-k-ro' && a.status === 'applied');
    expect((await b.rpc.withdrawOpportunityApplication(app.id)).ok).toBe(true);
    expect((await b.rpc.withdrawOpportunityApplication(app.id)).code).toBe('invalid');
    expect((await b.rpc.saveOpportunity('opp-fire-drill-reviews', true)).ok).toBe(true);
    expect((await b.list('opportunity_saves')).some((s) => s.opportunity_id === 'opp-fire-drill-reviews' && s.saved)).toBe(true);
    expect((await b.rpc.saveOpportunity('opp-crewb-procedure-usability', true)).code).toBe('not_found'); // someone else's draft
    expect((await b.rpc.setOpportunityStatus('opp-u3-outage-valve-walkdowns', 'closed')).code).toBe('forbidden');
    await as('outage-manager');
    expect((await b.rpc.setOpportunityStatus('opp-u3-outage-valve-walkdowns', 'closed')).ok).toBe(true);
    expect(b.raw('opportunity_applications').filter((a) => a.opportunity_id === 'opp-u3-outage-valve-walkdowns' && ['applied', 'released'].includes(a.status))).toHaveLength(0);
    expect(audits('opportunity.withdraw').length + audits('opportunity.save').length + audits('opportunity.status').length).toBeGreaterThanOrEqual(5);
  });
});
