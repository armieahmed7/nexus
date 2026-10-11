/** FS11 My Role in 2030 + FS12 Task exposure view (FS wave B · E3, M30): one test per acceptance criterion on the local path, the
 *  shared rules (transformRole, the copy check, publish checks, aggregates), RBAC, audit and ledger, the seed and i18n. The SQL path
 *  (TS = SQL parity, RLS, live RPC flows) is checked by scripts/validate/fs23-role-transformation.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import en from '../../src/i18n/m30.en.json';
import ar from '../../src/i18n/m30.ar.json';
import { SCHEMA } from '../../src/data/schema';
import { MIN_GROUP_SIZE } from '../../src/auth/policy';
import { publicTextIsClean } from '../../src/domain/future';
import { lintRanked } from '../../src/domain/engines';
import {
  BANNED_AR, BANNED_EN, MIN_GROUP, MONTHS_PER_LEVEL, PRACTICE_HOURS_PER_LEVEL, RT_MSG, bannedWording, checkTransformation, copyIsClean, exposureAggregate, hasDigits, isPathOnly,
  normDriver, readinessFor, transformRole, transformationOverview, type RtInput,
} from '../../src/modules/m30/transform';
import { routes } from '../../src/modules/m30/routes';
import seed from '../../src/seed/seed.json';

const S = (seed as unknown as { tables: Record<string, any[]> }).tables; // eslint-disable-line @typescript-eslint/no-explicit-any
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
const audits = () => b.raw('audit_events').length;
const ledger = () => b.raw('ledger_local').length;
const current = S.job_roles.filter((r) => (r.lifecycle ?? 'current') === 'current');
const role = (id: string) => S.job_roles.find((r) => r.id === id);
const mapFor = (id: string, person: string | null = null, horizon = '2030') => transformRole({
  role: role(id), map: S.role_transformations.find((m) => m.role_id === id) ?? null, versions: S.role_profile_versions, tasks: S.jta_tasks, taskSkills: S.jta_task_skills,
  levels: S.ai_capability_levels, skills: S.skills, courses: S.courses, mine: person ? S.person_skills.filter((s) => s.person_id === person) : null, horizon,
});
const flat = (o: object, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)] as [string, string]]));
const good = (roleId = 'chemistry-technician'): RtInput => {
  const m = S.role_transformations.find((x) => x.role_id === roleId);
  return { role_id: roleId, archetype: m.archetype, drivers: m.drivers, summary_en: m.summary_en, summary_ar: m.summary_ar, public_summary_en: m.public_summary_en, public_summary_ar: m.public_summary_ar, sources: m.sources, publish: false };
};

describe('FS11 acceptance', () => {
  it('all 28 roles have a map (seeded, published, public) and the RPC returns a map for each', async () => {
    expect(current.length).toBe(28);
    for (const r of current) expect(S.role_transformations.filter((m) => m.role_id === r.id && m.status === 'published' && m.is_public).length).toBe(1);
    await as('k-ro');
    for (const r of current) {
      const v = await b.rpc.roleTransformation(r.id, '2030');
      expect(v?.map?.role_id).toBe(r.id);
    }
  }, 60000);
  it('my time-to-ready lists the gaps it is based on (months = 2 x total level gap, each gap with have, need and a reason)', async () => {
    await as('k-ro');
    // [FS QA wave B] k-ro's AI fitness checks (FS10) now evidence sk-fs-ai-verify at level 2, so the 2030 profile reads ready now;
    // the 2035 profile still has two one-level gaps (digital twins, advanced cooling).
    const v30 = (await b.rpc.roleTransformation(null, '2030'))!;
    expect(v30.map!.me!.gaps.length).toBe(0);
    const v = (await b.rpc.roleTransformation(null, '2035'))!;
    expect(v.my_role_id).toBe('reactor-operator');
    const me = v.map!.me!;
    expect(me.gaps.length).toBeGreaterThan(0);
    expect(me.levels).toBe(me.gaps.reduce((s, g) => s + g.gap, 0));
    expect(me.months).toBe(MONTHS_PER_LEVEL * me.levels);
    expect(me.gaps.every((g) => g.need > g.have && g.gap === g.need - g.have && g.reasons.length >= 1)).toBe(true);
    expect(me.reasons.map((r) => r.code)).toEqual(['time_rule', 'time_gaps']);
    expect(me.gaps.map((g) => g.ref_id).sort()).toEqual(['sk-da-01-twins', 'sk-pf-02-advcool']);
    // the gap list is exactly the requirements of the 2035 profile I am below
    const pub = S.role_profile_versions.find((x) => x.role_id === 'reactor-operator' && x.horizon === '2035' && x.status === 'published');
    const fresh = readinessFor(pub.requirements, S.person_skills.filter((s) => s.person_id === 'p-k-ro'), S.skills, '2035');
    expect(fresh.gaps.map((g) => g.ref_id)).toEqual(me.gaps.map((g) => g.ref_id));
  });
  it('public views pass publicTextIsClean and show no headcount (no numbers in public summaries)', () => {
    const pub = [...S.role_transformations.flatMap((m) => [m.public_summary_en, m.public_summary_ar]), ...S.transformation_milestones.flatMap((x) => [x.title_en, x.title_ar, x.body_en, x.body_ar]),
      ...S.transformation_archetypes.flatMap((x) => [x.name_en, x.name_ar, x.meaning_en, x.meaning_ar, x.learning_en, x.learning_ar])];
    expect(publicTextIsClean(pub)).toBe(true);
    expect(S.role_transformations.every((m) => !hasDigits(m.public_summary_en) && !hasDigits(m.public_summary_ar))).toBe(true);
    expect(pub.join(' ')).not.toMatch(/headcount|\bFTE\b|عدد الموظفين/i);
    expect(SCHEMA.role_transformations.read).toEqual([{ res: 'public_content', where: 'is_public' }, { res: 'transformation' }]);
  });
  it('security roles show path-level content only', async () => {
    const sec = current.filter((r) => isPathOnly(r));
    expect(sec.map((r) => r.id).sort()).toEqual(['cyber-security-engineer', 'safeguards-specialist', 'security-officer']);
    for (const r of sec) {
      const m = mapFor(r.id, 'p-k-ro');
      expect([m.path_only, m.tasks.length, m.added.length, m.bridge.length, m.complements.length, m.me, m.archetype, m.drivers.length]).toEqual([true, 0, 0, 0, 0, null, null, 0]);
    }
    await as('nuc-security');
    const v = (await b.rpc.roleTransformation(null, '2030'))!;
    expect(v.map!.path_only).toBe(true);
    expect(JSON.stringify(v.map)).not.toMatch(/jt-security/);
  });
  it('the map carries technology drivers, tasks that grow / are augmented / shrink (FS06), skills added (FS05) and a bridge curriculum', () => {
    const m = mapFor('maintenance-technician-engineer');
    expect(m.drivers.map((d) => d.driver)).toEqual(expect.arrayContaining(['robotics', 'digital_ic', 'ai_assist']));
    expect(m.counts.rated).toBe(S.jta_tasks.filter((t) => t.role_id === 'maintenance-technician-engineer' && !t.restricted).length);
    expect(m.counts.grow + m.counts.augmented + m.counts.shrink).toBe(m.counts.rated);
    expect(m.tasks.every((t) => t.reasons[0].code === `move_${t.move}` && t.reasons.length >= 3)).toBe(true);
    expect(m.added.filter((a) => a.horizon === '2030').map((a) => a.ref_id)).toEqual(expect.arrayContaining(['sk-fs-dp-dic', 'sk-fs-dp-robotics']));
    expect(m.bridge.length).toBe(m.added.length);
    expect(m.bridge.some((s) => s.mode === 'course') && m.bridge.some((s) => s.mode === 'practice')).toBe(true);
    for (const s of m.bridge.filter((x) => x.mode === 'practice')) expect(s.hours).toBe(PRACTICE_HOURS_PER_LEVEL * (s.to - s.from));
    expect(lintRanked(m.tasks.map((t) => ({ id: t.id, score: 1, reasons: t.reasons })))).toEqual([]);
  });
  it('an archetype per role (Mastery Builder, Analytical Specialist, Human Connector) with what it means for learning', () => {
    const live = S.role_transformations.filter((m) => !m.path_only);
    expect(live.every((m) => ['mastery_builder', 'analytical_specialist', 'human_connector'].includes(m.archetype))).toBe(true);
    expect(new Set(live.map((m) => m.archetype)).size).toBe(3);
    expect(S.transformation_archetypes.every((a) => a.learning_en && a.learning_ar && a.sources[0].url.startsWith('https://'))).toBe(true);
  });
  it('a milestone timeline: OSSA support ending around 2030 (sourced) and ADVANCE gates, "no deployment decision implied"', () => {
    const ossa = S.transformation_milestones.find((x) => x.kind === 'ossa');
    expect(ossa.year).toBe(2030);
    expect(ossa.sources.some((s: { url: string }) => s.url.includes('enec.ae'))).toBe(true);
    const adv = S.transformation_milestones.filter((x) => x.kind === 'advance');
    expect(adv.length).toBeGreaterThanOrEqual(2);
    expect(adv.every((x) => /no deployment decision implied/i.test(x.body_en) && x.body_ar.includes('لا يعني'))).toBe(true);
    expect(adv.filter((x) => x.simulated).length).toBeGreaterThanOrEqual(1);
  });
  it('RBAC: transformation R for staff; nothing for the public or partners; HR aggregates; W for the training manager and HR director', async () => {
    await as(null);
    expect(await b.rpc.roleTransformation('reactor-operator')).toBeNull();
    await as('alnoor-gm');
    expect(await b.rpc.roleTransformation('reactor-operator')).toBeNull();
    await as('k-auditor');
    expect((await b.rpc.roleTransformation('reactor-operator'))?.can_edit).toBe(false);
    await as('training-mgr');
    const tm = (await b.rpc.roleTransformation('reactor-operator'))!;
    expect(tm.can_edit).toBe(true);
    expect(tm.draft?.drivers).toContain('digital_twin');
    expect(await b.rpc.exposureAggregate()).toBeNull();
    await as('chco');
    expect((await b.rpc.roleTransformation('reactor-operator'))?.can_edit).toBe(true);
    expect(await b.rpc.exposureAggregate()).not.toBeNull();
    for (const r of routes) expect(en.routes[r.id as keyof typeof en.routes]?.title && ar.routes[r.id as keyof typeof ar.routes]?.title).toBeTruthy();
    expect(routes.find((r) => r.id === 'careers-role-transformation')!.guard).toEqual({});
  });
  it('publishTransformation: draft keeps the published map; publish bumps the version, keeps the history, writes one audit row and the ledger', async () => {
    await as('k-ro');
    const f = await b.rpc.publishTransformation(good());
    expect([f.ok, f.code]).toEqual([false, 'forbidden']);
    await as('training-mgr');
    let a0 = audits(); let l0 = ledger();
    const d = await b.rpc.publishTransformation({ ...good(), drivers: [...good().drivers, 'robotics'] });
    expect(d.ok && d.data?.status === 'draft').toBe(true);
    expect([audits(), ledger()]).toEqual([a0 + 1, l0]);
    const row0 = b.raw('role_transformations' as never).find((x: any) => x.role_id === 'chemistry-technician') as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(row0.drivers).not.toContain('robotics');
    a0 = audits(); l0 = ledger();
    const p = await b.rpc.publishTransformation({ ...good(), drivers: [...good().drivers, 'robotics'], publish: true });
    expect(p.ok && p.data?.version === 2).toBe(true);
    const row = b.raw('role_transformations' as never).find((x: any) => x.role_id === 'chemistry-technician') as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect([row.version, row.history.length, row.drivers.includes('robotics'), row.is_public]).toEqual([2, 1, true, true]);
    expect([audits(), ledger()]).toEqual([a0 + 1, l0 + 1]);
    expect((b.raw('ledger_local') as any[]).at(-1).action).toBe('kafaa.transformation.publish'); // eslint-disable-line @typescript-eslint/no-explicit-any
    const dr = b.raw('transformation_drafts' as never).find((x: any) => x.role_id === 'chemistry-technician') as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(dr.open).toBe(false);
  });
  it('publishTransformation refuses invalid, unclean and security-detailed maps with the shared codes (audited)', async () => {
    await as('chco');
    const cases: [RtInput, string][] = [
      [{ ...good(), role_id: 'fr-digital-twin' }, 'not_found'], [{ ...good(), drivers: ['quantum'] }, 'invalid'], [{ ...good(), archetype: null }, 'invalid'],
      [{ ...good(), role_id: 'security-officer', archetype: 'mastery_builder', drivers: [] }, 'security_restricted'],
      [{ ...good(), summary_en: `${good().summary_en} The site selection is done.` }, 'unclean_text'],
      [{ ...good(), summary_en: `${good().summary_en} Analysers replace manual sampling.` }, 'banned_wording'],
      [{ ...good(), public_summary_en: 'Tools take on 2 of 3 routine checks; people keep the judgement.' }, 'public_numbers'],
      [{ ...good(), sources: [], publish: true }, 'source_required'],
    ];
    for (const [input, code] of cases) {
      const a0 = audits();
      const r = await b.rpc.publishTransformation(input);
      expect([r.ok, r.code]).toEqual([false, code]);
      expect(r.message).toBe(RT_MSG[code as keyof typeof RT_MSG]);
      expect(checkTransformation(input, role(input.role_id) ?? null)).toBe(code);
      expect(audits()).toBe(a0 + 1);
    }
  });
});

describe('FS12 acceptance', () => {
  it('every task band shows a reason (the move plus the FS06 OECD capability reasons)', () => {
    for (const r of current.filter((x) => !isPathOnly(x))) {
      for (const t of mapFor(r.id).tasks) {
        expect(t.reasons.length).toBeGreaterThanOrEqual(3);
        expect(t.reasons[1].key).toMatch(/^m26\.reasons\.fx_/);
        expect(t.reasons.some((x) => x.code === 'fx_dim_covered' || x.code === 'fx_dim_gap')).toBe(true);
      }
    }
  });
  it('aggregates under 10 people are suppressed (no count, no shares); security families never broken out', async () => {
    expect(MIN_GROUP).toBe(MIN_GROUP_SIZE);
    await as('k-hr-analyst');
    const agg = (await b.rpc.exposureAggregate())!;
    const cells = [...agg.families, ...agg.groups, agg.total];
    expect(cells.filter((c) => c.suppressed).length).toBeGreaterThan(0);
    for (const c of cells) {
      if (c.suppressed) expect([c.people, c.analysed, c.tasks, c.shares]).toEqual([null, null, null, null]);
      else expect(c.people!).toBeGreaterThanOrEqual(10);
    }
    expect(agg.families.map((c) => c.key)).not.toContain('security');
    expect(agg.not_broken_out).toEqual(['security', 'safeguards', 'cyber']);
    const ts = exposureAggregate({ people: S.people, roles: S.job_roles, families: S.job_families, tasks: S.jta_tasks, levels: S.ai_capability_levels } as never);
    expect(agg).toEqual(ts);
    const ov = (await b.rpc.transformationOverview('2030'))!;
    for (const c of [...ov.families, ...ov.groups, ov.total]) if (c.suppressed) expect([c.people, c.median_months, c.ready_pct]).toEqual([null, null, null]);
    expect(ov).toEqual(transformationOverview({ people: S.people, roles: S.job_roles, families: S.job_families, versions: S.role_profile_versions, states: S.person_skills, skills: S.skills, horizon: '2030' } as never));
  });
  it('the copy-check word list blocks "replace" / "redundant" wording in English and Arabic', () => {
    for (const s of ['AI will replace the operator', 'replacing manual rounds', 'Replacement of the role', 'The role is redundant', 'redundancy programme', 'redundancies', 'job losses', 'layoffs', 'eliminate positions', 'made surplus'])
      expect(bannedWording(s), s).not.toBeNull();
    for (const s of ['سيحل الذكاء الاصطناعي محل المشغل', 'استبدال المشغلين', 'يستبدل النظام الفني', 'الاستغناء عن الموظفين', 'موظف زائد عن الحاجة', 'تسريح العمال', 'إلغاء الوظائف'])
      expect(bannedWording(s), s).not.toBeNull();
    for (const s of ['Tools take on routine work; people keep the decision', 'placement and displacement of sensors', 'replica training', 'تتولى الأدوات العمل الروتيني', 'المشغل يتحقق من النتيجة'])
      expect(bannedWording(s), s).toBeNull();
    expect(BANNED_EN.test('replace') && BANNED_AR.test('استبدال')).toBe(true);
    // all of FS11/FS12's own copy (EN and AR) and the FS06 reasons it shows pass the check
    expect(copyIsClean(flat(en).map((x) => x[1])) && copyIsClean(flat(ar).map((x) => x[1]))).toBe(true);
    expect(copyIsClean(S.role_transformations.flatMap((m) => [m.summary_en, m.summary_ar, m.public_summary_en, m.public_summary_ar]))).toBe(true);
  });
  it('skills that complement AI come from the human-core tasks (or the 2030 profile when a role has no task analysis)', () => {
    const ro = mapFor('reactor-operator');
    const human = new Set(ro.tasks.filter((t) => t.band === 'human_core').map((t) => t.id));
    const linked = new Set(S.jta_task_skills.filter((x) => x.active && human.has(x.task_id)).map((x) => x.skill_id));
    expect(ro.complements.length).toBeGreaterThan(0);
    expect(ro.complements.every((c) => c.source === 'tasks' && linked.has(c.skill_id) && c.reasons[0].code === 'complement_tasks')).toBe(true);
    const corp = mapFor('corporate-professional');
    expect(corp.tasks.length).toBe(0);
    expect(corp.complements.length).toBeGreaterThan(0);
    expect(corp.complements.every((c) => c.source === 'profile')).toBe(true);
  });
});

describe('FS11/FS12 rules and i18n', () => {
  it('normalises the FS05 driver vocabulary and keeps the reason keys translated in EN and AR', () => {
    expect([normDriver('ai_assistance'), normDriver('ai_assist'), normDriver('none'), normDriver('x')]).toEqual(['ai_assist', 'ai_assist', null, null]);
    const keys = new Set<string>();
    for (const r of current) for (const h of ['2030', '2035']) {
      const m = mapFor(r.id, 'p-k-ro', h);
      for (const x of [...m.tasks, ...m.added, ...m.bridge, ...m.complements, ...(m.me?.gaps ?? [])]) x.reasons.forEach((y) => keys.add(y.key));
      m.me?.reasons.forEach((y) => keys.add(y.key));
    }
    const get = (o: any, k: string) => k.split('.').slice(1).reduce((x, p) => x?.[p], o); // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const k of [...keys].filter((x) => x.startsWith('m30.'))) { expect(get(en, k), k).toBeTruthy(); expect(get(ar, k), k).toBeTruthy(); }
  });
  it('flat EN and AR files have the same keys', () => {
    expect(flat(en).map((x) => x[0]).sort()).toEqual(flat(ar).map((x) => x[0]).sort());
  });
});
