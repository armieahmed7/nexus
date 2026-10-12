/** FS73 Emirati pipeline by competency + FS74 Future Skills Wallet target (FS wave H · E2, M37): one named test per acceptance criterion
 *  on the local path, plus the rules, the guard, RBAC, refusals, audit and ledger, the FS62 wiring, the seed, routes and i18n. The SQL path
 *  (kafaa_ep_* / kafaa_fw_* = pipeline.ts / wallet.ts, the five RPCs, RLS, grants, the redefined kafaa_na_* functions) is proved by
 *  scripts/validate/fs82-emirati-wallet.mjs (PGlite). */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { checkGuard } from '../../src/auth/guards';
import type { PlatformRole } from '../../src/auth/policy';
import { PROTECTED_INPUTS, functionBody, protectedRefs } from '../../src/modules/m16/transparency';
import en from '../../src/i18n/m37.en.json';
import ar from '../../src/i18n/m37.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m37/routes';
import { addMonths, areaReasons, emiratiPipeline, pipelineAllowed, pipelineRoles, pipelineWorldFrom, readyHorizons, successorEntry, EP_MIN, type EmiratiPipeline } from '../../src/modules/m37/pipeline';
import {
  ITEM_TITLE, WALLET_ITEMS, itemReasons, planActivityId, planEntries, planFor, targetProblem, walletCounter, walletStatus, walletWorld, type WalletInputs,
} from '../../src/modules/m37/wallet';
import { TARGET_TABLES, nationalReport, worldFrom } from '../../src/modules/m37/national';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const TODAY = new Date().toISOString().slice(0, 10);
const PW = pipelineWorldFrom((t) => T[t] ?? []);
const peopleCells = (ep: EmiratiPipeline) => [ep.total, ...ep.areas].flatMap((a) => [a.successors.emirati, a.successors.all, ...Object.values(a.successors.bands), ...a.ready_by.map((x) => x.n),
  a.progression.emirati, a.progression.all, ...a.progression.by_year.map((x) => x.n), ...a.retention.flatMap((x) => [x.cohort, x.retained])]);

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => (b.raw(t as never) as unknown as Row[]);
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

