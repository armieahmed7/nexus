/** FS41 CleanEnergyComp + FS42 energy-system integration pathway + FS43 ESG and GHG literacy for managers (FS wave E · E2, M32): one
 *  named test per acceptance criterion on the local path, plus the shared rules, RBAC, the seed, routes and i18n. The SQL path
 *  (kafaa_cec_comp/profile/level/stats = cec.ts, kafaa_cec_mine/kafaa_cec_stats = LocalBackend, RLS, grants, seed rows) is proved by
 *  scripts/validate/fs52-energy-transition.mjs (PGlite). */
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { publicTextIsClean } from '../../src/domain/future';
import { MIN_GROUP_SIZE } from '../../src/auth/policy';
import en from '../../src/i18n/m32.en.json';
import ar from '../../src/i18n/m32.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m32/routes';
import {
  CEC_AREAS, CEC_COUNT, GREENCOMP_AREA, PER_AREA, cecLevel, cecProfile, cecStats, competenceLevel, competenceProblems, frameworkProblems, pct1, targetProblems,
  type CecRow, type CecTargetRow, type LearningRef, type SkillName, type StateLite,
} from '../../src/modules/m32/cec';
import { FS43_HOUR_CAP, PROJECT_CLAIM, chainProblems, credentialRoute, quickRoute, trackHours, trackProblems, type ChainRow, type TrackRow } from '../../src/modules/m32/transition';
import { envelopeWeeks, resolvePathway } from '../../src/modules/m19/pathways';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = seed as unknown as { tables: Record<string, Row[]> };
const T = S.tables;
const comps = T.cec_competences as unknown as CecRow[];
const targets = T.cec_role_targets as unknown as CecTargetRow[];
const chains = T.value_chains as unknown as ChainRow[];
const tracks = T.transition_tracks as unknown as TrackRow[];
const names = new Map<string, SkillName>(T.skills.map((s) => [s.id, { id: s.id, name_en: s.name_en, name_ar: s.name_ar }]));
const content = { courses: T.courses, externals: T.external_resources, opportunities: T.opportunities, credentials: T.microcred_defs, fitness: T.fitness_areas ?? [], adaptive: T.adaptive_banks ?? [], tasks: T.performance_tasks ?? [] } as never;
const learningExists = (r: LearningRef) => {
  const tbl: Record<string, [string, string]> = { course: ['courses', 'id'], pathway: ['pathways', 'id'], external: ['external_resources', 'id'], adaptive: ['adaptive_banks', 'id'], task: ['performance_tasks', 'id'], credential: ['microcred_defs', 'code'], lane: ['horizon_lanes', 'id'], chain: ['value_chains', 'id'], academy: ['academies', 'id'], opportunity: ['opportunities', 'id'] };
  const [t, k] = tbl[r.kind] ?? ['', ''];
  return (T[t] ?? []).some((x) => x[k] === r.ref);
};
const st = (skill_id: string, level: number, basis: string, active = true): StateLite => ({ skill_id, level, basis, active });
const HTTPS = /^https:\/\/\S+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

