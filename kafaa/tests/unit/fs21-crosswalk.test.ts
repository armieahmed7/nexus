/** FS07 Skills Catalogue Explorer + FS08 International crosswalk (FS wave B · E1, M28): one test per acceptance criterion on the local
 *  path, the shared rules (search, filters, dated sources, roles, learning, checkAlignment, coverage, CASE export + schema, CSV), RBAC
 *  and the RPCs. The SQL path (SQL = TS on a battery, RLS, live RPC flows) is checked by scripts/validate/fs21-crosswalk.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA, columnsOf } from '../../src/data/schema';
import en from '../../src/i18n/m28.en.json';
import ar from '../../src/i18n/m28.ar.json';
import seed from '../../src/seed/seed.json';
import {
  AL_MSG, CASE_SCHEMA, CODE_PATTERNS, GOAL_MSG, alignmentsCsv, buildCasePackage, checkAlignment, coverage, isIndicative, isLabelLevel, stableUuid, validateJson,
} from '../../src/modules/m28/crosswalk';
import { datedSources, filterSkills, isListed, learningFor, norm, rolesForSkill, searchSkills } from '../../src/modules/m28/explorer';
import { routes } from '../../src/modules/m28/routes';
import { TRAINING_PATHS } from '../../src/modules/m04/paths';
import { lintRanked } from '../../src/domain/engines/rank';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
const FS70_72_PATHS = ['/skills/rising', '/skills/rising/method', '/workforce/skill-signals', '/my/manager-pulse', '/skills/technologies', '/admin/skills/technologies', '/my/skills/suggestions']; // FS72 (fsHe1)

const T = (seed as unknown as { tables: Record<string, any[]> }).tables; // eslint-disable-line @typescript-eslint/no-explicit-any
const listed = T.skills.filter(isListed);
const labels = new Map<string, { en: string; ar: string }[]>();
for (const a of T.skill_alignments.filter((x) => x.status === 'published')) { if (!labels.has(a.skill_id)) labels.set(a.skill_id, []); labels.get(a.skill_id)!.push({ en: a.label_en, ar: a.label_ar }); }
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
const audits = () => b.raw('audit_events').length;
const ledger = () => b.raw('ledger_local').length;
const al = (id: string) => (b.raw('skill_alignments' as never) as any[]).find((r) => r.id === id); // eslint-disable-line @typescript-eslint/no-explicit-any
const base = { skill_id: 'sk-fs-ai-use', framework: 'lightcast', external_code: null, label_en: 'Generative AI', label_ar: 'الذكاء الاصطناعي التوليدي', match_type: 'broad', source_url: 'https://lightcast.io/blog/open-skills-taxonomy', as_of: '2026-10-01', publish: true };

describe('FS07 · Skills Catalogue Explorer', () => {
  it('acceptance: all published skills (110+) are listed and every filter works', () => {
    expect(listed.length).toBeGreaterThanOrEqual(110);
    expect(listed.every((s) => s.lifecycle !== 'obsolete')).toBe(true);
    const ai = filterSkills(listed, { future: 'ai_data' });
    expect(ai.length).toBe(listed.filter((s) => s.fs_area === 'ai_data').length);
    expect(ai.length).toBeGreaterThan(0);
    expect(filterSkills(listed, { future: 'any' }).length + filterSkills(listed, { future: 'established' }).length).toBe(listed.length);
    for (const [k, col] of [['area', 'area'], ['reusability', 'reusability'], ['lifecycle', 'lifecycle'], ['group', 'future_group']] as const) {
      const v = listed[5][col];
      const r = filterSkills(listed, { [k]: v });
      expect(r.length, k).toBeGreaterThan(0);
      expect(r.every((s) => s[col] === v), k).toBe(true);
    }
    expect(filterSkills(listed, { area: 'digital', future: 'ai_data', lifecycle: 'emerging' }).every((s) => s.area === 'digital' && s.fs_area === 'ai_data' && s.lifecycle === 'emerging')).toBe(true);
  });
  it('acceptance: an Arabic search such as "تحليل البيانات" finds the data-analysis skill first (normalised Arabic, alternative labels)', () => {
    const hits = searchSkills(listed, 'تحليل البيانات', labels);
    expect(hits[0].id).toBe('sk-da-01-analysis');
    expect(searchSkills(listed, 'تحليل البيانات', labels).map((h) => h.id)).toContain('sk-da-01-analysis');
    expect(searchSkills(listed, 'تحليل البيانات ', labels)[0].id).toBe('sk-da-01-analysis');
    expect(norm('إدارة')).toBe(norm('ادارة'));
    expect(searchSkills(listed, 'data analysis', labels)[0].id).toBe('sk-da-01-analysis');
    // alternative labels and crosswalk labels count, and every hit explains itself (reasons with i18n keys)
    const alt = searchSkills(listed, 'Checking AI answers', labels);
    expect(alt[0].id).toBe('sk-fs-ai-verify');
    expect(alt[0].reasons.map((r) => r.code)).toContain('alt');
    const xw = searchSkills(listed, 'think analytically', labels);
    expect(xw.map((h) => h.id)).toContain('sk-fs-tr-analytical');
    expect(lintRanked(hits)).toEqual([]);
    for (const r of hits.flatMap((h) => h.reasons)) { expect((en as any).why[r.code], r.code).toBeTruthy(); expect((ar as any).why[r.code], r.code).toBeTruthy(); } // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(searchSkills(listed, 'zzzz-nothing', labels)).toEqual([]);
    expect(searchSkills(listed, '', labels).length).toBe(listed.length);
  });
  it('acceptance: every skill page shows at least one source with an as-of date', () => {
    const reg = new Map(T.sources.map((s) => [s.id, s]));
    const bms = new Map(T.benchmarks.map((x) => [x.id, x]));
    for (const s of T.skills) {
      const d = datedSources(s.sources, reg, bms);
      expect(d.filter((x) => x.as_of && /^\d{4}-\d{2}-\d{2}$/.test(x.as_of) && x.url.startsWith('https://')).length, s.id).toBeGreaterThanOrEqual(1);
    }
  });
  it('acceptance: anonymous payloads carry no person data (public tables have no personal columns; personal tables read nothing)', async () => {
    await as(null);
    const PERSONAL = /^(display_name|display_name_ar|full_name|person_name|first_name|last_name|initials|email|phone|mobile|photo|photo_url|avatar|emirates_id|passport|dob|birth_date|nationality|gender|salary)$/;
    for (const t of ['skills', 'skill_frameworks', 'skill_alignments', 'role_profile_versions', 'job_roles', 'courses', 'microcred_defs', 'sources', 'benchmarks']) {
      expect(columnsOf(t).filter((c) => PERSONAL.test(c.name)).map((c) => c.name), t).toEqual([]);
    }
    const rows = await b.list('skill_alignments' as never);
    expect(JSON.stringify(rows)).not.toMatch(/@|Training Manager|Instructor \(/);
    expect(await b.list('skill_goals' as never)).toEqual([]);
    expect(await b.list('person_skills' as never)).toEqual([]);
  });
  it('roles now and in 2030 come from published role profiles; security roles never appear', () => {
    const versions = T.role_profile_versions;
    const r = rolesForSkill(T.skills.find((s) => s.id === 'sk-fs-ai-verify'), versions, T.job_roles);
    expect(r['2030'].length).toBeGreaterThan(0);
    expect(r.now.length).toBe(0);
    const core = rolesForSkill(T.skills.find((s) => s.id === 'sk-co-01'), versions, T.job_roles);
    expect(core.now.length).toBeGreaterThan(0);
    expect(core.now.every((x) => x.via === 'competency')).toBe(true);
    const all = T.skills.flatMap((s) => Object.values(rolesForSkill(s, versions, T.job_roles)).flat());
    expect(all.some((x) => x.role.security_sensitive)).toBe(false);
  });
  it('learning that builds a skill: courses (evidence first), training-path stages and current micro-credentials', () => {
    const paths = TRAINING_PATHS.map((p) => ({ id: p.id, title: p.title, careerOnly: p.careerOnly, stages: p.stages.map((st) => ({ id: st.id, title: st.title, courses: st.courses, standards: st.standards })) }));
    const l = learningFor(T.skills.find((s) => s.id === 'sk-hu-01-star'), T.courses, paths, T.microcred_defs);
    expect(l.courses[0].via).toBe('evidence');
    expect(l.credentials.length).toBeGreaterThan(0);
    const ro = learningFor(T.skills.find((s) => s.id === 'sk-pf-03-rcs'), T.courses, paths, T.microcred_defs);
    expect(ro.paths.length).toBeGreaterThan(0);
  });
  it('acceptance: obsolete skills are hidden by default and stay reachable (obsolete since, replacement)', () => {
    const ob = T.skills.filter((s) => s.lifecycle === 'obsolete');
    expect(ob.length).toBeGreaterThan(0);
    expect(listed.some((s) => s.lifecycle === 'obsolete')).toBe(false);
    for (const s of ob) { expect(s.obsolete_on).toBeTruthy(); expect(T.skills.some((x) => x.id === s.replaced_by)).toBe(true); }
    expect(routes.find((r) => r.id === 'skills-skill')!.path).toBe('/skills/:id');
  });
  it('signed-in overlay: "Add to my goals" (setSkillGoal) with refusals, limit and audit; anonymous refused', async () => {
    await as(null);
    expect((await b.rpc.setSkillGoal('sk-fs-ai-use', 2, true)).code).toBe('not_signed_in');
    await as('k-auditor');
    expect((await b.rpc.setSkillGoal('sk-fs-ai-use', 2, true)).code).toBe('forbidden');
    await as('k-ro');
    const a0 = audits();
    const r = await b.rpc.setSkillGoal('sk-fs-ai-use', 3, true);
    expect([r.ok, r.data?.status, r.data?.target_level]).toEqual([true, 'active', 3]);
    expect((await b.list('skill_goals' as never)).map((g: any) => g.skill_id)).toContain('sk-fs-ai-use'); // eslint-disable-line @typescript-eslint/no-explicit-any
    const sec = await b.rpc.setSkillGoal('sk-sa-01', 2, true);
    expect([sec.code, sec.message]).toEqual(['restricted', GOAL_MSG.restricted]);
    expect((await b.rpc.setSkillGoal('sk-fs-dp-paperwp', 2, true)).code).toBe('obsolete');
    expect((await b.rpc.setSkillGoal('sk-fs-ai-use', 5, true)).code).toBe('invalid');
    expect((await b.rpc.setSkillGoal('sk-nope', 2, true)).code).toBe('not_found');
    expect((await b.rpc.setSkillGoal('sk-fs-ai-use', 3, false)).data?.status).toBe('removed');
    expect((await b.rpc.setSkillGoal('sk-fs-ai-use', 3, false)).code).toBe('no_change');
    expect(audits() - a0).toBe(7);
    const ids = listed.filter((s) => s.area !== 'security').slice(0, 13).map((s) => s.id);
    const have = (await b.list('skill_goals' as never)).filter((g: any) => g.status === 'active').length; // eslint-disable-line @typescript-eslint/no-explicit-any
    let last = null;
    for (const id of ids.slice(0, 12 - have + 1)) last = await b.rpc.setSkillGoal(id, 2, true);
    expect(last!.code).toBe('limit');
    await as('k-hr-analyst');
    expect((await b.list('skill_goals' as never)).length).toBe(0); // own rows only
  });
});

describe('FS08 · International crosswalk', () => {
  it('acceptance: at least 95% of skills have one or more alignments, and 100% of alignments cite a URL and an as-of date', () => {
    const pub = T.skill_alignments.filter((a) => a.status === 'published');
    const cov = coverage(T.skills, pub, T.skill_frameworks.map((f) => f.id));
    expect(cov.overall.pct).toBeGreaterThanOrEqual(95);
    expect(new Set(pub.map((a) => a.skill_id)).size / T.skills.length).toBeGreaterThanOrEqual(0.95);
    expect(T.skill_alignments.every((a) => /^https:\/\//.test(a.source_url) && /^\d{4}-\d{2}-\d{2}$/.test(a.as_of))).toBe(true);
    expect(T.skill_frameworks.length).toBe(11);
    expect(T.skill_frameworks.every((f) => f.url.startsWith('https://') && T.benchmarks.some((x) => x.id === f.benchmark_id))).toBe(true);
    expect(cov.emptyFrameworks).toEqual(['uae_nqf']);
  });
  it('acceptance: no code is invented: codes only for frameworks whose codes were copied, in the published format; the rest are label-level', () => {
    const copied = new Set(T.skill_frameworks.filter((f) => f.codes_copied).map((f) => f.id));
    expect([...copied].sort()).toEqual(['digcomp', 'esco', 'onet', 'sfia9']);
    for (const a of T.skill_alignments.filter((x) => x.status === 'published')) {
      if (isLabelLevel(a)) continue;
      expect(copied.has(a.framework), a.id).toBe(true);
      expect(new RegExp(CODE_PATTERNS[a.framework as 'esco']!).test(a.external_code), a.id).toBe(true);
    }
    expect(T.skill_alignments.filter((a) => !copied.has(a.framework) && a.status === 'published').every((a) => isLabelLevel(a))).toBe(true);
    expect(T.skill_alignments.filter((a) => a.framework === 'esco').every((a) => a.label_ar_official && /[؀-ۿ]/.test(a.label_ar))).toBe(true);
  });
  it('acceptance: the export validates against a CASE-shaped JSON schema (EN and AR), with stable identifiers', () => {
    for (const lang of ['en', 'ar'] as const) {
      const pkg = buildCasePackage(T.skills, T.skill_alignments, T.skill_frameworks, { lang, generatedAt: '2026-10-10T00:00:00Z', baseUri: 'https://example.org/kafaa', version: '2026.10', areaLabel: (a) => a });
      expect(validateJson(CASE_SCHEMA, pkg)).toEqual([]);
      expect(pkg.CFItems.filter((i: any) => i.CFItemType === 'Skill').length).toBe(T.skills.length); // eslint-disable-line @typescript-eslint/no-explicit-any
      const pub = T.skill_alignments.filter((a) => a.status === 'published').length;
      const childOf = pkg.CFAssociations.filter((x: any) => x.associationType === 'isChildOf').length; // eslint-disable-line @typescript-eslint/no-explicit-any
      const repl = pkg.CFAssociations.filter((x: any) => x.associationType === 'replacedBy').length; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(childOf).toBe(T.skills.length);
      expect(repl).toBe(T.skills.filter((s) => s.replaced_by).length);
      expect(pkg.CFAssociations.length).toBe(childOf + repl + pub);
      expect(pkg.CFAssociations.some((x: any) => x.associationType === 'exactMatchOf')).toBe(true); // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(new Set(pkg.CFAssociations.map((x: any) => x.identifier)).size).toBe(pkg.CFAssociations.length); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (lang === 'ar') expect(pkg.CFItems.find((i: any) => i.humanCodingScheme === 'FS-AI-02')!.fullStatement).toMatch(/[؀-ۿ]/); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
    expect(stableUuid('kafaa:skill:sk-pf-01')).toBe(stableUuid('kafaa:skill:sk-pf-01'));
    expect(stableUuid('a')).not.toBe(stableUuid('b'));
    expect(stableUuid('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    // the validator does reject broken packages
    const bad = buildCasePackage(T.skills.slice(0, 2), [], T.skill_frameworks, { lang: 'en', generatedAt: 'yesterday', baseUri: 'x', version: '1', areaLabel: (a) => a });
    (bad.CFAssociations[0] as any).associationType = 'sameAs'; // eslint-disable-line @typescript-eslint/no-explicit-any
    delete (bad.CFItems[0] as any).identifier; // eslint-disable-line @typescript-eslint/no-explicit-any
    const errs = validateJson(CASE_SCHEMA, bad);
    expect(errs.some((e) => e.includes('lastChangeDateTime'))).toBe(true);
    expect(errs.some((e) => e.includes('not in enum'))).toBe(true);
    expect(errs.some((e) => e.includes('identifier: required'))).toBe(true);
  });
  it('CSV export of the published crosswalk: BOM, header, one line per published row, quoting', () => {
    const csv = alignmentsCsv(T.skills, T.skill_alignments);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('skill_code,skill_id,skill_name_en,skill_name_ar,framework,external_code,external_label_en,external_label_ar,match_type,review_state,level_map,source_url,as_of');
    expect(lines.length - 1).toBe(T.skill_alignments.filter((a) => a.status === 'published').length);
    expect(csv).toContain('"evaluate data, information and digital content"');
  });
  it('acceptance: rows not yet reviewed display "indicative" in EN and AR', () => {
    const pub = T.skill_alignments.filter((a) => a.status === 'published');
    expect(pub.filter(isIndicative).length).toBeGreaterThan(0);
    expect(pub.filter((a) => !isIndicative(a)).length).toBeGreaterThan(0);
    expect((en as any).review.indicative).toBe('Indicative'); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect((ar as any).review.indicative).toBe('إرشادي'); // eslint-disable-line @typescript-eslint/no-explicit-any
  });
  it('checkAlignment covers every refusal in order (the rule SQL kafaa_al_check mirrors)', () => {
    const ctx = { skills: new Map(T.skills.map((s) => [s.id, { lifecycle: s.lifecycle }])), frameworks: new Set(T.skill_frameworks.map((f) => f.id)), rows: T.skill_alignments, today: '2026-10-10' };
    const C = (o: object, ex?: { skill_id: string; framework: string; status: string }) => checkAlignment({ ...base, ...o }, ctx, ex);
    expect(C({})).toBe('ok');
    expect(C({ skill_id: 'zz' })).toBe('skill_not_found');
    expect(C({ skill_id: 'sk-fs-dp-paperwp' })).toBe('obsolete');
    expect(C({ framework: 'linkedin' })).toBe('framework');
    expect(C({ label_ar: '' })).toBe('label');
    expect(C({ match_type: 'similar' })).toBe('match');
    expect(C({ framework: 'esco', external_code: 'S1.2' })).toBe('code');
    expect(C({ source_url: 'http://x.org' })).toBe('url');
    expect(C({ as_of: '2026-12-01' })).toBe('as_of');
    expect(C({ level_map: { 9: 'x' } })).toBe('level_map');
    expect(C({ note_en: 'x'.repeat(501) })).toBe('note');
    const e = T.skill_alignments.find((a) => a.framework === 'sfia9' && a.status === 'published');
    expect(C({ skill_id: e.skill_id, framework: 'sfia9', external_code: e.external_code })).toBe('duplicate');
    expect(C({ skill_id: 'sk-pf-01', framework: 'esco' }, { skill_id: 'sk-pf-02', framework: 'esco', status: 'published' })).toBe('immutable');
    expect(C({}, { skill_id: base.skill_id, framework: base.framework, status: 'retired' })).toBe('retired');
    for (const k of Object.keys(AL_MSG)) { expect((en as any).check[k] ?? (en as any).admin, k).toBeTruthy(); } // eslint-disable-line @typescript-eslint/no-explicit-any
  });
  it('saveAlignment / reviewAlignment / retireAlignment: frameworks W/A only, audited, maker-checker, never deleted, no ledger', async () => {
    const a0 = audits();
    const l0 = ledger();
    await as('k-ro');
    expect((await b.rpc.saveAlignment(base)).code).toBe('forbidden');
    await as('k-auditor');
    expect((await b.rpc.saveAlignment(base)).code).toBe('forbidden');
    await as('training-mgr');
    const d = await b.rpc.saveAlignment({ ...base, publish: false });
    expect(d.ok).toBe(true);
    const id = d.data!.id;
    expect(al(id).status).toBe('draft');
    await as(null);
    expect((await b.list('skill_alignments' as never)).some((r: any) => r.id === id)).toBe(false); // eslint-disable-line @typescript-eslint/no-explicit-any
    await as('k-auditor');
    expect((await b.list('skill_alignments' as never)).some((r: any) => r.id === id)).toBe(true); // eslint-disable-line @typescript-eslint/no-explicit-any
    await as('training-mgr');
    expect((await b.rpc.saveAlignment({ ...base, label_en: 'generative ai' })).code).toBe('conflict');
    const p = await b.rpc.saveAlignment({ ...base, id, level_map: { 2: ' Applied ' } });
    expect([p.ok, p.data?.version, al(id).listed, al(id).level_map]).toEqual([true, 2, true, { 2: 'Applied' }]);
    const mk = await b.rpc.reviewAlignment(id);
    expect([mk.code, mk.message]).toEqual(['maker_checker', AL_MSG.maker_checker]);
    await as('k-instructor');
    expect((await b.rpc.reviewAlignment(id)).ok).toBe(true);
    expect([al(id).reviewed_by, al(id).reviewed_role]).toEqual(['p-k-instructor', 'instructor']);
    expect((await b.rpc.reviewAlignment(id)).code).toBe('no_change');
    await as('k-admin');
    expect((await b.rpc.saveAlignment({ ...base, id, match_type: 'close' })).data?.version).toBe(3);
    expect(al(id).reviewed_by).toBeNull();
    expect((await b.rpc.retireAlignment(id, 'no')).code).toBe('invalid');
    expect((await b.rpc.retireAlignment(id, 'Replaced by a coded row')).ok).toBe(true);
    expect([al(id).status, al(id).listed, al(id).retired_reason]).toEqual(['retired', false, 'Replaced by a coded row']);
    expect((await b.rpc.saveAlignment({ ...base, id })).code).toBe('retired');
    expect((await b.rpc.reviewAlignment(id)).code).toBe('retired');
    expect((await b.rpc.saveAlignment({ ...base, skill_id: 'sk-fs-dp-paperwp' })).code).toBe('obsolete');
    expect(audits() - a0).toBe(14);
    expect(ledger()).toBe(l0);
  });
  it('schema, routes, benchmarks and i18n: three tables, four routes (public explorer, skill, frameworks; admin), FS07/FS08 benchmark ties', () => {
    expect(['skill_frameworks', 'skill_alignments', 'skill_goals'].every((t) => SCHEMA[t]?.module === 'M28')).toBe(true);
    expect(SCHEMA.skill_alignments.write).toEqual({ mode: 'rpc', res: 'frameworks' });
    expect(routes.map((r) => r.path).filter((x) => !FS70_72_PATHS.includes(x))).toEqual(['/skills', '/skills/frameworks', '/skills/:id', '/admin/skills/alignments']); // FS72 (fsHe1): the seven FS70-FS72 routes are pinned in fs81-skill-signals.test.ts
    expect(routes.filter((r) => r.zone === 'public').every((r) => Object.keys(r.guard).length === 0)).toBe(true);
    expect(FEATURE_BENCHMARKS.FS07).toEqual(['SFIA9', 'ESCO', 'SSG-SF']);
    expect(FEATURE_BENCHMARKS.FS08).toContain('1EDTECH');
    for (const r of routes) { expect((en as any).routes[r.id].title).toBeTruthy(); expect((ar as any).routes[r.id].title).toBeTruthy(); } // eslint-disable-line @typescript-eslint/no-explicit-any
    const sql = readFileSync('supabase/migrations/20261010221001_kafaa_fs21_skills_crosswalk.sql', 'utf8').replace(/--.*$/gm, '');
    expect(/\b(drop|truncate|delete\s+from)\b/i.test(sql)).toBe(false);
  });
});