describe('FS73 · acceptance 1: the protected-input test still passes for every engine', () => {
  it('no engine card names an FS73 or FS74 function, and no new ranked surface exists (the F24 runner list is unchanged)', () => {
    const fns = T.engine_cards.flatMap((c) => c.scoring_functions as string[]);
    expect(fns.filter((f) => /m37\/|kafaa_(ep|fw)_|emirati|wallet/i.test(f))).toEqual([]);
    const src = readFileSync('src/modules/m37/pipeline.ts', 'utf8') + readFileSync('src/modules/m37/wallet.ts', 'utf8');
    expect(src).not.toMatch(/useEngine|lintRanked|\brank[A-Z]\w*\(/);
  });
  it('the wallet rule is a scoring of people and never names a protected field (static scan of walletStatus and walletCounter)', () => {
    const file = readFileSync('src/modules/m37/wallet.ts', 'utf8');
    for (const fn of ['walletStatus', 'walletCounter', 'planEntries']) expect(protectedRefs(functionBody(file, fn)!), fn).toEqual([]);
    expect(PROTECTED_INPUTS).toContain('nationality_flag');
  });
  it('run on rows that all carry gender, nationality and age, the wallet rule never reads them', () => {
    const reads: string[] = [];
    const trap = (r: Row) => new Proxy({ ...r, gender: 'f', nationality_flag: 'uae', age: 41 }, { get(t, k, rcv) { if (k === 'gender' || k === 'nationality_flag' || k === 'age') reads.push(String(k)); return Reflect.get(t, k, rcv); } });
    const wt = walletWorld((t) => (T[t] ?? []).map(trap));
    const st = walletStatus('p-k-ro', wt.inputsFor('p-k-ro'), TODAY);
    expect(st.items.length).toBe(5);
    expect(reads).toEqual([]);
  });
  it('nationality is read by the pipeline aggregate only (pipeline.ts is the one M37 rule that names it)', () => {
    const files = ['national.ts', 'occupations.ts', 'wallet.ts'].map((f) => readFileSync(`src/modules/m37/${f}`, 'utf8'));
    for (const s of files) expect(s).not.toMatch(/nationality_flag/);
    expect(readFileSync('src/modules/m37/pipeline.ts', 'utf8')).toMatch(/nationality_flag === 'uae'/);
  });
});

describe('FS73 · acceptance 2: every cell under 10 is suppressed', () => {
  it('on the seed, in every scope, every people count is null or 10 and more, and some cells are suppressed while others show', () => {
    for (const s of ['all', 'critical', 'future']) {
      const ep = emiratiPipeline(PW, s, TODAY);
      const cells = peopleCells(ep);
      expect(cells.every((v) => v === null || v >= EP_MIN), s).toBe(true);
      expect(cells.some((v) => v === null), s).toBe(true);
      expect(cells.some((v) => v !== null), s).toBe(true);
    }
  });
  it('a share is shown only when its count and base are both 10 or more; a role coverage only when its people count is', () => {
    const ep = emiratiPipeline(PW, 'all', TODAY);
    for (const a of [ep.total, ...ep.areas]) {
      if (a.successors.share_pct !== null) { expect(a.successors.emirati).not.toBeNull(); expect(a.successors.all).not.toBeNull(); }
      for (const r of a.retention) if (r.pct !== null) { expect(r.cohort).not.toBeNull(); expect(r.retained).not.toBeNull(); }
      for (const x of a.ready_by) if (x.roles !== null) expect(x.n).not.toBeNull();
    }
  });
  it('a world with a group of 9 Emirati successors shows <10, and 10 shows the count', () => {
    const slate = { id: 'ss-t', role_id: 'reactor-operator', period: '2099-H1', critical: true };
    const ppl = Array.from({ length: 10 }, (_, i) => ({ id: `p-t${i}`, kind: 'staff', status: 'active', nationality_flag: 'uae' }));
    const succ = (n: number) => ppl.slice(0, n).map((p, i) => ({ id: `sx-${i}`, slate_id: 'ss-t', person_id: p.id, cover_source: 'internal', readiness: 'ready_now', status: 'confirmed', proposed_at: '2026-01-01T00:00:00Z', months: 0 }));
    const w = (n: number) => ({ ...PW, people: [...PW.people, ...ppl], succession_slates: [...PW.succession_slates, slate], successors: succ(n), pipeline_mirror: [] });
    const nine = emiratiPipeline(w(9), 'all', TODAY).areas.find((a) => a.family_id === 'operations')!;
    const ten = emiratiPipeline(w(10), 'all', TODAY).areas.find((a) => a.family_id === 'operations')!;
    expect(nine.successors.emirati).toBeNull(); expect(nine.successors.bands.ready_now).toBeNull();
    expect(ten.successors.emirati).toBe(10); expect(ten.successors.bands.ready_now).toBe(10);
  });
});

describe('FS73 · acceptance 3: the page is never reachable by observers or partners (guard test)', () => {
  const r = routes.find((x) => x.id === 'national-emirati-pipeline')!;
  const can = (rs: PlatformRole[]) => checkGuard(r.guard, { status: 'signed_in', roles: rs } as never) === 'ok';
  it('the route uses an anyRole guard (hr_analyst, hr_director, auditor) and no workforce_analytics grant', () => {
    expect(r.guard.anyRole).toEqual(['hr_analyst', 'hr_director', 'auditor']);
    expect(r.guard.grant).toBeUndefined();
  });
  it('observers, partner users, partner admins, universities, managers, employees and the training manager are refused; HR and auditors pass', () => {
    for (const rs of [['observer'], ['partner_user'], ['partner_admin'], ['university'], ['manager'], ['employee'], ['training_manager'], ['admin'], ['public']] as PlatformRole[][]) expect(can(rs), rs.join()).toBe(false);
    for (const rs of [['hr_analyst'], ['hr_director'], ['auditor'], ['hr_analyst', 'hr_director']] as PlatformRole[][]) expect(can(rs), rs.join()).toBe(true);
    expect(checkGuard(r.guard, { status: 'anonymous', roles: ['public'] } as never)).toBe('signin');
  });
  it('the RPC mirrors the guard: k-observer, alnoor-gm, k-contractor, k-university, sro and k-admin get null; HR and auditors get the report', async () => {
    for (const p of ['k-observer', 'alnoor-gm', 'gulfhydro-qa', 'k-contractor', 'k-university', 'sro', 'k-admin', 'nse']) { await as(p); expect(await b.rpc.emiratiPipeline('all'), p).toBeNull(); }
    for (const p of ['chco', 'k-hr-analyst', 'k-auditor', 'presenter']) { await as(p); const ep = await b.rpc.emiratiPipeline('all'); expect(ep?.scope, p).toBe('all'); expect(ep?.total.roles).toBeGreaterThan(10); }
    await as(null); expect(await b.rpc.emiratiPipeline()).toBeNull();
    expect(pipelineAllowed(['observer', 'manager'])).toBe(false);
  });
});

describe('FS73 · the pipeline rules', () => {
  it('the role set is the critical and future roles: current, never concept, never security-sensitive; a growing outlook makes a role "future"', () => {
    const rs = pipelineRoles(PW);
    const jr = new Map(T.job_roles.map((j) => [j.id, j]));
    expect(rs.length).toBe(14);
    expect(rs.every((r) => jr.get(r.role_id)!.lifecycle === 'current' && !jr.get(r.role_id)!.security_sensitive)).toBe(true);
    expect(rs.find((r) => r.role_id === 'nuclear-oversight-npi')).toMatchObject({ critical: false, future: true });
    expect(rs.find((r) => r.role_id === 'chemistry-technician')).toMatchObject({ critical: true, future: false }); // a critical slate
    expect(rs.some((r) => r.role_id === 'outage-manager-planner')).toBe(false); // a leadership slate only, outlook changing
  });
  it('concept roles never enter, even with a slate full of Emirati successors (QA_A gap: M23 readers audited)', () => {
    const concept = T.job_roles.find((j) => j.lifecycle === 'concept')!;
    const ppl = Array.from({ length: 12 }, (_, i) => ({ id: `p-c${i}`, kind: 'staff', status: 'active', nationality_flag: 'uae' }));
    const w = { ...PW, people: [...PW.people, ...ppl], succession_slates: [...PW.succession_slates, { id: 'ss-c', role_id: concept.id, period: '2026-H2', critical: true }],
      successors: [...PW.successors, ...ppl.map((p, i) => ({ id: `sx-c${i}`, slate_id: 'ss-c', person_id: p.id, cover_source: 'internal', readiness: 'ready_now', status: 'confirmed', proposed_at: '2026-01-01T00:00:00Z' }))] };
    const a = emiratiPipeline(w, 'all', TODAY); const b0 = emiratiPipeline(PW, 'all', TODAY);
    expect(a.roles.some((r) => r.role_id === concept.id)).toBe(false);
    expect(a.total.successors).toEqual(b0.total.successors);
  });
  it('successor entries: HR readiness first, ready-by date from the proposal plus months (band default when missing); withdrawn and external cover never count', () => {
    expect(successorEntry({ readiness: 'ready_now', proposed_at: '2026-01-05T00:00:00Z' }, '2026-10-12')).toEqual({ band: 'ready_now', ready_by: '2026-10-12' });
    expect(successorEntry({ readiness: null, computed_readiness: '1_2y', months: 18, proposed_at: '2026-01-31T00:00:00Z' }, '2026-10-12')).toEqual({ band: '1_2y', ready_by: '2027-07-31' });
    expect(successorEntry({ readiness: '3_5y', months: null, proposed_at: '2026-02-28T00:00:00Z' }, '2026-10-12')!.ready_by).toBe('2031-02-28');
    expect(successorEntry({ readiness: null, computed_readiness: null }, '2026-10-12')).toBeNull();
    const ep = emiratiPipeline(PW, 'all', TODAY);
    const internal = new Set(T.successors.filter((s) => s.status !== 'withdrawn' && s.cover_source === 'internal' && s.person_id).map((s) => s.person_id));
    expect(ep.total.successors.all).toBeLessThanOrEqual(internal.size);
  });
  it('addMonths clamps to the month end and handles negative months; the horizons end at the year ends and 2030', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    expect(addMonths('2026-10-12', -36)).toBe('2023-10-12');
    expect(addMonths('2025-12-31', 13)).toBe('2027-01-31');
    expect(readyHorizons('2026-10-12')).toEqual(['2026-12-31', '2027-12-31', '2028-12-31', '2030-12-31']);
    expect(readyHorizons('2029-01-01')).toEqual(['2029-12-31', '2030-12-31', '2031-12-31']);
  });
  it('retention and progression come from the SIMULATED, de-identified HR mirror: no person id, no name, every row SIMULATED', () => {
    expect(T.pipeline_mirror.length).toBeGreaterThan(400);
    expect(T.pipeline_mirror.every((m) => m.simulated && m.source === 'SIMULATED HR mirror' && !('person_id' in m) && !('name' in m) && m.open_read === false)).toBe(true);
    expect(Object.keys(SCHEMA.pipeline_mirror.cols)).not.toContain('person_id');
    const ep = emiratiPipeline(PW, 'all', TODAY);
    expect(ep.total.retention.map((r) => r.months)).toEqual([12, 24, 36]);
    expect(ep.total.retention[0].pct).not.toBeNull();
    expect(ep.total.progression.emirati).toBeGreaterThanOrEqual(10);
    expect(areaReasons(ep.total).map((r) => r.code)).toContain('ep_mirror');
  });
  it('the mirror table is read by nobody directly (always-false open_read on workforce_strategy)', async () => {
    for (const p of ['chco', 'k-admin', 'k-auditor', 'k-hr-analyst']) { await as(p); expect((await b.list('pipeline_mirror' as never)).length, p).toBe(0); }
  });
});