describe('FS41 · each competence lists learning outcomes in EN and AR and cites GreenComp (acceptance 1)', () => {
  it('twelve competences, three per area, each with 2-4 outcomes in English and Arabic', () => {
    expect(comps.length).toBe(CEC_COUNT);
    for (const a of CEC_AREAS) expect(comps.filter((c) => c.area === a).length).toBe(PER_AREA);
    for (const c of comps) {
      expect(c.outcomes!.length).toBeGreaterThanOrEqual(2);
      for (const o of c.outcomes!) { expect(o.en.length).toBeGreaterThan(10); expect(o.ar).toMatch(/[؀-ۿ]/); }
    }
  });
  it('every competence cites GreenComp: its GreenComp area, the GREENCOMP benchmark and a JRC GreenComp source with an as-of date', () => {
    for (const c of comps) {
      expect(c.greencomp_area).toBe(GREENCOMP_AREA[c.area as keyof typeof GREENCOMP_AREA]);
      expect(c.benchmark_ids).toContain('GREENCOMP');
      expect(c.sources!.some((s) => s.url === 'https://joint-research-centre.ec.europa.eu/greencomp' && DATE.test(s.as_of ?? ''))).toBe(true);
    }
  });
  it('the check refuses a competence without Arabic outcomes or without its GreenComp citation', () => {
    const c = comps[0];
    expect(competenceProblems(c, T.skills as never, learningExists)).toEqual([]);
    expect(competenceProblems({ ...c, outcomes: c.outcomes!.map((o) => ({ ...o, ar: '' })) }, T.skills as never, learningExists)).toContain('outcomes');
    expect(competenceProblems({ ...c, sources: c.sources!.filter((s) => !/greencomp/i.test(`${s.url} ${s.label}`)) }, T.skills as never, learningExists)).toContain('greencomp');
  });
});

describe('FS41 · every competence links to at least one FS02 skill and one learning item (acceptance 2)', () => {
  it('each competence has an FS02 future skill and only existing, non-security skills', () => {
    for (const c of comps) {
      const sk = c.skill_ids.map((id) => T.skills.find((s) => s.id === id));
      expect(sk.every(Boolean)).toBe(true);
      expect(sk.some((s) => s!.fs_area)).toBe(true);
      expect(sk.every((s) => s!.area !== 'security')).toBe(true);
    }
  });
  it('each competence has at least one learning item and every item exists in its own table', () => {
    for (const c of comps) {
      expect(c.learning!.length).toBeGreaterThanOrEqual(1);
      for (const r of c.learning!) expect(learningExists(r), `${c.id} ${r.kind}:${r.ref}`).toBe(true);
    }
    expect(frameworkProblems(comps, T.skills as never, learningExists)).toEqual([]);
  });
  it('the check refuses a competence with no FS02 skill or a missing learning item', () => {
    const c = comps[0];
    expect(competenceProblems({ ...c, skill_ids: ['sk-sc-01'] }, T.skills as never, learningExists)).toContain('fs02');
    expect(competenceProblems({ ...c, learning: [{ kind: 'course', ref: 'c-nope', title_en: 'x y', title_ar: 'س ص' }] }, T.skills as never, learningExists)).toContain('learning');
  });
});

describe('FS41 · role targets exist for every job family, and public text passes publicTextIsClean (acceptance 3)', () => {
  it('one target per job family, level 1-3, existing focus competences, rationale in both languages', () => {
    const fams = T.job_families.map((f) => f.id as string);
    expect(targets.length).toBe(fams.length);
    expect(targetProblems(targets, fams, comps.map((c) => c.id))).toEqual([]);
    expect(targetProblems(targets.slice(1), fams, comps.map((c) => c.id))).toContain(`family:${targets[0].family_id}`);
  });
  it('all public CleanEnergyComp text (competences, targets, i18n strings) passes publicTextIsClean', () => {
    expect(publicTextIsClean(comps.map((c) => [c.name_en, c.name_ar, c.summary_en, c.summary_ar, c.plant_en, c.plant_ar, c.outcomes]))).toBe(true);
    expect(publicTextIsClean(targets.map((t) => [t.rationale_en, t.rationale_ar]))).toBe(true);
    expect(publicTextIsClean([en, ar])).toBe(true);
  });
  it('the framework is public read and its routes are public; progress is Own and the HR view Agg', () => {
    expect(routes.find((r) => r.id === 'skills-clean-energy')!.zone).toBe('public');
    expect(routes.find((r) => r.id === 'skills-clean-energy-competence')!.guard).toEqual({});
    expect(routes.find((r) => r.id === 'my-clean-energy')!.guard.grant).toEqual({ res: 'skills_profile', levels: ['Own'] });
    expect(routes.find((r) => r.id === 'workforce-clean-energy')!.guard.grant).toEqual({ res: 'skills_profile', levels: ['Agg'] });
  });
});

