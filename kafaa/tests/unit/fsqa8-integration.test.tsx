// @vitest-environment jsdom
/** [FS QA · wave H integration] Cross-feature wiring of FS70-FS77 on the integration branch, one test per integration criterion:
 *   routes          380 routes after wave H (367 after wave G + 13 wave-H routes; 401 after wave I), each wave-H path registered
 *   benchmarks      every wave-H page shows its card's FS01 benchmark chips
 *   FS70 lists      the stored Skills on the Rise lists and badge lists still equal the rules on the final seed
 *   FS70 -> FS75    the digest's rising-skill nudge reads the stored FS70 rows (data-only coupling)
 *   FS72 -> FS55    the inferred-skills surface has its engine card and fairness snapshot; managers read no suggestion
 *   FS72 -> 3.9     a confirmed suggestion is recorded claimed evidence that a recompute keeps
 *   FS74 <- evidence the wallet counts evidence only: a confirmed (claimed) suggestion never completes an item
 *   FS74 -> FS62    the wallet target is a national-alignment target, tagged, a dated leadership setting with who and when
 *   FS73 guard      observers, partners and managers never reach the Emirati pipeline (route guard and RPC)
 *   FS69 -> F36     pre-arrival checks owed reach the digest of the evaluator who opened the share, from the release day only
 *   FS75            the final digest keeps every rule: at most 7 items, idempotent per period, nothing before the release
 *   FS76            the future-skills set is part of the release gate (seeded run passes); concept roles read FS15 (QA_B)
 *   FS77            induction plans name their intake year's baseline (or are flagged stale)
 *   entry links     Dalil future mode, the wallet and the student starter are linked from the pages that hand off to them
 *   migration       the QA migration is additive (one internal function replaced, no removal words, no data statement) */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { screen } from '@testing-library/react';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import { isRecordedEvidence } from '../../src/domain/skills';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { RANKED_SURFACES } from '../../src/modules/m16/surfaces';
import { risingSkills, signalInputFromTables } from '../../src/modules/m28/signals';
import { technologyBadges, badgeInputFromTables } from '../../src/modules/m28/technologies';
import { effectiveLinks, TARGET_TABLES } from '../../src/modules/m37/national';
import { walletStatus, walletWorld } from '../../src/modules/m37/wallet';
import { baselineFor, planStale } from '../../src/modules/m06/starter';
import { buildDigestItems, gatherDigest, DIGEST_MAX } from '../../src/shell/digest/rules';
import { FS75_FROM } from '../../src/shell/digest/future';
import { localDigestData } from '../../src/shell/digest/backend/local';
import LadderPage from '../../src/modules/m29/LadderPage';
// @ts-expect-error untyped seed builder (.mjs)
import { SHARED_EVIDENCE_LISTS, WAVE_H_REF_TABLES, SIGNAL_FIELDS, withClaims } from '../../scripts/seed/ext/fsqa8-integration.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = ((seed as any).tables ?? seed) as Record<string, Row[]>;
const raw = (t: string) => T[t] ?? [];
const W = { timeout: 60000 };
const QA = 'supabase/migrations/20261010289001_kafaa_fs8qa_integration.sql';
const WAVE_H: [string, string, string, string][] = [
  ['m28', 'skills-rising', '/skills/rising', 'FS70'], ['m28', 'skills-rising-method', '/skills/rising/method', 'FS70'], ['m28', 'workforce-skill-signals', '/workforce/skill-signals', 'FS70'],
  ['m28', 'my-manager-pulse', '/my/manager-pulse', 'FS70'], ['m28', 'skills-technologies', '/skills/technologies', 'FS71'], ['m28', 'admin-skills-technologies', '/admin/skills/technologies', 'FS71'],
  ['m28', 'my-skills-suggestions', '/my/skills/suggestions', 'FS72'],
  ['m37', 'national-emirati-pipeline', '/national/emirati-pipeline', 'FS73'], ['m37', 'my-future-wallet', '/my/future-wallet', 'FS74'], ['m37', 'national-future-wallet', '/national/future-wallet', 'FS74'],
  ['m06', 'pathways-starter', '/pathways/journey/starter', 'FS77'], ['m06', 'my-induction', '/my/induction', 'FS77'], ['m06', 'workforce-intake-baselines', '/workforce/intake-baselines', 'FS77'],
];
const pageFile = (m: string, id: string) => {
  const line = readFileSync(`src/modules/${m}/routes.ts`, 'utf8').split('\n').find((l) => l.includes(`id: '${id}'`))!;
  return `src/modules/${m}/${line.match(/import\('\.\/([^']+)'\)/)![1]}.tsx`;
};
const fresh = async (persona: string | null = null) => {
  const b = new LocalBackend(); await b.whenReady(); await b.reset();
  b.setPersona(persona); await b.whenReady();
  return b;
};
const onDay = (iso = '2026-10-12T05:00:00Z') => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); };
const staff = () => T.people.filter((p) => p.kind === 'staff' && p.status === 'active');