describe('FS74 · acceptance 1: wallet status is computed from evidence only', () => {
  const base = (): WalletInputs => ({ cells: T.ai_rungs, tracks: T.ai_skill_tracks, cec: T.cec_competences, core: T.core_skills, states: [], awards: [] });
  it('self-ratings never count: a claimed level 4 in data literacy and in a core skill leaves both items open', () => {
    const cs = T.core_skills[0];
    const st = walletStatus('p-x', { ...base(), states: [
      { id: 'ps:p-x:sk-da-01', person_id: 'p-x', skill_id: 'sk-da-01', level: 4, basis: 'claimed', active: true },
      { id: `ps:p-x:${cs.skill_ids[0]}`, person_id: 'p-x', skill_id: cs.skill_ids[0], level: 4, basis: 'claimed', active: true },
    ] }, TODAY);
    expect(st.items.find((i) => i.key === 'plant_data')!.met).toBe(false);
    expect(st.items.find((i) => i.key === 'core_skill')!.met).toBe(false);
    const ev = walletStatus('p-x', { ...base(), states: [
      { id: 'ps:p-x:sk-da-01', person_id: 'p-x', skill_id: 'sk-da-01', level: 1, basis: 'evidenced', active: true },
      { id: `ps:p-x:${cs.skill_ids[0]}`, person_id: 'p-x', skill_id: cs.skill_ids[0], level: 2, basis: 'validated', active: true },
    ] }, TODAY);
    expect(ev.items.find((i) => i.key === 'plant_data')).toMatchObject({ met: true, level: 1, ref_table: 'person_skills', ref_id: 'ps:p-x:sk-da-01' });
    expect(ev.items.find((i) => i.key === 'core_skill')).toMatchObject({ met: true, level: 2, ref_table: 'core_skills' });
  });
  it('the cyber hygiene item needs an awarded, in-date MC-CYBER-HYGIENE micro-credential (expired, revoked or pending never count)', () => {
    const aw = (x: Row) => walletStatus('p-x', { ...base(), awards: [{ id: 'mca-x', def_code: 'MC-CYBER-HYGIENE', status: 'awarded', issued_on: '2026-01-01', valid_to: '2099-01-01', ...x }] }, TODAY).items[1];
    expect(aw({})).toMatchObject({ met: true, ref_table: 'microcred_awards', ref_id: 'mca-x', until: '2099-01-01' });
    expect(aw({ valid_to: '2020-01-01' }).met).toBe(false);
    expect(aw({ status: 'revoked' }).met).toBe(false);
    expect(aw({ status: 'pending_approval' }).met).toBe(false);
    expect(aw({ def_code: 'MC-SCWE' }).met).toBe(false);
  });
  it('every seeded staff wallet equals the rule on the live tables; the AI and CleanEnergyComp items reuse FS09 aiRung and FS41 cecLevel', async () => {
    await as('k-ro');
    const mine = await b.rpc.myFutureWallet();
    const ww = walletWorld(raw);
    expect(mine!.status).toEqual(walletStatus('p-k-ro', ww.inputsFor('p-k-ro'), TODAY));
    expect(mine!.status.items.map((i) => i.key)).toEqual([...WALLET_ITEMS]);
    const src = readFileSync('src/modules/m37/wallet.ts', 'utf8');
    expect(src).toMatch(/import \{ aiRung \} from '\.\.\/m29\/fluency\.ts'/);
    expect(src).toMatch(/import \{ cecLevel \} from '\.\.\/m32\/cec\.ts'/);
    expect(itemReasons(mine!.status.items[0]).map((r) => r.code)).toContain('fw_evidence_only');
  });
});

