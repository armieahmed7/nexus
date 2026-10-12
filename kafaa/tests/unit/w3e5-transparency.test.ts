/** F24 Recommendation transparency, opt-out and fairness monitor (W3 · E5, M16): every acceptance criterion on the local path, the
 *  pure rules shared with SQL, the seed and i18n. The SQL path is checked by scripts/validate/w3e5-transparency.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { hasKey } from '../../src/i18n';
import en16 from '../../src/i18n/m16.en.json';
import ar16 from '../../src/i18n/m16.ar.json';
import { routes } from '../../src/modules/m16/routes';
import { FOUR_FIFTHS, comparisons, fairnessSnapshot, isoWeek, outcomes, statusAsOf, weeklyDates, type FairnessData } from '../../src/modules/m16/fairness';
import { ENGINE_MSG, CARD_IDS, EXCLUDED_ON_CARDS, sameWeights, validWeights, weightDiff } from '../../src/modules/m16/transparency';
import { buildInferenceExport } from '../../src/modules/m16/inferences';
import { localFairnessData } from '../../src/modules/m16/backend/local';
import seed from '../../src/seed/seed.json';

const S = seed as unknown as { tables: Record<string, any[]>; meta: { demo_today: string } };
const T = S.tables;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
const lastAudit = () => [...b.raw('audit_events')].sort((x, y) => x.seq - y.seq).pop()!;
const ledgerN = () => b.raw('ledger_local').length;
const seedData = (): FairnessData => ({
  people: T.people, roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills, states: T.person_skills,
  licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records, programmes: T.programmes, courses: T.courses, trainingRecords: T.training_records, enrolments: T.enrolments,
  weights: T.engine_settings.find((s) => s.id === 'recommend')?.weights, optouts: T.reco_optouts, applications: T.opportunity_applications, mentoring: T.mentoring_requests, nominations: T.leadership_nominations,
  placements: T.review_placements ?? null, // W3 integration: F18 placements feed the HiPo metric once merged
});

/** Synthetic population for the pure rules: n people per group with k positives each (navigator data left empty). */
function synth(groups: { g: 'f' | 'm'; nat: 'uae' | 'other'; n: number; k: number }[]): FairnessData {
  const people: FairnessData['people'] = [];
  const applications: FairnessData['applications'] = [];
  let i = 0;
  for (const x of groups) for (let j = 0; j < x.n; j++) {
    const id = `p${++i}`;
    people.push({ id, kind: 'staff', status: 'active', job_role_id: 'r', hire_date: '2020-01-01', gender: x.g, nationality_flag: x.nat });
    applications.push({ person_id: id, history: [{ at: '2026-09-01T09:00:00Z', status: 'applied' }, ...(j < x.k ? [{ at: '2026-09-10T09:00:00Z', status: 'selected' }] : [])] });
  }
  people.push({ id: 'u1', kind: 'staff', status: 'active', job_role_id: 'r', gender: null, nationality_flag: 'unknown' });
  applications.push({ person_id: 'u1', history: [{ at: '2026-09-01T09:00:00Z', status: 'selected' }] });
  return { people, roles: [], edges: [], roleComps: [], competencies: [], skills: [], states: [], licences: [], standards: [], qualRecords: [], programmes: [], courses: [], trainingRecords: [], enrolments: [], optouts: [], applications, mentoring: [], nominations: [], placements: null };
}

