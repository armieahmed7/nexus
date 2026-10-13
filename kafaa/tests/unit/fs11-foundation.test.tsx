// @vitest-environment jsdom
/** FS01 (future skills, wave A) acceptance: modules M28-M37, the seven policy resources, the benchmark registry,
 *  <BenchmarkChip>/<BenchmarkLine> in RTL with the reader's digits, the transform/assess engine surfaces, and a
 *  migration that touches kafaa_* objects only. SQL side: scripts/validate/fs11-foundation.mjs (PGlite). */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MODULES } from '../../src/routes/modules';
import { ROUTES } from '../../src/routes/registry';
import { MATRIX, RESOURCES, PLATFORM_ROLES } from '../../src/auth/policy';
import { SCHEMA } from '../../src/data/schema';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { benchmarkProblems, figureOf, yearParts, type BenchmarkRow } from '../../src/domain/benchmarks';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { DEFAULT_SETTINGS, FS_SURFACES, SURFACES, makeEngine, nextItem, resolveEngine, taskExposure } from '../../src/domain/engines';
import { hasKey } from '../../src/i18n';
import { BenchmarkChip, BenchmarkChips, BenchmarkLine } from '../../src/ui';
import BenchmarksTab from '../../src/modules/m28/admin/BenchmarksTab';
import SkillCatalogueTab from '../../src/modules/m28/admin/SkillCatalogueTab';
import seed from '../../src/seed/seed.json';
import { renderPage } from './g1-harness';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const BM = T.benchmarks as BenchmarkRow[];
const NEW = Array.from({ length: 10 }, (_, i) => `M${28 + i}`);
const NEW_RES = ['skills_taxonomy', 'ai_literacy', 'transformation', 'recognition', 'workforce_strategy', 'ecosystem', 'national_alignment'] as const;
const MIGRATION = 'supabase/migrations/20261010211001_kafaa_fs11_foundation_catalogue.sql';

