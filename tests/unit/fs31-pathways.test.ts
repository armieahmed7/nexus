/** FS17 Future-skill learning pathways + FS18 Curated, outcome-gated external catalogue (FS wave C · E1, M19): one test per acceptance
 *  criterion on the local path, plus the rules shared with SQL, RBAC, the seed and i18n. The SQL path (TS = SQL parity for
 *  kafaa_pw_resolve / _progress / _peer / _problems and kafaa_xr_check; RLS; RPC flows) is scripts/validate/fs31-pathways.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import en from '../../src/i18n/m19.en.json';
import ar from '../../src/i18n/m19.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m19/routes';
import { lintRanked } from '../../src/domain/engines/rank';
import {
  catalogueCheck, courseTeaches, envelopeWeeks, pathwayProblems, pathwayProgress, peerStats, rankExternals, rankPathways, recordsOf, resolvePathway, weeksTaken,
  type Content, type RankInput, type SkillRef,
} from '../../src/modules/m19/pathways';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const content: Content = { courses: T.courses as never, externals: T.external_resources as never, opportunities: T.opportunities as never, credentials: T.microcred_defs as never, fitness: T.fitness_areas as never };
const skills = T.skills as unknown as SkillRef[];
const futureSkills = T.skills.filter((s) => s.fs_area && s.lifecycle !== 'obsolete' && s.area !== 'security');
const TODAY = new Date().toISOString().slice(0, 10);

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('FS17 · acceptance', () => {
  it('every future skill has an L1 pathway, and every pathway shows its envelope and weekly hours', async () => {
    await as('k-ro');
    const cat = await b.rpc.pathwayCatalogue();
    expect(cat).not.toBeNull();
    for (const s of futureSkills) expect(cat!.pathways.some((p) => p.skill_id === s.id && p.level === 1)).toBe(true);
    expect(cat!.pathways.length).toBeGreaterThanOrEqual(futureSkills.length);
    for (const p of cat!.pathways) {
      expect(p.envelope_months).toBeGreaterThanOrEqual(3);
      expect(p.envelope_months).toBeLessThanOrEqual(6);
      expect(p.weekly_hours).toBeGreaterThan(0);
      expect(p.total_hours).toBeLessThanOrEqual(p.weeks * p.weekly_hours);
    }
  });
  it('Coach cards for pathways carry reasons (lintRanked clean), and the 2030 profile ranks alongside today', () => {
    const pathways = T.pathways.filter((p) => p.status === 'published').map((p) => ({ ...p, requested: 0, peer: null })) as RankInput['pathways'];
    const input: RankInput = {
      pathways, skills, have: new Map([['sk-fs-ai-verify', 0]]), roleTitle: { en: 'Reactor operator', ar: 'مشغل المفاعل' },
      now: [{ kind: 'competency', ref_id: 'ld-02', level: 3 }], y2030: [{ kind: 'skill', ref_id: 'sk-fs-ai-verify', level: 2 }, { kind: 'competency', ref_id: 'da-01', level: 3 }],
      goals: ['sk-fs-gr-ghg'], weeklyGoal: 2, enrolled: new Map(),
    };
    const ranked = rankPathways(input);
    expect(ranked.length).toBeGreaterThan(0);
    expect(lintRanked(ranked)).toEqual([]);
    expect(ranked[0].id).toBe('pw-ai-verify-l1');
    expect(ranked[0].reasons[0].code).toBe('gap_2030');
    expect(rankPathways({ ...input, y2030: [], goals: [] }).every((r) => r.reasons.some((x) => x.code === 'today_role'))).toBe(true);
    expect(ranked.some((r) => r.reasons.some((x) => x.code === 'rising_2030'))).toBe(true);
    expect(ranked.some((r) => r.reasons.some((x) => x.code === 'my_goal'))).toBe(true);
    // only the next level I do not hold; nothing I hold; nothing I already follow
    expect(ranked.some((r) => r.id === 'pw-ai-verify-l2')).toBe(false);
    expect(rankPathways({ ...input, have: new Map([['sk-fs-ai-verify', 1]]) })[0].id).toBe('pw-ai-verify-l2');
    expect(rankPathways({ ...input, enrolled: new Map([['pw-ai-verify-l1', 'active']]) }).some((r) => r.id === 'pw-ai-verify-l1')).toBe(false);
    for (const r of ranked) for (const x of r.reasons) expect(x.key.startsWith('m19.pw.reasons.')).toBe(true);
    const picks = rankExternals(ranked, T.external_resources as never, skills);
    expect(lintRanked(picks)).toEqual([]);
    expect(picks.every((p) => p.reasons.some((r) => r.code === 'ext_external'))).toBe(true);
  });
  it("peer completion times under 10 are suppressed", async () => {
    const pw = 'pw-ai-use-l1';
    const done = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, pathway_id: pw, status: 'completed', started_on: '2026-01-05', completed_on: '2026-03-02' }));
    expect(peerStats(done(9), pw, 10)).toEqual({ started: null, completed: null, median_weeks: null, suppressed: true });
    expect(peerStats(done(10), pw, 10)).toEqual({ started: 10, completed: 10, median_weeks: 8, suppressed: false });
    await as('k-ro');
    const cat = await b.rpc.pathwayCatalogue();
    const vis = cat!.pathways.filter((p) => !p.peer.suppressed);
    expect(vis.length).toBeGreaterThan(0);
    expect(cat!.pathways.some((p) => p.peer.suppressed)).toBe(true);
    for (const p of cat!.pathways) {
      if (p.peer.suppressed) expect(p.peer.median_weeks).toBeNull();
      else expect(p.peer.completed!).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('FS17 · rules (mirrored by SQL)', () => {
  it('envelope weeks and weeks taken', () => {
    expect([3, 4, 5, 6].map(envelopeWeeks)).toEqual([13, 17, 22, 26]);
    expect(weeksTaken('2026-01-01', '2026-01-01')).toBe(1);
    expect(weeksTaken('2026-01-01', '2026-01-09')).toBe(2);
  });
  it('pathwayProblems checks skill, level, titles, envelope, weekly hours, steps, sequence, capacity and pins', () => {
    const p = T.pathways.find((x) => x.id === 'pw-ai-use-l1')!;
    const steps = T.pathway_steps.filter((s) => s.pathway_id === p.id);
    const ok = { ...p, steps };
    expect(pathwayProblems(ok, skills)).toEqual([]);
    expect(pathwayProblems({ ...ok, skill_id: 'sk-fs-dp-paperwp' }, skills)).toEqual(['skill']);
    expect(pathwayProblems({ ...ok, envelope_months: 7 }, skills)).toEqual(['envelope']);
    expect(pathwayProblems({ ...ok, weekly_hours: 0.25 }, skills)).toEqual(['weekly']);
    expect(pathwayProblems({ ...ok, steps: [steps[1], steps[0], steps[2]] }, skills)).toEqual(['sequence']);
    expect(pathwayProblems({ ...ok, steps: steps.map((s) => ({ ...s, hours: 20 })) }, skills)).toEqual(['over_envelope']);
    expect(pathwayProblems({ ...ok, steps: steps.map((s) => ({ ...s, pins: ['nope'] })) }, skills)).toEqual(['pins']);
    expect(pathwayProblems({}, skills)).toEqual(['skill', 'level', 'title', 'envelope', 'weekly', 'steps']);
  });
  it('steps resolve at run time: pins first, then any item teaching the skill at the level; nothing means "requested"', () => {
    const p = T.pathways.find((x) => x.id === 'pw-ai-verify-l1')!;
    const r = resolvePathway(p as never, T.pathway_steps as never, content);
    expect(r.steps.map((s) => s.kind)).toEqual(['learn', 'practice', 'assess']);
    expect(r.steps[0].items[0]).toMatchObject({ type: 'course', id: 'c-ai-gov', pinned: true });
    expect(r.steps[2].items.some((i) => i.type === 'fitness')).toBe(true);
    // a new course whose objective carries the skill and level is picked up with no code change (FS19 hand-off)
    const fsCourse = { id: 'c-test-ghg', code: 'T-1', title_en: 'GHG basics', title_ar: 'أساسيات غازات الدفيئة', modality: 'elearning', audience: 'staff', duration_hours: 4, objectives: [{ skill_id: 'sk-fs-gr-esg', level: 1 }] };
    expect(courseTeaches(fsCourse, 'sk-fs-gr-esg', 1)).toBe(true);
    const esg = T.pathways.find((x) => x.id === 'pw-gr-esg-l1')!;
    expect(resolvePathway(esg as never, T.pathway_steps as never, content).steps[0].status).toBe('requested');
    const after = resolvePathway(esg as never, T.pathway_steps as never, { ...content, courses: [...content.courses, fsCourse] });
    expect(after.steps[0]).toMatchObject({ status: 'resolved', items: [expect.objectContaining({ id: 'c-test-ghg', pinned: false })] });
  });
  it('the seeded gap backlog is exactly the requested steps of published pathways (FS57 feed)', () => {
    const req = T.pathways.filter((p) => p.status === 'published').flatMap((p) => resolvePathway(p as never, T.pathway_steps as never, content).steps.filter((s) => s.status === 'requested').map((s) => `pg:${s.step_id}`));
    expect(T.pathway_gaps.map((g) => g.id).sort()).toEqual(req.sort());
  });
  it('progress is derived from records; a self-declared external counts but is labelled', () => {
    const p = T.pathways.find((x) => x.id === 'pw-ai-use-l1')!;
    const r = resolvePathway(p as never, T.pathway_steps as never, content);
    const none = pathwayProgress(r, { courses: [], externals: [], opportunities: [], credentials: [], fitness: false });
    expect(none).toMatchObject({ done: 0, pct: 0, complete: false });
    const ext = r.steps[0].items.find((i) => i.external)!;
    const some = pathwayProgress(r, { courses: [], externals: [ext.id], opportunities: [], credentials: [], fitness: true });
    expect(some.steps[0]).toMatchObject({ done: true, self_declared: true });
    expect(some.self_declared).toBe(1);
    const verified = pathwayProgress(r, { courses: ['c-ai-gov'], externals: [ext.id], opportunities: [], credentials: [], fitness: true });
    expect(verified.steps[0]).toMatchObject({ done: true, self_declared: false, via: 'course:c-ai-gov' });
  });
});

describe('FS17 · RPCs (LocalBackend = SQL)', () => {
  it('start, refuse duplicates and drafts, refuse completion with open steps, leave; private rows', async () => {
    await as('sro');
    const target = (await b.rpc.pathwayCatalogue())!.pathways.find((p) => p.id === 'pw-gr-esg-l1')!;
    expect(target.mine).toBeNull();
    expect((await b.rpc.startPathway('pw-gr-esg-l1')).ok).toBe(true);
    expect((await b.rpc.startPathway('pw-gr-esg-l1')).code).toBe('already');
    expect((await b.rpc.startPathway('pw-ai-automation-l3')).code).toBe('not_found');
    expect((await b.rpc.completePathway('pw-gr-esg-l1')).code).toBe('steps_open');
    const det = await b.rpc.pathwayDetail('pw-gr-esg-l1');
    expect(det!.mine!.status).toBe('active');
    expect((await b.rpc.withdrawPathway('pw-gr-esg-l1', 'Outage season')).ok).toBe(true);
    expect((await b.list('pathway_enrolments' as never)).every((e: Row) => e.person_id === 'p-sro')).toBe(true);
  });
  it('three active pathways at most; a level I already hold is refused', async () => {
    await as('k-lo-trainee');
    const cat = (await b.rpc.pathwayCatalogue())!;
    const free = cat.pathways.filter((p) => !p.mine && p.level === 1);
    let n = (cat.pathways.filter((p) => p.mine === 'active')).length;
    let last = null as null | { code: string };
    for (const p of free) {
      const r = await b.rpc.startPathway(p.id);
      if (r.ok) n++;
      else if (r.code === 'too_many') { last = r; break; }
    }
    expect(n).toBe(3);
    expect(last?.code).toBe('too_many');
    const held = (T.person_skills as Row[]).find((s) => s.person_id === 'p-k-ro' && s.active && String(s.skill_id).startsWith('sk-fs-') && s.level >= 1)!;
    await as('k-ro');
    expect((await b.rpc.startPathway(`pw-${String(held.skill_id).replace('sk-fs-', '')}-l1`)).code).toBe('held');
  });
  it('only the training manager edits pathways; an edit bumps the version and keeps old steps', async () => {
    await as('sro');
    expect((await b.rpc.savePathway({})).code).toBe('forbidden');
    await as('training-mgr');
    const p = T.pathways.find((x) => x.id === 'pw-ai-use-l1')!;
    const steps = T.pathway_steps.filter((s) => s.pathway_id === p.id).map((s) => ({ kind: s.kind, title_en: s.title_en, title_ar: s.title_ar, hours: s.hours, pins: s.pins }));
    const bad = await b.rpc.savePathway({ ...p, steps, envelope_months: 2 });
    expect(bad.code).toBe('invalid');
    const r = await b.rpc.savePathway({ ...p, steps, status: 'published' });
    expect(r).toMatchObject({ ok: true, data: { id: p.id, version: 2 } });
    expect((b.raw('pathway_steps' as never) as Row[]).filter((s) => s.pathway_id === p.id).length).toBe(6);
    const g = await b.rpc.refreshPathwayGaps();
    expect(g.ok).toBe(true);
    expect(g.data!.open).toBe(T.pathway_gaps.length);
  });
  it('anonymous and partner users get no catalogue; staff never see drafts', async () => {
    await as(null);
    expect(await b.rpc.pathwayCatalogue()).toBeNull();
    await as('alnoor-gm');
    expect(await b.rpc.pathwayCatalogue()).toBeNull();
    await as('sro');
    expect((await b.list('pathways' as never)).some((p: Row) => p.status === 'draft')).toBe(false);
    expect(await b.rpc.pathwayDetail('pw-ai-automation-l3')).toBeNull();
    await as('training-mgr');
    expect(await b.rpc.pathwayDetail('pw-ai-automation-l3')).not.toBeNull();
  });
});

describe('FS18 · acceptance', () => {
  it('every external item cites its provider URL and an as-of date', () => {
    expect(T.external_resources.length).toBeGreaterThanOrEqual(10);
    for (const x of T.external_resources) {
      expect(x.provider_url).toMatch(/^https:\/\//);
      expect(x.url).toMatch(/^https:\/\//);
      expect(x.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(x.sources.length).toBeGreaterThan(0);
      expect(x.sources.every((s: Row) => /^https:\/\//.test(s.url))).toBe(true);
    }
  });
  it('items failing the criteria cannot be published (RPC refusal)', async () => {
    await as('training-mgr');
    const r = await b.rpc.publishExternalResource('xr-iaea-nuclear-security-elearning');
    expect(r).toMatchObject({ ok: false, code: 'criteria_failed' });
    expect(r.message).toContain('relevance');
    const ok = await b.rpc.publishExternalResource('xr-enen2plus');
    expect(ok.ok).toBe(true);
    await as('sro');
    expect((await b.rpc.publishExternalResource('xr-enen2plus')).code).toBe('forbidden');
    const chk = catalogueCheck(T.external_resources.find((x) => x.id === 'xr-iaea-nuclear-security-elearning')!, T.catalogue_criteria as never, skills, TODAY);
    expect(chk).toEqual({ ok: false, problems: [], failing: ['relevance'] });
  });
  it('self-declared completions are labelled and never become verified evidence', async () => {
    await as('sro');
    const before = (b.raw('skill_evidence' as never) as Row[]).filter((e) => e.person_id === 'p-sro').length;
    const states = JSON.stringify((b.raw('person_skills' as never) as Row[]).filter((e) => e.person_id === 'p-sro'));
    const r = await b.rpc.recordExternalCompletion({ resource_id: 'xr-uncclearn-climate', completed_on: TODAY, note: 'All six modules' });
    expect(r).toMatchObject({ ok: true, data: { evidence: 'self_declared' } });
    expect((await b.rpc.recordExternalCompletion({ resource_id: 'xr-uncclearn-climate', completed_on: TODAY })).code).toBe('duplicate');
    expect((await b.rpc.recordExternalCompletion({ resource_id: 'xr-enen2plus', completed_on: TODAY })).code).toBe('not_published');
    expect((await b.rpc.recordExternalCompletion({ resource_id: 'xr-elements-of-ai', completed_on: '2099-01-01' })).code).toBe('invalid');
    const st = (b.raw('xapi_statements' as never) as Row[]).find((s) => s.id === r.data!.statement_id)!;
    expect(st).toMatchObject({ verb: 'experienced', actor_person_id: 'p-sro', stored_by: 'p-sro', source: 'console' });
    expect(st.context.extensions['https://kafaa.example/xapi/ext/evidence']).toBe('self-declared');
    expect((b.raw('skill_evidence' as never) as Row[]).filter((e) => e.person_id === 'p-sro').length).toBe(before);
    expect(JSON.stringify((b.raw('person_skills' as never) as Row[]).filter((e) => e.person_id === 'p-sro'))).toBe(states);
    const rec = recordsOf('p-sro', { training_records: [], external_completions: b.raw('external_completions' as never) as Row[], opportunity_applications: [], microcred_awards: [], fitness_attempts: [] });
    expect(rec.externals).toContain('xr-uncclearn-climate');
    expect(rec.externalsVerified).toEqual([]);
  });
  it('external items show in pathways with the external flag', () => {
    const r = resolvePathway(T.pathways.find((p) => p.id === 'pw-gr-climaterisk-l1') as never, T.pathway_steps as never, content);
    expect(r.steps[0].items.some((i) => i.external && i.id === 'xr-uncclearn-climate')).toBe(true);
  });
});

describe('FS17/FS18 · wiring', () => {
  it('six routes with i18n titles in English and Arabic; guards as the RBAC lines', () => {
    const ids = ['learn-pathways', 'learn-pathway', 'my-pathways', 'training-pathways', 'learn-external', 'training-external'];
    for (const id of ids) {
      const r = routes.find((x) => x.id === id)!;
      expect(r).toBeTruthy();
      expect((en as Row).routes[id].title).toBeTruthy();
      expect((ar as Row).routes[id].title).toBeTruthy();
    }
    expect(routes.find((r) => r.id === 'my-pathways')!.guard).toMatchObject({ grant: { res: 'skills_profile', levels: ['Own'] } });
    expect(routes.find((r) => r.id === 'learn-pathways')!.guard).toMatchObject({ grant: { res: 'internal_content' } });
  });
  it('every reason code has EN and AR text', () => {
    const codes = ['gap_2030', 'rising_2030', 'today_role', 'my_goal', 'lifecycle_emerging', 'lifecycle_growing', 'next_level', 'fits_goal', 'over_goal', 'envelope', 'peers', 'requested', 'ext_for_skill', 'ext_free', 'ext_arabic', 'ext_external'];
    for (const c of codes) { expect((en as Row).pw.reasons[c]).toBeTruthy(); expect((ar as Row).pw.reasons[c]).toBeTruthy(); }
  });
});