describe('FS74 · acceptance 2: the counter shows its definition and target date', () => {
  it('the counter carries the target value and date and the five-item definition; every count under 10 is suppressed', async () => {
    await as('chco');
    const c = await b.rpc.futureWalletCounter();
    expect(c!.target).toMatchObject({ pct: 60, due_on: '2027-12-31', metric: 'core_five_complete' });
    expect(c!.items.map((i) => i.key)).toEqual([...WALLET_ITEMS]);
    for (const v of [c!.staff, c!.complete, ...c!.items.map((i) => i.n), ...c!.distribution.map((d) => d.n), ...c!.families.flatMap((f) => [f.staff, f.complete])]) expect(v === null || v >= 10).toBe(true);
    expect(c!.families.some((f) => ['security', 'safeguards', 'cyber'].includes(f.family_id))).toBe(false);
    expect(c).toEqual(walletCounter(walletWorld(raw), TODAY));
    expect(en.fw.item.ai_rung2.rule).toBeTruthy(); expect(en.fwc.definition).toBe('Definition');
  });
  it('the counter is for national_alignment Agg/W/A only: HR analyst, HR director, admins; staff, auditors and observers get null', async () => {
    for (const p of ['k-hr-analyst', 'chco', 'k-admin']) { await as(p); expect(await b.rpc.futureWalletCounter(), p).not.toBeNull(); }
    for (const p of ['k-ro', 'nse', 'k-auditor', 'k-observer', 'alnoor-gm']) { await as(p); expect(await b.rpc.futureWalletCounter(), p).toBeNull(); }
  });
});