describe('FS01 · modules M28-M37 register once', () => {
  it('every new module has a name in EN and AR, an FS group, a routes file, backend extension points and EN/AR namespaces', () => {
    for (const id of NEW) {
      const m = id.toLowerCase();
      const meta = MODULES[id as keyof typeof MODULES];
      expect(meta?.en && meta?.ar, id).toBeTruthy();
      expect(meta.group).toMatch(/^FS[A-I]$/);
      for (const f of ['routes.ts', 'backend/schema.ts', 'backend/rpc.ts', 'backend/local.ts', 'backend/supabase.ts']) expect(existsSync(`src/modules/${m}/${f}`), `${m}/${f}`).toBe(true);
      for (const l of ['en', 'ar']) expect(JSON.parse(readFileSync(`src/i18n/${m}.${l}.json`, 'utf8')).module.name).toBeTruthy();
      expect(readFileSync('src/routes/registry.ts', 'utf8')).toContain(`../modules/${m}/routes`);
      for (const f of ['schema', 'rpc', 'local', 'supabase']) expect(readFileSync(`src/data/ext/${f}.ts`, 'utf8')).toContain(`modules/${m}/backend/`);
    }
  });
  it('the route sweep reads the registry, so routes added to M28-M37 are covered without test edits; today 212 (206 + the 6 wave-A routes of FS03-FS06)', () => {
    expect(ROUTES.length).toBe(401); // FS wave I QA: + 21 (FS78/FS79 M34 5: my-learning-balance, team-study-time, workforce-learning-balances, my-external-certs, external-certs-queue; FS80 M29 4: workforce-ai-automations, workforce-ai-automation, my-ai-builds, admin-ai-automations; FS81 M30 4: my-transition-plan, workforce-transition-plans, workforce-transition-plan, workforce-rung-alerts; FS82/FS83 M36 6: my-grants, ecosystem-grants, workforce-grants, ecosystem-consortium, ecosystem-consortium-cohort, my-consortium; FS84 M17 2: team-skills-future, workforce-skills-inventory). FS wave H QA: + 13 (FS70-FS72 M28 7: skills-rising, skills-rising-method, workforce-skill-signals, my-manager-pulse, skills-technologies, admin-skills-technologies, my-skills-suggestions; FS73/FS74 M37 3: national-emirati-pipeline, my-future-wallet, national-future-wallet; FS77 M06 3: pathways-starter, my-induction, workforce-intake-baselines; FS75 shell digest and FS76 M13 none). FS wave G QA: + 29 (FS60/FS61 M35 6: workforce-disclosure, -metrics, -pack, workforce-pilots, workforce-pilot, skills-pilots; FS62/FS63 M37 5: national-alignment, -tag, national-report, national-occupations, admin-national-tags; FS64/FS65 M36 6: ecosystem-regional-plan, -commitments, -commitment, -demand-release, ecosystem-pledges, -register; FS66/FS67 M10 7: partner-university-programmes, training-university-programmes, university-programme, workforce-graduate-hires, universities-fellowships, university-fellowship, workforce-fellowships; FS68/FS69 M09 5: partner-future-readiness, admin-supplier-future-readiness, partner-prearrival, training-equivalency-prearrival, -share). FS wave F QA: + 23 (FS50/FS51 M35 7, FS54/FS55 M16 6, FS56/FS57 M25 3, FS58/FS59 M33 7; FS52/FS53 M07 none). FS wave E QA: + 27 (FS38-FS40 M31 9, FS41-FS43 M32 7, FS44/FS45 M24 4, FS46-FS48 M22 5, FS49 M08 2). FS wave D QA: + 29 (FS27/FS28 M20 6, FS29/FS30 M34 7, FS31-FS33 M17 7, FS34/FS35 M18 2, FS36/FS37 M29 7). FS wave C QA: + 32 (FS17/FS18 M19 6, FS19/FS20 M04 6, FS21/FS22 M05 7, FS23/FS24 M02 7, FS25/FS26 M33 6). FS wave B QA: 216 + FS09/FS10 5 + FS11/FS12 5 + FS16 1. FS wave B · E1: + 4 M28 routes (FS07 /skills, /skills/:id; FS08 /skills/frameworks, /admin/skills/alignments)
    const sweep = readFileSync('tests/e2e/sweep.spec.ts', 'utf8');
    expect(sweep).toContain('ROUTES');
    for (const r of ROUTES.filter((x) => NEW.includes(x.module))) {
      for (const l of ['en', 'ar']) {
        const d = JSON.parse(readFileSync(`src/i18n/${r.module.toLowerCase()}.${l}.json`, 'utf8'));
        expect(d.routes?.[r.id]?.title && d.routes?.[r.id]?.purpose, `${r.id} ${l}`).toBeTruthy();
      }
    }
  });
  it('module RPC hooks of M28-M37 install on the LocalBackend without changing existing RPCs', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    expect(typeof b.rpc.recomputeSkills).toBe('function');
    expect(typeof b.rpc.setEngineWeights).toBe('function');
  });
});

describe('FS01 · policy resources', () => {
  it('adds the seven resources with matrix rows from existing roles, and docs/RBAC.md regenerates with them', () => {
    const rbac = readFileSync('docs/RBAC.md', 'utf8');
    for (const r of NEW_RES) {
      expect(RESOURCES).toContain(r);
      const rows = MATRIX[r];
      expect(Object.keys(rows).length, r).toBeGreaterThan(0);
      for (const role of Object.keys(rows)) expect(PLATFORM_ROLES as readonly string[]).toContain(role);
      expect(rbac).toContain(r);
    }
    expect(MATRIX.workforce_strategy.public).toBeUndefined();
    expect(MATRIX.workforce_strategy.employee).toBeUndefined();
    expect(MATRIX.skills_taxonomy.public).toEqual(['R']);
    expect(MATRIX.skills_taxonomy.training_manager).toContain('A');
    expect(MATRIX.ecosystem.partner_admin).toEqual(expect.arrayContaining(['OwnOrg', 'OrgW']));
    expect(MATRIX.recognition.auditor).toEqual(['R']);
  });
});

