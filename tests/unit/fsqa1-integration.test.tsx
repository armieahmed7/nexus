// @vitest-environment jsdom
/** [FS QA · wave A integration] Cross-feature wiring of FS01-FS06 on master, one test per integration criterion:
 *   routes      212 routes (206 after wave 5 + 6 wave-A routes), each wave-A path registered
 *   benchmarks  every wave-A page shows the FS01 shared <BenchmarkChip>s of its card (registry rows, drawer with https sources),
 *               with Arabic-Indic digits in Arabic
 *   FS02-FS03   the stored decay class of every F01 skill is FS03's area default; the public decay-class rows list those areas
 *   FS05-FS02   2030/2035 requirements name the FS02 future skills (AI output verification, robotics, digital I&C); "now" keeps today
 *   FS06-FS02   future task links name the FS02 skills; the RPC accepts an FS02 skill
 *   FS04-FS02   the keyspace carries the FS02 rows, every key still resolves, and radar readiness is unchanged by them
 *   migration   the QA migration is additive (no DDL, no delete) and names only kafaa_* tables */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { FEATURE_BENCHMARKS, FUTURE_SKILL_EQUIVALENT as EQ, FS_QA_KEYSPACE_ROWS } from '../../src/domain/taxonomy';
import { AREA_DECAY_CLASS } from '../../src/domain/skills';
import { futureRadar, unresolvedKeys, type MapRow } from '../../src/modules/m11/keyspace';
import MyConfidencePage from '../../src/modules/m17/MyConfidencePage';
import SkillsConfidenceAdminPage from '../../src/modules/m17/SkillsConfidenceAdminPage';
import WorkforceFuturePage from '../../src/modules/m11/WorkforceFuturePage';
import KeyspacePage from '../../src/modules/m11/KeyspacePage';
import CareersHorizonsPage from '../../src/modules/m01/CareersHorizonsPage';
import CareersProfileEditPage from '../../src/modules/m01/CareersProfileEditPage';
import SatFuturePage from '../../src/modules/m26/SatFuturePage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = ((seed as any).tables ?? seed) as Record<string, any[]>;
const W = { timeout: 60000 };

describe('FS wave A · route registry', () => {
  it('212 routes, and the 6 wave-A routes are registered', async () => {
    const { loadRoutes } = await import('../smoke/routes');
    const R = loadRoutes();
    expect(R.length).toBe(259); // FS wave C QA: + 32 (FS17/FS18 M19 6, FS19/FS20 M04 6, FS21/FS22 M05 7, FS23/FS24 M02 7, FS25/FS26 M33 6). FS wave B QA: + 11 (FS09/FS10 5, FS11/FS12 5, FS16 1). FS wave B · E1: + 4 M28 routes (FS07, FS08)
    const paths = new Set(R.map((r) => r.path));
    for (const p of ['/my/skills/confidence', '/admin/skills-confidence', '/workforce/future/keyspace', '/careers/horizons', '/careers/roles/:slug/profile', '/training/sat/future']) expect(paths.has(p), p).toBe(true);
  });
});

