// @vitest-environment jsdom
/** [FS QA · wave F integration] Cross-feature wiring of FS50-FS59 on the integration branch, one test per integration criterion:
 *   routes        338 routes (315 after wave E + 23 wave-F routes), each wave-F path registered
 *   benchmarks    every wave-F page names its card's FS01 benchmark chips (FS52/FS53 on the outlook panels); every chip is a published
 *                 registry row with an https source and an as-of date
 *   FS51-FS52     the F35 outlook stays shared: FS51 imports m07/outlook.ts read-only, FS52 keeps its exports; adoption 0 reproduces the
 *                 five stored outlooks byte for byte and the stress test reads 10 of 10; kafaa_so_base keeps its fs2qa body
 *   FS54-F35/51   the methodology-change banner shows on /workforce/skills-outlook and on the FS51 pages (keys skills_outlook and
 *                 skill_forecasts), read from the public change log
 *   FS54-FS57     one "taught by" rule: the orphan audit's course / pathway / external flags are exactly FS57's taughtBy() (SQL
 *                 kafaa_fs63_health reads kafaa_cov_taught)
 *   FS55 lint     the three wave-F ranked lists have engine cards (34 cards for 34 surfaces) and their functions use no protected input
 *   FS57-FS17     the gap backlog is keyed on the M19 pathway gaps (no second backlog), every row has an owner; coverage() is import-free
 *   3.9 union     validated role-play feedback (roleplay_sessions) is recorded evidence that an F01 recompute keeps; fs65 is the newest
 *                 kafaa_skill_states_v2 / kafaa_skills_apply and carries the full list
 *   passport      the skills passport labels validated role-play evidence
 *   FS59-F36      a named reviewer sees the role-play review owed under "approvals I owe"; deciding it removes the item
 *   FS56-FS59     the stored skill-change measures equal the rule on the final seed (after the role-play evidence)
 *   migration     the QA migration is additive (two functions replaced with the same signatures, cards on conflict do nothing, guarded
 *                 updates, no removal words) */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import { localDigestData } from '../../src/shell/digest/backend/local';
import { gatherDigest } from '../../src/shell/digest/rules';
import { RECORDED_REF_TABLES, isRecordedEvidence } from '../../src/domain/skills';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { I18nProvider } from '../../src/i18n';
import { useEvidenceLabel } from '../../src/modules/m17/PassportView';
import { RANKED_SURFACES, FSQA6_CARDS } from '../../src/modules/m16/surfaces';
import { taxonomyHealth, TAUGHT_BY } from '../../src/modules/m16/taxonomyGov';
import { localHealthData } from '../../src/modules/m16/backend/local';
import { taughtBy } from '../../src/modules/m25/coverage';
import { skillChange, skillChangeWorld } from '../../src/modules/m25/skillChange';
import * as Outlook from '../../src/modules/m07/outlook';
import SkillsOutlookPage from '../../src/modules/m07/SkillsOutlookPage';
import ForecastMethodPage from '../../src/modules/m35/ForecastMethodPage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = ((seed as any).tables ?? seed) as Record<string, Row[]>;
const W = { timeout: 60000 };
const DAY = '2026-10-08';
const QA = 'supabase/migrations/20261010269001_kafaa_fs6qa_integration.sql';
const WAVE_F: [string, string, string, string[]][] = [
  ['m35', 'workforce-critical-skills', '/workforce/critical-skills', ['FS50']], ['m35', 'workforce-critical-skill', '/workforce/critical-skills/:id', ['FS50']],
  ['m35', 'workforce-skill-forecasts', '/workforce/skill-forecasts', ['FS51']], ['m35', 'workforce-skill-forecast', '/workforce/skill-forecasts/skills/:skillId', ['FS51']],
  ['m35', 'workforce-skill-forecast-versions', '/workforce/skill-forecasts/versions', ['FS51']], ['m35', 'workforce-skill-generations', '/workforce/skill-forecasts/generations', ['FS51']],
  ['m35', 'workforce-skill-forecast-method', '/workforce/skill-forecasts/method', ['FS51']],
  ['m16', 'skills-changes', '/skills/changes', ['FS54']], ['m16', 'skills-change-propose', '/skills/changes/propose', ['FS54']], ['m16', 'admin-skills-council', '/admin/skills-council', ['FS54']],
  ['m16', 'admin-skills-health', '/admin/skills-health', ['FS54']], ['m16', 'skills-datasheet', '/skills/datasheet', ['FS55']], ['m16', 'admin-model-risk', '/admin/ai-transparency/model-risk', ['FS55']],
  ['m25', 'training-skill-change', '/training/skill-change', ['FS56']], ['m25', 'training-coverage', '/training/coverage', ['FS57']], ['m25', 'training-coverage-backlog', '/training/coverage/backlog', ['FS57']],
  ['m33', 'my-problem-solving', '/my/core-skills/problem-solving', ['FS58']], ['m33', 'training-aps-scenarios', '/training/aps/scenarios', ['FS58']], ['m33', 'learn-role-play', '/learn/role-play', ['FS59']],
  ['m33', 'my-role-play', '/my/role-play', ['FS59']], ['m33', 'my-role-play-scenario', '/my/role-play/:id', ['FS59']], ['m33', 'training-role-play', '/training/role-play', ['FS59']],
  ['m33', 'workforce-core-practice', '/workforce/core-skills/practice', ['FS58', 'FS59']],
];
const pageFile = (m: string, id: string) => {
  const line = readFileSync(`src/modules/${m}/routes.ts`, 'utf8').split('\n').find((l) => l.includes(`id: '${id}'`))!;
  return `src/modules/${m}/${line.match(/import\('\.\/([^']+)'\)/)![1]}.tsx`;
};