describe('FS41 · level rules: counted evidence only, overall = lowest area', () => {
  const c = comps.find((x) => x.id === 'cec-1-1')!;
  it('a competence level is the best counted state; self-ratings never count', () => {
    expect(competenceLevel(c, [st(c.skill_ids[0], 3, 'claimed')]).level).toBe(0);
    expect(competenceLevel(c, [st(c.skill_ids[0], 3, 'claimed')]).claimed).toEqual([c.skill_ids[0]]);
    expect(competenceLevel(c, [st(c.skill_ids[0], 1, 'validated'), st(c.skill_ids[1], 2, 'evidenced')]).level).toBe(2);
    expect(competenceLevel(c, [st(c.skill_ids[0], 4, 'verified')]).level).toBe(3);
    expect(competenceLevel(c, [st(c.skill_ids[0], 2, 'verified', false)]).level).toBe(0);
  });
  it('the overall level is the lowest area, so one empty area keeps it at 0; status compares it with the family target', () => {
    const one = CEC_AREAS.map((a) => comps.find((x) => x.area === a)!.skill_ids.find((id) => T.skills.find((s) => s.id === id)?.fs_area)!);
    const all2 = one.map((id) => st(id, 2, 'evidenced'));
    const p = cecProfile('p-x', 'engineering', comps, targets, all2, names);
    expect(p.level).toBe(Math.min(...p.areas.map((a) => a.level)));
    expect(p.level).toBeGreaterThanOrEqual(2);
    expect(p.status).toBe('met');
    const acting = new Set(comps.filter((x) => x.area === 'acting').flatMap((x) => x.skill_ids));
    const rich = comps.filter((x) => x.area !== 'acting').flatMap((x) => x.skill_ids).filter((id) => !acting.has(id)).map((id) => st(id, 2, 'evidenced'));
    const three = cecProfile('p-x', 'engineering', comps, targets, rich, names);
    expect(three.areas.filter((x) => x.level >= 2).length).toBe(3);
    expect(three.level).toBe(0);
    expect(three.status).toBe('none');
    expect(three.reasons.at(-1)!.key).toBe('m32.reason.levelNone');
    expect(cecLevel(comps, all2)).toBe(p.level);
    expect(cecProfile('p-x', null, comps, targets, all2, names).status).toBe('no_target');
  });
  it('grow next puts the family focus competences first and every view carries its reasons', () => {
    const p = cecProfile('p-x', 'operations', comps, targets, [], names);
    const focus = targets.find((t) => t.family_id === 'operations')!.focus_ids!;
    expect(p.grow.slice(0, focus.length).sort()).toEqual([...focus].sort());
    expect(p.competences.every((v) => v.reasons.length >= 1)).toBe(true);
    expect(p.competences.find((v) => v.focus)!.reasons.some((r) => r.key === 'm32.reason.focus')).toBe(true);
  });
  it('pct1 rounds half up to one decimal, as SQL round(x, 1)', () => {
    expect(pct1(1, 3)).toBe(33.3);
    expect(pct1(2, 3)).toBe(66.7);
    expect(pct1(46, 106)).toBe(43.4);
  });
});