describe('F24 schema, route and i18n', () => {
  it('has the four tables with RPC-only writes and the expected read rules', () => {
    for (const t of ['engine_cards', 'reco_optouts', 'fairness_snapshots', 'engine_changes']) { expect(SCHEMA[t], t).toBeTruthy(); expect(SCHEMA[t].write.mode).toBe('rpc'); }
    expect(SCHEMA.reco_optouts.read).toEqual([{ res: 'own_profile', person: 'person_id' }]);
    expect(SCHEMA.fairness_snapshots.read.map((r) => r.res)).toEqual(['integrations', 'skills_profile']);
  });
  it('registers /admin/ai-transparency for admin, auditor and HR, with EN and AR titles', () => {
    const r = routes.find((x) => x.id === 'admin-ai-transparency')!;
    expect(r.path).toBe('/admin/ai-transparency');
    expect(r.guard.anyRole).toEqual(['admin', 'auditor', 'hr_analyst', 'hr_director']);
    expect(hasKey('m16.routes.admin-ai-transparency.title')).toBe(true);
    expect((ar16 as any).routes['admin-ai-transparency'].title).toMatch(/[\u0600-\u06FF]/);
    // every metric, group, dimension, surface and protected label used by the pages exists in both languages
    for (const d of [en16, ar16] as any[]) {
      for (const m of ['navigator_ready', 'opportunity_selected', 'mentoring_matched', 'hipo_pool']) expect(d.ai.metric[m] && d.ai.metricHelp[m], m).toBeTruthy();
      for (const g of ['f', 'm', 'uae', 'other']) expect(d.ai.group[g], g).toBeTruthy();
      for (const k of ['gender', 'nationality_flag', 'age']) expect(d.ai.protected[k], k).toBeTruthy();
      for (const s of ['navigator', 'coach', 'marketplace']) expect(d.ai.optedOut.body[s] && d.ai.settings.offBody[s] && d.ai.settings.consequenceOff[s], s).toBeTruthy();
      for (const w of new Set(T.engine_settings.flatMap((x) => Object.keys(x.weights)))) expect(d.ai.weight[w], w).toBeTruthy();
    }
  });
});

describe('F24 engine cards (model and engine card for each surface)', () => {
  it('seeds one card per surface: Navigator, Coach, Marketplace and Talent review evidence among them, bilingual, with sources', () => {
    // FS55 (fsFe3) adds 23 cards for the newer ranked surfaces (tests/unit/fs63-engine-lint.test.ts); the eight F24 cards are all still here
    expect(T.engine_cards.filter((c) => (CARD_IDS as readonly string[]).includes(c.id)).map((c) => c.id).sort()).toEqual([...CARD_IDS].sort());
    for (const c of T.engine_cards) {
      expect(c.inputs_excluded, c.id).toEqual([...EXCLUDED_ON_CARDS]);
      expect(c.inputs_used.length, c.id).toBeGreaterThan(0);
      for (const i of c.inputs_used) expect(i.en && i.ar, `${c.id}.${i.key}`).toBeTruthy();
      expect(c.scoring_functions.length, c.id).toBeGreaterThan(0);
      for (const f of ['title', 'purpose', 'owner', 'output', 'oversight', 'limitations']) expect(c[`${f}_en`] && c[`${f}_ar`], `${c.id}.${f}`).toBeTruthy();
      expect(c.owner_en, c.id).toMatch(/role card/);
      expect(c.sources.every((s: any) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.as_of)), c.id).toBe(true);
    }
    expect(T.engine_cards.filter((c) => c.opt_out).map((c) => c.id).sort()).toEqual(['coach', 'marketplace', 'navigator']);
    expect(T.engine_cards.find((c) => c.id === 'talent_evidence').opt_out).toBe(false);
  });
  it('each card weight key exists in its engine settings', () => {
    for (const c of T.engine_cards) { const w = T.engine_settings.find((s) => s.id === c.engine_surface).weights; for (const k of c.weight_keys) expect(k in w, `${c.id}.${k}`).toBe(true); }
  });
});