afterEach(() => { vi.useRealTimers(); });

describe('FS wave F · route registry', () => {
  it('338 routes after wave F (367 after wave G, 380 after wave H, 401 after wave I), and the 23 wave-F routes are registered', async () => {
    const { loadRoutes } = await import('../smoke/routes');
    const R = loadRoutes();
    expect(R.length).toBe(404); // Help centre 2026-10-17: + 3 (help, help-glossary, help-guide). FS wave I QA: + 21 (FS78/FS79 M34 5: my-learning-balance, team-study-time, workforce-learning-balances, my-external-certs, external-certs-queue; FS80 M29 4: workforce-ai-automations, workforce-ai-automation, my-ai-builds, admin-ai-automations; FS81 M30 4: my-transition-plan, workforce-transition-plans, workforce-transition-plan, workforce-rung-alerts; FS82/FS83 M36 6: my-grants, ecosystem-grants, workforce-grants, ecosystem-consortium, ecosystem-consortium-cohort, my-consortium; FS84 M17 2: team-skills-future, workforce-skills-inventory). FS wave H QA: + 13 (FS70-FS72 M28 7: skills-rising, skills-rising-method, workforce-skill-signals, my-manager-pulse, skills-technologies, admin-skills-technologies, my-skills-suggestions; FS73/FS74 M37 3: national-emirati-pipeline, my-future-wallet, national-future-wallet; FS77 M06 3: pathways-starter, my-induction, workforce-intake-baselines; FS75 shell digest and FS76 M13 none). FS wave G QA: + 29 (FS60/FS61 M35 6: workforce-disclosure, -metrics, -pack, workforce-pilots, workforce-pilot, skills-pilots; FS62/FS63 M37 5: national-alignment, -tag, national-report, national-occupations, admin-national-tags; FS64/FS65 M36 6: ecosystem-regional-plan, -commitments, -commitment, -demand-release, ecosystem-pledges, -register; FS66/FS67 M10 7: partner-university-programmes, training-university-programmes, university-programme, workforce-graduate-hires, universities-fellowships, university-fellowship, workforce-fellowships; FS68/FS69 M09 5: partner-future-readiness, admin-supplier-future-readiness, partner-prearrival, training-equivalency-prearrival, -share). FS wave F QA: + 23 (FS50/FS51 M35 7, FS54/FS55 M16 6, FS56/FS57 M25 3, FS58/FS59 M33 7; FS52/FS53 M07 none)
    const byId = new Map(R.map((r) => [r.id, r.path]));
    expect(WAVE_F.length).toBe(23);
    for (const [, id, path] of WAVE_F) expect(byId.get(id), id).toBe(path);
  });
});

