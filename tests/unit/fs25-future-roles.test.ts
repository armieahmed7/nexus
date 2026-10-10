/** FS15 Future roles in the Navigator and Roadmap + FS16 Role outlook labels (FS wave B · E5): one test per acceptance criterion
 * on the LocalBackend, plus RBAC, refusals, the pure rules and i18n coverage. The SQL mirrors are proven equal to these rules in
 * scripts/validate/fs25-future-roles.mjs (PGlite). */
import { readFileSync, readdirSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { careerFacts } from '../../src/modules/m18/career';
import { buildRoadmap, routeOptions, DEFAULT_SCENARIO, developmentBlocks, type RmEdge } from '../../src/modules/m18/roadmap';
import { conceptProfile, reqsOfVersion, cellOf, medianOf, MIN_GROUP, READY_SCORE, type ConceptVersion } from '../../src/modules/m18/futureRoles';
import { computeLabels, criteriaFor, labelReasons, outlookLabel, thresholdsOf, type Components, type CriteriaRow, type Thresholds } from '../../src/modules/m18/outlookLabels';
import { lintRanked } from '../../src/domain/engines/rank';
import { publicTextIsClean } from '../../src/domain/future';
import { rankConcepts } from '../../src/modules/m18/FutureRoles';
import { routes } from '../../src/modules/m18/routes';
import en from '../../src/i18n/m18.en.json';
import ar from '../../src/i18n/m18.ar.json';

type Row = Record<string, any>;
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const CONCEPTS = T.job_roles.filter((r) => r.lifecycle === 'concept').map((r) => r.id);
const SEC = T.job_roles.filter((r) => r.security_sensitive).map((r) => r.id);
const YEAR = new Date().getUTCFullYear();

let b: LocalBackend;
const as = async (p: string | null) => {
  b.setPersona(p);
  await b.whenReady();
};
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('FS15 acceptance', () => {
  it('persona k-ro can shortlist a concept role and build a roadmap to it (sent to the development plan)', async () => {
    await as('k-ro');
    const mine = await b.list('career_targets', { filter: { person_id: 'p-k-ro', active: true } });
    expect(mine).toHaveLength(3);
    // make room (a shortlist holds three), then shortlist the small BWR operator concept role
    expect((await b.update('career_targets', mine[2].id, { active: false })).ok).toBe(true);
    const ins = await b.insert('career_targets', { id: 'ct:p-k-ro:fr-bwr-operator', person_id: 'p-k-ro', role_id: 'fr-bwr-operator', rank: 3, shared: false, active: true } as never);
    expect(ins.ok).toBe(true);
    const now = await b.list('career_targets', { filter: { person_id: 'p-k-ro', active: true } });
    expect(now.map((x) => x.role_id)).toContain('fr-bwr-operator');
    // readiness against the FS05 profile, with my own bridge
    const r = await b.rpc.futureRoleReadiness('p-k-ro', ['fr-bwr-operator']);
    expect(r.ok).toBe(true);
    expect(r.data![0].bridge?.mine).toBe(true);
    // a roadmap: the route from my role ends in bridge learning and a "profile-ready" milestone, never a move
    const edges = (await b.list('career_paths')) as unknown as RmEdge[];
    const route = routeOptions(edges, 'reactor-operator', 'fr-bwr-operator')[0];
    expect(route.map((e) => e.id)).toEqual(['fp-reactor-operator--fr-bwr-operator']);
    const facts = careerFacts({ people: T.people, roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills, states: [], licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records, programmes: T.programmes, courses: T.courses, trainingRecords: T.training_records, enrolments: T.enrolments } as never, 'p-k-ro', '2026-10-10');
    const course = T.courses.find((c) => c.audience === 'staff')!;
    const rm = buildRoadmap({ now: '2026-10-10', roleId: 'reactor-operator', monthsInRole: facts.months_in_role, qualifiedInRole: facts.qualified_in_role, edges, roles: T.job_roles as never, programmes: T.programmes as never, gapCourses: [course as never], conceptRoles: CONCEPTS, bridgeMonths: r.data![0].gap_months }, { path: route.map((e) => e.id), ...DEFAULT_SCENARIO });
    const bridge = rm.blocks.find((x) => x.kind === 'bridge')!;
    expect(bridge.indicative).toBe(true);
    expect(bridge.months).toBe(Math.max(3, r.data![0].gap_months));
    const move = rm.blocks.find((x) => x.kind === 'move')!;
    expect(move.title.en).toContain('no vacancy, no deployment decision');
    expect(move.start).toBe(bridge.end);
    const id = 'rm-k-ro-fs15';
    expect((await b.insert('roadmaps', { id, person_id: 'p-k-ro', target_role_id: 'fr-bwr-operator', name: 'BWR concept', scenario: { path: route.map((e) => e.id), ...DEFAULT_SCENARIO }, plan: rm.blocks, end_on: rm.end, earliest_on: rm.earliest, shared: false, active: true } as never)).ok).toBe(true);
    const sent = await b.rpc.roadmapToPlan(id);
    expect(sent.ok).toBe(true);
    expect(sent.data!.created).toBe(developmentBlocks(rm).length);
    const plan = (await b.list('dev_plans')).find((p) => p.id === sent.data!.plan_id)!;
    expect(plan.target_role_id).toBe('fr-bwr-operator');
  });

  it('readiness uses the FS05 profile and shows its reasons', async () => {
    await as('k-ro');
    const r = await b.rpc.futureRoleReadiness('p-k-ro', null);
    expect(r.ok).toBe(true);
    expect(r.data!.map((x) => x.role_id).sort()).toEqual([...CONCEPTS].sort());
    const versions = T.role_profile_versions as unknown as ConceptVersion[];
    const states = b.raw('person_skills').filter((s) => s.person_id === 'p-k-ro' && s.active !== false);
    for (const x of r.data!) {
      const prof = conceptProfile(versions, x.role_id)!;
      expect(x.profile_id).toBe(prof.id);
      expect(x.horizon).toBe(prof.horizon);
      const reqs = reqsOfVersion(prof);
      expect(x.gaps.length).toBeLessThanOrEqual(reqs.length);
      // every gap is a requirement of that profile, with its own "why" line
      for (const g of x.gaps) expect(reqs.some((q) => q.kind === g.kind && q.ref_id === g.ref_id && q.level === g.need)).toBe(true);
      // a skill requirement nobody holds yet is an honest 0
      for (const g of x.gaps.filter((y) => y.kind === 'skill')) expect(g.have).toBe(Math.max(0, ...states.filter((s) => s.skill_id === g.ref_id).map((s) => s.level)));
      const profileReason = x.reasons.find((y) => y.code === 'fs15_profile')!;
      expect(profileReason.ref).toEqual({ table: 'role_profile_versions', id: prof.id });
      expect(x.reasons.some((y) => y.code === 'fs15_concept')).toBe(true);
      expect(x.band === 'profile_met').toBe(x.score >= READY_SCORE && x.months === 0);
    }
    expect(lintRanked(rankConcepts(r.data!))).toEqual([]);
    // ranking: concept roles bridged from my own role come first
    expect(rankConcepts(r.data!)[0].item!.bridge?.mine).toBe(true);
    // every reason key exists in both languages
    const has = (o: Row, key: string) => key.split('.').slice(1).reduce((a: any, k) => (a == null ? a : a[k]), o) != null;
    for (const x of r.data!) for (const y of x.reasons) if (y.key.startsWith('m18.')) { expect(has(en, y.key)).toBe(true); expect(has(ar, y.key)).toBe(true); }
  });

  it('transition counts under 10 are suppressed', async () => {
    await as('k-ro');
    const all: Row[] = [];
    for (const from of T.job_roles.filter((x) => x.lifecycle === 'current').map((x) => x.id)) {
      const r = await b.rpc.transitionEvidence(from, T.job_roles.map((x) => x.id));
      expect(r.ok).toBe(true);
      all.push(...r.data!);
    }
    expect(all.every((x) => x.suppressed ? x.n === null && x.median_months === null : x.n >= MIN_GROUP)).toBe(true);
    expect(all.filter((x) => x.analogue).every((x) => (x.analogue.suppressed ? x.analogue.n === null : x.analogue.n >= MIN_GROUP))).toBe(true);
    const pair = (f: string, t: string) => all.find((x) => x.from_role_id === f && x.to_role_id === t)!;
    expect(pair('local-operator', 'reactor-operator')).toMatchObject({ n: 26, suppressed: false });
    expect(pair('reactor-operator', 'operations-support-work-control')).toMatchObject({ n: 12, suppressed: false });
    expect(pair('local-operator', 'operations-support-work-control')).toMatchObject({ n: null, median_months: null, suppressed: true }); // 9 moves
    // the median is the real median of the mirror
    const ms = T.role_moves.filter((m) => m.from_role_id === 'local-operator' && m.to_role_id === 'reactor-operator').map((m) => m.months_before);
    expect(pair('local-operator', 'reactor-operator').median_months).toBe(medianOf(ms));
    // concept targets never carry a count; the closest family evidence is shown or suppressed by the same rule
    const bwr = pair('reactor-operator', 'fr-bwr-operator');
    expect(bwr).toMatchObject({ concept: true, n: null });
    expect(bwr.analogue).toMatchObject({ family_id: 'operations', suppressed: false });
    // security roles: path only
    for (const s of SEC) expect(all.filter((x) => x.to_role_id === s || x.from_role_id === s).every((x) => x.path_only && x.n === null)).toBe(true);
    expect(cellOf([1, 2, 3])).toEqual({ n: null, median_months: null, suppressed: true });
    expect(cellOf(Array.from({ length: 10 }, (_, i) => i + 1))).toEqual({ n: 10, median_months: 5.5, suppressed: false });
  });
});

describe('FS15 RBAC and refusals', () => {
  it('another person: refused unless a line manager in scope and the plans are shared; partners refused move evidence', async () => {
    await as('k-ro');
    expect((await b.rpc.futureRoleReadiness('p-k-lo-trainee', null)).code).toBe('forbidden');
    expect((await b.rpc.futureRoleReadiness('nobody', null)).code).toBe('not_found');
    await as(null);
    expect((await b.rpc.futureRoleReadiness('p-k-ro', null)).code).toBe('not_signed_in');
    expect((await b.rpc.transitionEvidence('reactor-operator', ['senior-reactor-operator'])).code).toBe('not_signed_in');
    await as('alnoor-gm');
    expect((await b.rpc.transitionEvidence('reactor-operator', ['senior-reactor-operator'])).code).toBe('forbidden');
    await as('sro');
    expect((await b.rpc.transitionEvidence('nope', ['x'])).code).toBe('not_found');
    // the move mirror is read by auditors only
    expect(await b.list('role_moves')).toHaveLength(0);
    await as('k-auditor');
    expect((await b.list('role_moves')).length).toBe(T.role_moves.length);
    // refusals are audited
    expect(b.raw('audit_events').filter((a) => a.action === 'career.future_readiness' && a.outcome === 'refused').length).toBeGreaterThanOrEqual(3);
  });

  it('a line manager or instructor in scope reads a report\'s concept readiness only when the report shares a plan (same rule as F05)', async () => {
    const results: [string, boolean, boolean][] = [];
    for (const p of ['sro', 'ops-ceo', 'training-mgr', 'k-instructor', 'outage-manager', 'chco']) {
      await as(p);
      const f15 = await b.rpc.futureRoleReadiness('p-k-ro', null);
      const f05 = await b.rpc.careerReadiness('p-k-ro', ['senior-reactor-operator']);
      results.push([p, f15.ok, f05.ok]);
    }
    expect(results.every(([, a, c]) => a === c)).toBe(true);
    expect(results.some(([, a]) => a)).toBe(true);
    expect(results.some(([, a]) => !a)).toBe(true);
    // once k-ro stops sharing, nobody else reads it
    await as('k-ro');
    for (const t of b.raw('career_targets').filter((x) => x.person_id === 'p-k-ro')) await b.update('career_targets', t.id, { shared: false, shared_person_id: null });
    for (const r of b.raw('roadmaps').filter((x) => x.person_id === 'p-k-ro')) await b.update('roadmaps', r.id, { shared: false, shared_person_id: null });
    for (const [p, ok] of results) if (ok) { await as(p); expect((await b.rpc.futureRoleReadiness('p-k-ro', null)).code).toBe('forbidden'); }
  });
});

describe('FS16 acceptance', () => {
  it('the criteria rows publish every threshold the rule uses, with precedence and sources', () => {
    const crit = T.role_outlook_criteria as unknown as (CriteriaRow & Row)[];
    expect(crit.map((c) => c.id)).toEqual(['olc-v1', 'olc-v2']);
    for (const c of crit) {
      const th = thresholdsOf(c);
      for (const k of ['growth_min_pct', 'shortfall_min_pct', 'change_min_pct', 'base_year', 'horizon_year'] as (keyof Thresholds)[]) expect(k in th).toBe(true);
      expect(c.sources.every((s: Row) => /^https:\/\//.test(s.url) && s.as_of)).toBe(true);
      expect(c.precedence![c.precedence!.length - 1]).toBe('stable');
      expect(publicTextIsClean([c.summary_en, c.summary_ar])).toBe(true);
    }
    const v2 = thresholdsOf(crit[1]);
    expect(v2).toMatchObject({ growth_min_pct: 5, shortfall_min_pct: 0, change_min_pct: 30 });
    // the 5% growth line is the sourced O*NET Bright Outlook figure
    const onet = T.benchmarks.find((x) => x.id === 'ONET')!;
    expect(onet.figures.find((f: Row) => f.key === 'bright_growth_threshold').value).toBe(v2.growth_min_pct);
    expect(criteriaFor(crit, 2025)!.id).toBe('olc-v1');
    expect(criteriaFor(crit, 2026)!.id).toBe('olc-v2');
  });

  it('labels reproduce exactly from the rule (every stored row, and today\'s inputs give this year\'s labels)', async () => {
    const crit = new Map((T.role_outlook_criteria as unknown as CriteriaRow[]).map((c) => [c.id, c]));
    const comps = new Map(T.role_outlook_components.map((c) => [c.id, c.components as Components]));
    for (const l of T.role_outlook_labels) expect(outlookLabel(comps.get(l.id)!, thresholdsOf(crit.get(l.criteria_id)!))).toBe(l.label);
    const released = T.skill_outlooks.find((o) => o.status === 'released')!;
    const now = computeLabels({ roles: T.job_roles as never, roleComps: T.role_competencies as never, skills: T.skills as never, outlook: { id: released.id, results: released.results }, versions: T.role_profile_versions as never }, crit.get('olc-v2')!, 2026);
    const stored2026 = T.role_outlook_labels.filter((l) => l.year === 2026);
    expect(now.map((r) => [r.role_id, r.label])).toEqual(stored2026.sort((a, b) => (a.id < b.id ? -1 : 1)).map((l) => [l.role_id, l.label]));
    expect(new Set(now.map((r) => r.label))).toEqual(new Set(['growing', 'changing', 'stable']));
    // the rule at its boundaries
    const th = thresholdsOf(crit.get('olc-v2')!);
    expect(outlookLabel({ growth_pct: 5, shortfall_pct: 0.1, change_pct: 29.9 }, th)).toBe('growing');
    expect(outlookLabel({ growth_pct: 5, shortfall_pct: 0, change_pct: 29.9 }, th)).toBe('stable');
    expect(outlookLabel({ growth_pct: 50, shortfall_pct: 50, change_pct: 30 }, th)).toBe('changing');
    expect(outlookLabel({ growth_pct: 4.9, shortfall_pct: 10, change_pct: null }, th)).toBe('stable');
    // under criteria v1 there is no change component
    expect(outlookLabel({ growth_pct: 1, shortfall_pct: 1, change_pct: 99 }, thresholdsOf(crit.get('olc-v1')!))).toBe('stable');
    // past years are kept; security and concept roles are not labelled
    expect([...new Set(T.role_outlook_labels.map((l) => l.year))].sort()).toEqual([2024, 2025, 2026]);
    expect(T.role_outlook_labels.some((l) => SEC.includes(l.role_id) || CONCEPTS.includes(l.role_id))).toBe(false);
    // every label explains itself with keys in both languages
    const has = (o: Row, key: string) => key.split('.').slice(1).reduce((a: any, k) => (a == null ? a : a[k]), o) != null;
    for (const l of T.role_outlook_labels.slice(0, 10)) for (const r of labelReasons(comps.get(l.id)!, thresholdsOf(crit.get(l.criteria_id)!), l.label)) { expect(has(en, r.key)).toBe(true); expect(has(ar, r.key)).toBe(true); }
  });

  it('no headcount appears on public payloads: anonymous visitors read labels and criteria only', async () => {
    await as(null);
    const labels = await b.list('role_outlook_labels');
    expect(labels).toHaveLength(75);
    expect(await b.list('role_outlook_components')).toHaveLength(0);
    expect(await b.list('role_moves')).toHaveLength(0);
    for (const l of labels) expect(Object.keys(l).sort()).toEqual(['archived', 'as_of', 'criteria_id', 'id', 'label', 'published_at', 'published_by_role', 'role_id', 'year']);
    const crit = await b.list('role_outlook_criteria');
    expect(publicTextIsClean(crit.flatMap((c) => [c.summary_en, c.summary_ar]))).toBe(true);
    // components are percentages, never people counts
    for (const c of T.role_outlook_components) expect(JSON.stringify(c.components)).not.toMatch(/demand"|supply"|headcount|people/);
    await as('k-ro');
    expect((await b.list('role_outlook_components')).length).toBe(75);
  });
});

describe('FS16 RPCs', () => {
  it('preview (training manager, HR director) and publish (HR director only; past years locked; audited and ledgered)', async () => {
    await as('k-ro');
    expect((await b.rpc.outlookLabelsPreview(YEAR)).code).toBe('forbidden');
    await as('training-mgr');
    const pv = await b.rpc.outlookLabelsPreview(YEAR);
    expect(pv.ok).toBe(true);
    expect(pv.data!.rows).toHaveLength(25);
    expect(pv.data!.counts.growing + pv.data!.counts.changing + pv.data!.counts.stable).toBe(25);
    expect((await b.rpc.outlookLabelsPreview(YEAR - 1)).code).toBe('invalid');
    expect((await b.rpc.publishOutlookLabels(YEAR)).code).toBe('forbidden');
    await as('chco');
    expect((await b.rpc.publishOutlookLabels(YEAR - 1)).code).toBe('past_year_locked');
    expect((await b.rpc.publishOutlookLabels(YEAR + 1)).code).toBe('invalid');
    const past = b.raw('role_outlook_labels').filter((l) => l.year < YEAR).map((l) => JSON.stringify(l));
    const led0 = b.raw('ledger_local').length;
    const pub = await b.rpc.publishOutlookLabels(YEAR);
    expect(pub.ok).toBe(true);
    expect(pub.data!.published).toBe(25);
    expect(b.raw('role_outlook_labels').filter((l) => l.year === YEAR)).toHaveLength(25);
    expect(b.raw('role_outlook_labels').filter((l) => l.year < YEAR).map((l) => JSON.stringify(l))).toEqual(past);
    const aud = b.raw('audit_events').filter((a) => a.action === 'outlook.publish');
    expect(aud.some((a) => a.outcome === 'ok' && a.actor_role === 'hr_director')).toBe(true);
    expect(aud.filter((a) => a.outcome === 'refused').length).toBeGreaterThanOrEqual(3);
    expect(b.raw('ledger_local').length).toBe(led0 + 1);
    // labels and components cannot be written directly
    expect((await b.insert('role_outlook_labels', { id: 'x', role_id: 'reactor-operator', year: YEAR, label: 'growing', criteria_id: 'olc-v2', as_of: '2026-10-10' } as never)).ok).toBe(false);
  });
});

describe('module wiring', () => {
  it('route, migration, validator and seed builder follow the PLAN naming; strings in EN and AR', () => {
    const r = routes.find((x) => x.id === 'careers-outlook-criteria')!;
    expect(r).toMatchObject({ path: '/careers/outlook-criteria', zone: 'public', guard: {} });
    expect(readdirSync('supabase/migrations')).toContain('20261010225001_kafaa_fs25_future_roles.sql');
    expect(readdirSync('scripts/validate')).toContain('fs25-future-roles.mjs');
    expect(readdirSync('scripts/seed/ext')).toContain('fs15-future-roles.mjs');
    const sql = readFileSync('supabase/migrations/20261010225001_kafaa_fs25_future_roles.sql', 'utf8');
    expect(sql).not.toMatch(/\bdrop\s|\bdelete\s+from|\btruncate\b|alter table (?!kafaa_)/i);
    expect(en.routes['careers-outlook-criteria'].title).toBeTruthy();
    expect(ar.routes['careers-outlook-criteria'].title).toBeTruthy();
    const nav = T.engine_cards.find((c) => c.id === 'navigator')!;
    expect(nav.scoring_functions).toContain('src/modules/m18/futureRoles.ts#conceptReadiness');
    expect(nav.inputs_used.map((x: Row) => x.key)).toEqual(expect.arrayContaining(['role_profile_versions', 'role_moves']));
  });
});
