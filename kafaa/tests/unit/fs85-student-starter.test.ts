// @vitest-environment jsdom
/** FS77 Student future-skills starter and intake baselines (FS wave H · E5, M06): one named test per acceptance criterion on the local
 *  path, plus the rules shared with SQL, RBAC, the seed, routes and i18n. The SQL path (kafaa_ib_problem / clean / for, kafaa_ip_compute /
 *  problem / joiners = TS; RLS; RPC flows in a rolled-back transaction; grants; additivity) is checked by
 *  scripts/validate/fs85-student-starter.mjs (PGlite). The anonymous "stores nothing" spy tests live in fs85-pages.test.tsx and
 *  w5e3-pages.test.tsx (A2, extended). */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m06.en.json';
import ar from '../../src/i18n/m06.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m06/routes';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { publicTextIsClean } from '../../src/domain/future';
import { todayIso } from '../../src/domain/rules';
import {
  HEADCOUNT_OR_SITE, baselineFor, baselineProblem, cleanEntries, inductionPlan, joinerCandidates, lessonProblem, planProblem, planStale, sourcesOf,
  starterKey, starterProgress, starterTextIsClean, type BaselineRow, type InductionModule, type StarterLesson,
} from '../../src/modules/m06/starter';
import { HEADCOUNT_OR_SITE as FUTURE_PATTERN } from '../../src/domain/future';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = seed as unknown as { tables: Record<string, Row[]> };
const T = S.tables;
const MODS = T.induction_modules as unknown as InductionModule[];
const BASES = T.intake_baselines as unknown as BaselineRow[];
const LESSONS = T.starter_lessons as unknown as StarterLesson[];
const AR = /[؀-ۿ]/;
const flat = (o: Row, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => b.raw(t as never) as unknown as Row[];
beforeEach(async () => {
  try { localStorage.clear(); } catch { /* ignore */ }
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

const draft27 = BASES.find((x) => x.status === 'draft')!;
const inp27 = { intake_year: 2027, programme: 'all', entries: draft27.entries as never, note_en: 'Draft for 2027', note_ar: 'مسودة 2027' };

describe('FS77 acceptance', () => {
  it('FS77 acceptance: all facts cite sources (every starter lesson has https sources with an as-of date; secondary ones flagged)', () => {
    expect(LESSONS.length).toBe(8);
    for (const l of LESSONS) {
      expect(lessonProblem(l)).toBeNull();
      const src = sourcesOf(l);
      expect(src.length).toBeGreaterThan(0);
      for (const s of src) {
        expect(s.url).toMatch(/^https:\/\//);
        expect(s.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
    // sources the research packs mark secondary (or news reports) carry the flag; the verified NEA Plan 2035 and the official DGE page do not
    const all = LESSONS.flatMap((l) => sourcesOf(l));
    expect(all.find((s) => s.url.includes('gcedclearinghouse'))?.secondary).toBe(true);
    expect(all.find((s) => s.url.includes('middleeastainews'))?.secondary).toBe(true);
    expect(all.find((s) => s.url.includes('oecd-nea.org'))?.secondary).toBeFalsy();
    expect(all.find((s) => s.url.includes('dge.gov.ae'))?.secondary).toBeFalsy();
    // published baselines that claim a national-curriculum basis cite an https source too
    for (const bl of BASES) for (const e of bl.entries as Row[]) if (e.basis === 'national_curriculum') expect(e.source_url).toMatch(/^https:\/\//);
    // every source URL comes from the research packs
    const packs = ['corporate_platforms', 'global_frameworks', 'national_systems', 'nuclear_energy'].map((f) => readFileSync(`../docs/kafaa/ref/research/${f}.md`, 'utf8')).join('\n');
    for (const s of all) expect(packs.includes(s.url.replace(/\/$/, ''))).toBe(true);
  });

  it('FS77 acceptance: induction plans read the baseline for the joiner\'s intake year (programme first, then all programmes; none = full)', async () => {
    await as('k-hr-analyst');
    const r27 = await b.rpc.buildInductionPlan({ person_id: 'ap-054', programme: 'dnt', intake_year: 2027 });
    expect(r27.ok).toBe(true);
    expect(r27.data!.baseline_id).toBeNull(); // the 2027 baseline is still a draft: full induction
    expect(r27.data!.hours_saved).toBe(0);
    const pub = await b.rpc.saveIntakeBaseline({ ...inp27, publish: true });
    expect(pub.ok && pub.data!.status === 'published' && pub.data!.stale_plans === 6).toBe(true);
    const after = await b.rpc.buildInductionPlan({ person_id: 'ap-054', programme: 'dnt', intake_year: 2027 });
    expect(after.data!.baseline_id).toBe('ib-2027-all-v1');
    expect(after.data!.hours_saved).toBeGreaterThan(0);
    const g26 = await b.rpc.buildInductionPlan({ person_id: 'ap-128', programme: 'gdp', intake_year: 2026 });
    expect(g26.data!.baseline_id).toBe('ib-2026-gdp-v1');
    const d26 = await b.rpc.buildInductionPlan({ person_id: 'ap-128', programme: 'dnt', intake_year: 2026 });
    expect(d26.data!.baseline_id).toBe('ib-2026-all-v2');
    const d25 = await b.rpc.buildInductionPlan({ person_id: 'ap-128', programme: 'dnt', intake_year: 2025 });
    expect(d25.data!.baseline_id).toBe('ib-2025-all-v2');
    const row = raw('induction_plans').find((p) => p.person_id === 'ap-128')!;
    const want = inductionPlan(MODS, baselineFor(raw('intake_baselines') as unknown as BaselineRow[], 2025, 'dnt'));
    expect(row.items).toEqual(want.items);
    expect([row.hours_total, row.hours_planned, row.hours_saved, row.revision]).toEqual([want.hours_total, want.hours_planned, want.hours_saved, 3]);
    expect(raw('notifications').some((n) => n.id === 'nt-ip-ap-128-r3' && n.kind === 'induction' && n.link === '/my/induction')).toBe(true);
    // the seeded joiner plans equal the rule on the baseline each names
    for (const p of T.induction_plans) expect(inductionPlan(MODS, BASES.find((x) => x.id === p.baseline_id) ?? null).items).toEqual(p.items);
  });

  it('FS77 acceptance: anonymous use stores nothing (no RPC writes for public visitors; the starter needs no RPC)', async () => {
    await as(null);
    const audit0 = raw('audit_events').length;
    for (const r of [await b.rpc.saveIntakeBaseline(inp27), await b.rpc.buildInductionPlan({ person_id: 'ap-054', programme: 'dnt', intake_year: 2027 }), await b.rpc.inductionJoiners(), await b.rpc.saveStudentJourney({ checklist: { [starterKey('sl-ai-what')]: 'done' } })])
      expect(r.code).toBe('not_signed_in');
    expect(raw('intake_baselines').length).toBe(T.intake_baselines.length);
    expect(raw('induction_plans').length).toBe(T.induction_plans.length);
    expect(raw('student_journeys').length).toBe(T.student_journeys.length);
    expect(raw('audit_events').length).toBe(audit0 + 4); // refusals are audited, nothing else is written
    // public reads: lessons, modules and published baselines only; no plan
    expect((await b.list('starter_lessons', {})).length).toBe(8);
    expect((await b.list('induction_modules', {})).length).toBe(12);
    expect((await b.list('intake_baselines', {})).every((x) => x.status === 'published')).toBe(true);
    expect((await b.list('induction_plans', {})).length).toBe(0);
  });
});

describe('FS77 rules (= SQL kafaa_ib_* / kafaa_ip_*)', () => {
  it('mandatory nuclear modules can never be skipped or shortened by a baseline', () => {
    const mand = MODS.filter((m) => m.mandatory).map((m) => m.id).sort();
    expect(mand).toEqual(['ind-ai-enec', 'ind-company', 'ind-cyber', 'ind-radiation', 'ind-safety-culture', 'ind-site']);
    for (const id of mand) {
      expect(baselineProblem({ intake_year: 2027, programme: 'all', entries: [{ module_id: id, status: 'held', basis: 'intake_diagnostic' }] }, MODS)).toBe('mandatory');
      expect(baselineProblem({ intake_year: 2027, programme: 'all', entries: [{ module_id: id, status: 'partial', basis: 'intake_diagnostic' }] }, MODS)).toBe('mandatory');
    }
    const plan = inductionPlan(MODS, { id: 'x', intake_year: 2030, programme: 'all', status: 'published', version: 1, entries: mand.map((id) => ({ module_id: id, status: 'held', basis: 'x' })) });
    expect(plan.items.filter((i) => mand.includes(i.module_id)).every((i) => i.action === 'full' && i.reason === 'mandatory')).toBe(true);
  });

  it('baselineProblem gives the first problem in order (year, programme, entries, then per entry module, duplicate, status, basis, mandatory, source, note)', () => {
    const e = { module_id: 'ind-data', status: 'partial', basis: 'intake_diagnostic' };
    const base = { intake_year: 2027, programme: 'all', entries: [e] };
    expect(baselineProblem(base, MODS)).toBeNull();
    expect(baselineProblem({ ...base, intake_year: 2019 }, MODS)).toBe('year');
    expect(baselineProblem({ ...base, intake_year: 2026.5 }, MODS)).toBe('year');
    expect(baselineProblem({ ...base, programme: 'mustaqbali' }, MODS)).toBe('programme');
    expect(baselineProblem({ ...base, entries: [] }, MODS)).toBe('entries');
    expect(baselineProblem({ ...base, entries: [{ ...e, module_id: 'zz' }] }, MODS)).toBe('module');
    expect(baselineProblem({ ...base, entries: [e, e] }, MODS)).toBe('duplicate');
    expect(baselineProblem({ ...base, entries: [{ ...e, status: 'maybe' }] }, MODS)).toBe('status');
    expect(baselineProblem({ ...base, entries: [{ ...e, basis: 'none' }] }, MODS)).toBe('basis');
    expect(baselineProblem({ ...base, entries: [{ ...e, basis: 'national_curriculum' }] }, MODS)).toBe('source');
    expect(baselineProblem({ ...base, entries: [{ ...e, source_url: 'http://x.org' }] }, MODS)).toBe('source');
    expect(baselineProblem({ ...base, entries: [{ ...e, note_en: 'x'.repeat(301) }] }, MODS)).toBe('note');
    expect(baselineProblem({ ...base, note_ar: 'x'.repeat(601) }, MODS)).toBe('note');
    expect(cleanEntries([e, { module_id: 'ind-ai-basics', status: 'held', basis: 'intake_diagnostic', note_en: ' a ' }], MODS).map((x) => [x.module_id, x.note_en, x.source_url])).toEqual([['ind-ai-basics', 'a', null], ['ind-data', '', null]]);
  });

  it('inductionPlan: held is skipped, partly held is a refresher, not held or not covered is full; hours add up', () => {
    const b26 = BASES.find((x) => x.id === 'ib-2026-all-v2')!;
    const p = inductionPlan(MODS, b26);
    const by = Object.fromEntries(p.items.map((i) => [i.module_id, i]));
    expect(by['ind-digital'].action).toBe('skip');
    expect(by['ind-ai-basics']).toMatchObject({ action: 'refresher', planned_hours: 1, reason: 'partial', basis: 'national_curriculum' });
    expect(by['ind-energy']).toMatchObject({ action: 'full', reason: 'not_held' });
    expect(by['ind-safety-culture']).toMatchObject({ action: 'full', reason: 'mandatory' });
    expect(p.hours_total).toBe(33.5);
    expect(p.hours_planned + p.hours_saved).toBe(p.hours_total);
    expect(inductionPlan(MODS, null).items.every((i) => i.action === 'full')).toBe(true);
  });

  it('baselineFor picks the programme\'s highest published version, then all programmes; drafts and superseded rows never count', () => {
    expect(baselineFor(BASES, 2026, 'gdp')?.id).toBe('ib-2026-gdp-v1');
    expect(baselineFor(BASES, 2026, 'dnt')?.id).toBe('ib-2026-all-v2');
    expect(baselineFor(BASES, 2025, 'gpo')?.id).toBe('ib-2025-all-v2');
    expect(baselineFor(BASES, 2027, 'dnt')).toBeNull();
    expect(planStale({ baseline_id: 'ib-2026-all-v1', intake_year: 2026, programme: 'direct' }, BASES)).toBe(true);
    expect(planStale({ baseline_id: 'ib-2026-all-v2', intake_year: 2026, programme: 'dnt' }, BASES)).toBe(false);
  });

  it('SMR starter text carries no site, headcount or deployment claim (same pattern as FS05 publicTextIsClean, plus deployment)', () => {
    expect(HEADCOUNT_OR_SITE.source).toBe(FUTURE_PATTERN.source);
    for (const s of ['to be built in the region', '40 operators', 'candidate site', 'Deployment is planned for 2030', 'The UAE will deploy SMRs']) expect(starterTextIsClean([s])).toBe(false);
    expect(publicTextIsClean(['40 operators'])).toBe(false);
    for (const l of LESSONS.filter((x) => x.track === 'smr')) expect(starterTextIsClean([l.title_en, l.summary_en, l.points, l.self_check])).toBe(true);
    expect(lessonProblem({ ...LESSONS.find((x) => x.track === 'smr')!, summary_en: 'A first SMR in the UAE will be built.' })).toBe('smr_claim');
  });

  it('no benchmark figure is typed into starter copy (figures come from kafaa_benchmarks through BenchmarkChips)', () => {
    const figures = T.benchmarks.filter((x) => (FEATURE_BENCHMARKS.FS77 ?? []).includes(x.id)).flatMap((x) => (x.figures ?? []).map((f: Row) => String(f.quote_en)));
    expect(figures.length).toBeGreaterThan(0);
    const copy = JSON.stringify([LESSONS.map((l) => [l.title_en, l.title_ar, l.summary_en, l.summary_ar, l.points, l.self_check]), flat(en.starter), flat(ar.starter)]);
    for (const q of figures) expect(copy.includes(q)).toBe(false);
  });

  it('planProblem and joinerCandidates (plans, offers, recent entry-level hires; one row per person)', () => {
    expect(planProblem({ programme: 'dnt', intake_year: 2026 }, { kind: 'partner' })).toBe('person');
    expect(planProblem({ programme: 'all', intake_year: 2026 }, { kind: 'staff' })).toBe('programme');
    expect(planProblem({ programme: 'dnt', intake_year: 2040 }, { kind: 'applicant' })).toBe('year');
    expect(planProblem({ programme: 'direct', intake_year: 2026 }, { kind: 'staff' })).toBeNull();
    const j = joinerCandidates({ people: T.people, applications: T.applications, induction_plans: T.induction_plans }, '2026-10-12');
    expect(new Set(j.map((x) => x.person_id)).size).toBe(j.length);
    expect(j.filter((x) => x.source === 'plan').length).toBe(8);
    expect(j.find((x) => x.person_id === 'ap-128')).toMatchObject({ source: 'offer', programme: 'gdp', intake_year: 2027, plan_id: null });
    expect(j.find((x) => x.person_id === 'w-lo-10')?.source).toBe('plan');
  });

  it('starterProgress counts checked lessons per track from checklist keys starter:<lesson>', () => {
    const p = starterProgress(LESSONS, { [starterKey('sl-ai-what')]: 'done', [starterKey('sl-smr-what')]: 'done', 'prep:dnt:apply': 'done' });
    expect(p).toEqual({ ai: { done: 1, total: 5 }, smr: { done: 1, total: 3 } });
  });
});

describe('FS77 RBAC and RPCs (local path)', () => {
  it('saveIntakeBaseline: HR only (workforce_strategy W); drafts update in place; publish supersedes and writes the ledger', async () => {
    for (const p of ['sro', 'training-mgr', 'k-student', 'alnoor-gm', 'k-auditor']) {
      await as(p);
      expect((await b.rpc.saveIntakeBaseline(inp27)).code).toBe('forbidden');
    }
    await as('k-hr-analyst');
    expect((await b.rpc.saveIntakeBaseline({ ...inp27, entries: [{ module_id: 'ind-site', status: 'held', basis: 'intake_diagnostic' }] })).message).toMatch(/Mandatory nuclear modules/);
    const led0 = raw('ledger_local').length;
    const d = await b.rpc.saveIntakeBaseline(inp27);
    expect(d.ok && d.data!.id === draft27.id && d.data!.status === 'draft').toBe(true);
    expect(raw('ledger_local').length).toBe(led0);
    await as('chco');
    const v3 = await b.rpc.saveIntakeBaseline({ intake_year: 2026, programme: 'all', entries: [{ module_id: 'ind-ai-basics', status: 'held', basis: 'national_curriculum', source_url: 'https://www.middleeastainews.com/p/uae-rolls-out-ai-school-curriculum' }], publish: true });
    expect(v3.ok && v3.data!.id === 'ib-2026-all-v3').toBe(true);
    const rows = raw('intake_baselines').filter((x) => x.intake_year === 2026 && x.programme === 'all').sort((x, y) => x.version - y.version);
    expect(rows.map((x) => x.status)).toEqual(['superseded', 'superseded', 'published']);
    expect(rows.filter((x) => x.listed).length).toBe(1);
    expect(raw('ledger_local').length).toBe(led0 + 1);
    expect(v3.data!.stale_plans).toBe(2); // k-lo-trainee (on v2) and w-lo-10 (on v1)
  });

  it('buildInductionPlan and inductionJoiners: HR builds, training staff read the joiners, others are refused', async () => {
    await as('sro');
    expect((await b.rpc.buildInductionPlan({ person_id: 'ap-128', programme: 'gdp', intake_year: 2027 })).code).toBe('forbidden');
    expect((await b.rpc.inductionJoiners()).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.buildInductionPlan({ person_id: 'ap-128', programme: 'gdp', intake_year: 2027 })).code).toBe('forbidden');
    const j = await b.rpc.inductionJoiners();
    expect(j.ok && j.data!.length).toBeGreaterThanOrEqual(9);
    await as('k-hr-analyst');
    expect((await b.rpc.buildInductionPlan({ person_id: 'p-alnoor-gm', programme: 'dnt', intake_year: 2027 })).code).toBe('invalid');
    expect((await b.rpc.buildInductionPlan({ person_id: 'ap-128', programme: 'mustaqbali', intake_year: 2027 })).code).toBe('invalid');
    const ok = await b.rpc.buildInductionPlan({ person_id: 'ap-128', programme: 'gdp', intake_year: 2027 });
    expect(ok.ok && ok.data!.id === 'ip-ap-128' && ok.data!.revision === 1).toBe(true);
  });

  it('RLS: a joiner reads only their own plan; HR, training staff and auditors read every plan and every baseline incl. drafts', async () => {
    await as('k-lo-trainee');
    expect((await b.list('induction_plans', {})).map((p) => p.id)).toEqual(['ip-p-k-lo-trainee']);
    await as('k-student');
    expect((await b.list('induction_plans', {})).length).toBe(0);
    expect((await b.list('intake_baselines', {})).some((x) => x.status === 'draft')).toBe(false);
    for (const p of ['k-hr-analyst', 'training-mgr', 'k-auditor']) {
      await as(p);
      expect((await b.list('induction_plans', {})).length).toBe(T.induction_plans.length);
      expect((await b.list('intake_baselines', {})).length).toBe(T.intake_baselines.length);
    }
    await as('alnoor-gm');
    expect((await b.list('induction_plans', {})).length).toBe(0);
  });
});

describe('FS77 seed, schema, routes and i18n', () => {
  it('seed: 8 lessons, 12 modules (6 mandatory), 7 baselines (one 2027 draft), 8 plans (one stale); synthetic people only', () => {
    expect([T.starter_lessons.length, T.induction_modules.length, T.intake_baselines.length, T.induction_plans.length]).toEqual([8, 12, 7, 8]);
    expect(T.intake_baselines.filter((x) => x.status === 'draft').map((x) => x.id)).toEqual(['ib-2027-all-v1']);
    expect(T.induction_plans.filter((p) => planStale(p as never, BASES)).map((p) => p.id)).toEqual(['ip-w-lo-10']);
    const people = new Map(T.people.map((p) => [p.id, p]));
    for (const p of T.induction_plans) expect(people.get(p.person_id)?.synthetic).toBe(true);
    for (const x of T.intake_baselines) expect(baselineProblem(x, MODS)).toBeNull();
    expect(todayIso() >= '2026-10-08').toBe(true);
  });

  it('schema: public tables read through talent_content where listed; writes only through RPCs (workforce_strategy)', () => {
    expect(SCHEMA.starter_lessons.read).toEqual([{ res: 'talent_content', where: 'listed' }]);
    expect(SCHEMA.induction_modules.write.mode).toBe('none');
    expect(SCHEMA.intake_baselines.write).toEqual({ mode: 'rpc', res: 'workforce_strategy' });
    expect(SCHEMA.induction_plans.read.map((r) => r.res)).toEqual(['own_profile', 'workforce_strategy', 'sat']);
  });

  it('routes: three FS77 routes with the right guards; FS77 benchmarks are UAE-AI, NEA and UK-NUC', () => {
    const r = Object.fromEntries(routes.map((x) => [x.id, x]));
    expect(r['pathways-starter'].guard).toEqual({});
    expect(r['pathways-starter'].path).toBe('/pathways/journey/starter');
    expect(r['my-induction'].guard).toEqual({ signedIn: true });
    expect(r['workforce-intake-baselines'].guard).toEqual({ signedIn: true, anyRole: ['hr_analyst', 'hr_director', 'training_manager', 'admin', 'auditor'] });
    expect(FEATURE_BENCHMARKS.FS77).toEqual(['UAE-AI', 'NEA', 'UK-NUC']);
  });

  it('i18n: every FS77 key exists in English and Arabic, and the Arabic is Arabic', () => {
    for (const ns of ['starter', 'ind', 'myind', 'ibw'] as const) {
      const e = flat((en as Row)[ns]), a = new Map(flat((ar as Row)[ns]));
      expect(e.length).toBeGreaterThan(5);
      for (const [k] of e) {
        expect(a.get(k)).toBeTruthy();
        if (!/^(ind\.hoursN|ind\.area\.company)$/.test(`${ns}.${k}`)) expect(AR.test(a.get(k)!)).toBe(true);
      }
    }
    for (const id of ['pathways-starter', 'my-induction', 'workforce-intake-baselines']) expect(AR.test((ar as Row).routes[id].title)).toBe(true);
  });
});