describe('FS wave F · benchmark chips', () => {
  it('every wave-F page names its card\'s chips (FS52/FS53 on the outlook panels), and every chip is a published registry row with an https source and an as-of date', () => {
    for (const [m, id, , feats] of WAVE_F) {
      const src = readFileSync(pageFile(m, id), 'utf8');
      for (const fs of feats) expect(new RegExp(`feature=(\\{['"]?${fs}['"]?\\}|"${fs}")`).test(src), `${id} ${fs}`).toBe(true);
    }
    expect(readFileSync('src/modules/m07/automationUi.tsx', 'utf8')).toMatch(/feature="FS52"/);
    expect(readFileSync('src/modules/m07/marketUi.tsx', 'utf8')).toMatch(/feature="FS53"/);
    const bench = new Map(T.benchmarks.map((b) => [b.id, b]));
    for (const fs of ['FS50', 'FS51', 'FS52', 'FS53', 'FS54', 'FS55', 'FS56', 'FS57', 'FS58', 'FS59']) {
      expect(FEATURE_BENCHMARKS[fs]?.length, fs).toBeGreaterThan(0);
      for (const id of FEATURE_BENCHMARKS[fs]) {
        const b = bench.get(id);
        expect(b, `${fs} ${id}`).toBeTruthy();
        expect((b.urls as string[]).every((u) => u.startsWith('https://')) && !!b.as_of && b.listed, id).toBe(true);
      }
    }
  });
});

describe('FS wave F · FS51 <-> FS52 (shared F35 outlook)', () => {
  it('FS51 imports the outlook read-only, FS52 keeps its exports; adoption 0 reproduces the stored outlooks byte for byte; the stress test reads 10 of 10', () => {
    const m35 = ['forecast.ts', 'critical.ts', 'ui.tsx'].map((f) => readFileSync(`src/modules/m35/${f}`, 'utf8')).join('\n');
    const used = [...m35.matchAll(/import \{([^}]+)\} from '\.\.\/m07\/outlook(?:\.ts)?'/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().replace(/^type /, '').split(' ')[0]).filter(Boolean));
    expect(used.length).toBeGreaterThan(0);
    for (const n of used) if (!/^[A-Z]/.test(n) || n === 'BASELINE' || n === 'LIMITS') expect(n in Outlook, n).toBe(true);
    expect(/from '\.\.\/m07\/backend/.test(m35)).toBe(false);
    const inp = Outlook.inputFromTables((t: string) => T[t] ?? []);
    for (const o of T.skill_outlooks) {
      const r = Outlook.outlookFor(inp, { ...o.params, automation_adoption: 0 });
      expect(r.code, o.id).toBe('ok');
      expect(JSON.stringify((r as Row).result), o.id).toBe(JSON.stringify(o.results));
    }
    const stress = T.skill_outlooks.find((o) => o.id === 'so-attrition-stress');
    expect([stress.results.totals.families_short, stress.results.totals.visible]).toEqual([10, 10]);
    const waveF = ['20261010261001_kafaa_fs61_strategy_forecasts.sql', '20261010262001_kafaa_fs62_outlook_automation.sql', '20261010263001_kafaa_fs63_taxonomy_governance.sql',
      '20261010264001_kafaa_fs64_skill_change_coverage.sql', '20261010265001_kafaa_fs65_aps_roleplay.sql', '20261010269001_kafaa_fs6qa_integration.sql'];
    for (const f of waveF) expect(readFileSync(`supabase/migrations/${f}`, 'utf8').includes('create or replace function kafaa_so_base('), f).toBe(false);
    expect(readFileSync('supabase/migrations/20261010261001_kafaa_fs61_strategy_forecasts.sql', 'utf8')).not.toMatch(/create or replace function kafaa_so_/);
  });
});