describe('FS41 · cecMine (Own) and cecStats (Agg) on the LocalBackend', () => {
  it('my profile is my own counted states against my family target; anonymous gets null', async () => {
    await as('head-sustainability');
    const p = (await b.rpc.cecMine())!;
    expect(p.person_id).toBe('p-head-sustainability');
    const states = (b.raw('person_skills' as never) as unknown as Row[]).filter((s) => s.person_id === p.person_id && s.active) as StateLite[];
    expect(p).toEqual(cecProfile(p.person_id, 'corporate', comps, targets, states, names));
    expect(p.level).toBe(2);
    expect(p.status).toBe('met');
    await as('nse'); // FS wave F QA: k-ro now holds validated role-play evidence on two transversal skills (FS59), so a persona with no counted evidence is used
    const ro = (await b.rpc.cecMine())!;
    expect(ro.level).toBe(0);
    expect(ro.grow.length).toBeGreaterThan(0);
    await as(null);
    expect(await b.rpc.cecMine()).toBeNull();
  });
  it('the HR view needs skills_profile Agg, equals cecStats() and suppresses cells under ten', async () => {
    await as('k-ro');
    expect(await b.rpc.cecStats()).toBeNull();
    await as('chco');
    const v = (await b.rpc.cecStats())!;
    const by = new Map<string, StateLite[]>();
    for (const s of b.raw('person_skills' as never) as unknown as Row[]) if (s.active) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)!).push(s as StateLite);
    expect(v).toEqual(cecStats(b.raw('people' as never) as never, comps, targets, by, MIN_GROUP_SIZE));
    expect(v.staff).toBeGreaterThanOrEqual(100);
    expect(v.pct_l1).not.toBeNull();
    for (const l of v.by_level) expect(l.n === null || l.n >= MIN_GROUP_SIZE).toBe(true);
    for (const f of v.by_family) expect(f.n === null || f.n >= MIN_GROUP_SIZE).toBe(true);
    expect(v.by_family.map((f) => f.family_id).filter((f) => ['security', 'safeguards', 'cyber'].includes(f))).toEqual([]);
    expect(v.by_family.some((f) => f.n === null)).toBe(true);
  });
  it('stats with fewer than ten people show nothing but the head count', () => {
    const people = T.people.filter((p) => p.kind === 'staff' && p.status === 'active').slice(0, 9);
    const v = cecStats(people as never, comps, targets, new Map(), MIN_GROUP_SIZE);
    expect(v.staff).toBe(9);
    expect(v.pct_l1).toBeNull();
    expect(v.by_level.every((l) => l.n === null)).toBe(true);
  });
});

describe('FS42 · every fact carries a source and an as-of date (acceptance 1)', () => {
  const ctx = { skills: T.skills as never, lanes: T.horizon_lanes.map((l) => l.id), pathways: T.pathways.map((p) => p.id), cec: comps.map((c) => c.id), benchmarks: T.benchmarks.map((x) => x.id), today: '2026-10-11' };
  it('three value chains (hydrogen, process heat, grid); every fact has an https source, a label and an as-of date', () => {
    expect(chains.map((c) => c.id).sort()).toEqual(['vc-grid', 'vc-hydrogen', 'vc-process-heat']);
    for (const c of chains) {
      expect(c.facts.length).toBeGreaterThanOrEqual(2);
      for (const f of c.facts) { expect(f.url).toMatch(HTTPS); expect(f.label.length).toBeGreaterThan(5); expect(f.as_of).toMatch(DATE); expect(f.as_of <= '2026-10-11').toBe(true); }
      expect(chainProblems(c, ctx)).toEqual([]);
    }
  });
  it('every fact URL comes from the research packs (the FS41/FS42/FS43 source list), never an invented source', () => {
    const allowed = new Set(tracks.flatMap((t) => t.sources.map((s) => s.url)).concat(comps.flatMap((c) => c.sources!.map((s) => s.url))));
    for (const f of chains.flatMap((c) => c.facts)) expect(allowed.has(f.url), f.url).toBe(true);
  });
  it('the check refuses a fact without its as-of date or source', () => {
    const c = chains[0];
    expect(chainProblems({ ...c, facts: [{ ...c.facts[0], as_of: '' }, ...c.facts.slice(1)] }, ctx)).toContain('fact_source');
    expect(chainProblems({ ...c, facts: [{ ...c.facts[0], url: 'nope' }, ...c.facts.slice(1)] }, ctx)).toContain('fact_source');
  });
});