afterEach(() => { vi.useRealTimers(); });

describe('FS wave H · route registry', () => {
  it('380 routes after wave H (401 after wave I), and the 13 wave-H routes are registered with their paths', async () => {
    const { ROUTES } = await import('../../src/routes/registry');
    const R = ROUTES as Row[];
    expect(R.length).toBe(406); // Orientation 2026-10-17: + 2 (future-skills, start). Help centre 2026-10-17: + 3 (help, help-glossary, help-guide). FS wave I QA: + 21 (FS78/FS79 M34 5: my-learning-balance, team-study-time, workforce-learning-balances, my-external-certs, external-certs-queue; FS80 M29 4: workforce-ai-automations, workforce-ai-automation, my-ai-builds, admin-ai-automations; FS81 M30 4: my-transition-plan, workforce-transition-plans, workforce-transition-plan, workforce-rung-alerts; FS82/FS83 M36 6: my-grants, ecosystem-grants, workforce-grants, ecosystem-consortium, ecosystem-consortium-cohort, my-consortium; FS84 M17 2: team-skills-future, workforce-skills-inventory). FS wave H QA: + 13 (FS70-FS72 M28 7, FS73/FS74 M37 3, FS77 M06 3; FS75 shell digest and FS76 M13 none)
    for (const [, id, path] of WAVE_H) expect(R.find((r) => r.id === id)?.path, id).toBe(path);
  });
});

describe('FS wave H · benchmarks', () => {
  it('every wave-H page shows its card benchmark chips (FS75 in the digest strip, FS76 on the ask page); every chip id is a listed registry row', () => {
    for (const [m, id, , fs] of WAVE_H) expect(readFileSync(pageFile(m, id), 'utf8'), id).toContain(`<BenchmarkChips feature="${fs}" />`);
    expect(readFileSync('src/shell/digest/FutureNudges.tsx', 'utf8')).toContain('<BenchmarkChips feature="FS75" />');
    expect(readFileSync('src/modules/m13/AskPage.tsx', 'utf8')).toContain('<BenchmarkChips feature="FS76" />');
    const bench = new Map(T.benchmarks.map((b) => [b.id, b]));
    for (const fs of ['FS70', 'FS71', 'FS72', 'FS73', 'FS74', 'FS75', 'FS76', 'FS77']) {
      expect(FEATURE_BENCHMARKS[fs]?.length, fs).toBeGreaterThan(0);
      for (const b of FEATURE_BENCHMARKS[fs]) expect(bench.get(b)?.listed && (bench.get(b)?.urls ?? []).length > 0 && (bench.get(b)?.urls ?? []).every((s: Row) => /^https:\/\//.test(typeof s === 'string' ? s : s.url)), `${fs} ${b}`).toBe(true);
    }
  });
});

describe('FS wave H · FS70/FS71 published lists', () => {
  it('every stored Skills on the Rise list and badge list equals the rule on the final seed (no later builder moved an input)', () => {
    const inp = signalInputFromTables(raw);
    for (const run of T.skill_signal_runs) {
      const want = (risingSkills(inp, run.quarter)?.rows ?? []).map((r: Row) => `${r.skill_id}:${r.category}:${r.rank}`).sort();
      expect(T.skill_signals.filter((s) => s.run_id === run.id).map((r) => `${r.skill_id}:${r.category}:${r.rank}`).sort(), run.quarter).toEqual(want);
    }
    const bin = badgeInputFromTables(raw);
    for (const q of new Set(T.technology_badges.map((b) => b.quarter))) {
      const res = technologyBadges(bin, q)!;
      expect(T.technology_badges.filter((b) => b.quarter === q && b.scope === 'enec').map((b) => b.technology_id).sort(), q).toEqual(res.hot.map((x: Row) => x.technology_id).sort());
    }
  });
});

describe('FS wave H · FS70 -> FS75', () => {
  it('the rising-skill nudge on the release day reads the stored FS70 rows of the newest quarter (category growing, families, rank)', () => {
    for (const s of T.skill_signals) for (const f of SIGNAL_FIELDS) expect(f in s, `${s.id} ${f}`).toBe(true);
    const latest = T.skill_signals.reduce((m, r) => (r.quarter > m ? r.quarter : m), '');
    const items = staff().flatMap((p) => gatherDigest(T as never, p.id, FS75_FROM).filter((i) => i.ref_table === 'skill_signals'));
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(T.skill_signals.some((s) => s.quarter === latest && s.skill_id === i.ref_id && s.category === 'growing'), i.id).toBe(true);
      expect(i.link).toBe(`/skills/${i.ref_id}`);
    }
    expect(staff().flatMap((p) => gatherDigest(T as never, p.id, '2026-10-11')).some((i) => i.ref_table === 'skill_signals')).toBe(false);
  });
});

describe('FS wave H · FS72 -> FS55', () => {
  it('the skill_suggestions surface has an engine card (protected inputs excluded) and a fairness snapshot; a manager reads only their own suggestions', async () => {
    expect(RANKED_SURFACES.some((s) => s.card === 'skill_suggestions')).toBe(true);
    const card = T.engine_cards.find((c) => c.id === 'skill_suggestions');
    const excl = (card.inputs_excluded ?? []).map((x: Row) => (typeof x === 'string' ? x : x.key));
    for (const k of ['gender', 'nationality_flag', 'age']) expect(excl).toContain(k);
    expect(T.skill_suggestion_fairness.length).toBeGreaterThan(0);
    const b = await fresh('sro');
    const rows = await b.list('skill_suggestions' as never) as Row[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.person_id === b.identity().personId)).toBe(true);
  }, 120000);
});

