/** FS03 Honest skill states (future-skills wave A · E2, M17): one test per acceptance criterion on the local path, plus the rules (decay
 *  classes, half-lives, the calibrated blend, the Wilson band), the RPCs (setSkillHalfLives, skillConfidenceStats), the engine-settings
 *  check, the seed, routes and i18n. The SQL path is proved by scripts/validate/fs12-decay.mjs (PGlite, SQL = TS for every state). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import { hasKey } from '../../src/i18n';
import {
  AREA_DECAY_CLASS, BASIS_WEIGHT, DEFAULT_DECAY, DEFAULT_HALF_LIFE_MONTHS, bandOf, blendConfidence, confidenceInterval, decayClassOf, decayModelFrom, deriveSkillState, deriveStates,
  gatherEvidence, halfLifeMonths, makeDecayModel, monthsToDays, skillReasons, sourceOf, type Evidence, type SkillSources,
} from '../../src/domain/skills';
import { FS03_MSG, RECORD_ORDER, checkHalfLives, confidenceStats, methodNotice, nextDrop, projectSkill, raiseActions, readinessRange, sourceRecord, METHOD_SINCE } from '../../src/modules/m17/decay';
import { ENGINE_MSG, validHalfLives, validWeights } from '../../src/modules/m16/transparency';
import { makeSupabaseM17 } from '../../src/modules/m17/backend/supabase';
import { routes } from '../../src/modules/m17/routes';
// @ts-expect-error the seed builder is plain JavaScript (node loads it in build-seed.mjs)
import { DECAY_CLASS_ROWS as ROWS, backfillAwardEvidence as backfill } from '../../scripts/seed/ext/fs03-decay.mjs';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DECAY_CLASS_ROWS = ROWS as any[];
const backfillAwardEvidence = backfill as (t: unknown) => unknown[];
import seed from '../../src/seed/seed.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, any[]>; meta: { demo_today: string } }).tables;
const NOW = (seed as unknown as { meta: { demo_today: string } }).meta.demo_today;
const SEED_MODEL = decayModelFrom(T.engine_settings, T.skills);
const src = (tables: Record<string, any[]>): SkillSources => ({
  skills: tables.skills, competencies: tables.competencies, role_competencies: tables.role_competencies, qual_standards: tables.qual_standards, qual_records: tables.qual_records,
  training_records: tables.training_records, courses: tables.courses, attempts: tables.attempts, assessment_forms: tables.assessment_forms, jpm_results: tables.jpm_results, jpms: tables.jpms,
});
const ev = (o: Partial<Evidence>): Evidence => ({ id: 'e', person_id: 'p', skill_id: 's', kind: 'course', ref_table: 'x', ref_id: 'r', level: 2, basis: 'evidenced', status: 'current', observed_on: NOW, ...o });
const monthsAgo = (n: number) => { const d = new Date(`${NOW}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 10); };
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('FS03 AC1 · the half-life setting is wired (TS and SQL use the same rule; SQL proved by PGlite)', () => {
  it('changing half_life_months through setEngineWeights changes computed confidence, exactly as the rule with the new setting', async () => {
    await as('k-admin');
    const before = new Map(b.raw('person_skills').filter((p) => p.active).map((p) => [p.id, Number(p.confidence)]));
    const w = { ...(b.rawGet('engine_settings', 'skills')!.weights as Record<string, number>), half_life_months: 24 };
    const r = await b.rpc.setEngineWeights('skills', 'deterministic', w);
    expect(r.ok).toBe(true);
    await as('training-mgr');
    expect((await b.rpc.recomputeSkills(null)).ok).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    const tbl = Object.fromEntries(['skills', 'competencies', 'role_competencies', 'qual_standards', 'qual_records', 'training_records', 'courses', 'attempts', 'assessment_forms', 'jpm_results', 'jpms']
      .map((t) => [t, b.raw(t as never) as unknown as any[]])) as Record<string, any[]>;
    const recorded = b.raw('skill_evidence').filter((e) => e.active && (['rating', 'ojt', 'credential'].includes(e.kind) || ['fitness_attempts', 'adaptive_attempts', 'task_attempts'].includes(String(e.ref_table)) /* FS10, FS21/FS22 */)) as unknown as Evidence[];
    const want = deriveStates([...gatherEvidence(src(tbl), { person: null, now: today }), ...recorded], today, makeDecayModel(w, b.raw('skills') as never));
    const stored = new Map(b.raw('person_skills').filter((p) => p.active).map((p) => [p.id, p]));
    expect(want.length).toBe(stored.size);
    for (const s of want) {
      const x = stored.get(s.id)!;
      expect(Number(x.confidence), s.id).toBe(s.confidence);
      expect(x.confidence_band, s.id).toBe(s.confidence_band);
    }
    const changed = want.filter((s) => before.get(s.id) !== s.confidence).length;
    expect(changed).toBeGreaterThan(50);
    expect(want.some((s) => s.reasons.some((x) => x.hl === 24))).toBe(true);
  });
  it('the model reads the setting: no hard-coded 1096 days (36 months -> 1096 days, 24 -> 731)', () => {
    expect(monthsToDays(36)).toBe(1096);
    expect(makeDecayModel({ half_life_months: 24 }).days.standard).toBe(731); // 24 x 30.4375 = 730.5, rounded half up (same in SQL)
    expect(halfLifeMonths({ half_life_months: 24, half_life_fast: 12 })).toEqual({ fast: 12, standard: 24, slow: 60 });
    expect(halfLifeMonths({ half_life_months: 500 })).toEqual(DEFAULT_HALF_LIFE_MONTHS); // out of range: the default
    const e = ev({ observed_on: monthsAgo(30) });
    expect(deriveSkillState([e], NOW, makeDecayModel({ half_life_months: 24 }))!.confidence).toBeLessThan(deriveSkillState([e], NOW, makeDecayModel({ half_life_months: 48 }))!.confidence);
  });
  it('setEngineWeights accepts half-lives (whole months 6-120, fast <= standard <= slow) on the skills surface only', async () => {
    expect(validWeights({ half_life_months: 36, half_life_fast: 18, half_life_slow: 60 }, 'skills')).toBe(true);
    expect(validWeights({ half_life_months: 36 }, 'recommend')).toBe(false);
    expect(validHalfLives({ half_life_months: 24.5 })).toBe(false);
    expect(validHalfLives({ half_life_fast: 40 })).toBe(false); // 40 > standard default 36
    expect(validHalfLives({ half_life_months: 121 })).toBe(false);
    expect(ENGINE_MSG.halfLife).toBe(FS03_MSG.invalid_hl);
    await as('k-admin');
    const bad = await b.rpc.setEngineWeights('skills', 'deterministic', { half_life_months: 200 });
    expect(bad).toMatchObject({ ok: false, code: 'invalid', message: FS03_MSG.invalid_hl });
    const rec = await b.rpc.setEngineWeights('recommend', 'deterministic', { core: 99 });
    expect(rec).toMatchObject({ ok: false, code: 'invalid', message: ENGINE_MSG.weights });
  });
});