describe('FS42 · copy passes publicTextIsClean: no project or site claims (acceptance 2)', () => {
  it('chains, tracks, the two pathways and their steps pass publicTextIsClean and the project-claim check', () => {
    const pw = T.pathways.filter((p) => p.id.startsWith('pw-et-'));
    const steps = T.pathway_steps.filter((s) => s.pathway_id.startsWith('pw-et-'));
    const text = [chains.map((c) => [c.name_en, c.name_ar, c.summary_en, c.summary_ar, c.stages, c.facts.map((f) => [f.en, f.ar])]), tracks.map((t) => [t.summary_en, t.summary_ar, t.audience_en, t.audience_ar]),
      pw.map((p) => [p.title_en, p.title_ar, p.summary_en, p.summary_ar, p.outcome_en, p.outcome_ar]), steps.map((s) => [s.title_en, s.title_ar])];
    expect(publicTextIsClean(text)).toBe(true);
    expect(PROJECT_CLAIM.test(JSON.stringify(text))).toBe(false);
  });
  it('a project claim fails the chain check', () => {
    const c = chains[0];
    expect(PROJECT_CLAIM.test('ENEC will build a hydrogen plant at the site')).toBe(true);
    expect(chainProblems({ ...c, summary_en: 'ENEC will build a hydrogen plant next to the reactors to export fuel.' }, { skills: T.skills as never, lanes: T.horizon_lanes.map((l) => l.id), pathways: T.pathways.map((p) => p.id), cec: comps.map((x) => x.id), benchmarks: T.benchmarks.map((x) => x.id), today: '2026-10-11' })).toContain('clean');
  });
});

describe('FS42 · the pathway shows its envelope and weekly hours like every other pathway (acceptance 3)', () => {
  it('the FS42 pathway is a published FS17 pathway that passes pathwayProblems and fits its envelope', () => {
    const t = tracks.find((x) => x.feature === 'FS42')!;
    const p = T.pathways.find((x) => x.id === t.pathway_id)!;
    expect(p.status).toBe('published');
    expect(trackProblems(t, p as never, T.pathway_steps as never, T.skills as never)).toEqual([]);
    const h = trackHours(p as never, T.pathway_steps as never, null);
    expect(h.weeks).toBe(envelopeWeeks(6));
    expect(h.weekly_hours).toBe(2);
    expect(h.fits).toBe(true);
  });
  it('the pathway catalogue lists it with envelope, weekly hours and planned hours, and no requested step', async () => {
    await as('k-ro');
    const cat = (await b.rpc.pathwayCatalogue())!;
    for (const t of tracks) {
      const s = cat.pathways.find((p) => p.id === t.pathway_id)!;
      const h = trackHours(T.pathways.find((p) => p.id === t.pathway_id) as never, T.pathway_steps as never, null);
      expect(s).toMatchObject({ envelope_months: Number(T.pathways.find((p) => p.id === t.pathway_id)!.envelope_months), weekly_hours: h.weekly_hours, weeks: h.weeks, total_hours: h.total_hours, requested: 0 });
    }
  });
  it('awareness to practitioner with curated readings, a gig and the matching horizon lane', async () => {
    const t = tracks.find((x) => x.feature === 'FS42')!;
    const p = T.pathways.find((x) => x.id === t.pathway_id)!;
    expect(p.skill_id).toBe('sk-fs-gr-h2heat');
    expect(p.level).toBe(2);
    await as('k-ro');
    const det = (await b.rpc.pathwayDetail(p.id))!;
    const items = det.resolved.steps.flatMap((s) => s.items);
    expect(items.filter((i) => i.type === 'external').length).toBeGreaterThanOrEqual(3);
    expect(items.some((i) => i.type === 'opportunity')).toBe(true);
    expect(det.resolved.steps.every((s) => s.status === 'resolved')).toBe(true);
    expect(chains.every((c) => c.pathway_ids.includes(p.id) && c.lane_ids.length > 0 && c.lane_ids.every((l) => T.horizon_lanes.some((x) => x.id === l)))).toBe(true);
    const lanes = new Set(chains.flatMap((c) => c.lane_ids).map((l) => T.horizon_lanes.find((x) => x.id === l)!.code));
    for (const code of ['HZ-5', 'HZ-9', 'HZ-10']) expect(lanes.has(code)).toBe(true);
  });
  it('MC-H2-HEAT stays a draft: the FS42 track points at it but nothing publishes it', () => {
    expect(T.microcred_defs.filter((d) => d.code === 'MC-H2-HEAT').map((d) => d.status)).toEqual(['draft']);
  });
});