describe('F24 acceptance: the fairness snapshot suppresses groups below 10 and flags a ratio below 0.8', () => {
  it('flags the group under four-fifths of the best rate', () => {
    const rows = fairnessSnapshot(synth([{ g: 'f', nat: 'uae', n: 12, k: 3 }, { g: 'm', nat: 'uae', n: 30, k: 12 }, { g: 'm', nat: 'other', n: 10, k: 4 }]), '2026-10-08')
      .filter((r) => r.metric === 'opportunity_selected');
    const f = rows.find((r) => r.group_key === 'f')!, m = rows.find((r) => r.group_key === 'm')!;
    expect(f).toMatchObject({ n: 12, positives: 3, rate: 0.25, suppressed: false, flagged: true });
    expect(m).toMatchObject({ n: 40, positives: 16, rate: 0.4, ratio: 1, flagged: false });
    expect(f.ratio).toBeCloseTo(0.625, 4);
    expect(f.ratio! < FOUR_FIFTHS).toBe(true);
  });
  it('a ratio of exactly 0.8 is not flagged', () => {
    const rows = fairnessSnapshot(synth([{ g: 'f', nat: 'uae', n: 10, k: 4 }, { g: 'm', nat: 'uae', n: 10, k: 5 }, { g: 'm', nat: 'other', n: 10, k: 5 }]), '2026-10-08').filter((r) => r.metric === 'opportunity_selected' && r.dimension === 'gender');
    expect(rows.find((r) => r.group_key === 'f')).toMatchObject({ ratio: 0.8, flagged: false });
  });
  it('a group of 9 suppresses the whole comparison (no count, rate or flag for any group)', () => {
    const rows = fairnessSnapshot(synth([{ g: 'f', nat: 'uae', n: 20, k: 2 }, { g: 'm', nat: 'other', n: 9, k: 9 }, { g: 'm', nat: 'uae', n: 20, k: 10 }]), '2026-10-08').filter((r) => r.metric === 'opportunity_selected');
    const nat = rows.filter((r) => r.dimension === 'nationality');
    expect(nat.every((r) => r.suppressed && r.n === null && r.rate === null && r.positives === null && r.ratio === null && !r.flagged)).toBe(true);
    const gen = rows.filter((r) => r.dimension === 'gender');
    expect(gen.every((r) => !r.suppressed)).toBe(true);
    expect(gen.find((r) => r.group_key === 'f')!.flagged).toBe(true);
  });
  it('people with no recorded gender or nationality are left out of the comparison', () => {
    const rows = fairnessSnapshot(synth([{ g: 'f', nat: 'uae', n: 10, k: 5 }, { g: 'm', nat: 'other', n: 10, k: 5 }]), '2026-10-08').filter((r) => r.metric === 'opportunity_selected');
    expect(rows.find((r) => r.group_key === 'f')!.n).toBe(10);
    expect(rows.find((r) => r.group_key === 'm')!.n).toBe(10);
  });
  it('outcomes are as of the date (history-aware) and withdrawn applications do not count', () => {
    expect(statusAsOf([{ at: '2026-09-01T09:00:00Z', status: 'applied' }, { at: '2026-09-10T09:00:00Z', status: 'selected' }], '2026-09-05')).toBe('applied');
    expect(statusAsOf([{ at: '2026-09-01T09:00:00Z', status: 'applied' }, { at: '2026-09-10T09:00:00Z', status: 'selected' }], '2026-09-10')).toBe('selected');
    expect(statusAsOf([{ at: '2026-09-11T09:00:00Z', status: 'applied' }], '2026-09-10')).toBeNull();
    const d = synth([{ g: 'f', nat: 'uae', n: 10, k: 10 }]);
    d.applications[0] = { person_id: 'p1', history: [{ at: '2026-09-01T09:00:00Z', status: 'withdrawn' }] };
    expect(outcomes(d, '2026-10-08')[1].people.has('p1')).toBe(false);
  });
  it('ISO weeks match SQL to_char(d, \'IYYY-"W"IW\')', () => {
    expect(isoWeek('2026-10-08')).toBe('2026-W41');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
    expect(isoWeek('2024-12-30')).toBe('2025-W01');
    expect(isoWeek('2021-01-03')).toBe('2020-W53');
    expect(weeklyDates('2026-10-08', 3)).toEqual(['2026-09-24', '2026-10-01', '2026-10-08']);
  });
  it('the seed holds ten weekly snapshots equal to fairnessSnapshot() on the seed, with a flag and suppressed comparisons this week', () => {
    const days = [...new Set(T.fairness_snapshots.map((r) => r.as_of))].sort();
    expect(days).toEqual(weeklyDates(S.meta.demo_today, 10));
    const latest = fairnessSnapshot(seedData(), S.meta.demo_today);
    const seeded = T.fairness_snapshots.filter((r) => r.as_of === S.meta.demo_today).map(({ run_by, created_at, ...r }) => r);
    expect(seeded).toEqual(latest);
    const c = comparisons(latest);
    expect(c.some((x) => x.flagged)).toBe(true);
    expect(c.some((x) => x.suppressed)).toBe(true);
    expect(latest.find((r) => r.id === 'fs:2026-W41:opportunity_selected:gender:f')).toMatchObject({ flagged: true });
  });
  it('people who opted out of the Navigator are not counted as "suggested ready"', () => {
    const out = new Set(T.reco_optouts.filter((o) => o.surface === 'navigator').map((o) => o.person_id));
    expect(out.size).toBeGreaterThan(0);
    const nav = outcomes(seedData(), S.meta.demo_today)[0].people;
    for (const p of out) expect(nav.has(p)).toBe(false);
  });
});