describe('FS wave H · FS72 -> 3.9 recorded evidence', () => {
  it('a confirmed suggestion writes rating evidence with basis claimed (level <= 2) that a skills recompute keeps; the shared lists name skill_suggestions', async () => {
    const b = await fresh('sro');
    const me = b.identity().personId!;
    const s = b.raw('skill_suggestions' as never).find((r: Row) => r.person_id === me && r.status === 'open') as Row;
    const r = await b.rpc.respondSuggestion(s.id, 'confirm');
    expect(r.ok).toBe(true);
    const ev = b.raw('skill_evidence').filter((e: Row) => e.ref_table === 'skill_suggestions' && e.ref_id === s.id && e.active);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ kind: 'rating', basis: 'claimed' });
    expect(Number(ev[0].level)).toBeLessThanOrEqual(2);
    expect(isRecordedEvidence(ev[0])).toBe(true);
    await applySkills(b, me, new Date().toISOString().slice(0, 10));
    expect(b.raw('skill_evidence').filter((e: Row) => e.id === ev[0].id && e.active)).toHaveLength(1);
    expect(WAVE_H_REF_TABLES).toEqual(['skill_suggestions']);
    for (const f of SHARED_EVIDENCE_LISTS) expect(readFileSync(f, 'utf8'), f).toContain("'skill_suggestions'");
  }, 120000);
});

describe('FS wave H · FS74 <- evidence only', () => {
  it('claimed states (what a confirmed FS72 suggestion adds) never complete a wallet item for any active staff member; the local wallet stays put after a confirmation', async () => {
    const ww = walletWorld(raw);
    const skills = [...new Set([...T.ai_skill_tracks.map((x) => x.skill_id), 'sk-da-01', ...T.core_skills.flatMap((c) => c.skill_ids ?? []), ...T.cec_competences.flatMap((c) => c.skill_ids ?? [])])];
    for (const p of staff()) {
      const base = walletStatus(p.id, ww.inputsFor(p.id), FS75_FROM);
      const claimed = walletStatus(p.id, { ...ww.inputsFor(p.id), states: withClaims(T, p.id, skills) }, FS75_FROM);
      expect(claimed.met, p.id).toBe(base.met);
    }
    const b = await fresh('sro');
    const before = (await b.rpc.myFutureWallet())!;
    const s = b.raw('skill_suggestions' as never).find((r: Row) => r.person_id === b.identity().personId && r.status === 'open') as Row;
    expect((await b.rpc.respondSuggestion(s.id, 'confirm')).ok).toBe(true);
    const after = (await b.rpc.myFutureWallet())!;
    expect(JSON.stringify(after.status ?? after)).toBe(JSON.stringify(before.status ?? before));
  }, 120000);
});