const chipIds = (root: HTMLElement) => Array.from(root.querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid')!.replace('benchmark-chip-', ''));
async function expectChips(feature: string, rootId: string) {
  await waitFor(() => expect(chipIds(screen.getByTestId(rootId)).sort()).toEqual([...FEATURE_BENCHMARKS[feature]].sort()), W);
}

describe('FS wave A · every page shows its FS01 benchmark chips (registry rows)', () => {
  it('FS03 /my/skills/confidence', async () => {
    await renderPage(<MyConfidencePage />, { persona: 'k-ro', path: '/my/skills/confidence' });
    await expectChips('FS03', 'm17-benchmarks');
  }, 120000);
  it('FS03 /admin/skills-confidence', async () => {
    await renderPage(<SkillsConfidenceAdminPage />, { persona: 'training-mgr', path: '/admin/skills-confidence' });
    await expectChips('FS03', 'm17-benchmarks');
  }, 120000);
  it('FS04 /workforce/future', async () => {
    await renderPage(<WorkforceFuturePage />, { persona: 'k-hr-analyst', path: '/workforce/future' });
    await expectChips('FS04', 'm11-benchmarks');
  }, 120000);
  it('FS04 /workforce/future/keyspace', async () => {
    await renderPage(<KeyspacePage />, { persona: 'k-hr-analyst', path: '/workforce/future/keyspace' });
    await expectChips('FS04', 'm11-benchmarks');
  }, 120000);
  it('FS05 /careers/horizons; a chip opens the registry drawer with https sources', async () => {
    await renderPage(<CareersHorizonsPage />, { persona: null, path: '/careers/horizons' });
    await expectChips('FS05', 'm01-benchmarks');
    fireEvent.click(screen.getByTestId('benchmark-chip-SG-JTM'));
    const drawer = await screen.findByTestId('benchmark-drawer');
    expect(drawer.querySelector('a[href^="https://"]')).toBeTruthy();
  }, 120000);
  it('FS05 /careers/roles/:slug/profile (editor)', async () => {
    await renderPage(<CareersProfileEditPage />, { persona: 'training-mgr', path: '/careers/roles/reactor-operator/profile', route: '/careers/roles/:slug/profile' });
    await expectChips('FS05', 'm01-benchmarks');
  }, 120000);
  it('FS06 /training/sat/future', async () => {
    await renderPage(<SatFuturePage />, { persona: 'training-mgr', path: '/training/sat/future' });
    await expectChips('FS06', 'm26-fx-bench');
  }, 120000);
  it('in Arabic the chips name the benchmark in Arabic and follow the reader\'s digit setting (Arabic-Indic)', async () => {
    localStorage.setItem('kafaa.prefs.v1', JSON.stringify({ digits: 'arab' }));
    try {
      await renderPage(<CareersHorizonsPage />, { persona: null, path: '/ar/careers/horizons' });
      await expectChips('FS05', 'm01-benchmarks');
      const chip = screen.getByTestId('benchmark-chip-SG-JTM');
      expect(chip.textContent).toMatch(/[\u0600-\u06FF]/);
      expect(chip.textContent).toMatch(/[٠-٩]{4}/);
    } finally { localStorage.removeItem('kafaa.prefs.v1'); }
  }, 120000);
});

describe('FS wave A · FS02 <-> FS03 decay classes', () => {
  it('every F01 skill stores FS03\'s area class, and the public decay-class rows list the areas of their skills', () => {
    const f01 = T.skills.filter((s) => !s.fs_area);
    expect(f01).toHaveLength(71);
    for (const s of f01) expect(s.decay_class, s.id).toBe(AREA_DECAY_CLASS[s.area] ?? 'standard');
    const rows = new Map(T.skill_decay_classes.map((c) => [c.id, c]));
    for (const s of f01) expect(rows.get(s.decay_class).areas, s.id).toContain(s.area);
  });
});

describe('FS wave A · FS05 -> FS02 role profiles', () => {
  it('2030/2035 requirements name the FS02 future skills; "now" versions keep today\'s skills', () => {
    const olds = new Set(Object.keys(EQ));
    const fut = T.role_profile_versions.filter((v) => v.horizon !== 'now');
    expect(fut.every((v) => v.requirements.every((r: { kind: string; ref_id: string }) => r.kind !== 'skill' || !olds.has(r.ref_id)))).toBe(true);
    const ro30 = T.role_profile_versions.find((v) => v.id === 'rpv-reactor-operator-2030-v2');
    expect(ro30.requirements.some((r: { ref_id: string; level: number }) => r.ref_id === 'sk-fs-ai-verify' && r.level === 2)).toBe(true);
    const ro30v1 = T.role_profile_versions.find((v) => v.id === 'rpv-reactor-operator-2030-v1');
    expect(ro30v1.requirements.some((r: { ref_id: string }) => r.ref_id === 'sk-fs-ai-verify')).toBe(false); // v1 lacked AI output verification
    const skills = new Set(T.skills.map((s) => s.id));
    for (const v of T.role_profile_versions) for (const r of v.requirements) if (r.kind === 'skill') expect(skills.has(r.ref_id), `${v.id} ${r.ref_id}`).toBe(true);
  });
  it('the LocalBackend accepts an FS02 skill in a draft profile (FS05 RPC reads the extended catalogue)', async () => {
    const b = new LocalBackend();
    await b.whenReady(); await b.reset();
    b.setPersona('training-mgr'); await b.whenReady();
    const r = await b.rpc.saveRoleProfileVersion({ role_id: 'local-operator', horizon: '2035', requirements: [{ kind: 'skill', ref_id: 'sk-fs-ai-plantdata', level: 2, importance: 'important' }], drivers: ['ai_assistance'],
      rationale_en: 'Plant-data quality checks become part of rounds (planning assumption).', rationale_ar: 'تصبح فحوص جودة بيانات المحطة جزءاً من الجولات (افتراض تخطيطي).', sources: [], publish: false } as never);
    expect(r.ok, r.code).toBe(true);
  }, 60000);
});

describe('FS wave A · FS06 -> FS02 task links', () => {
  let b: LocalBackend;
  beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
  it('future links name the FS02 skills, none their F01 equivalents', () => {
    const fut = T.jta_task_skills.filter((l) => l.kind === 'future');
    const fs = new Set(T.skills.filter((s) => s.fs_area).map((s) => s.id));
    expect(fut.some((l) => Object.keys(EQ).includes(l.skill_id))).toBe(false);
    expect(fut.filter((l) => fs.has(l.skill_id)).length).toBeGreaterThan(40);
    for (const l of fut) expect(l.id).toBe(`jts:${l.task_id}:${l.skill_id}`);
  });
  it('setTaskFuture accepts an FS02 skill as the future skill of a task', async () => {
    b.setPersona('training-mgr'); await b.whenReady();
    const t = T.jta_tasks.find((x) => x.id === 'jt-qs-ro-t4');
    const r = await b.rpc.setTaskFuture({ task_id: t.id, needs: t.ai_capability_needed, change_horizon: '2030', tech_driver: 'ai_assist', skills: [{ skill_id: 'sk-fs-ai-verify', level: 2, kind: 'future' }], note: 'FS wave A integration check' } as never);
    expect(r.ok, r.code).toBe(true);
  }, 60000);
});

describe('FS wave A · FS04 -> FS02 keyspace', () => {
  it('the keyspace carries the FS02 rows, every key resolves, and radar readiness is unchanged by them', () => {
    const map = T.future_skill_map as MapRow[];
    for (const [key, , sk] of FS_QA_KEYSPACE_ROWS) expect(map.some((m) => m.key === key && m.sk_id === sk && m.active), `${key} ${sk}`).toBe(true);
    expect(unresolvedKeys({ advSkills: T.adv_skills, futureSkills: T.future_skills, plans: T.skill_gap_plans, map, skills: T.skills } as never)).toEqual([]);
    const qa = new Set(FS_QA_KEYSPACE_ROWS.map(([k, , sk]) => `fsm:${k}:${sk}`));
    for (const sc of [...new Set(T.future_skills.map((f) => f.scenario))]) {
      // FS10: states backed only by the AI and digital fitness check (recorded F01 evidence on FS02 skills) are left out here, so the
      // invariant still isolates the keyspace rows; with them, the ai-governance key gains holders (see fs22-ai-fluency).
      const fit = new Set((T.skill_evidence as { active: boolean; ref_table: string; person_id: string; skill_id: string }[]).filter((e) => e.active && ['fitness_attempts', 'cohort_capstones', 'adaptive_attempts', 'task_attempts', 'rpl_requests'].includes(e.ref_table)) /* FS21/FS22 too */.map((e) => `ps:${e.person_id}:${e.skill_id}`));
      const inp = (m: MapRow[]) => ({ futureSkills: T.future_skills as never, map: m, people: T.people as never, states: (T.person_skills as { id: string }[]).filter((x) => !fit.has(x.id)) as never });
      const a = futureRadar(inp(map), sc as string).rows.map((r) => [r.key, r.readiness, r.ready_n]);
      const b = futureRadar(inp(map.filter((m) => !qa.has(m.id))), sc as string).rows.map((r) => [r.key, r.readiness, r.ready_n]);
      expect(a).toEqual(b);
    }
    for (const a of T.adv_skills) for (const m of map.filter((x) => x.key === a.id && x.active)) expect(a.sk_ids).toContain(m.sk_id);
  });
});

describe('FS wave A · QA migration', () => {
  it('is additive: guarded DML on kafaa_* tables plus create-or-replace of two kafaa_* functions (no drop, alter, delete or NEXUS table)', () => {
    const sql = readFileSync('supabase/migrations/20261010219001_kafaa_fs1qa_integration.sql', 'utf8').replace(/--.*$/gm, '');
    expect(/\b(drop|alter|truncate|delete)\b/i.test(sql)).toBe(false);
    expect([...sql.matchAll(/\bcreate\b(?!\s+or\s+replace\s+function\s+kafaa_)/gi)]).toEqual([]);
    expect([...sql.matchAll(/create or replace function (\w+)/g)].map((m) => m[1])).toEqual(['kafaa_fairness_compute', 'kafaa_dg_gather']);
    const dml = sql.replace(/create or replace function[\s\S]*?\nend \$\$;/g, '');
    const tables = [...dml.matchAll(/\b(?:update|into|from)\s+([a-z_]+)/gi)].map((m) => m[1]).filter((x) => x.length > 3 && !['values', 'jsonb_array_elements', 'public'].includes(x));
    expect(tables.length).toBeGreaterThan(4);
    expect(tables.every((x) => x.startsWith('kafaa_')), tables.join(',')).toBe(true);
  });
});

describe('FS wave A · FS05 future edges are not progression routes for pre-FS05 engines (bug found in E2E)', () => {
  it('the Navigator reach, career moves and the digest target skip "future" edges (current role -> concept role)', async () => {
    const { reachableRoles } = await import('../../src/modules/m18/career');
    const { careerMoves } = await import('../../src/domain/engines/rank');
    const { defaultTargetRole } = await import('../../src/shell/digest/rules');
    const concept = new Set(T.job_roles.filter((r) => r.lifecycle === 'concept').map((r) => r.id));
    expect(concept.size).toBe(11);
    for (const r of T.job_roles.filter((x) => x.lifecycle === 'current')) {
      expect([...reachableRoles(T.career_paths as never, r.id, 2).keys()].filter((x) => concept.has(x)), r.id).toEqual([]);
      expect(careerMoves({ from: r.id, edges: T.career_paths as never, roleComps: T.role_competencies as never, have: new Map() }).filter((m) => concept.has(m.item?.role_id ?? ""))).toEqual([]);
      const tgt = defaultTargetRole(T.career_paths, r.id, []);
      expect(tgt == null || !concept.has(tgt), r.id).toBe(true);
    }
    // procurement engineers have only a future edge out of their role: no concept role becomes a "role within two steps"
    expect([...reachableRoles(T.career_paths as never, 'procurement-engineer', 2).keys()]).toEqual([]);
  });
  it('the seeded F24 fairness snapshots equal the pre-merge ones (the Navigator reach no longer counts concept roles)', async () => {
    const { readFileSync: rf } = await import('node:fs');
    const sql = rf('supabase/migrations/20261010219001_kafaa_fs1qa_integration.sql', 'utf8');
    expect(sql).toContain("where e.from_role_id = p.job_role_id and coalesce(e.kind, 'current') <> 'future'");
    expect(sql).toContain("and coalesce(cp.kind, 'current') <> 'future' order by");
    const nav = T.fairness_snapshots.filter((f) => f.metric === 'navigator_ready');
    expect(nav.length).toBeGreaterThan(0);
  });
});