describe('FS43 · the pathway is completable in under 10 hours with a stated weekly cost (acceptance 1)', () => {
  const t = tracks.find((x) => x.feature === 'FS43')!;
  const p = T.pathways.find((x) => x.id === t.pathway_id)!;
  it('planned hours are under the 10-hour cap and fit the envelope at the stated weekly hours', () => {
    expect(Number(t.max_hours)).toBe(FS43_HOUR_CAP);
    const h = trackHours(p as never, T.pathway_steps as never, FS43_HOUR_CAP);
    expect(h.total_hours).toBeLessThan(10);
    expect(h.weekly_hours).toBe(1);
    expect(h.under_cap && h.fits).toBe(true);
    expect(trackProblems(t, p as never, T.pathway_steps as never, T.skills as never)).toEqual([]);
  });
  it('the quickest item in every step fits the step hours, so the route itself is under 10 hours', () => {
    const q = quickRoute(resolvePathway(p as never, T.pathway_steps as never, content));
    expect(q.all_fit).toBe(true);
    expect(q.planned).toBeLessThan(10);
  });
  it('the check refuses an FS43 track over the cap', () => {
    const steps = T.pathway_steps.map((s) => (s.pathway_id === p.id && s.n === 2 ? { ...s, hours: 9 } : s));
    expect(trackProblems({ ...t, max_hours: 10 }, { ...p, envelope_months: 6 } as never, steps as never, T.skills as never)).toContain('cap');
  });
});

describe('FS43 · all content is sourced (acceptance 2)', () => {
  it('the track and pathway cite sources; every item the pathway resolves to has an https source', () => {
    const t = tracks.find((x) => x.feature === 'FS43')!;
    expect(t.sources.every((s) => HTTPS.test(s.url) && DATE.test(s.as_of ?? ''))).toBe(true);
    const p = T.pathways.find((x) => x.id === t.pathway_id)!;
    expect(p.sources.length).toBeGreaterThanOrEqual(2);
    const res = resolvePathway(p as never, T.pathway_steps as never, content);
    const tbl: Record<string, string> = { course: 'courses', external: 'external_resources', adaptive: 'adaptive_banks', task: 'performance_tasks', opportunity: 'opportunities' };
    for (const it of res.steps.flatMap((s) => s.items)) {
      const row = T[tbl[it.type]].find((x) => x.id === it.id)!;
      const urls = [...(row.sources ?? []).map((s: Row) => s.url), ...(it.type === 'external' ? [row.url] : [])];
      expect(urls.length, `${it.type}:${it.id}`).toBeGreaterThan(0);
      expect(urls.every((u: string) => HTTPS.test(u))).toBe(true);
    }
  });
  it('the five new readings pass the FS18 catalogue criteria and carry an as-of date', () => {
    const xs = T.external_resources.filter((x) => x.id.startsWith('xr-et-'));
    expect(xs.length).toBe(5);
    for (const x of xs) { expect(x.url).toMatch(HTTPS); expect(x.as_of).toMatch(DATE); expect(x.criteria.relevance).toBeGreaterThanOrEqual(2); expect(x.criteria.standing).toBeGreaterThanOrEqual(2); expect(x.criteria.language).toBeGreaterThanOrEqual(2); }
  });
});