describe('F24 rpc.runFairnessSnapshot (weekly snapshot)', () => {
  it('admin / AI governance stores 16 rows for this week, audited and ledgered; equal to the rules on the live tables', async () => {
    await as('ai-governance');
    const l0 = ledgerN();
    const r = await b.rpc.runFairnessSnapshot(null);
    expect(r.ok).toBe(true);
    expect(r.data!.rows).toBe(16);
    const period = r.data!.period;
    const rows = b.raw('fairness_snapshots').filter((x) => x.period === period);
    expect(rows).toHaveLength(16);
    expect(rows.every((x) => x.run_by === 'p-ai-governance')).toBe(true);
    expect(lastAudit()).toMatchObject({ action: 'fairness.snapshot', outcome: 'ok', entity_id: period, ledger_status: 'written' });
    expect(ledgerN()).toBe(l0 + 1);
    const expected = fairnessSnapshot(localFairnessData(b), r.data!.as_of);
    expect(rows.map(({ run_by, created_at, ...x }) => x).sort((a, c) => (a.id < c.id ? -1 : 1))).toEqual([...expected].sort((a, c) => (a.id < c.id ? -1 : 1)));
    expect((await b.rpc.runFairnessSnapshot(null)).ok).toBe(true);
    expect(b.raw('fairness_snapshots').filter((x) => x.period === period)).toHaveLength(16);
  });
  it('refuses employees, auditors, HR and dates outside the last year', async () => {
    for (const p of ['k-ro', 'k-auditor', 'chco']) { await as(p); expect((await b.rpc.runFairnessSnapshot(null)).code, p).toBe('forbidden'); }
    await as('k-admin');
    expect((await b.rpc.runFairnessSnapshot('2099-01-01')).code).toBe('invalid');
    expect((await b.rpc.runFairnessSnapshot('2020-01-01')).code).toBe('invalid');
    expect((await b.rpc.runFairnessSnapshot('nope')).code).toBe('invalid');
    expect(lastAudit()).toMatchObject({ outcome: 'refused' });
  });
});