describe('FS01 · benchmark registry', () => {
  it('holds the 40 plan benchmarks; every row carries at least one https source, an as-of date and EN/AR text', () => {
    expect(BM.length).toBe(40);
    for (const b of BM) {
      expect(benchmarkProblems(b), b.id).toEqual([]);
      expect(b.urls.length).toBeGreaterThan(0);
      expect(b.urls.every((u) => u.startsWith('https://'))).toBe(true);
      expect(b.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(b.status === 'published' && b.listed).toBe(true);
    }
  });
  it('every figure is a sourced row whose number appears in the fact text, never typed into copy', () => {
    const figs = BM.flatMap((b) => (b.figures as any[]).map((f) => ({ b, f })));
    expect(figs.length).toBeGreaterThanOrEqual(40);
    for (const { b, f } of figs) expect(b.fact_en.includes(f.quote_en), `${b.id}.${f.key}`).toBe(true);
    expect(figureOf(BM, 'OECD-PIAAC', 'aps_oecd_average')?.value).toBe(251);
    expect(figureOf(BM, 'WEF-FOJ', 'core_skills_change_2030')?.value).toBe(39);
  });
  it('maps every FS card (FS01-FS84) to registry ids, and each benchmark lists the cards that follow it', () => {
    const ids = new Set(BM.map((b) => b.id));
    expect(Object.keys(FEATURE_BENCHMARKS).length).toBe(84);
    for (const [fs, list] of Object.entries(FEATURE_BENCHMARKS)) for (const id of list) expect(ids.has(id), `${fs} -> ${id}`).toBe(true);
    for (const b of BM) for (const fs of b.feature_ids) expect(FEATURE_BENCHMARKS[fs]).toContain(b.id);
  });
  it('is public when published, hidden while draft, and written only by framework owners (LocalBackend = RLS + guards)', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    await b.reset();
    b.setPersona(null);
    expect((await b.list('benchmarks')).length).toBe(40);
    b.setPersona('sro');
    expect((await b.update('benchmarks', 'ESCO', { borrow_en: 'x' })).ok).toBe(false);
    b.setPersona('training-mgr');
    const http = await b.update('benchmarks', 'ESCO', { urls: ['http://esco.ec.europa.eu'] });
    expect(http.ok).toBe(false);
    expect(http.message).toMatch(/https/);
    const listedDraft = await b.update('benchmarks', 'ESCO', { status: 'draft' as never });
    expect(listedDraft.ok).toBe(false);
    expect((await b.update('benchmarks', 'ESCO', { status: 'draft' as never, listed: false })).ok).toBe(true);
    b.setPersona(null);
    expect((await b.list('benchmarks')).map((x) => x.id)).not.toContain('ESCO');
    b.setPersona('k-admin');
    expect((await b.list('benchmarks')).map((x) => x.id)).toContain('ESCO');
    await b.reset();
  });
  it('check:public stays green (no personal data; every benchmark and skill cites an https source)', () => {
    const out = execFileSync(process.execPath, ['scripts/check-public-payloads.mjs'], { encoding: 'utf8' });
    expect(out).toMatch(/40 benchmarks and \d+ skills cite https sources/);
  });
  it('year display parts keep numbers numeric so the digit setting applies', () => {
    expect(yearParts({ year_from: 2022, year_to: 2025, year_kind: 'editions' })).toEqual({ kind: 'editions', from: 2022, to: 2025 });
    expect(yearParts({ year_from: 2026, year_to: null, year_kind: 'bogus' })).toEqual({ kind: 'single', from: 2026, to: null });
  });
});

