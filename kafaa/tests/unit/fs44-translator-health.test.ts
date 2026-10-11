/** FS34 Transferable-skills translator + FS35 Career Health check (FS wave D · E4): one test per acceptance criterion on the pure
 * rules and the LocalBackend, plus RBAC, refusals and i18n coverage. The SQL mirrors are proven equal to these rules in
 * scripts/validate/fs44-translator-health.mjs (PGlite). The page-level criteria (nothing stored on the public run, Execute through
 * the F12 RPC) are in fs44-pages.test.tsx. */
import { beforeEach, describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { translate, templateProblems, templateSkills, heldOf, coveragePct, MAX_RESULTS, PRACTICE_HOURS_PER_LEVEL, type OccupationTemplate, type TrData } from '../../src/modules/m18/translate';
import { careerHealth, normPlan, skillCurrency, pctOf, HEALTH_KEYS, type HealthData } from '../../src/modules/m18/careerHealth';
import { rankTranslation } from '../../src/modules/m18/CareersTranslatePage';
import { lintRanked } from '../../src/domain/engines/rank';
import { routes } from '../../src/modules/m18/routes';
import en from '../../src/i18n/m18.en.json';
import ar from '../../src/i18n/m18.ar.json';

type Row = Record<string, any>;
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const W = Object.fromEntries(Object.entries(T.engine_settings.find((s) => s.id === 'recommend')!.weights).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
const TR: TrData = { roles: T.job_roles as never, roleComps: T.role_competencies as never, competencies: T.competencies as never, skills: T.skills as never, courses: T.courses as never, links: T.course_skill_links as never, packs: T.course_pack_items as never, edges: T.career_paths as never, weights: W };
const TPL = T.occupation_templates as unknown as OccupationTemplate[];
const get = (o: unknown, path: string) => path.split('.').reduce<any>((x, k) => (x == null ? undefined : x[k]), o);

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('FS34 acceptance', () => {
  it('at least 8 source occupations are available, each with an ESCO-aligned skill set and a cited source', () => {
    const skillIds = new Set(T.skills.map((s) => s.id));
    expect(TPL.length).toBeGreaterThanOrEqual(8);
    expect(new Set(TPL.map((t) => t.industry)).size).toBeGreaterThanOrEqual(5);
    for (const t of TPL) {
      expect(templateProblems(t, skillIds)).toEqual([]);
      expect(t.esco_uri).toMatch(/^http:\/\/data\.europa\.eu\/esco\/occupation\/[0-9a-f-]{36}$/);
      const src = t.sources as { url: string; as_of: string }[];
      expect(src.length).toBeGreaterThan(0);
      expect(src.every((s) => s.url.startsWith('https://esco.ec.europa.eu/') && s.url.includes(t.esco_uri) && /^\d{4}-\d{2}-\d{2}$/.test(s.as_of))).toBe(true);
      for (const s of templateSkills(t)) {
        expect(s.esco_uri).toMatch(/^http:\/\/data\.europa\.eu\/esco\/(skill|knowledge)\//);
        expect(s.esco_label_en && s.esco_label_ar && s.why_en && s.why_ar).toBeTruthy();
        // an "exact" tie is the FS08 crosswalk's own alignment of this skill to that ESCO concept
        if (s.match === 'exact') expect(T.skill_alignments.some((a) => a.skill_id === s.skill_id && a.framework === 'esco' && a.external_code === s.esco_uri)).toBe(true);
      }
      expect(t.benchmark_ids).toEqual(expect.arrayContaining(['ESCO', 'UK-NUC', 'SMR-WF']));
    }
    expect(TPL.flatMap((t) => templateSkills(t)).some((s) => s.match === 'exact')).toBe(true);
  });

  it('each result lists its delta skills and bridging items with reasons', () => {
    for (const t of TPL) {
      const r = translate(TR, heldOf(t), t.industry);
      expect(r.results).toHaveLength(MAX_RESULTS);
      expect(lintRanked(rankTranslation(r))).toEqual([]);
      for (const x of r.results) {
        expect(x.reasons.map((y) => y.code)).toEqual(expect.arrayContaining(['fs34_cover', 'fs34_transfer']));
        for (const g of x.gaps) {
          expect(g.need).toBeGreaterThan(g.have);
          expect(x.bridge.some((i) => i.competency_ids.includes(g.competency_id))).toBe(true);
          expect(x.reasons.some((y) => y.code === 'fs34_gap') || x.gaps.indexOf(g) >= 3).toBe(true);
        }
        for (const i of x.bridge) {
          expect(i.reasons.length).toBeGreaterThan(0);
          expect(i.reasons.every((y) => /^m18\.fs34\.reason\./.test(y.key) && get(en, y.key.slice(4)) && get(ar, y.key.slice(4)))).toBe(true);
          if (i.kind === 'practice') expect(i.hours).toBe(PRACTICE_HOURS_PER_LEVEL * i.levels);
        }
        expect(x.hours).toBe(x.bridge.reduce((s, i) => s + i.hours, 0));
        expect(x.weeks).toBe(x.bridge.reduce((s, i) => s + i.weeks, 0));
      }
    }
  });

  it('the anonymous run performs no write and no storage (the rule is pure; the page test covers RPC and Storage spies)', () => {
    const t = TPL[0];
    const before = JSON.stringify([TR, t]);
    const a = translate(TR, heldOf(t), t.industry);
    const c = translate(TR, heldOf(t), t.industry);
    expect(JSON.stringify([TR, t])).toBe(before);
    expect(c).toEqual(a);
  });

  it('never proposes security, safeguards, cyber, concept or corporate roles; career-changers start with the FS19 cross-over course', () => {
    const banned = new Set(T.job_roles.filter((r) => r.security_sensitive || r.lifecycle === 'concept' || r.family_id === 'corporate').map((r) => r.id));
    for (const t of TPL) {
      const r = translate(TR, heldOf(t), t.industry);
      expect(r.results.some((x) => banned.has(x.role_id))).toBe(false);
      const cross = T.course_pack_items.filter((p) => p.kind === 'crossover' && p.for_industries.includes(t.industry));
      for (const x of r.results) expect(x.bridge.filter((i) => i.kind === 'crossover').map((i) => i.course_id)).toEqual(cross.sort((p, q) => p.sort - q.sort).map((p) => p.course_id));
    }
    const hse = translate(TR, heldOf(TPL.find((t) => t.id === 'occ-hse-officer')!), 'oil_gas');
    expect(hse.results[0].role_id).toBe('industrial-health-safety-officer');
    expect(hse.results[0].pct).toBe(100);
    const pp = translate(TR, heldOf(TPL.find((t) => t.id === 'occ-power-plant-cro')!), 'power');
    expect(pp.results[0].role_id).toBe('local-operator');
    expect(coveragePct(12 * 3, 3)).toBe(100);
  });

  it('staff variant: my own passport through rpc.translateMine (own role excluded, nothing stored); others are refused', async () => {
    await as('k-ro');
    const audit0 = b.raw('audit_events').length;
    const r = await b.rpc.translateMine();
    expect(r.ok).toBe(true);
    expect(r.data!.held).toBe(T.person_skills.filter((s) => s.person_id === 'p-k-ro' && s.active !== false).length);
    expect(r.data!.results.some((x) => x.role_id === 'reactor-operator')).toBe(false);
    expect(r.data!.industry).toBeNull();
    expect(b.raw('audit_events').length).toBe(audit0);
    await as(null);
    expect((await b.rpc.translateMine()).code).toBe('not_signed_in');
    await as('alnoor-gm');
    expect((await b.rpc.translateMine()).code).toBe('forbidden');
  });
});

describe('FS35 acceptance', () => {
  it('all five components are shown with their inputs; there is no single hidden score', async () => {
    await as('k-lo-trainee');
    const r = await b.rpc.careerHealth();
    expect(r.ok).toBe(true);
    const h = r.data!;
    expect(h.components.map((c) => c.key)).toEqual([...HEALTH_KEYS]);
    for (const c of h.components) {
      expect(Object.keys(c.inputs).length).toBeGreaterThanOrEqual(3);
      expect(c.reasons.length).toBeGreaterThan(0);
      expect(c.reasons.every((y) => get(en, y.key.slice(4)) && get(ar, y.key.slice(4)))).toBe(true);
      expect(['good', 'watch', 'act', 'na']).toContain(c.status);
    }
    expect(Object.keys(h).sort()).toEqual(['act', 'actions', 'as_of', 'components', 'good', 'person_id', 'role_id', 'watch']);
    expect(h.good).toBe(h.components.filter((c) => c.status === 'good').length);
    expect(JSON.stringify(h)).not.toMatch(/"score"/);
  });

  it('a manager cannot read another person\'s health snapshot (RLS), nor HR, auditors or admins; the owner can', async () => {
    const kro = T.health_snapshots.filter((s) => s.person_id === 'p-k-ro');
    expect(kro).toHaveLength(3);
    await as('k-ro');
    expect(await b.list('health_snapshots', { filter: { person_id: 'p-k-ro' } })).toHaveLength(3);
    expect((await b.list('health_snapshots')).every((s) => s.person_id === 'p-k-ro')).toBe(true);
    for (const p of ['sro', 'chco', 'k-hr-analyst', 'k-auditor', 'k-admin', 'training-mgr']) {
      await as(p);
      expect(await b.list('health_snapshots', { filter: { person_id: 'p-k-ro' } })).toHaveLength(0);
      const me = b.identity().personId;
      expect((await b.list('health_snapshots')).every((s) => s.person_id === me)).toBe(true);
      expect((await b.rpc.saveHealthSnapshot({ snapshot_id: kro[0].id, plan: { actions: [] } })).code).toMatch(/not_found|forbidden/);
    }
    await as(null);
    expect(await b.list('health_snapshots')).toHaveLength(0);
    // direct writes are refused (RPC only)
    await as('k-ro');
    expect((await b.insert('health_snapshots', { id: 'x', person_id: 'p-k-ro', as_of: '2026-10-11' } as never)).ok).toBe(false);
  });

  it('the Execute step links only my own conversation shared through the F12 RPC', async () => {
    await as('k-ro');
    const s = await b.rpc.saveHealthSnapshot({ plan: { actions: ['learn', 'conversation'], note: 'x' } });
    expect(s.ok && s.data!.step).toBe('charted');
    // an unshared conversation cannot be linked
    const draft = b.raw('career_conversations').find((c) => c.person_id === 'p-k-ro' && !c.prep_submitted_at)!;
    expect((await b.rpc.saveHealthSnapshot({ snapshot_id: s.data!.id, conversation_id: draft.id })).code).toBe('invalid');
    // book through the existing F12 RPC, then link it
    const prep = await b.rpc.submitPrep({ aspirations: ['grow_vertical'], goal_12m: 'Prepare for the SRO route', topics: 'Career health plan' }, true);
    expect(prep.ok).toBe(true);
    const conv = b.rawGet('career_conversations', prep.data!.id)!;
    expect(conv.prep_submitted_at).toBeTruthy();
    expect(conv.manager_read_id).toBe(prep.data!.manager_person_id);
    const l = await b.rpc.saveHealthSnapshot({ snapshot_id: s.data!.id, conversation_id: prep.data!.id });
    expect(l.ok && l.data!.step).toBe('executed');
    const row = b.rawGet('health_snapshots', s.data!.id)!;
    expect(row.conversation_id).toBe(prep.data!.id);
    expect((row.plan as Row).actions).toEqual(['learn', 'conversation']);
    // the conversation never carries the health check
    expect(JSON.stringify(conv)).not.toMatch(/fs35_|"components"|health_snapshots|"currency"/);
    // audited, never ledgered
    const aud = b.raw('audit_events').filter((a) => a.action === 'career_health.save');
    expect(aud.filter((a) => a.outcome === 'ok')).toHaveLength(2);
    expect(b.raw('ledger_local').some((x) => /health/i.test(String(x.action ?? '')))).toBe(false);
  });
});

describe('FS35 rules', () => {
  const hd = (pid: string): HealthData => ({
    person: { id: pid, job_role_id: T.people.find((p) => p.id === pid)?.job_role_id ?? null }, roles: T.job_roles as never, roleComps: T.role_competencies as never, skills: T.skills as never,
    states: T.person_skills.filter((s) => s.person_id === pid) as never, training: T.training_records.filter((s) => s.person_id === pid) as never, external: [], pathways: [], weights: W, map: null,
  });
  it('currency, thresholds and plans follow the published rules', () => {
    expect(skillCurrency({ skill_id: 'x', level: 2, reasons: [{ observed_on: '2020-01-01', ageing: true, hl: 36 }] }, '2026-10-11')).toBe('ageing');
    expect(skillCurrency({ skill_id: 'x', level: 2, reasons: [{ observed_on: '2024-01-01', ageing: false, hl: 36, source: 'assessment' }] }, '2026-10-11')).toBe('due');
    expect(skillCurrency({ skill_id: 'x', level: 2, reasons: [{ observed_on: '2020-01-01', ageing: false, hl: 36, source: 'qualification' }] }, '2026-10-11')).toBe('current');
    expect(skillCurrency({ skill_id: 'x', level: 2, reasons: [{ observed_on: '2026-06-01', ageing: false, hl: 18, source: 'work' }] }, '2026-10-11')).toBe('current');
    expect(pctOf(1, 3)).toBe(33);
    expect(pctOf(1, 0)).toBeNull();
    const h = careerHealth(hd('p-nse'), '2026-10-11');
    expect(h.components.find((c) => c.key === 'change')!.status).toBe('na'); // no map passed
    expect(h.components.find((c) => c.key === 'recency')!.status).toBe('act');
    expect(h.actions.map((a) => a.key)).toEqual(expect.arrayContaining(['learn']));
    expect(normPlan({ actions: ['bridge', 'learn', 'learn'], note: '  hi ', review_on: '' })).toEqual({ actions: ['learn', 'bridge'], note: 'hi', review_on: null, focus_role_id: null });
    expect(normPlan({ actions: ['promote_me'] })).toBeNull();
    expect(normPlan({ note: 'x'.repeat(601) })).toBeNull();
    expect(normPlan({ review_on: '11/10/2026' })).toBeNull();
  });
});

describe('FS34/FS35 wiring', () => {
  it('routes, guards and i18n (EN and AR) are complete', () => {
    const tr = routes.find((r) => r.id === 'careers-translate')!;
    expect(tr.path).toBe('/careers/translate');
    expect(tr.guard).toEqual({});
    const he = routes.find((r) => r.id === 'my-career-health')!;
    expect(he.guard).toEqual({ signedIn: true, grant: { res: 'skills_profile', levels: ['Own'] } });
    for (const id of ['careers-translate', 'my-career-health']) for (const d of [en, ar]) expect(get(d, `routes.${id}.title`)).toBeTruthy();
    const flat = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(flat((en as any).fs34).sort()).toEqual(flat((ar as any).fs34).sort());
    expect(flat((en as any).fs35).sort()).toEqual(flat((ar as any).fs35).sort());
  });
});