describe('FS03 AC2 · decay classes', () => {
  it('a digital skill evidenced 30 months ago shows lower confidence than a reactor-physics skill of the same age', () => {
    const da = T.skills.find((s) => s.id === 'sk-da-01-analysis')!;
    const pf = T.skills.find((s) => s.id === 'sk-pf-01-core')!;
    expect(decayClassOf(da)).toBe('fast');
    expect(decayClassOf(pf)).toBe('slow');
    const on = monthsAgo(30);
    const d = deriveSkillState([ev({ skill_id: da.id, kind: 'ojt', observed_on: on })], NOW, SEED_MODEL)!;
    const p = deriveSkillState([ev({ skill_id: pf.id, kind: 'ojt', observed_on: on })], NOW, SEED_MODEL)!;
    expect(d.confidence).toBeLessThan(p.confidence);
    expect(d.reasons[0]).toMatchObject({ hl: 18, ageing: true });
    expect(p.reasons[0]).toMatchObject({ hl: 60, ageing: false });
    expect(d.level).toBe(1); // older than its 18-month half-life: one level lower
    expect(p.level).toBe(2);
  });
  it('areas default to a class and FS02\'s decay_class overrides it', () => {
    expect(AREA_DECAY_CLASS.digital).toBe('fast');
    expect(decayClassOf({ area: 'operations' })).toBe('standard');
    expect(decayClassOf({ area: 'digital', decay_class: 'slow' })).toBe('slow');
    expect(decayClassOf({ area: 'digital', decay_class: 'bogus' })).toBe('fast');
    expect(DECAY_CLASS_ROWS.map((r) => r.id)).toEqual(['fast', 'standard', 'slow']);
    for (const r of DECAY_CLASS_ROWS) {
      expect(r.default_months).toBe(DEFAULT_HALF_LIFE_MONTHS[r.id as 'fast']);
      for (const f of r.facts) { expect(f.url).toMatch(/^https:\/\//); expect(f.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(f.label_ar.length).toBeGreaterThan(10); }
    }
  });
});

describe('FS03 · the calibrated blend and the band', () => {
  it('weights by basis (verified 1.0, evidenced 0.8, validated 0.6, claimed 0.3) with diminishing returns per extra source', () => {
    expect(BASIS_WEIGHT).toEqual({ verified: 1, evidenced: 0.8, validated: 0.6, claimed: 0.3 });
    const one = blendConfidence([0.8]).point;
    const two = blendConfidence([0.8, 0.6]).point;
    const three = blendConfidence([0.8, 0.6, 0.3]).point;
    expect(one).toBeCloseTo(0.8, 10);
    expect(two).toBeGreaterThan(one);
    expect(three - two).toBeLessThan(two - one); // each extra source adds less
    expect(blendConfidence([0.6, 0.8]).point).toBe(two); // order-independent
  });
  it('counts the best row of each independent source once (two courses are one source)', () => {
    const twoCourses = deriveSkillState([ev({ id: 'a' }), ev({ id: 'b', ref_id: 'r2' })], NOW)!;
    const courseAndCheckin = deriveSkillState([ev({ id: 'a' }), ev({ id: 'c', kind: 'rating', basis: 'validated' })], NOW)!;
    expect(twoCourses.confidence).toBe(0.8);
    expect(courseAndCheckin.confidence).toBeGreaterThan(0.8);
    expect(sourceOf({ kind: 'rating', basis: 'claimed' })).toBe('self');
    expect(sourceOf({ kind: 'jpm', basis: 'evidenced' })).toBe('assessment');
  });
  it('returns a low / medium / high band and an interval that contains the confidence', () => {
    const claimed = deriveSkillState([ev({ kind: 'rating', basis: 'claimed' })], NOW)!;
    const course = deriveSkillState([ev({})], NOW)!;
    const strong = deriveSkillState([ev({ id: 'q', kind: 'qual', basis: 'verified', level: 3 }), ev({ id: 'v', kind: 'rating', basis: 'validated' })], NOW)!;
    expect([claimed.confidence_band, course.confidence_band, strong.confidence_band]).toEqual(['low', 'medium', 'high']);
    for (const s of [claimed, course, strong]) { expect(s.conf_low).toBeLessThanOrEqual(s.confidence); expect(s.conf_high).toBeGreaterThanOrEqual(s.confidence); }
    expect(strong.conf_high - strong.conf_low).toBeLessThan(claimed.conf_high - claimed.conf_low); // more and stronger sources: narrower range
    expect(bandOf(0.6)).toBe('high');
    expect(bandOf(0.3)).toBe('medium');
    expect(bandOf(0.29)).toBe('low');
    expect(confidenceInterval(0.5, 0)).toEqual([0, 0.5]);
  });
});

describe('FS03 AC3 · every person skill carries a band', () => {
  it('every seeded state has a band, conf_low <= confidence <= conf_high, and the seed equals the rule', () => {
    const active = T.person_skills.filter((s) => s.active);
    expect(new Set(active.map((s) => s.confidence_band))).toEqual(new Set(['low', 'medium', 'high']));
    for (const s of active) {
      expect(['low', 'medium', 'high']).toContain(s.confidence_band);
      expect(Number(s.conf_low)).toBeLessThanOrEqual(Number(s.confidence));
      expect(Number(s.confidence)).toBeLessThanOrEqual(Number(s.conf_high));
    }
    const fresh = deriveStates(T.skill_evidence.filter((e) => e.active !== false) as Evidence[], NOW, SEED_MODEL);
    const byId = new Map(active.map((s) => [s.id, s]));
    for (const s of fresh) expect(byId.get(s.id), s.id).toMatchObject({ confidence_band: s.confidence_band, conf_low: s.conf_low, conf_high: s.conf_high, confidence: s.confidence });
  });
  it('the Navigator range: readiness counting every skill vs only skills we are fairly sure of, with a band and reasons', () => {
    const me = 'p-sro';
    const states = T.person_skills.filter((s) => s.person_id === me && s.active);
    const r = readinessRange({ states, skills: T.skills, roleComps: T.role_competencies, roleId: 'shift-supervisor' })!;
    expect(r).not.toBeNull();
    expect(r.pctSure).toBeLessThanOrEqual(r.pct);
    expect(['low', 'medium', 'high']).toContain(r.band);
    for (const x of r.reasons) expect(hasKey(x.key), x.key).toBe(true);
    // all claims low -> the sure readiness drops
    const weak = readinessRange({ states: states.map((s) => ({ ...s, confidence_band: 'low', conf_low: 0.1 })), skills: T.skills, roleComps: T.role_competencies, roleId: 'shift-supervisor' })!;
    expect(weak.pctSure).toBe(0);
    expect(weak.band).toBe('low');
  });
});

describe('FS03 AC4 · micro-credential evidence back-fill, recompute idempotent', () => {
  it('every seeded award that was issued has one credential evidence row per aligned skill, active only while awarded', () => {
    const issued = T.microcred_awards.filter((a) => ['awarded', 'superseded', 'revoked'].includes(a.status) && a.issued_on);
    expect(issued.length).toBeGreaterThan(90);
    const rows = T.skill_evidence.filter((e) => e.ref_table === 'microcred_awards');
    expect(rows.length).toBeGreaterThan(100);
    for (const a of issued) {
      const mine = rows.filter((e) => e.ref_id === a.id);
      expect(mine.length, a.id).toBeGreaterThan(0);
      for (const e of mine) { expect(e).toMatchObject({ kind: 'credential', basis: 'evidenced', observed_on: a.issued_on, active: a.status === 'awarded' }); expect(e.level).toBeLessThanOrEqual(2); }
    }
    expect(backfillAwardEvidence(T)).toEqual([]); // nothing left to add
  });
  it('recomputing on the seed changes nothing, and recomputing twice is byte-identical', async () => {
    const snap = () => JSON.stringify(b.raw('person_skills').map((p) => [p.id, p.level, Number(p.confidence), p.basis, p.reasons, p.confidence_band, Number(p.conf_low), Number(p.conf_high), p.active]));
    const s0 = snap();
    const r1 = await applySkills(b, null, NOW);
    expect(snap()).toBe(s0);
    const r2 = await applySkills(b, null, NOW);
    expect(r2.digest).toBe(r1.digest);
    await as('training-mgr');
    const x1 = await b.rpc.recomputeSkills(null);
    const s1 = snap();
    const x2 = await b.rpc.recomputeSkills(null);
    expect(x1.data!.digest).toBe(x2.data!.digest);
    expect(snap()).toBe(s1);
  });
});

describe('FS03 rpc.setSkillHalfLives and rpc.skillConfidenceStats (local)', () => {
  it('platform admins only; checks; no change refused; success logs an engine change, versions the cards, ledgers and recomputes', async () => {
    await as(null);
    expect((await b.rpc.setSkillHalfLives({ fast: 12, standard: 36, slow: 60, rationale: 'Digital tools change fast now' })).code).toBe('not_signed_in');
    await as('training-mgr');
    expect((await b.rpc.setSkillHalfLives({ fast: 12, standard: 36, slow: 60, rationale: 'Digital tools change fast now' })).code).toBe('forbidden');
    await as('ai-governance');
    expect(await b.rpc.setSkillHalfLives({ fast: 40, standard: 36, slow: 60, rationale: 'Digital tools change fast now' })).toMatchObject({ code: 'invalid', message: FS03_MSG.invalid_hl });
    expect(await b.rpc.setSkillHalfLives({ fast: 12, standard: 36, slow: 60, rationale: 'short' })).toMatchObject({ code: 'invalid', message: FS03_MSG.invalid_why });
    expect((await b.rpc.setSkillHalfLives({ fast: 18, standard: 36, slow: 60, rationale: 'Digital tools change fast now' })).code).toBe('no_change');
    const ch0 = b.raw('engine_changes').length;
    const led0 = b.raw('ledger_local').length;
    const card0 = b.raw('engine_cards').filter((c) => c.engine_surface === 'skills').reduce((a, c) => a + c.version, 0);
    const r = await b.rpc.setSkillHalfLives({ fast: 12, standard: 30, slow: 60, rationale: 'Digital tools change fast now' });
    expect(r.ok).toBe(true);
    expect(r.message).toBe(FS03_MSG.saved);
    expect(r.data!.moved).toBeGreaterThan(0);
    expect(b.raw('engine_changes').length).toBe(ch0 + 1);
    expect(b.rawGet('engine_settings', 'skills')!.weights).toMatchObject({ half_life_fast: 12, half_life_months: 30, half_life_slow: 60 });
    expect(b.raw('engine_cards').filter((c) => c.engine_surface === 'skills').reduce((a, c) => a + c.version, 0)).toBeGreaterThan(card0);
    expect(b.raw('ledger_local').length).toBeGreaterThan(led0); // ai-governance is a NEXUS role card: ledger written
    const audit = b.raw('audit_events').slice(-1)[0];
    expect(audit).toMatchObject({ action: 'engine.settings', outcome: 'ok' });
  });
  it('statistics: admins, the training manager, HR and auditors; others refused; suppressed cells; preview; back-fill complete', async () => {
    await as('sro');
    await expect(b.rpc.skillConfidenceStats(null)).rejects.toThrow(/aggregate-only/);
    for (const p of ['k-admin', 'training-mgr', 'k-hr-analyst', 'k-auditor']) { await as(p); expect((await b.rpc.skillConfidenceStats(null)).allowed).toBe(true); }
    await as('k-admin');
    const s = await b.rpc.skillConfidenceStats({ half_life_months: 24 });
    expect(s.months).toEqual(DEFAULT_HALF_LIFE_MONTHS);
    expect(s.preview!.months.standard).toBe(24);
    expect(s.preview!.changed).toBeGreaterThan(10);
    expect([...s.by_class, ...s.by_area].every((c) => (c.suppressed ? c.states === null : (c.states ?? 0) > 0))).toBe(true);
    expect(s.by_area.some((c) => c.suppressed)).toBe(true);
    expect(s.backfill.with_evidence).toBe(s.backfill.awards);
  });
  it('confidenceStats suppresses a band naming fewer than 10 people', () => {
    const st = Array.from({ length: 9 }, (_, i) => ({ id: `ps:${i}:s`, person_id: `p${i}`, skill_id: 'sk-da-01', level: 1, confidence_band: 'low' }));
    const out = confidenceStats({ states: st, skills: T.skills, awards: [], evidence: [], changes: [], weights: {}, today: NOW });
    expect(out.bands.find((x) => x.band === 'low')).toEqual({ band: 'low', states: null, people: null });
  });
  it('maps the Supabase RPCs', async () => {
    const calls: [string, unknown][] = [];
    const m = makeSupabaseM17({ call: async (fn, args) => { calls.push([fn, args]); return { ok: true, code: 'ok', message: '' } as never; }, rpc: async (fn, args) => { calls.push([fn, args]); return {} as never; } });
    await m.skillConfidenceStats({ half_life_fast: 12 });
    await m.setSkillHalfLives({ fast: 12, standard: 36, slow: 60, rationale: 'x'.repeat(12) });
    expect(calls.map((c) => c[0])).toEqual(['kafaa_skill_confidence_stats', 'kafaa_set_skill_half_lives']);
  });
});

describe('FS03 · the person view rules', () => {
  it('the multi-source record lists self, peers, validation, assessment and work with dates; peers are shown but not counted', () => {
    const st = deriveSkillState([ev({ id: 'c', kind: 'rating', basis: 'claimed' }), ev({ id: 'o', kind: 'ojt' }), ev({ id: 'a', kind: 'assessment' })], NOW)!;
    const rec = sourceRecord(st, [ev({ id: 'c', kind: 'rating', basis: 'claimed' }), ev({ id: 'o', kind: 'ojt' }), ev({ id: 'a', kind: 'assessment' })],
      [{ id: 'r1', subject_id: 'p', skill_id: 's', rater_kind: 'peer', level: 2, status: 'submitted', at: `${NOW}T10:00:00Z`, example: 'Led the brief' }]);
    expect(rec.map((r) => r.source)).toEqual(['self', 'peer', 'assessment', 'work']);
    expect(rec.find((r) => r.source === 'peer')!.counted).toBe(false);
    expect(rec.find((r) => r.source === 'work')!.rows[0].observed_on).toBe(NOW);
    expect(RECORD_ORDER).toContain('validation');
  });
  it('projects decay by class and names the first drop; suggests what would raise confidence', () => {
    const e = [ev({ skill_id: 'sk-da-01-analysis', observed_on: monthsAgo(10) })];
    const pts = projectSkill(e, SEED_MODEL, NOW, [0, 3, 6, 9, 12]);
    expect(pts[0].confidence).toBeGreaterThan(pts[pts.length - 1].confidence);
    const drop = nextDrop(pts);
    expect(drop).not.toBeNull();
    const rec = sourceRecord(deriveSkillState(e, NOW, SEED_MODEL), e);
    const acts = raiseActions({ skill: { id: 'sk-da-01-analysis', code: 'DA-01.1' }, record: rec, qualificationOnly: false, security: false, drop, ageing: false, refresher: { id: 'c-x', code: 'C-X' }, microcred: { code: 'MC-DATA-FOUND' } });
    expect(acts.map((a) => a.kind)).toEqual(['validate', 'refresh', 'work', 'credential']);
    for (const a of acts) for (const r of a.reasons) expect(hasKey(r.key), r.key).toBe(true);
    expect(raiseActions({ skill: { id: 's', code: 'X' }, record: rec, qualificationOnly: false, security: true, drop, ageing: true, refresher: null, microcred: null })).toEqual([]);
  });
  it('the methodology banner shows for 120 days after FS03 or an admin change, never for seeded settings', () => {
    expect(methodNotice({ updated_by: null, updated_at: '2026-10-08T00:00:00Z' }, METHOD_SINCE)).toEqual({ kind: 'fs03', since: METHOD_SINCE });
    expect(methodNotice({ updated_by: 'p-k-admin', updated_at: '2026-12-01T09:00:00Z' }, '2026-12-02')).toEqual({ kind: 'half_lives', since: '2026-12-01' });
    expect(methodNotice(null, '2027-06-01')).toBeNull();
  });
  it('checkHalfLives mirrors the SQL order', () => {
    expect(checkHalfLives({ fast: 6, standard: 6, slow: 120, rationale: 'a valid reason' })).toBe('ok');
    expect(checkHalfLives({ fast: 5, standard: 36, slow: 60, rationale: '' })).toBe('invalid_hl');
    expect(checkHalfLives({ fast: 18, standard: 36, slow: 60, rationale: 'short' })).toBe('invalid_why');
  });
});

describe('FS03 routes and i18n', () => {
  it('registers /my/skills/confidence (own) and /admin/skills-confidence (admin, training manager, auditor, HR)', () => {
    const me = routes.find((r) => r.id === 'my-skills-confidence')!;
    const adm = routes.find((r) => r.id === 'admin-skills-confidence')!;
    expect(me.path).toBe('/my/skills/confidence');
    expect(me.guard).toMatchObject({ grant: { res: 'skills_profile', levels: ['Own'] } });
    expect(adm.path).toBe('/admin/skills-confidence');
    expect(adm.guard.anyRole).toEqual(expect.arrayContaining(['admin', 'training_manager', 'auditor', 'hr_analyst', 'hr_director']));
    for (const id of ['my-skills-confidence', 'admin-skills-confidence']) for (const k of ['title', 'purpose']) expect(hasKey(`m17.routes.${id}.${k}`)).toBe(true);
  });
  it('every dynamic key exists: bands, classes, sources, actions, why codes, areas and ageing reasons', () => {
    const keys = [
      ...['low', 'medium', 'high'].map((x) => `m17.dk.band.${x}`), ...['fast', 'standard', 'slow'].map((x) => `m17.dk.class.${x}`), ...RECORD_ORDER.map((x) => `m17.dk.source.${x}`),
      ...['validate', 'refresh', 'work', 'credential', 'requal'].flatMap((x) => [`m17.dk.raise.${x}`, `m17.dk.raise.${x}Body`]),
      ...[...new Set(T.skills.map((s) => s.area))].map((a) => `m17.dk.area.${a}`), ...['WEF-FOJ', 'SKILLS-TECH', 'FORECAST'].map((x) => `m17.dk.bench.${x}`),
      'm17.dk.method.fs03', 'm17.dk.method.half_lives',
    ];
    for (const k of keys) expect(hasKey(k), k).toBe(true);
    for (const s of T.person_skills.slice(0, 600)) for (const r of skillReasons(s.reasons)) expect(hasKey(r.key), r.key).toBe(true);
    expect(DEFAULT_DECAY.days.standard).toBe(1096);
  });
});