describe('F24 rpc.setRecoOptout (employee control)', () => {
  it('opts out and back in, audited and ledgered, own row only', async () => {
    await as('nse');
    const l0 = ledgerN();
    const r = await b.rpc.setRecoOptout('coach', true, '  I prefer the catalogue  ');
    expect(r).toMatchObject({ ok: true, data: { id: 'ro:p-nse:coach', surface: 'coach', opted_out: true } });
    expect(b.rawGet('reco_optouts', 'ro:p-nse:coach')).toMatchObject({ opted_out: true, reason: 'I prefer the catalogue' });
    expect(lastAudit()).toMatchObject({ action: 'reco.optout', outcome: 'ok', ledger_status: 'written' });
    expect(ledgerN()).toBe(l0 + 1);
    expect((await b.list('reco_optouts')).map((x) => x.id)).toEqual(['ro:p-nse:coach']);
    expect((await b.rpc.setRecoOptout('coach', false)).data!.opted_out).toBe(false);
    expect(b.rawGet('reco_optouts', 'ro:p-nse:coach')!.opted_out).toBe(false);
  });
  it('refuses unknown surfaces, long reasons, non-staff and anonymous callers', async () => {
    await as('nse');
    expect((await b.rpc.setRecoOptout('salary' as never, true)).code).toBe('invalid');
    expect((await b.rpc.setRecoOptout('mentoring' as never, true)).code).toBe('invalid');
    expect((await b.rpc.setRecoOptout('coach', true, 'x'.repeat(501))).code).toBe('invalid');
    for (const p of ['k-auditor', 'alnoor-gm', 'k-student']) { await as(p); expect((await b.rpc.setRecoOptout('coach', true)).code, p).toBe('forbidden'); }
    await as(null);
    expect((await b.rpc.setRecoOptout('coach', true)).code).toBe('not_signed_in');
  });
  it('nobody else reads my opt-out; admins and HR get only suppressed counts', async () => {
    await as('nse');
    await b.rpc.setRecoOptout('navigator', true);
    for (const p of ['k-admin', 'chco', 'k-auditor', 'sro']) { await as(p); expect((await b.list('reco_optouts')).filter((x) => x.person_id === 'p-nse'), p).toEqual([]); }
    await as('k-admin');
    const st = await b.rpc.optoutStats();
    const seedN = T.reco_optouts.filter((o) => o.surface === 'coach').length;
    expect(st.find((x) => x.surface === 'coach')).toEqual({ surface: 'coach', n: seedN, suppressed: false });
    expect(st.find((x) => x.surface === 'navigator')).toEqual({ surface: 'navigator', n: null, suppressed: true });
    await as('k-ro');
    await expect(b.rpc.optoutStats()).rejects.toThrow();
  });
});