describe('FS wave H · FS74 -> FS62', () => {
  it('the wallet target is an FS62 target table, tagged to national strategies, and a dated leadership setting with who and when', () => {
    expect(TARGET_TABLES.wallet_targets).toEqual({ kind: 'target', measure: 'wallet_share' });
    const links = effectiveLinks({ tags: T.national_tags, links: T.tag_links, skills: T.skills, cec_competences: T.cec_competences }).filter((l) => l.target_table === 'wallet_targets');
    expect(links.map((l) => l.tag_id).sort()).toEqual(['nt-ai-2031', 'nt-jahiz']);
    const t = T.wallet_targets.find((x) => x.id === 'wt-core-five');
    expect(t).toMatchObject({ pct: 60, due_on: '2027-12-31', set_by: 'p-chco', set_by_role: 'hr_director', status: 'active' });
    expect(t.set_at).toBeTruthy();
    for (const f of ['20261010282001_kafaa_fs82_emirati_wallet.sql']) {
      const sql = readFileSync(`supabase/migrations/${f}`, 'utf8');
      for (const fn of ['kafaa_na_target', 'kafaa_na_link_problem', 'kafaa_na_links', 'kafaa_na_measure', 'kafaa_na_report_core']) expect(sql, fn).toMatch(new RegExp(`create or replace function ${fn}\\(`));
    }
  });
});

describe('FS wave H · FS73 guard', () => {
  it('the Emirati pipeline is guarded by role (HR analyst, HR director, auditor) and the RPC gives observers, partners and managers nothing', async () => {
    const { ROUTES } = await import('../../src/routes/registry');
    const r = (ROUTES as Row[]).find((x) => x.id === 'national-emirati-pipeline');
    expect(r.guard.anyRole).toEqual(['hr_analyst', 'hr_director', 'auditor']);
    expect(r.guard.grant).toBeUndefined();
    for (const p of ['k-observer', 'alnoor-gm', 'alnoor-qaqc', 'sro', 'k-university']) expect(await (await fresh(p)).rpc.emiratiPipeline('all'), p).toBeNull();
    expect(await (await fresh('k-hr-analyst')).rpc.emiratiPipeline('all')).not.toBeNull();
  }, 180000);
});

describe('FS wave H · FS69 -> F36', () => {
  it('the evaluator who opened a pre-arrival share on the contractor\'s behalf gets the check in the digest from the release day, with a deep link and a why in EN and AR', async () => {
    const en = JSON.parse(readFileSync('src/i18n/digest.en.json', 'utf8')).why;
    const ar = JSON.parse(readFileSync('src/i18n/digest.ar.json', 'utf8')).why;
    const owed = T.people.flatMap((p) => gatherDigest(T as never, p.id, FS75_FROM).filter((i) => i.ref_table === 'prearrival_shares').map((i) => ({ p: p.id, i })));
    expect(owed.length).toBeGreaterThan(0);
    for (const { p, i } of owed) {
      const pa = T.prearrival_shares.find((x) => x.id === i.ref_id);
      expect(pa).toMatchObject({ created_via: 'on_behalf', created_by: p, checked_at: null });
      expect(i).toMatchObject({ kind: 'approval', urgency: 2, link: `/training/equivalency/prearrival/${pa.id}`, due_on: pa.mobilise_on });
      for (const w of i.why) { expect(en[w.code], w.code).toBeTruthy(); expect(ar[w.code], w.code).toMatch(/[؀-ۿ]/); }
      expect(`${i.title_en} ${i.meta_en}`).not.toContain(T.people.find((x) => x.id === pa.person_id)?.display_name ?? '§');
    }
    expect(T.people.some((p) => gatherDigest(T as never, p.id, '2026-10-11').some((i) => i.ref_table === 'prearrival_shares'))).toBe(false);
    // audit 2026-10-13 (finding 4): on the release day the checks are seven weeks away, so the owed plant visit and role-play reviews
    // keep the 3 approval places; within APPROVAL_SOON_DAYS (14) of mobilisation the check ranks by days again and is in the digest
    onDay();
    const b = await fresh('training-mgr');
    const r = await b.rpc.buildDigest();
    expect(r.ok).toBe(true);
    const appr = r.data!.items.filter((i) => i.kind === 'approval').map((i) => i.ref_table);
    expect(appr).toContain('plant_visits');
    expect(appr).toContain('roleplay_sessions');
    expect(appr).not.toContain('prearrival_shares');
    onDay('2026-11-23T05:00:00Z');
    const b2 = await fresh('training-mgr');
    const r2 = await b2.rpc.buildDigest();
    expect(r2.ok).toBe(true);
    expect(r2.data!.items.some((i) => i.ref_table === 'prearrival_shares' && i.link === '/training/equivalency/prearrival/pa-calnoor01-mech')).toBe(true);
  }, 120000);
});