describe('FS74 · acceptance 3: the target date and value are a leadership setting, shown with who set them and when', () => {
  it('the seeded setting names the HR director role card and the date it was set (a parameter, not a claim)', async () => {
    await as('k-ro');
    const t = (await b.rpc.myFutureWallet())!.target!;
    expect(t).toMatchObject({ set_by: 'p-chco', set_by_role: 'hr_director', set_at: '2026-10-05T09:00:00Z', version: 1 });
    expect(t.set_by_name_en).toMatch(/role card/);
    expect(t.note_en).toMatch(/not a claim/);
    expect(t.sources.every((s: Row) => readFileSync('../docs/kafaa/ref/research/national_systems.md', 'utf8').includes(s.url))).toBe(true);
  });
  it('setWalletTarget: staff, the HR analyst and admins are refused; bad values and an unchanged target are refused; the HR director sets it with history, audit and ledger', async () => {
    const good = { pct: 65, due_on: '2028-06-30', note_en: 'Leadership raised the demo target.', note_ar: 'رفعت القيادة هدف العرض التوضيحي.' };
    for (const p of ['k-ro', 'k-hr-analyst', 'k-admin']) { await as(p); const r = await b.rpc.setWalletTarget(good); expect(r.ok, p).toBe(false); expect(r.code).toBe('forbidden'); }
    await as('chco');
    expect((await b.rpc.setWalletTarget({ ...good, pct: 0 })).code).toBe('invalid');
    expect((await b.rpc.setWalletTarget({ ...good, due_on: '2020-01-01' })).code).toBe('invalid');
    expect((await b.rpc.setWalletTarget({ ...good, pct: 60, due_on: '2027-12-31' })).code).toBe('unchanged');
    const a0 = raw('audit_events').length; const l0 = raw('ledger_local').length;
    const r = await b.rpc.setWalletTarget(good);
    expect(r.ok).toBe(true); expect(r.data!.version).toBe(2);
    expect(raw('audit_events').length).toBe(a0 + 1); expect(raw('ledger_local').length).toBe(l0 + 1);
    const c = (await b.rpc.futureWalletCounter())!;
    expect(c.target).toMatchObject({ pct: 65, due_on: '2028-06-30', set_by: 'p-chco', version: 2 });
    expect(c.target!.set_at.slice(0, 10)).toBe(TODAY);
    expect(c.target!.history).toEqual([expect.objectContaining({ version: 1, pct: 60, due_on: '2027-12-31', set_by: 'p-chco', set_at: '2026-10-05T09:00:00Z' })]);
    await b.reset();
  });
  it('targetProblem: a whole percentage 1-100, a date after today and by 2035, notes of 10-300 characters in EN and AR, no headcounts', () => {
    const ok = { pct: 60, due_on: '2027-12-31', note_en: 'A leadership decision.', note_ar: 'قرار قيادي للعرض.' };
    expect(targetProblem(ok, '2026-10-12')).toBeNull();
    expect(targetProblem({ ...ok, pct: 60.5 }, '2026-10-12')).toBe('pct');
    expect(targetProblem({ ...ok, due_on: '2027-02-30' }, '2026-10-12')).toBe('due');
    expect(targetProblem({ ...ok, due_on: '2036-01-01' }, '2026-10-12')).toBe('due');
    expect(targetProblem({ ...ok, note_ar: 'قصير' }, '2026-10-12')).toBe('note');
    expect(targetProblem({ ...ok, note_en: 'Covers the headcount on site at Barakah.' }, '2026-10-12')).toBe('clean');
  });
  it('the target table is written only through the RPC (write mode rpc on workforce_strategy) and read by staff (national_alignment)', () => {
    expect(SCHEMA.wallet_targets.write).toEqual({ mode: 'rpc', res: 'workforce_strategy' });
    expect(SCHEMA.wallet_targets.read).toEqual([{ res: 'national_alignment' }]);
  });
});