describe('FS01 · <BenchmarkChip> and <BenchmarkLine> follow RTL and the digit setting', () => {
  it('Arabic page with Arabic-Indic digits: Arabic name, Arabic-Indic year, drawer with sources, as-of date and figures', async () => {
    localStorage.setItem('kafaa.prefs.v1', JSON.stringify({ digits: 'arab' }));
    await renderPage(<BenchmarkChips feature="FS01" />, { path: '/ar/x' });
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-OECD-PIAAC').tagName).toBe('BUTTON'), { timeout: 10000 });
    const chip = screen.getByTestId('benchmark-chip-OECD-PIAAC');
    expect(document.documentElement.dir).toBe('rtl');
    expect(chip.textContent).toContain('٢٠٢٤');
    expect(chip.textContent).toMatch(/مسح منظمة التعاون/);
    expect(screen.getByTestId('benchmark-chips').textContent).toContain('المراجع التي يتبعها');
    fireEvent.click(chip);
    const drawer = await screen.findByTestId('benchmark-drawer');
    expect(drawer.textContent).toContain('٢٥١');
    expect(drawer.textContent).toContain('cso.ie');
    expect(drawer.textContent).toContain('ما تقتبسه منصة كفاءة');
    localStorage.removeItem('kafaa.prefs.v1');
  });
  it('English with Latin digits; the line places each marker with a logical (inline-start) position and lists values for screen readers', async () => {
    localStorage.setItem('kafaa.prefs.v1', JSON.stringify({ digits: 'latn' }));
    await renderPage(<BenchmarkLine value={238} max={500} label="Adaptive problem solving" lines={[{ kind: 'enec', label: 'ENEC average', value: 244 }]} benchmark={{ id: 'OECD-PIAAC', figure: 'aps_oecd_average' }} />, { path: '/x' });
    await waitFor(() => expect(document.querySelectorAll('[data-kind="benchmark"]').length).toBe(1), { timeout: 10000 });
    const fig = screen.getByTestId('benchmark-line');
    expect(fig.textContent).toContain('251');
    expect(fig.textContent).toContain('244');
    expect(fig.querySelector('table')?.textContent).toContain('238');
    const src = readFileSync('src/ui/Benchmark.tsx', 'utf8');
    expect(src).toContain('insetInlineStart');
    expect(src).not.toMatch(/\b(left|right):/);
    localStorage.removeItem('kafaa.prefs.v1');
  });
  it('an id that is not in the registry renders an inert chip instead of failing', async () => {
    await renderPage(<BenchmarkChip id="NOT-THERE" />, { path: '/x' });
    await screen.findByTestId('benchmark-chip-NOT-THERE');
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByTestId('benchmark-chip-NOT-THERE').tagName).toBe('SPAN');
  });
  it('the admin benchmarks tab lists all 40 with tiles and its own benchmark chips', async () => {
    await renderPage(<BenchmarksTab />, { persona: 'training-mgr', path: '/admin/frameworks?tab=benchmarks' });
    const tab = await screen.findByTestId('fs-admin-benchmarks', {}, { timeout: 15000 });
    expect(tab.textContent).toContain('40');
    expect(screen.getByTestId('fs-bm-table')).toBeTruthy();
    expect(screen.getAllByTestId('benchmark-chips').length).toBeGreaterThan(0);
  });
});