describe('FS43 · completion counts toward the matching micro-credential criteria (acceptance 3)', () => {
  it('every MC-CLEAN-ENERGY criterion is reached by a step of the pathway (adaptive check and GHG skill)', async () => {
    const t = tracks.find((x) => x.feature === 'FS43')!;
    expect(t.credential_code).toBe('MC-CLEAN-ENERGY');
    const def = T.microcred_defs.find((d) => d.code === 'MC-CLEAN-ENERGY' && d.status === 'current')!;
    await as('k-ro');
    const det = (await b.rpc.pathwayDetail(t.pathway_id))!;
    const route = credentialRoute(def.criteria, det.resolved, { courses: T.courses, adaptive: T.adaptive_banks, tasks: T.performance_tasks });
    expect(route.map((r) => r.key).sort()).toEqual(def.criteria.map((c: Row) => c.key).sort());
    expect(route.every((r) => r.covered)).toBe(true);
    expect(route.find((r) => r.kind === 'adaptive')!.via.some((v) => v.id === 'ab-clean-energy')).toBe(true);
  });
  it('a pathway without the assess step would not reach the credential', () => {
    const t = tracks.find((x) => x.feature === 'FS43')!;
    const p = T.pathways.find((x) => x.id === t.pathway_id)!;
    const res = resolvePathway(p as never, T.pathway_steps.filter((s) => !(s.pathway_id === p.id && s.kind === 'assess')) as never, content);
    const def = T.microcred_defs.find((d) => d.code === 'MC-CLEAN-ENERGY' && d.status === 'current')!;
    expect(credentialRoute(def.criteria, res, { courses: T.courses, adaptive: T.adaptive_banks, tasks: T.performance_tasks }).every((r) => r.covered)).toBe(false);
  });
});

describe('FS41-FS43 · seed, coupling, routes and i18n', () => {
  it('the four M32 tables exist with no person data; the FS17 gap backlog is unchanged (215 rows, 145 open)', () => {
    for (const t of ['cec_competences', 'cec_role_targets', 'value_chains', 'transition_tracks']) {
      expect(SCHEMA[t]).toBeTruthy();
      expect(Object.keys(SCHEMA[t].cols).filter((c) => /person_id/.test(c))).toEqual([]);
    }
    expect(T.pathway_gaps.length).toBe(215);
    expect(T.pathway_gaps.filter((g) => g.status === 'open').length).toBe(145);
  });
  it('the new courses and pathways carry FS30 credit tags like every other item', () => {
    for (const id of ['c-et-ghg-mgr', 'c-et-esg-clinic', 'pw-et-system-integration', 'pw-et-esg-managers']) expect(T.credit_tags.some((c) => JSON.stringify(c).includes(`"${id}"`)), id).toBe(true);
  });
  it('7 routes with their guards and benchmark chips from the feature cards', () => {
    expect(routes.map((r) => r.id).sort()).toEqual(['learn-energy-chain', 'learn-energy-transition', 'learn-esg-managers', 'my-clean-energy', 'skills-clean-energy', 'skills-clean-energy-competence', 'workforce-clean-energy']);
    for (const id of ['learn-energy-transition', 'learn-esg-managers', 'learn-energy-chain']) expect(routes.find((r) => r.id === id)!.guard.grant).toEqual({ res: 'internal_content', levels: ['R'] });
    expect(FEATURE_BENCHMARKS.FS41).toEqual(['GREENCOMP', 'WEF-FOJ', 'JAHIZ']);
    expect(FEATURE_BENCHMARKS.FS42).toEqual(['ENERGY-JOBS', 'NEA']);
    expect(FEATURE_BENCHMARKS.FS43).toEqual(['GREENCOMP', 'ISO30414', 'ENERGY-JOBS']);
  });
  it('every M32 text exists in English and Arabic, and every route has a title and purpose', () => {
    const flat = (o: Row, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
    const e = flat(en as Row);
    const a = new Set(flat(ar as Row));
    expect(e.length).toBeGreaterThan(250);
    expect(e.filter((k) => !a.has(k))).toEqual([]);
    for (const r of routes) { expect(e).toContain(`routes.${r.id}.title`); expect(e).toContain(`routes.${r.id}.purpose`); }
  });
});