describe('FS74 · each wallet links to the development plan', () => {
  it('addWalletToPlan adds one planned activity per open item to the open plan, never twice; the wallet then shows them as in the plan', async () => {
    await as('k-ro');
    const before = (await b.rpc.myFutureWallet())!;
    const open = before.status.items.filter((i) => !i.met).map((i) => i.key);
    expect(before.plan?.id).toBe('dp-k-ro');
    expect(before.in_plan.plant_data).toBe('in_progress'); // seeded by fs73-emirati-wallet.mjs
    const r = await b.rpc.addWalletToPlan();
    expect(r.ok).toBe(true);
    expect(r.data).toMatchObject({ plan_id: 'dp-k-ro', plan_created: false, created: open.filter((k) => k !== 'plant_data').length, existing: open.includes('plant_data') ? 1 : 0 });
    const again = await b.rpc.addWalletToPlan();
    expect(again.data!.created).toBe(0);
    const acts = raw('plan_activities').filter((a) => a.id.startsWith('pa-fs74-p-k-ro-'));
    expect(acts.map((a) => a.id).sort()).toEqual(open.map((k) => planActivityId('p-k-ro', k)).sort());
    expect(acts.every((a) => a.due_on === '2027-12-31' && a.title_en === ITEM_TITLE[a.id.replace('pa-fs74-p-k-ro-', '') as keyof typeof ITEM_TITLE].en)).toBe(true);
    const after = (await b.rpc.myFutureWallet())!;
    for (const k of open) expect(after.in_plan[k]).toBeTruthy();
    await b.reset();
  });
  it('a person with no open plan gets a draft plan; auditors and partners are refused; a complete wallet has nothing to add', async () => {
    await as('nse');
    const r = await b.rpc.addWalletToPlan();
    if (raw('dev_plans').some((p) => p.person_id === 'p-nse' && p.id !== 'dp-fs74-p-nse' && ['draft', 'submitted', 'approved', 'active'].includes(p.status))) expect(r.data!.plan_created).toBe(false);
    else { expect(r.ok).toBe(true); expect(r.data!.plan_created).toBe(true); expect(raw('dev_plans').find((p) => p.id === 'dp-fs74-p-nse')).toMatchObject({ status: 'draft', person_id: 'p-nse' }); }
    for (const p of ['k-auditor', 'alnoor-gm']) { await as(p); expect((await b.rpc.addWalletToPlan()).code, p).toBe('forbidden'); }
    const done = { items: WALLET_ITEMS.map((k) => ({ key: k, met: true, level: 1, ref_table: null, ref_id: null, until: null })), met: 5, complete: true };
    expect(planEntries(done, 'p-x', 'dp-x', [], null).add).toEqual([]);
    expect(planFor([{ id: 'b', person_id: 'p', status: 'draft' }, { id: 'a', person_id: 'p', status: 'active' }, { id: 'c', person_id: 'p', status: 'closed' }], 'p')!.id).toBe('a');
    await b.reset();
  });
});