describe('F24 acceptance: every weight change has audit and ledger rows and appears in the change log', () => {
  it('changeEngineWeights logs before, after and rationale, bumps the cards, and carries audit and ledger numbers', async () => {
    await as('ai-governance');
    const v0 = Object.fromEntries(b.raw('engine_cards').map((c) => [c.id, c.version]));
    const l0 = ledgerN();
    const r = await b.rpc.changeEngineWeights('recommend', 'deterministic', { current_role: 1, target_role: 0.8, core: 3, important: 2, useful: 1 }, 'Targets matter more after the career conversations pilot');
    expect(r.ok).toBe(true);
    expect(r.data).toMatchObject({ change_id: 'ec:recommend:002', surface: 'recommend' });
    // FS55 (fsFe3): every card on the recommend slot is bumped, the F24 three among them
    expect(r.data!.cards).toEqual(T.engine_cards.filter((c) => c.engine_surface === 'recommend').map((c) => c.id).sort());
    expect(r.data!.cards).toEqual(expect.arrayContaining(['coach', 'future', 'navigator']));
    const ch = b.rawGet('engine_changes', 'ec:recommend:002')!;
    expect(ch).toMatchObject({ engine_before: 'deterministic', engine_after: 'deterministic', changed_by: 'p-ai-governance', changed_by_role: 'admin', audit_seq: r.audit_seq, ledger_seq: r.ledger_seq });
    expect(weightDiff(ch.weights_before as never, ch.weights_after as never)).toEqual([{ key: 'target_role', from: 0.6, to: 0.8 }]);
    expect(r.ledger_seq).not.toBeNull();
    expect(ledgerN()).toBe(l0 + 1);
    expect(lastAudit()).toMatchObject({ action: 'engine.settings', outcome: 'ok', ledger_status: 'written', seq: r.audit_seq });
    for (const c of b.raw('engine_cards')) expect(c.version, c.id).toBe(v0[c.id] + (c.engine_surface === 'recommend' ? 1 : 0));
    expect(b.rawGet('engine_cards', 'navigator')!.last_change_id).toBe('ec:recommend:002');
    expect(b.rawGet('engine_settings', 'recommend')!.weights).toMatchObject({ target_role: 0.8 });
  });
  it('the wave-0 setEngineWeights now also lands in the change log with ledger', async () => {
    await as('ai-governance');
    const r = await b.rpc.setEngineWeights('search', 'model');
    expect(r.ok).toBe(true);
    expect(b.rawGet('engine_changes', 'ec:search:002')).toMatchObject({ engine_before: 'deterministic', engine_after: 'model', rationale: null });
    expect(r.ledger_seq).not.toBeNull();
  });
  it('refusals: non-admins, short rationale, out-of-range weights, unknown surface, no change', async () => {
    await as('chco');
    expect((await b.rpc.changeEngineWeights('match', 'deterministic', null, 'A valid rationale here')).code).toBe('forbidden');
    await as('k-admin');
    expect((await b.rpc.changeEngineWeights('match', 'deterministic', { skills: 0.6 }, 'short')).message).toBe(ENGINE_MSG.rationale);
    expect((await b.rpc.changeEngineWeights('match', 'deterministic', { skills: 11 }, 'A valid rationale here')).message).toBe(ENGINE_MSG.weights);
    expect((await b.rpc.changeEngineWeights('nope', 'deterministic', null, 'A valid rationale here')).message).toBe(ENGINE_MSG.surface);
    expect((await b.rpc.changeEngineWeights('match', 'deterministic', { target: 0.1, development: 0.2, skills: 0.7 }, 'Same values in another order')).code).toBe('no_change');
    expect(b.raw('engine_changes').filter((c) => c.surface === 'match')).toHaveLength(1);
  });
  it('the seed change log holds one deployment baseline per engine, equal to the current settings', () => {
    expect(T.engine_changes).toHaveLength(4);
    for (const c of T.engine_changes) expect(c.weights_after).toEqual(T.engine_settings.find((s) => s.id === c.surface).weights);
  });
  it('weight helpers', () => {
    expect(validWeights({ a: 0, b: 10 })).toBe(true);
    expect(validWeights({ a: -1 })).toBe(false);
    expect(validWeights([1])).toBe(false);
    expect(sameWeights({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameWeights({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe('F24 employee control: "what Kafa\'a infers about me" (JSON)', () => {
  it('lists skills with their evidence and reasons, readiness and ranked suggestions, and never a protected attribute', () => {
    const me = 'p-k-ro';
    const json = buildInferenceExport({
      personId: me, generatedAt: '2026-10-09T08:00:00Z', lang: 'en', skills: T.skills,
      states: T.person_skills.filter((s) => s.person_id === me), evidence: T.skill_evidence.filter((e) => e.person_id === me),
      readiness: [{ role_id: 'senior-reactor-operator', pct: 72, band: 'ready_in', months: 18, gate_status: 'not_met', reasons: [{ code: 'readiness', key: 'common.engines.reason.readiness', vars: { pct: 72 } }] }],
      roles: T.job_roles, coach: { opted_out: true, items: [{ id: 'x', kind: 'course', itemId: 'c', score: 1, reasons: [] }] },
      opportunities: { opted_out: false, items: [{ id: 'opp-1', score: 0.5, reasons: [{ code: 'fit', key: 'm20.reasons.fit' }] }] }, navigatorOptedOut: false,
      optouts: [{ surface: 'coach', opted_out: true }], cards: T.engine_cards, engines: T.engine_settings,
    });
    expect(json.skills.length).toBeGreaterThan(0);
    expect(json.skills.every((s) => s.reasons.length > 0)).toBe(true);
    expect(json.evidence.length).toBeGreaterThan(0);
    expect(json.coach).toEqual({ opted_out: true, items: [] });
    expect(json.career_readiness).toMatchObject({ opted_out: false, items: [{ role_id: 'senior-reactor-operator', readiness_pct: 72 }] });
    expect(json.never_used).toEqual(['gender', 'nationality_flag', 'age']);
    const { never_used, note, ...rest } = json;
    const text = JSON.stringify(rest);
    expect(text).not.toMatch(/"(gender|nationality(_flag)?|age|birth\w*)"\s*:/);
    const person = T.people.find((p) => p.id === me);
    if (person.display_name) expect(text).not.toContain(person.display_name);
  });
});