describe('FS02 · admin skills catalogue tab', () => {
  it('shows the 120-skill catalogue in Arabic with taxonomy tiles, FS02 benchmark chips and the obsolete skill drawer', async () => {
    await renderPage(<SkillCatalogueTab />, { persona: 'training-mgr', path: '/ar/admin/frameworks?tab=skills' });
    const tab = await screen.findByTestId('fs-admin-skills', {}, { timeout: 15000 });
    expect(tab.textContent).toContain('المهارات');
    expect(screen.getAllByTestId('benchmark-chips').length).toBeGreaterThan(0);
    expect(screen.getByTestId('fs-sk-table')).toBeTruthy();
    fireEvent.change(tab.querySelector('input.input') as HTMLInputElement, { target: { value: 'paper work' } });
    fireEvent.click(await screen.findByTestId('fs-sk-open-sk-fs-dp-paperwp'));
    const drawer = await screen.findByTestId('fs-sk-drawer');
    expect(drawer.textContent).toContain('متقادمة');
    expect(drawer.textContent).toContain('الإدارة الرقمية للأعمال');
    expect((screen.getByTestId('fs-sk-lifecycle') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('FS01 · engine surfaces transform and assess', () => {
  it('are registered with deterministic defaults; the disabled model slot falls back; stored surfaces stay four', () => {
    expect(SURFACES).toEqual(['skills', 'recommend', 'match', 'search']);
    expect(FS_SURFACES).toEqual(['transform', 'assess']);
    for (const s of FS_SURFACES) {
      expect(DEFAULT_SETTINGS[s].engine).toBe('deterministic');
      expect(resolveEngine(s, null).kind).toBe('deterministic');
      expect(resolveEngine(s, { engine: 'model' }, null).status).toBe('model_unavailable');
      expect(hasKey(`common.engines.surface.${s}`)).toBe(true);
    }
  });
  it('transform: task exposure classes with reasons (safety-critical tasks stay human-led)', () => {
    const e = makeEngine(resolveEngine('transform', null));
    expect(e.future.taskExposure({ id: 'a', ai_level: 4, human_level: 3 }).item?.cls).toBe('automatable');
    expect(e.future.taskExposure({ id: 'b', ai_level: 3, human_level: 4 }).item?.cls).toBe('augmentable');
    expect(e.future.taskExposure({ id: 'c', ai_level: 1, human_level: 5 }).item?.cls).toBe('human_led');
    const safe = taskExposure({ id: 'd', ai_level: 5, human_level: 3, safety_critical: true });
    expect(safe.item?.cls).toBe('human_led');
    expect(safe.reasons.map((r) => r.code)).toContain('fs_exposure_safety');
    expect(taskExposure({ id: 'e', ai_level: 4, human_level: 4, horizon: '2035' }).score).toBeLessThan(taskExposure({ id: 'e', ai_level: 4, human_level: 4 }).score);
    for (const r of safe.reasons) expect(hasKey(r.key), r.key).toBe(true);
  });
  it('assess: a staircase over levels 1-4 that stops and explains its estimate', () => {
    expect(nextItem([]).level).toBe(2);
    expect(nextItem([{ level: 2, correct: true }, { level: 2, correct: true }]).level).toBe(3);
    expect(nextItem([{ level: 2, correct: false }]).level).toBe(1);
    const h = Array.from({ length: 12 }, (_, i) => ({ level: 3, correct: i % 2 === 0 }));
    const r = nextItem(h);
    expect(r.done).toBe(true);
    expect(r.reasons.map((x) => x.code)).toContain('fs_assess_done');
    for (const x of r.reasons) expect(hasKey(x.key), x.key).toBe(true);
  });
});

describe('FS01 · the migration touches kafaa_* objects only', () => {
  it('creates, alters and grants only kafaa_ objects and never drops, truncates or deletes', () => {
    const sql = readFileSync(MIGRATION, 'utf8').replace(/--[^\n]*/g, '');
    const targets = [...sql.matchAll(/\b(?:alter table|create table if not exists|create index if not exists \w+ on|insert into|create or replace function|comment on table|grant [a-z, ]+ on|alter policy \w+ on|create policy \w+ on|create trigger \w+ [a-z ]+ on|revoke execute on function|references)\s+([a-z_]+)/gi)].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(20);
    expect(targets.filter((x) => !x.startsWith('kafaa_'))).toEqual([]);
    expect(sql).not.toMatch(/\b(drop|truncate)\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(SCHEMA.benchmarks.module).toBe('M28');
  });
});