describe('FS74 · wiring FS62: the wallet target is tagged to the national strategies (data only)', () => {
  it('wallet_targets is a target table with the wallet_share measure; the seed tags it to Jahiz and the AI strategy', () => {
    expect(TARGET_TABLES.wallet_targets).toEqual({ kind: 'target', measure: 'wallet_share' });
    const links = T.tag_links.filter((l) => l.target_table === 'wallet_targets');
    expect(links.map((l) => l.tag_id).sort()).toEqual(['nt-ai-2031', 'nt-jahiz']);
    const rep = nationalReport(worldFrom((n) => T[n] ?? []), { tag_id: 'nt-jahiz' }, true);
    const item = rep.items.find((i) => i.target_table === 'wallet_targets')!;
    expect(item).toMatchObject({ kind: 'target', status: 'active', title_en: 'Future Skills Wallet target: the core five' });
    expect(item.measure).toMatchObject({ kind: 'wallet_share', target: 60, due_on: '2027-12-31' });
    expect(item.measure!.n === null || item.measure!.n >= 10).toBe(true);
  });
});

describe('FS73/FS74 · routes, i18n, benchmarks, schema', () => {
  it('three routes: the pipeline (anyRole), my wallet (skills_profile Own) and the counter (national_alignment Agg/W/A)', () => {
    const ids = routes.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['national-emirati-pipeline', 'my-future-wallet', 'national-future-wallet']));
    expect(routes.find((r) => r.id === 'my-future-wallet')!.guard.grant).toEqual({ res: 'skills_profile', levels: ['Own'] });
    expect(routes.find((r) => r.id === 'national-future-wallet')!.guard.grant).toEqual({ res: 'national_alignment', levels: ['Agg', 'W', 'A'] });
  });
  it('every new route and page string exists in EN and AR (Arabic script), and the pages show their FS73 / FS74 chips', () => {
    for (const id of ['national-emirati-pipeline', 'my-future-wallet', 'national-future-wallet']) {
      const e = (en.routes as Row)[id]; const a = (ar.routes as Row)[id];
      expect(e.title).toBeTruthy(); expect(a.title).toMatch(/[؀-ۿ]/);
    }
    const flat = (o: Row, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v as string]]));
    const arMap = new Map(flat((ar as Row)));
    for (const [k] of flat({ ep: (en as Row).ep, fw: (en as Row).fw, fwc: (en as Row).fwc })) expect(arMap.get(k), k).toBeTruthy();
    expect(FEATURE_BENCHMARKS.FS73).toEqual(expect.arrayContaining(['NAFIS', 'IAEA-WFP']));
    expect(FEATURE_BENCHMARKS.FS74).toEqual(expect.arrayContaining(['JAHIZ', 'UAE-AI', 'UAE-PEERS']));
    for (const [f, file] of [['FS73', 'EmiratiPipelinePage'], ['FS74', 'FutureWalletPage'], ['FS74', 'FutureWalletCounterPage']]) expect(readFileSync(`src/modules/m37/${file}.tsx`, 'utf8')).toContain(`<BenchmarkChips feature="${f}" />`);
  });
  it('the pages use logical RTL utilities only and route every number and date through useFormat', () => {
    for (const file of ['EmiratiPipelinePage', 'FutureWalletPage', 'FutureWalletCounterPage']) {
      const s = readFileSync(`src/modules/m37/${file}.tsx`, 'utf8');
      expect(s).not.toMatch(/\b(ml|mr|pl|pr)-\d|\b(left|right)-\d|text-left|text-right/);
      expect(s).toMatch(/useFormat\(\)/);
    }
  });
  it('the seeded wallet target is the settled Appendix B demo value (60 % by the end of 2027)', () => {
    expect(T.wallet_targets).toEqual([expect.objectContaining({ id: 'wt-core-five', pct: 60, due_on: '2027-12-31', status: 'active', set_by: 'p-chco' })]);
  });
});
