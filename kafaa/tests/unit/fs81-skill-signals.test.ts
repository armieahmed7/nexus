/** FS70 ENEC Skills on the Rise + manager pulse, FS71 hot technologies and in-demand badges, FS72 "Skills you may have" (FS wave H · E1,
 *  fsHe1, M28): one named test per acceptance criterion on the local path, the RBAC of every table and RPC, the pure rules, the seed, the
 *  routes, the Supabase mapping and i18n. The SQL path (SQL = TS, RLS, grants, the same flows) is checked by
 *  scripts/validate/fs81-skill-signals.mjs in PGlite. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import {
  GROWTH_PCT, MIN_SIGNAL, PULSE_BANDS, RS_MSG, lastClosedQuarter, prevQuarter, pulseOpen, pulseSummary, quarterBounds, quarterClosed, risingSkills, signalInputFromTables,
} from '../../src/modules/m28/signals';
import { BRAND_DENY, HOT, IN_DEMAND, badgeInputFromTables, brandHits, techProblem, technologyBadges } from '../../src/modules/m28/technologies';
import { FAIRNESS, MAX_PER_PERSON, SUPPRESS_DAYS, THRESHOLD, inferSuggestions, ssgWorldFromTables, suppressedUntil } from '../../src/modules/m28/suggestions';
import { suggestionFairness } from '../../src/modules/m28/suggestFairness';
import { RANKED_SURFACES } from '../../src/modules/m16/surfaces';
import { routes } from '../../src/modules/m28/routes';
import { makeSupabaseM28 } from '../../src/modules/m28/backend/supabase';
import seed from '../../src/seed/seed.json';
import enJson from '../../src/i18n/m28.en.json';
import arJson from '../../src/i18n/m28.ar.json';
import m16en from '../../src/i18n/m16.en.json';
import m16ar from '../../src/i18n/m16.ar.json';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
afterEach(() => { vi.useRealTimers(); });
const raw = (t: string) => (b.raw(t as never) as unknown as Row[]) ?? [];
const list = (t: string, filter?: Row) => b.list(t as never, (filter ? { filter } : undefined) as never) as Promise<Row[]>;
const audits = (action: string) => raw('audit_events').filter((a) => a.action === action);
const clock = (day: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(`${day}T09:00:00Z`)); };
const plus = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const same = (a: unknown, c: unknown) => JSON.stringify(a) === JSON.stringify(c);

describe('FS70 ENEC Skills on the Rise', () => {
  it('FS70 AC1: each listed skill shows which signals moved it', async () => {
    const rows = T.skill_signals;
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) {
      expect(r.moved_by.length).toBeGreaterThan(0);
      for (const k of r.moved_by) expect(r.signals.find((c: Row) => c.key === k)?.moved).toBe(true);
      expect(r.reasons.length).toBeGreaterThanOrEqual(r.moved_by.length);
      expect(r.reasons.every((x: Row) => /^m28\.rs\.reason\./.test(x.key))).toBe(true);
      expect(r.category === 'now' ? r.moved_by.includes('demand') : r.moved_by.some((k: string) => k !== 'demand')).toBe(true);
    }
    // the published lists are what the rule computes on the seed (computed, never typed)
    const inp = signalInputFromTables((t) => T[t] ?? []);
    for (const run of T.skill_signal_runs) {
      const c = risingSkills(inp, run.quarter)!;
      const stored = rows.filter((r) => r.quarter === run.quarter).sort((a, z) => (a.category === z.category ? a.rank - z.rank : a.category < z.category ? 1 : -1));
      expect(same(stored.map((r) => [r.skill_id, r.category, r.rank, r.moved_by, r.signals, r.reasons]), c.rows.map((r) => [r.skill_id, r.category, r.rank, r.moved_by, r.signals, r.reasons]))).toBe(true);
      expect(same(run.counts, c.counts)).toBe(true);
    }
  });

  it('FS70 AC2: signals under 10 are suppressed (never shown, compared or used to move a skill)', () => {
    expect(MIN_SIGNAL).toBe(10);
    const cells = T.skill_signals.flatMap((r) => r.signals as Row[]);
    expect(cells.every((c) => (c.value === null || c.value >= 10) && (c.prev === null || c.prev >= 10))).toBe(true);
    expect(cells.some((c) => c.value === null)).toBe(true);
    expect(cells.filter((c) => c.value === null).every((c) => c.moved === false && c.change_pct === null)).toBe(true);
    // pure rule: one skill asked for by 9 sources is not listed; with a 10th it is
    const opp = (i: number, created: string) => ({ id: `o${i}`, status: 'open', created_at: created, family_id: `f${i % 3}`, skills_needed: ['sk-x'], skills_gained: [] });
    const base = { skills: [{ id: 'sk-x', area: 'technical', lifecycle: 'active' }], people: [], evidence: [], goals: [], opportunities: [] as Row[], versions: [], roles: [] };
    const nine = risingSkills({ ...base, opportunities: Array.from({ length: 9 }, (_, i) => opp(i, '2026-05-02')) } as never, '2026-Q2')!;
    expect(nine.rows.length).toBe(0);
    expect(nine.counts.suppressed).toBe(1);
    const ten = risingSkills({ ...base, opportunities: Array.from({ length: 10 }, (_, i) => opp(i, '2026-05-02')) } as never, '2026-Q2')!;
    expect(ten.rows.map((r) => [r.skill_id, r.category])).toEqual([['sk-x', 'now']]);
    expect(ten.rows[0].signals.find((c) => c.key === 'goals_profiles')!.value).toBeNull();
  });

  it('FS70 AC3: the method page publishes how each signal is counted (from the rule constants, EN and AR)', () => {
    const en = enJson as Row, ar = arJson as Row;
    for (const k of ['goals_profiles', 'recent_hires', 'demand']) {
      expect(en.sm[k]).toBeTruthy(); expect(ar.sm[k]).toBeTruthy();
      expect(en.rs.sig[k]).toBeTruthy(); expect(ar.rs.sig[k]).toBeTruthy();
    }
    for (const k of ['suppress', 'now', 'growing', 'max', 'never', 'kept']) { expect(en.sm[k]).toBeTruthy(); expect(ar.sm[k]).toBeTruthy(); }
    expect(en.sm.suppress).toContain('{n}');
    expect(en.sm.growing).toContain('{pct}');
    expect(GROWTH_PCT).toBe(25);
    const r = routes.find((x) => x.id === 'skills-rising-method')!;
    expect(r.path).toBe('/skills/rising/method');
    expect(r.guard).toEqual({}); // public
  });

  it('FS70 compute and publish: HR and auditors compute; HR publishes an ended quarter once (audit + ledger); others refused', async () => {
    clock('2026-10-12');
    await as('k-hr-analyst');
    const c1 = await b.rpc.computeSkillSignals('2026-Q3');
    expect(c1.ok).toBe(true);
    expect(same(c1.data, risingSkills(signalInputFromTables(raw), '2026-Q3'))).toBe(true);
    expect((await b.rpc.computeSkillSignals('2024-Q4')).code).toBe('invalid');
    await as('k-auditor');
    expect((await b.rpc.computeSkillSignals('2026-Q2')).ok).toBe(true);
    await as('sro');
    const before = audits('skill_signals.compute').length;
    expect((await b.rpc.computeSkillSignals('2026-Q3')).code).toBe('forbidden');
    expect(audits('skill_signals.compute').length).toBe(before + 1);
    await as('training-mgr');
    expect((await b.rpc.publishSkillSignals('2025-Q3')).code).toBe('forbidden');
    await as('k-hr-analyst');
    expect((await b.rpc.publishSkillSignals('2026-Q3')).code).toBe('published');
    expect((await b.rpc.publishSkillSignals('2026-Q4')).code).toBe('open_quarter');
    await as('chco'); // the HR director (a Nexus persona, so the ledger row is written)
    const p = await b.rpc.publishSkillSignals('2025-Q3', 'Two skills growing.', 'مهارتان في نمو.');
    expect(p.ok).toBe(true);
    expect(p.ledger_seq).not.toBeNull();
    const run = raw('skill_signal_runs').find((x) => x.quarter === '2025-Q3')!;
    expect(run.summary_ar).toBe('مهارتان في نمو.');
    const rows = raw('skill_signals').filter((x) => x.quarter === '2025-Q3');
    expect(rows.length).toBe(risingSkills(signalInputFromTables(raw), '2025-Q3')!.rows.length);
    expect((await b.rpc.publishSkillSignals('2025-Q3')).code).toBe('published');
    expect(RS_MSG.published).toMatch(/kept/);
  });

  it('FS70 RBAC: staff read the published list; partners, observers and visitors do not', async () => {
    await as('k-ro');
    expect((await list('skill_signals')).length).toBe(T.skill_signals.length);
    expect((await list('skill_signal_runs')).length).toBe(4);
    for (const p of ['alnoor-gm', 'k-observer', 'k-university', null]) {
      await as(p);
      expect((await list('skill_signals').catch(() => [])).length).toBe(0);
    }
  });

  it('FS70 pulse: a line manager answers while open (15 Sep to 15 Dec; again updates); staff refused; HR reads only the aggregate', async () => {
    expect(pulseOpen('2026-09-15') && pulseOpen('2026-12-15') && !pulseOpen('2026-09-14') && !pulseOpen('2026-12-16')).toBe(true);
    clock('2026-10-12');
    await as('sro');
    expect((await b.rpc.submitManagerPulse({ share_pct: 45, team_size: 12 })).ok).toBe(true);
    expect((await b.rpc.submitManagerPulse({ share_pct: 120 })).code).toBe('invalid');
    const again = await b.rpc.submitManagerPulse({ share_pct: 50 });
    expect(again.ok && again.data!.share_pct).toBe(50);
    expect((await list('manager_pulse')).map((r) => [r.person_id, r.year, r.share_pct])).toEqual([['p-sro', 2026, 50]]);
    expect((await b.rpc.managerPulseSummary(2026)).code).toBe('forbidden');
    await as('k-ro');
    expect((await b.rpc.submitManagerPulse({ share_pct: 45 })).code).toBe('forbidden');
    await as('k-hr-analyst');
    expect((await list('manager_pulse')).length).toBe(0); // own rows only: HR never reads an answer
    const m = await b.rpc.managerPulseSummary(2026);
    expect(m.ok).toBe(true);
    expect(same(m.data, pulseSummary(raw('manager_pulse') as never, 2026))).toBe(true);
    expect(m.data!.responses).toBeGreaterThanOrEqual(10);
    expect(m.data!.bands.length).toBe(PULSE_BANDS.length);
    expect(m.data!.bands.every((x) => x.n === null || x.n >= 10)).toBe(true);
    expect((await b.rpc.managerPulseSummary(2019)).code).toBe('invalid');
    clock('2026-12-20');
    await as('sro');
    expect((await b.rpc.submitManagerPulse({ share_pct: 40 })).code).toBe('closed');
  });

  it('FS70 rule: pulse aggregates under 10 answers are suppressed; quarters and the last closed quarter', () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ year: 2026, share_pct: 30 + i }));
    const s = pulseSummary(rows, 2026);
    expect(s.suppressed && s.responses === null && s.median === null && s.families.length === 0).toBe(true);
    const s10 = pulseSummary([...rows, { year: 2026, share_pct: 70 }], 2026);
    expect(s10.responses).toBe(10);
    expect(s10.median).toBe(34.5);
    expect(quarterBounds('2026-Q3')).toEqual({ start: '2026-07-01', end: '2026-09-30' });
    expect(prevQuarter('2026-Q1')).toBe('2025-Q4');
    expect(lastClosedQuarter('2026-10-12')).toBe('2026-Q3');
    expect(quarterClosed('2026-Q4', '2026-10-12')).toBe(false);
  });
});

describe('FS71 hot technologies and in-demand badges', () => {
  it('FS71 AC1: criteria are published and the badges reproduce from them', async () => {
    expect(HOT).toEqual({ window_quarters: 4, min_sources: 6, min_families: 3, min_recent: 1 });
    expect(IN_DEMAND.min_family_opportunities).toBe(2);
    const inp = badgeInputFromTables((t) => T[t] ?? []);
    const quarters = [...new Set(T.technology_badges.map((x) => x.quarter))].sort();
    expect(quarters.length).toBeGreaterThanOrEqual(2);
    for (const q of quarters) {
      const c = technologyBadges(inp, q)!;
      const st = T.technology_badges.filter((x) => x.quarter === q);
      expect(same(st.filter((x) => x.scope === 'enec').sort((a, z) => a.rank - z.rank).map((x) => [x.technology_id, x.sources, x.families, x.recent]), c.hot.map((h) => [h.technology_id, h.sources, h.families, h.recent]))).toBe(true);
      expect(st.filter((x) => x.scope === 'role').length).toBe(c.roles.length);
      expect(st.every((x) => x.criteria === c.criteria)).toBe(true);
    }
    clock('2026-10-12');
    await as('training-mgr');
    const r = await b.rpc.computeTechnologyBadges('2026-Q3');
    expect(r.ok && same(r.data, technologyBadges(badgeInputFromTables(raw), '2026-Q3'))).toBe(true);
    const en = enJson as Row, ar = arJson as Row;
    for (const k of ['window', 'sources', 'families', 'recent', 'profile', 'family', 'kept']) { expect(en.ht.c[k]).toBeTruthy(); expect(ar.ht.c[k]).toBeTruthy(); }
  });

  it('FS71 AC2: no vendor brand name appears in a tag (catalogue clean; a brand is refused by the rule and the RPC)', async () => {
    expect(BRAND_DENY.length).toBeGreaterThan(50);
    expect(T.technologies.length).toBeGreaterThanOrEqual(15);
    const skills = T.skills.map((s) => s.id);
    for (const t of T.technologies) {
      expect(brandHits(`${t.id} ${t.name_en} ${t.name_ar} ${t.description_en} ${t.description_ar}`)).toEqual([]);
      expect(techProblem(t as never, skills, true)).toBeNull();
    }
    expect(brandHits('OSIsoft PI System trends').length).toBe(2);
    expect(brandHits('excellent work')).toEqual([]);
    expect(brandHits('تحليل مايكروسوفت').length).toBe(1);
    const base = { id: 'tech-check-tool', name_en: 'Check tool', name_ar: 'أداة الفحص', description_en: 'A generic checking tool for plant inspection work.', description_ar: 'أداة عامة للفحص في أعمال المحطة والتفتيش.', category: 'inspection', skill_ids: [] };
    clock('2026-10-12');
    await as('training-mgr');
    const r = await b.rpc.saveTechnology({ ...base, name_en: 'Splunk log search' });
    expect(r.code).toBe('invalid');
    expect(r.message).toMatch(/brand/);
    expect(raw('technologies').some((x) => x.id === 'tech-check-tool')).toBe(false);
    const ok1 = await b.rpc.saveTechnology(base);
    expect(ok1.ok && ok1.data!.version).toBe(1);
    expect((await b.rpc.saveTechnology({ ...base, name_en: 'Check tool v2' })).data!.version).toBe(2);
    await as('sro');
    expect((await b.rpc.saveTechnology(base)).code).toBe('forbidden');
  });

  it('FS71 AC3: past badge lists are kept per quarter (a published quarter is never overwritten)', async () => {
    clock('2026-10-12');
    const q2 = raw('technology_badges').filter((x) => x.quarter === '2026-Q2').map((x) => x.id).sort();
    expect(q2.length).toBeGreaterThan(0);
    await as('training-mgr');
    expect((await b.rpc.publishTechnologyBadges('2026-Q2')).code).toBe('published');
    expect((await b.rpc.publishTechnologyBadges('2026-Q3')).code).toBe('published');
    expect((await b.rpc.publishTechnologyBadges('2026-Q4')).code).toBe('open_quarter');
    expect((await b.rpc.publishTechnologyBadges('2025-Q2')).code).toBe('no_change');
    expect(raw('technology_badges').filter((x) => x.quarter === '2026-Q2').map((x) => x.id).sort()).toEqual(q2);
    await as('k-hr-analyst');
    expect((await b.rpc.computeTechnologyBadges('2026-Q3')).code).toBe('forbidden');
  });

  it('FS71 tags: family and date come from the source; no duplicates; unknown sources refused; untag keeps the row inactive', async () => {
    clock('2026-10-12');
    await as('training-mgr');
    const tech = T.technologies[0].id;
    const opp = raw('opportunities').find((o) => !raw('technology_links').some((l) => l.technology_id === tech && l.ref_id === o.id) && o.status !== 'draft')!;
    const g1 = await b.rpc.tagTechnology({ technology_id: tech, ref_table: 'opportunities', ref_id: opp.id, active: true });
    expect(g1.ok).toBe(true);
    const link = raw('technology_links').find((l) => l.id === g1.data!.id)!;
    expect(link.family_id).toBe(opp.family_id ?? null);
    expect(String(link.source_on).slice(0, 10)).toBe(String(opp.created_at).slice(0, 10));
    expect((await b.rpc.tagTechnology({ technology_id: tech, ref_table: 'opportunities', ref_id: opp.id, active: true })).code).toBe('no_change');
    expect((await b.rpc.tagTechnology({ technology_id: tech, ref_table: 'opportunities', ref_id: 'opp-nope', active: true })).code).toBe('source_not_found');
    expect((await b.rpc.tagTechnology({ technology_id: tech, ref_table: 'opportunities', ref_id: opp.id, active: false })).ok).toBe(true);
    expect(raw('technology_links').find((l) => l.id === g1.data!.id)!.active).toBe(false);
  });

  it('FS71 RBAC: staff read technologies, tags and badges; partners and visitors do not', async () => {
    await as('k-ro');
    expect((await list('technologies')).length).toBe(T.technologies.length);
    expect((await list('technology_badges')).length).toBe(T.technology_badges.length);
    for (const p of ['alnoor-gm', 'k-student', null]) {
      await as(p);
      expect((await list('technologies').catch(() => [])).length).toBe(0);
      expect((await list('technology_badges').catch(() => [])).length).toBe(0);
    }
  });
});

describe('FS72 "Skills you may have"', () => {
  it('FS72 AC1: no suggestion is readable by a manager (own rows only, RLS)', async () => {
    const kro = T.skill_suggestions.filter((r) => r.person_id === 'p-k-ro').length;
    expect(kro).toBeGreaterThan(0);
    await as('k-ro');
    const mine = await list('skill_suggestions');
    expect(mine.length).toBe(kro);
    expect(mine.every((r) => r.person_id === 'p-k-ro')).toBe(true);
    for (const p of ['sro', 'ops-ceo', 'training-mgr', 'k-hr-analyst', 'chco', 'k-auditor', 'k-admin']) {
      await as(p);
      expect((await list('skill_suggestions', { person_id: 'p-k-ro' })).length).toBe(0);
      expect((await list('skill_suggestions')).every((r) => r.person_id === b.identity().personId)).toBe(true);
    }
    // a manager cannot answer or see someone else's suggestion either
    await as('sro');
    const id = T.skill_suggestions.find((r) => r.person_id === 'p-k-ro' && r.status === 'open')!.id;
    expect((await b.rpc.respondSuggestion(id, 'confirm')).code).toBe('not_found');
    expect((await b.rpc.suggestionStats()).code).toBe('forbidden');
  });

  it('FS72 AC2: an engine card and a fairness snapshot exist for the surface', async () => {
    const card = T.engine_cards.find((c) => c.id === FAIRNESS.card)!;
    expect(card).toBeTruthy();
    expect(card.fairness_metric).toBe('suggestion_offered');
    expect(card.inputs_excluded).toEqual(['gender', 'nationality_flag', 'age']);
    const s = RANKED_SURFACES.find((x) => x.card === 'skill_suggestions')!;
    expect([s.feature, s.module, s.route, s.fairness]).toEqual(['FS72', 'M28', '/my/skills/suggestions', { metric: 'suggestion_offered' }]);
    expect(s.functions).toContain('src/modules/m28/suggestions.ts#inferSuggestions');
    expect(T.skill_suggestion_fairness.length).toBe(4);
    const asOf = T.skill_suggestion_fairness[0].as_of;
    const people = T.people.filter((p) => p.kind === 'staff' && p.status === 'active');
    const ts = suggestionFairness(people as never, T.skill_suggestions as never, asOf);
    expect(same(ts.map((r) => [r.dimension, r.group_key, r.n, r.suppressed, r.flagged]).sort(), T.skill_suggestion_fairness.map((r) => [r.dimension, r.group_key, r.n, r.suppressed, r.flagged]).sort())).toBe(true);
    expect(T.skill_suggestion_fairness.every((r) => (r.suppressed ? r.n === null : r.n >= 10))).toBe(true);
    await as('ai-governance');
    const f = await b.rpc.runSuggestionFairness(null);
    expect(f.ok && f.data!.rows).toBe(4);
    expect(f.ledger_seq).not.toBeNull();
    await as('sro');
    expect((await b.rpc.runSuggestionFairness(null)).code).toBe('forbidden');
    expect((await list('skill_suggestion_fairness')).length).toBe(0);
    expect((m16en as Row).reg.metric.suggestion_offered && (m16ar as Row).reg.metric.suggestion_offered).toBeTruthy();
  });

  it('FS72 AC3: a rejected suggestion does not return for 180 days (fixed clock)', async () => {
    expect(SUPPRESS_DAYS).toBe(180);
    // seeded: k-ro rejected one on 2026-08-20: hidden on 2027-02-15, back on 2027-02-16 (pure rule)
    const w = ssgWorldFromTables((t) => T[t] ?? []);
    const rej = T.skill_suggestions.find((r) => r.person_id === 'p-k-ro' && r.status === 'rejected')!;
    expect(rej.responded_on).toBe('2026-08-20');
    expect(rej.suppressed_until).toBe('2027-02-16');
    expect(suppressedUntil('2026-08-20')).toBe('2027-02-16');
    expect(inferSuggestions(w, 'p-k-ro', '2026-10-11').some((c) => c.skill_id === rej.skill_id)).toBe(false);
    expect(inferSuggestions(w, 'p-k-ro', '2027-02-15').some((c) => c.skill_id === rej.skill_id)).toBe(false);
    expect(inferSuggestions(w, 'p-k-ro', '2027-02-16').some((c) => c.skill_id === rej.skill_id)).toBe(true);
    // the "not me" from March came back after its 180 days with the answer kept in history
    const back = T.skill_suggestions.find((r) => r.person_id === 'p-k-ro' && (r.history ?? []).length > 0)!;
    expect(back.status).toBe('open');
    expect(back.history[0].status).toBe('not_me');
    // local path: reject today, refresh on day 179 (still hidden) and day 180 (back, if still backed)
    const day0 = '2026-10-12';
    clock(day0);
    await as('k-ro');
    await b.rpc.refreshSkillSuggestions();
    const target = raw('skill_suggestions').filter((r) => r.person_id === 'p-k-ro' && r.status === 'open').sort((a, z) => z.score - a.score)[0];
    const r = await b.rpc.respondSuggestion(target.id, 'reject');
    expect(r.ok && r.data!.suppressed_until).toBe(plus(day0, 180));
    clock(plus(day0, 179));
    expect((await b.rpc.refreshSkillSuggestions()).ok).toBe(true);
    expect(raw('skill_suggestions').find((x) => x.id === target.id)!.status).toBe('rejected');
    clock(plus(day0, 180));
    await b.rpc.refreshSkillSuggestions();
    const after = raw('skill_suggestions').find((x) => x.id === target.id)!;
    const backed = inferSuggestions(ssgWorldFromTables(raw), 'p-k-ro', plus(day0, 180)).some((c) => c.skill_id === target.skill_id) || after.status === 'open';
    expect(backed ? after.status === 'open' && after.history.some((h: Row) => h.status === 'rejected') : after.status === 'rejected').toBe(true);
  });

  it('FS72 confirm: writes my claimed evidence (kind rating, ref_table skill_suggestions) and updates my skill state; answered once', async () => {
    clock('2026-10-12');
    await as('k-ro');
    await b.rpc.refreshSkillSuggestions();
    const target = raw('skill_suggestions').filter((r) => r.person_id === 'p-k-ro' && r.status === 'open').sort((a, z) => z.score - a.score)[0];
    expect((await b.rpc.respondSuggestion(target.id, 'love' as never)).code).toBe('invalid');
    const r = await b.rpc.respondSuggestion(target.id, 'confirm');
    expect(r.ok).toBe(true);
    const ev = raw('skill_evidence').find((e) => e.id === r.data!.evidence_id)!;
    expect([ev.kind, ev.basis, ev.ref_table, ev.person_id, ev.skill_id]).toEqual(['rating', 'claimed', 'skill_suggestions', 'p-k-ro', target.skill_id]);
    expect(ev.level).toBe(Math.min(2, target.level));
    const st = raw('person_skills').find((s) => s.person_id === 'p-k-ro' && s.skill_id === target.skill_id && s.active)!;
    expect(st.basis).toBe('claimed');
    expect((await b.rpc.respondSuggestion(target.id, 'reject')).code).toBe('closed');
    expect(audits('skill_suggestions.respond').length).toBeGreaterThan(0);
  });

  it('FS72 rule and seed: reasons per source, at most 6 open each, threshold 30, stored = rule, no protected input', () => {
    const open = T.skill_suggestions.filter((r) => r.status === 'open');
    expect(open.length).toBeGreaterThan(100);
    const per = new Map<string, number>();
    for (const r of open) per.set(r.person_id, (per.get(r.person_id) ?? 0) + 1);
    expect([...per.values()].every((n) => n <= MAX_PER_PERSON)).toBe(true);
    expect(open.every((r) => r.score >= THRESHOLD && r.level <= 2 && r.reasons.length === r.sources.length && r.reasons.every((x: Row) => /^m28\.ssg\.reason\./.test(x.key)))).toBe(true);
    const w = ssgWorldFromTables((t) => T[t] ?? []);
    for (const p of [...per.keys()].slice(0, 12)) {
      const c = inferSuggestions(w, p, '2026-10-11');
      expect(same(c.map((x) => [x.skill_id, x.score, x.level, x.sources]).sort(), open.filter((r) => r.person_id === p).map((r) => [r.skill_id, r.score, r.level, r.sources]).sort())).toBe(true);
    }
    expect(T.skill_suggestions.some((r) => r.status === 'confirmed')).toBe(false);
    // changing a protected attribute changes nothing
    const flip = { ...w, people: w.people.map((p) => ({ ...p, gender: 'x', nationality_flag: 'x', age: 99 })) };
    expect(same(inferSuggestions(flip as never, 'p-k-ro', '2026-10-11'), inferSuggestions(w, 'p-k-ro', '2026-10-11'))).toBe(true);
  });

  it('FS72 stats: HR reads counts by status as an aggregate with every count under 10 suppressed', async () => {
    await as('k-hr-analyst');
    const z = await b.rpc.suggestionStats();
    expect(z.ok).toBe(true);
    expect(z.data!.open).toBeGreaterThanOrEqual(10);
    expect(z.data!.rejected).toBeNull();
    expect(z.data!.suppressed).toBe(true);
    await as('k-ro');
    expect((await b.rpc.suggestionStats()).code).toBe('forbidden');
  });
});

describe('FS70-FS72 wiring', () => {
  it('routes and guards', () => {
    const r = (id: string) => routes.find((x) => x.id === id)!;
    const staff = { signedIn: true, grant: { res: 'internal_content', levels: ['R'] } };
    expect([r('skills-rising').path, r('skills-rising').guard]).toEqual(['/skills/rising', staff]);
    expect([r('skills-technologies').path, r('skills-technologies').guard]).toEqual(['/skills/technologies', staff]);
    expect(r('workforce-skill-signals').guard).toEqual({ signedIn: true, grant: { res: 'workforce_strategy', levels: ['Agg', 'R', 'W', 'A'] } });
    expect(r('my-manager-pulse').guard).toEqual({ signedIn: true, grant: { res: 'transformation', levels: ['Scope'] } });
    expect(r('admin-skills-technologies').guard!.anyRole).toEqual(['admin', 'training_manager', 'instructor']);
    expect([r('my-skills-suggestions').path, r('my-skills-suggestions').guard]).toEqual(['/my/skills/suggestions', { signedIn: true, grant: { res: 'skills_profile', levels: ['Own'] } }]);
  });

  it('the Supabase backend maps every RPC to its kafaa_* function', async () => {
    const calls: string[] = [];
    const x = { call: async (fn: string) => { calls.push(fn); return { ok: true, code: 'ok', message: '' }; }, rpc: async (fn: string) => { calls.push(fn); return []; } };
    const s = makeSupabaseM28(x as never);
    await s.computeSkillSignals('2026-Q3'); await s.publishSkillSignals('2026-Q3'); await s.submitManagerPulse({ share_pct: 1 }); await s.managerPulseSummary(2026);
    await s.saveTechnology({} as never); await s.tagTechnology({} as never); await s.computeTechnologyBadges('2026-Q3'); await s.publishTechnologyBadges('2026-Q3');
    await s.refreshSkillSuggestions(); await s.respondSuggestion('x', 'confirm'); await s.runSuggestionFairness(null); await s.suggestionStats();
    expect(calls).toEqual(['kafaa_compute_skill_signals', 'kafaa_publish_skill_signals', 'kafaa_submit_manager_pulse', 'kafaa_manager_pulse_summary', 'kafaa_save_technology', 'kafaa_tag_technology',
      'kafaa_compute_technology_badges', 'kafaa_publish_technology_badges', 'kafaa_refresh_skill_suggestions', 'kafaa_respond_suggestion', 'kafaa_run_suggestion_fairness', 'kafaa_suggestion_stats']);
  });

  it('every reason, status and page text exists in English and Arabic; no secondary figure, no regulatory claim', () => {
    const en = enJson as Row, ar = arJson as Row;
    for (const k of ['demand', 'goals_profiles_new', 'goals_profiles_up', 'recent_hires_new', 'recent_hires_up', 'also_growing']) { expect(en.rs.reason[k]).toBeTruthy(); expect(ar.rs.reason[k]).toBeTruthy(); }
    for (const k of ['gig', 'contribution', 'xapi', 'co_occurrence', 'adjacency']) { expect(en.ssg.reason[k]).toBeTruthy(); expect(ar.ssg.reason[k]).toBeTruthy(); expect(en.ssg.src[k]).toBeTruthy(); }
    for (const k of ['open', 'confirmed', 'rejected', 'not_me', 'expired']) { expect(en.ssg.status[k]).toBeTruthy(); expect(ar.ssg.status[k]).toBeTruthy(); }
    for (const id of ['skills-rising', 'skills-rising-method', 'workforce-skill-signals', 'my-manager-pulse', 'skills-technologies', 'admin-skills-technologies', 'my-skills-suggestions']) {
      expect(en.routes[id].title && en.routes[id].purpose && ar.routes[id].title && ar.routes[id].purpose).toBeTruthy();
    }
    for (const ns of ['rs', 'sm', 'mp', 'ht', 'hta', 'sw', 'ssg', 'err']) expect(JSON.stringify(Object.keys(ar[ns]).sort())).toBe(JSON.stringify(Object.keys(en[ns]).sort()));
    const text = JSON.stringify([en.rs, en.sm, en.mp, en.ht, en.hta, en.sw, en.ssg]);
    expect(text).not.toMatch(/39 ?%/);
    expect(text).not.toMatch(/\b(FANR|regulator) (certifies|certified|approves|requires)\b/);
  });
});