describe('FS wave H · FS75 final digest', () => {
  it('still at most 7 items and idempotent per period on the release day; no seeded digest is dated on or after the release', async () => {
    onDay();
    const b = await fresh('training-mgr');
    const me = b.identity().personId!;
    const r1 = await b.rpc.buildDigest();
    const r2 = await b.rpc.buildDigest();
    expect(r1.ok && r2.ok && !r2.data!.created && r2.data!.run_id === r1.data!.run_id).toBe(true);
    expect(r2.data!.items).toEqual(r1.data!.items);
    expect(r1.data!.items.length).toBeLessThanOrEqual(DIGEST_MAX);
    expect(r1.data!.items).toEqual(buildDigestItems(localDigestData(b), me, '2026-10-12', { muted_kinds: [] }));
    expect(T.digest_runs.every((x) => String(x.as_of).slice(0, 10) < FS75_FROM)).toBe(true);
  }, 120000);
});

describe('FS wave H · FS76', () => {
  it('the seeded release-gate run carries the future-skills set and passes; concept roles asked about directly read FS15 (QA_B)', () => {
    const ev = T.eval_runs.find((x) => x.id === 'eval-2026-10-fs76');
    expect(ev.pass).toBe(true);
    expect(ev.engine).toContain('future-v1');
    expect(ev.cited_correct / ev.in_scope_total).toBeGreaterThanOrEqual(0.95);
    expect(ev.security_correct).toBe(ev.security_total);
    expect(readFileSync('src/modules/m13/AdminDalilPage.tsx', 'utf8')).toMatch(/gatePass = .*\(!future \|\| future\.pass\)/);
    expect(readFileSync('src/modules/m13/career/engine.ts', 'utf8')).toContain('conceptReadiness');
  });
});

describe('FS wave H · FS77', () => {
  it('every induction plan names the baseline of its intake year (programme first, then all), or is flagged stale', () => {
    const pub = T.intake_baselines.filter((x) => x.status === 'published');
    let stale = 0;
    for (const p of T.induction_plans) {
      const s = planStale(p, T.intake_baselines);
      if (s) stale++;
      else expect(p.baseline_id ?? null, p.id).toBe(baselineFor(pub, Number(p.intake_year), p.programme)?.id ?? null);
    }
    expect(stale).toBe(1);
  });
});

describe('FS wave H · entry links', () => {
  it('Dalil future mode, the wallet and the student starter are linked from the pages that hand off to them', async () => {
    const src = (f: string) => readFileSync(`src/modules/${f}.tsx`, 'utf8');
    expect(src('m30/MyRole2030Page')).toContain("/ask?mode=future&q=${encodeURIComponent(t('m30.my.askQ'))}");
    expect(src('m29/MyFluencyPage')).toContain("/ask?mode=future&q=${encodeURIComponent(t('m29.my.askQ'))}");
    expect(src('m29/MyFluencyPage')).toContain('to="/my/future-wallet"');
    expect(src('m28/SkillPage')).toContain("/ask?mode=future&q=${encodeURIComponent(t('m28.skill.askQ'");
    expect(src('m19/MyPathwaysPage')).toContain("/ask?mode=future&q=${encodeURIComponent(t('m19.pw.my.askQ'))}");
    expect(src('m04/MyPlanPage')).toContain('to="/my/future-wallet"');
    await renderPage(<LadderPage />, { persona: null, path: '/learn/ai-fluency' });
    expect((await screen.findByTestId('m29-lad-to-starter', {}, W)).getAttribute('href')).toMatch(/\/pathways\/journey\/starter$/);
  }, 120000);
});

describe('FS wave H · QA migration', () => {
  it('is additive: one internal function replaced with the same signature and revoked from API roles, no removal words, no data statement', () => {
    const sql = readFileSync(QA, 'utf8');
    expect(/\b(drop|delete|truncate)\b/i.test(sql)).toBe(false);
    const body = sql.replace(/--.*$/gm, '');
    const top = body.replace(/\$\$[\s\S]*?\$\$/g, "''");
    expect([...body.matchAll(/create or replace function (\w+)\(([^)]*)\)/g)].map((m) => `${m[1]}(${m[2]})`)).toEqual(['kafaa_dg_future(p_me text, p_today date, p_out jsonb)']);
    expect(/\balter\b|\bcreate (table|index|policy|trigger)\b|\binsert into\b|\bupdate\b/i.test(top)).toBe(false);
    expect(top).toContain('revoke execute on function kafaa_dg_future(text, date, jsonb) from public, anon, authenticated;');
    expect(body).toContain("if p_today < date '2026-10-12' then return out; end if;");
  });
});