describe('FS wave F · FS54 -> F35 / FS51 methodology banner', () => {
  it('shows the catalogue methodology-change banner on /workforce/skills-outlook and on the FS51 pages', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${DAY}T09:00:00Z`));
    await renderPage(<SkillsOutlookPage />, { persona: 'chco', path: '/workforce/skills-outlook' });
    const b1 = await screen.findByTestId('m16-methodology-banner', {}, W);
    expect(b1.getAttribute('data-dashboard')).toBe('skills_outlook');
    expect(Number(b1.getAttribute('data-n'))).toBeGreaterThan(0);
    await renderPage(<ForecastMethodPage />, { persona: 'chco', path: '/workforce/skill-forecasts/method' });
    await waitFor(() => expect(screen.getAllByTestId('m16-methodology-banner').some((x) => x.getAttribute('data-dashboard') === 'skill_forecasts')).toBe(true), W);
    // every FS51 page carries it through the shared SimLabels row
    expect(readFileSync('src/modules/m35/ui.tsx', 'utf8')).toContain('<MethodologyBanner dashboard="skill_forecasts" />');
    for (const f of ['SkillForecastsPage', 'SkillForecastPage', 'ForecastVersionsPage', 'GenerationsPage']) expect(readFileSync(`src/modules/m35/${f}.tsx`, 'utf8'), f).toContain('<SimLabels');
  }, 120000);
});

describe('FS wave F · FS54 <-> FS57 one "taught by" rule', () => {
  it('the orphan audit takes course, pathway and external flags from FS57 taughtBy(); SQL kafaa_fs63_health reads kafaa_cov_taught', async () => {
    const b = new LocalBackend(); await b.whenReady(); await b.reset();
    const hd = localHealthData(b);
    const h = taxonomyHealth(hd, DAY);
    const tb = taughtBy({ skills: hd.skills as never, competencies: hd.competencies!, courses: hd.courses, course_skill_links: hd.courseSkillLinks, pathways: hd.pathways, pathway_gaps: hd.pathwayGaps!, external_resources: hd.externals! } as never);
    for (const s of h.skills) for (const k of ['course', 'pathway', 'external'] as const) expect(s[k], `${s.skill_id} ${k}`).toBe((tb.get(s.skill_id) ?? []).some((i) => i.kind === k));
    expect(h.skills.every((s) => s.orphan === (!s.taught && !s.role))).toBe(true);
    expect(Object.keys(TAUGHT_BY)).toEqual(['course', 'pathway', 'external', 'assessment', 'role']);
    expect(h.summary.orphans).toBeGreaterThan(0); // pathways whose learning step is empty no longer count as teaching
    const sql = readFileSync(QA, 'utf8');
    const fn = sql.slice(sql.indexOf('create or replace function kafaa_fs63_health'), sql.indexOf('end $$;', sql.indexOf('create or replace function kafaa_fs63_health')));
    expect(fn).toContain('kafaa_cov_taught()');
    expect(fn).not.toMatch(/kafaa_course_skill_links|from kafaa_pathways/);
  });
});

describe('FS wave F · FS55 lint covers the wave-F ranked lists', () => {
  it('the FS50 attention order, the FS52 automation ranking and the FS58 suggestion have engine cards; none uses a protected input', () => {
    expect(FSQA6_CARDS).toEqual(['critical_attention', 'outlook_automation', 'aps_next']);
    expect(T.engine_cards.length).toBe(RANKED_SURFACES.length);
    expect(RANKED_SURFACES.length).toBe(35); // FS wave H QA: + skill_suggestions (FS72, fsHe1)
    for (const s of RANKED_SURFACES.filter((x) => x.wave === 'FSQA6')) {
      const c = T.engine_cards.find((x) => x.id === s.card);
      expect(c, s.card).toBeTruthy();
      for (const f of s.functions) expect(c.scoring_functions, `${s.card} ${f}`).toContain(f);
      expect(c.inputs_excluded).toEqual(expect.arrayContaining(['gender', 'nationality_flag', 'age']));
      expect(s.ranks === 'people').toBe(false);
      expect(c.title_ar && c.purpose_ar && c.output_ar && c.oversight_ar && c.limitations_ar, s.card).toBeTruthy();
      for (const f of s.functions) {
        const [file, name] = f.split('#');
        const src = readFileSync(file, 'utf8');
        const start = src.search(new RegExp(`export\\s+function\\s+${name}\\b`));
        expect(start, f).toBeGreaterThanOrEqual(0);
        const body = src.slice(start, src.indexOf('\n}\n', start));
        expect(/\b(gender|nationality|nationality_flag|birth|age_band|date_of_birth)\b/.test(body), f).toBe(false);
      }
    }
    expect(readFileSync(QA, 'utf8')).toMatch(/insert into kafaa_engine_cards[\s\S]*on conflict \(id\) do nothing;/);
  });
});

describe('FS wave F · FS57 -> FS17', () => {
  it('the gap backlog is the decision layer over the M19 pathway gaps (no second backlog), every row has an owner; coverage() is import-free for FS66', () => {
    const open = T.pathway_gaps.filter((g) => g.status === 'open');
    const ids = new Set(T.gap_backlog.map((r) => r.id));
    for (const g of open) if (g.skill_id && g.level <= 2) expect(ids.has(`gb:${g.skill_id}:${g.level}`), g.id).toBe(true);
    expect(T.gap_backlog.every((r) => !!r.owner_role)).toBe(true);
    expect(Object.keys(T).filter((t) => /backlog/.test(t)).sort()).toEqual(['gap_backlog']);
    const src = readFileSync('src/modules/m25/coverage.ts', 'utf8');
    // import-free in the repo's sense: only type imports and .ts domain files, so node scripts (FS66 seed builders) load it directly
    for (const m of src.matchAll(/^import (type )?.* from '([^']+)';$/gm)) expect(!!m[1] || (m[2].endsWith('.ts') && m[2].includes('/domain/')), m[0]).toBe(true);
    for (const n of ['coverage', 'whatIf', 'taughtBy', 'courseSkills']) expect(new RegExp(`export function ${n}\\b`).test(src), n).toBe(true);
  });
});

describe('FS wave F · recorded-evidence union (handover 3.9)', () => {
  it('validated role-play feedback is recorded evidence that an F01 recompute keeps; fs65 is the newest shared redefinition with the full list', async () => {
    expect(RECORDED_REF_TABLES).toContain('roleplay_sessions');
    const b = new LocalBackend(); await b.whenReady(); await b.reset();
    const row = (b.raw('skill_evidence') as Row[]).find((e) => e.ref_table === 'roleplay_sessions' && e.active);
    expect(row).toMatchObject({ kind: 'rating', basis: 'validated' });
    expect(isRecordedEvidence(row as never)).toBe(true);
    await applySkills(b, row.person_id, '2026-10-11');
    expect((b.rawGet('skill_evidence' as never, row.id) as unknown as Row).active).toBe(true);
    const sql = readFileSync('supabase/migrations/20261010265001_kafaa_fs65_aps_roleplay.sql', 'utf8');
    const lists = sql.match(/'fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts'[^)]*\)/g) ?? [];
    expect(lists.length).toBe(2);
    for (const l of lists) for (const t of RECORDED_REF_TABLES) expect(l, t).toContain(`'${t}'`);
    expect(readFileSync(QA, 'utf8')).not.toMatch(/create or replace function kafaa_skills_apply|create or replace function kafaa_skill_states_v2/);
  });
});

describe('FS wave F · skills passport label', () => {
  it('labels validated role-play feedback', () => {
    let title = '', system = '';
    const d = { courses: [], quals: [], standards: [], training: [], attempts: [], forms: [], badges: [], mcAwards: [] } as never;
    function Probe() {
      const label = useEvidenceLabel(d);
      const r = label({ kind: 'rating', basis: 'validated', ref_table: 'roleplay_sessions', ref_id: 'rp-s-0001' });
      title = r.title; system = r.system;
      return null;
    }
    render(<MemoryRouter><I18nProvider><Probe /></I18nProvider></MemoryRouter>);
    expect(title).toBe('Validated role-play feedback');
    expect(system).toBe('Human Skills Studio (reviewer-validated)');
  });
});

describe('FS wave F · FS59 -> F36', () => {
  it('a named reviewer sees the role-play review owed under approvals; deciding it removes the item', async () => {
    const b = new LocalBackend(); await b.whenReady(); await b.reset();
    const s = T.roleplay_sessions.find((x) => x.id === 'rp-s-0003');
    expect([s.review_status, s.reviewer_id]).toEqual(['requested', 'p-training-mgr']);
    const it0 = gatherDigest(localDigestData(b), 'p-training-mgr', '2026-10-11').find((i) => i.id === 'approval:roleplay_sessions:rp-s-0003');
    expect(it0).toMatchObject({ kind: 'approval', link: '/training/role-play?tab=reviews', ref_table: 'roleplay_sessions' });
    expect(it0!.why[0].code).toBe('approval_roleplay');
    expect(gatherDigest(localDigestData(b), s.person_id, '2026-10-11').some((i) => i.ref_table === 'roleplay_sessions')).toBe(false);
    expect(T.digest_runs.find((r) => r.id === 'dg:p-training-mgr:2026-W41').items.some((i: Row) => i.ref_table === 'roleplay_sessions')).toBe(true);
    b.setPersona('training-mgr'); await b.whenReady();
    const r = await b.rpc.attachRoleplayEvidence({ session_id: 'rp-s-0003', decision: 'decline', note: 'Please repeat the turnover with the open items read back.' });
    expect(r.ok).toBe(true);
    expect(gatherDigest(localDigestData(b), 'p-training-mgr', '2026-10-11').some((i) => i.id === 'approval:roleplay_sessions:rp-s-0003')).toBe(false);
    const sql = readFileSync(QA, 'utf8');
    expect(sql).toContain("'approval:roleplay_sessions:' || r.id");
    expect(sql).toContain("'/training/role-play?tab=reviews'");
  });
});

describe('FS wave F · FS56 after FS59', () => {
  it('the stored skill-change measures equal the rule on the final seed (after the validated role-play evidence)', () => {
    const stored = T.skill_change_measures.map(({ computed_at, computed_by, ...r }: Row) => { void computed_at; void computed_by; return r; });
    expect(JSON.stringify(stored)).toBe(JSON.stringify(skillChange(skillChangeWorld(T as never), DAY)));
  });
});

describe('FS wave F · migration', () => {
  it('is additive: two functions replaced with the same signatures, engine cards on conflict do nothing, guarded updates only', () => {
    const raw = readFileSync(QA, 'utf8');
    expect(/\b(drop|delete|truncate)\b/i.test(raw)).toBe(false);
    const sql = raw.replace(/--.*$/gm, '').replace(/\$j\$[\s\S]*?\$j\$/g, "''");
    expect([...sql.matchAll(/create or replace function (\w+)/g)].map((m) => m[1])).toEqual(['kafaa_fs63_health', 'kafaa_dg_gather']);
    expect(/\balter\b|\bcreate (table|index|policy|trigger)\b/i.test(sql)).toBe(false);
    expect([...sql.matchAll(/insert into (\w+)/g)].map((m) => m[1])).toEqual(['kafaa_engine_cards']);
    const data = sql.slice(sql.indexOf('-- 5.') >= 0 ? sql.indexOf('-- 5.') : sql.lastIndexOf("select set_config('kafaa.seeding'"));
    const upd = [...data.matchAll(/\bupdate (\w+) set/g)].map((m) => m[1]);
    expect(upd.filter((u) => u === 'kafaa_digest_runs').length).toBe(7);
    expect(upd.filter((u) => u === 'kafaa_notifications').length).toBe(7);
    expect((data.match(/\n where id = '[^']+' and /g) ?? []).length).toBe(14);
    expect(raw).toMatch(/create or replace function kafaa_fs63_health\(p_day date\) returns jsonb/);
    expect(raw).toMatch(/create or replace function kafaa_dg_gather\(p_me text, p_today date, p_hints jsonb\) returns jsonb/);
  });
});
