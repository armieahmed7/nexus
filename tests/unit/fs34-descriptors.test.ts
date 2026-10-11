/** FS23 Behaviourally anchored descriptors and generic level attributes + FS24 Scale mapping and an "Authority" recognition
 *  (FS wave C · E4, M02): one test per acceptance criterion on the local path, the shared rules (checkDescriptor, checkRange,
 *  isTemplated, coverage, checkPropose, checkDecide, alignmentFollowsMap) and the LocalBackend RPCs with RBAC, audit and ledger.
 *  The SQL path (SQL = TS on batteries, RLS, RPC flows, grants) is checked by scripts/validate/fs34-descriptors-scale.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import { SCHEMA } from '../../src/data/schema';
import seed from '../../src/seed/seed.json';
import en from '../../src/i18n/m02.en.json';
import ar from '../../src/i18n/m02.ar.json';
import {
  DESC_MSG, EVIDENCE_MODES, TEMPLATE_PATTERNS, checkDescriptor, checkRange, descriptorCoverage, descResultCode, isRestrictedSkill, isTemplated, levelState,
} from '../../src/modules/m02/descriptors';
import { AUTH_MSG, BANDS, SCALE_FRAMEWORKS, addYearsIso, alignmentFollowsMap, authResultCode, bandOfLevel, checkDecide, checkPropose, extRange, rowCitesSource } from '../../src/modules/m02/authority';
import { routes } from '../../src/modules/m02/routes';
import { makeSupabaseM02 } from '../../src/modules/m02/backend/supabase';
import { FEATURE_BENCHMARKS, LEVEL_ESSENCE } from '../../src/domain/taxonomy';
import { todayIso } from '../../src/domain/rules';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables; // eslint-disable-line @typescript-eslint/no-explicit-any
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
const audits = () => b.raw('audit_events').length;
const ledger = () => b.raw('ledger_local').length;
const rows = (t: string) => b.raw(t as never) as unknown as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
const pub = T.skill_descriptors.filter((d) => d.status === 'published');
const rangeOf = new Map(T.skill_level_ranges.map((r) => [r.skill_id, r]));
const skill = (id: string) => T.skills.find((s) => s.id === id);
const base = { skill_id: 'sk-fs-ai-use', level: 2, essence_en: 'Uses approved AI tools for drafting and checks every claim.', essence_ar: 'يستخدم أدوات الذكاء الاصطناعي المعتمدة في الصياغة ويتحقق من كل ادعاء.',
  indicators_en: ['Checks each AI answer against the controlled document.', 'Logs the tool and version used.'], indicators_ar: ['يتحقق من كل إجابة مقابل الوثيقة المعتمدة.', 'يسجّل الأداة والإصدار المستخدمين.'], evidence_modes: ['work_product', 'records'], publish: true };

describe('FS23 · behaviourally anchored descriptors (acceptance)', () => {
  it('acceptance: every skill has a descriptor at each level where it exists, none outside its range, and none uses the old template sentence', () => {
    expect(T.skills.length).toBe(120);
    const cov = descriptorCoverage(T.skills, T.skill_level_ranges, pub);
    expect(cov.noRange).toEqual([]);
    expect(cov.missing).toEqual([]);
    expect(cov.extra).toEqual([]);
    expect(cov.complete).toBe(120);
    expect(cov.templated).toEqual([]);
    // the detector does catch the old sentences: every F01 competency level text (EN and AR) and the FS02 level-essence template
    for (const c of T.competencies) for (const l of c.levels) { expect(isTemplated(l.en), `${c.id} ${l.level} en`).toBe(true); expect(isTemplated(l.ar), `${c.id} ${l.level} ar`).toBe(true); }
    for (const lv of [1, 2, 3, 4] as const) expect(isTemplated(LEVEL_ESSENCE[lv].en.replace('{skill}', 'x'))).toBe(true);
    // descriptors are skill-specific: no two skills share the same essence at the same level
    for (const lv of [1, 2, 3, 4]) { const es = pub.filter((d) => d.level === lv).map((d) => d.essence_en); expect(new Set(es).size, `L${lv}`).toBe(es.length); }
  });
  it('acceptance: indicators exist in English and Arabic (2-4 per level, the same number in each language, Arabic script)', () => {
    for (const d of pub) {
      expect(d.indicators_en.length, d.id).toBeGreaterThanOrEqual(2);
      expect(d.indicators_en.length, d.id).toBeLessThanOrEqual(4);
      expect(d.indicators_ar.length, d.id).toBe(d.indicators_en.length);
      for (const x of [d.essence_ar, ...d.indicators_ar]) expect(/[؀-ۿ]/.test(x) && !/ـ/.test(x), d.id).toBe(true);
      for (const x of [d.essence_en, ...d.indicators_en]) expect(/^[A-Z]/.test(x) && !/[{}]/.test(x), d.id).toBe(true);
      expect(d.evidence_modes.every((m: string) => (EVIDENCE_MODES as readonly string[]).includes(m))).toBe(true);
    }
    const counts = new Set(pub.map((d) => d.indicators_en.length));
    expect([...counts].sort()).toEqual([2, 3, 4]); // 2 at level 1, 4 at the key level, 3 otherwise
  });
  it('generic level attributes: essence + autonomy, influence, complexity, knowledge, behaviours at each of the four levels, with the SFIA 9 level', () => {
    expect(T.level_attributes.length).toBe(24);
    for (const lv of [1, 2, 3, 4]) for (const a of ['essence', 'autonomy', 'influence', 'complexity', 'knowledge', 'behaviours']) {
      const r = T.level_attributes.find((x) => x.level === lv && x.attribute === a);
      expect(r?.text_en && r?.text_ar && !isTemplated(r.text_en), `${lv} ${a}`).toBeTruthy();
    }
    expect(T.level_attributes.filter((x) => x.attribute === 'essence').map((x) => x.sfia_levels)).toEqual(['1-2', '3', '4', '5']);
  });
  it('skills are defined only at the levels where they exist, each range with a published EN/AR rationale (SFIA)', () => {
    const by = (b2: string) => T.skill_level_ranges.filter((r) => r.basis === b2);
    expect(by('awareness_only').every((r) => r.max_level === 2 && isRestrictedSkill(skill(r.skill_id)))).toBe(true);
    expect(by('licence_like').every((r) => r.min_level === 2 && skill(r.skill_id).skill_type === 'licence_like')).toBe(true);
    expect(by('not_operated').every((r) => r.max_level === 3)).toBe(true);
    expect(rangeOf.get('sk-fs-adv-fusion')).toMatchObject({ min_level: 1, max_level: 2, basis: 'watch' });
    for (const r of T.skill_level_ranges) {
      expect(r.rationale_en.length >= 20 && r.rationale_ar.length >= 20, r.skill_id).toBe(true);
      expect(/no deployment decision implied|لا يعني ذلك أي قرار بالنشر/.test(r.rationale_en + r.rationale_ar) || r.basis !== 'not_operated').toBe(true);
    }
    expect(T.skill_level_ranges.filter((r) => r.track === 'behavioural').length).toBeGreaterThan(20);
    expect(levelState(rangeOf.get('sk-pf-03-rcs'), 1)).toBe('below');
    expect(levelState(rangeOf.get('sk-fs-adv-smr'), 4)).toBe('above');
  });
  it('checkDescriptor: every refusal in order (skill, obsolete, level, restricted, essence, count, mismatch, indicator, duplicate, template, mode, in/out of range)', () => {
    const ctx = (id: string) => ({ skill: skill(id) ? { ...skill(id) } : null, range: rangeOf.get(id) });
    const D = (o: object) => ({ ...base, ...o });
    expect(checkDescriptor(base, ctx('sk-fs-ai-use'))).toBe('ok');
    expect(checkDescriptor(D({ skill_id: 'x' }), ctx('x'))).toBe('skill_not_found');
    expect(checkDescriptor(D({ skill_id: 'sk-fs-dp-paperwp' }), ctx('sk-fs-dp-paperwp'))).toBe('obsolete');
    expect(checkDescriptor(D({ level: 5 }), ctx('sk-fs-ai-use'))).toBe('level');
    expect(checkDescriptor(D({ skill_id: 'sk-sa-01', level: 3 }), ctx('sk-sa-01'))).toBe('restricted');
    expect(checkDescriptor(D({ essence_ar: '' }), ctx('sk-fs-ai-use'))).toBe('essence');
    expect(checkDescriptor(D({ indicators_en: ['one'] }), ctx('sk-fs-ai-use'))).toBe('count');
    expect(checkDescriptor(D({ indicators_ar: ['أ', 'ب', 'ج'] }), ctx('sk-fs-ai-use'))).toBe('mismatch');
    expect(checkDescriptor(D({ indicators_en: ['ok', 'x'.repeat(221)] }), ctx('sk-fs-ai-use'))).toBe('indicator');
    expect(checkDescriptor(D({ indicators_en: ['Same', ' same '] }), ctx('sk-fs-ai-use'))).toBe('duplicate');
    expect(checkDescriptor(D({ essence_en: 'Coaches, trains and evaluates others in AI tools.' }), ctx('sk-fs-ai-use'))).toBe('template');
    expect(checkDescriptor(D({ evidence_modes: ['jpm', 'jpm'] }), ctx('sk-fs-ai-use'))).toBe('mode');
    expect(checkDescriptor(D({ publish: false }), ctx('sk-fs-ai-use'))).toBe('in_range');
    expect(checkDescriptor(D({ skill_id: 'sk-fs-adv-smr', level: 4 }), ctx('sk-fs-adv-smr'))).toBe('out_of_range');
    expect(checkDescriptor(D({ skill_id: 'sk-fs-adv-smr', level: 4, publish: false }), ctx('sk-fs-adv-smr'))).toBe('ok');
    expect(TEMPLATE_PATTERNS.length).toBe(11);
    expect(descResultCode('skill_not_found')).toBe('not_found');
    expect(descResultCode('template')).toBe('invalid');
  });
  it('checkRange: bounds, restricted skills, basis, rationale, a descriptor at every level in range, no-change', () => {
    const lv = (id: string) => T.skill_descriptors.filter((d) => d.skill_id === id).map((d) => d.level);
    const cur = rangeOf.get('sk-ld-01');
    const R = { skill_id: 'sk-ld-01', min_level: 1, max_level: 4, basis: 'full', rationale_en: 'Defined from level 1 for new joiners.', rationale_ar: 'معرَّفة من المستوى الأول للمنضمين الجدد.' };
    expect(checkRange(R, { skill: skill('sk-ld-01'), levels: lv('sk-ld-01'), current: cur })).toBe('ok'); // the seeded draft covers level 1
    expect(checkRange({ ...R, skill_id: 'sk-pf-03-rcs' }, { skill: skill('sk-pf-03-rcs'), levels: lv('sk-pf-03-rcs'), current: rangeOf.get('sk-pf-03-rcs') })).toBe('incomplete');
    expect(checkRange({ ...R, min_level: 3, max_level: 2 }, { skill: skill('sk-ld-01'), levels: [1, 2, 3, 4], current: cur })).toBe('range');
    expect(checkRange({ ...R, skill_id: 'sk-fs-cy-media', max_level: 3 }, { skill: skill('sk-fs-cy-media'), levels: [1, 2, 3], current: null })).toBe('restricted');
    expect(checkRange({ ...R, basis: 'vibes' }, { skill: skill('sk-ld-01'), levels: [1, 2, 3, 4], current: cur })).toBe('basis');
    expect(checkRange({ ...R, rationale_ar: 'قصير' }, { skill: skill('sk-ld-01'), levels: [1, 2, 3, 4], current: cur })).toBe('rationale');
    expect(checkRange({ skill_id: 'sk-ld-01', min_level: 2, max_level: 4, basis: cur.basis, rationale_en: cur.rationale_en, rationale_ar: cur.rationale_ar }, { skill: skill('sk-ld-01'), levels: [1, 2, 3, 4], current: cur })).toBe('no_change');
  });
  it('saveDescriptor (local): framework owners only, in-range levels stay published, version bumps, template refused, audited, no ledger', async () => {
    await as('sro');
    expect((await b.rpc.saveDescriptor(base)).code).toBe('forbidden');
    await as('k-auditor');
    expect((await b.rpc.saveDescriptor(base)).code).toBe('forbidden');
    await as('k-instructor');
    const a0 = audits(); const l0 = ledger();
    const ok = await b.rpc.saveDescriptor({ ...base, essence_en: `  ${base.essence_en}  ` });
    expect(ok.ok && ok.data?.status === 'published' && ok.data.version === 2).toBe(true);
    const row = rows('skill_descriptors').find((r) => r.id === 'sd:sk-fs-ai-use:2');
    expect(row).toMatchObject({ essence_en: base.essence_en, listed: true, updated_by: 'p-k-instructor' });
    const t1 = await b.rpc.saveDescriptor({ ...base, indicators_en: ['ok', 'Applies the tool under supervision using approved procedures.'] });
    expect(t1.code).toBe('invalid');
    expect(t1.message).toBe(DESC_MSG.template);
    expect((await b.rpc.saveDescriptor({ ...base, publish: false })).message).toBe(DESC_MSG.in_range);
    const dr = await b.rpc.saveDescriptor({ ...base, skill_id: 'sk-fs-adv-smr', level: 4, publish: false });
    expect(dr.ok && dr.data?.status === 'draft').toBe(true);
    expect(audits() - a0).toBe(4);
    expect(ledger()).toBe(l0);
  });
  it('setLevelRange (local): extending publishes the drafted level, shrinking archives it (never deletes), incomplete ranges are refused', async () => {
    await as('k-admin');
    const R = { skill_id: 'sk-ld-01', min_level: 1, max_level: 4, basis: 'full', rationale_en: 'Defined from level 1 so new joiners see good team leadership.', rationale_ar: 'معرَّفة من المستوى الأول ليرى المنضمون الجدد القيادة الجيدة للفريق.' };
    const r1 = await b.rpc.setLevelRange(R);
    expect(r1.ok && r1.data?.published === 1 && r1.data.version === 2).toBe(true);
    expect(rows('skill_descriptors').find((r) => r.id === 'sd:sk-ld-01:1')).toMatchObject({ status: 'published', listed: true });
    await as(null);
    expect((await b.list('skill_descriptors', { filter: { skill_id: 'sk-ld-01' } })).length).toBe(4);
    await as('k-admin');
    const cur = T.skill_level_ranges.find((r) => r.skill_id === 'sk-ld-01');
    const r2 = await b.rpc.setLevelRange({ ...R, min_level: 2, basis: 'leading', rationale_en: cur.rationale_en, rationale_ar: cur.rationale_ar });
    expect(r2.ok && r2.data?.archived === 1).toBe(true);
    expect(rows('skill_descriptors').find((r) => r.id === 'sd:sk-ld-01:1')).toMatchObject({ status: 'archived', listed: false });
    expect((await b.rpc.setLevelRange({ ...R, skill_id: 'sk-pf-03-rcs' })).code).toBe('incomplete');
    await as('sro');
    expect((await b.rpc.setLevelRange(R)).code).toBe('forbidden');
  });
});

describe('FS23 · check-in raters see the indicators', () => {
  it('acceptance: the check-in level picker (F10, M17) renders the FS23 indicators for the skill being rated', () => {
    const src = readFileSync('src/modules/m17/ciUi.tsx', 'utf8');
    expect(src).toContain("import { LevelIndicators } from '../m02/levelsUi'");
    expect(src).toMatch(/<LevelIndicators skillId=\{skillId\} level=\{value\}/);
    // the picker is used by all three check-in surfaces: self-rating, peer rating and manager validation
    for (const f of ['CheckinsPage.tsx', 'ValidatePage.tsx']) expect(readFileSync(`src/modules/m17/${f}`, 'utf8')).toContain('<LevelPicker');
  });
});

describe('FS24 · scale mapping and Authority (acceptance)', () => {
  it('acceptance: every mapping row cites its framework source (https + as-of date), for five frameworks x six bands', () => {
    expect(T.scale_maps.length).toBe(35);
    for (const r of T.scale_maps) expect(rowCitesSource(r), r.id).toBe(true);
    const fws = new Map(T.skill_frameworks.map((f) => [f.id, f]));
    for (const id of SCALE_FRAMEWORKS) {
      expect(fws.has(id), id).toBe(true);
      expect(T.scale_maps.filter((m) => m.framework === id && m.row_kind === 'map').map((m) => m.band).sort()).toEqual([...BANDS].sort());
      const sc = T.scale_maps.find((m) => m.framework === id && m.row_kind === 'scale');
      expect(sc.levels.length).toBe(sc.level_count);
    }
    expect(T.scale_maps.find((m) => m.id === 'sm:sfia9:scale').level_count).toBe(7);
    expect(T.scale_maps.find((m) => m.id === 'sm:skillsfuture:scale').level_count).toBe(6);
    expect(T.scale_maps.find((m) => m.id === 'sm:digcomp:scale').level_count).toBe(8);
    expect(T.scale_maps.find((m) => m.id === 'sm:unesco_ai:scale').level_count).toBe(3);
    // loose fits carry a note; the NQF column says it is indicative and that Kafa'a is not an authority
    for (const m of T.scale_maps.filter((x) => x.fit === 'loose')) expect(m.note_en.length > 10 && m.note_ar.length > 10, m.id).toBe(true);
    expect(T.scale_maps.find((m) => m.id === 'sm:uae_nqf:authority').note_en).toMatch(/not a recognition authority/);
  });
  it('the published map agrees with the FS08 crosswalk level maps (data-only coupling)', () => {
    expect(extRange({ ext_from: 5, ext_to: 6 })).toBe('5-6');
    expect(bandOfLevel(0)).toBe('not_yet');
    expect(bandOfLevel(3)).toBe('l3');
    for (const fw of ['sfia9', 'digcomp']) {
      const al = T.skill_alignments.filter((a) => a.framework === fw && a.status === 'published' && Object.keys(a.level_map ?? {}).length);
      expect(al.length, fw).toBeGreaterThan(0);
      expect(al.every((a) => alignmentFollowsMap(a.level_map, T.scale_maps, fw) === 'follows'), fw).toBe(true);
    }
    expect(alignmentFollowsMap({ 1: '2' }, T.scale_maps, 'sfia9')).toBe('differs');
    expect(alignmentFollowsMap({ 1: '2' }, T.scale_maps, 'esco')).toBe('n/a');
  });
  it('acceptance: Authority never changes the F01 level (recognise, then recompute: person_skills unchanged, no evidence written)', async () => {
    const digest = () => JSON.stringify(rows('person_skills').filter((r) => r.person_id === 'w-sro-02').map((r) => [r.id, r.level, r.basis, r.active]).sort());
    const before = digest();
    await as('training-mgr');
    const p = await b.rpc.recogniseAuthority({ action: 'propose', person_id: 'w-sro-02', skill_id: 'sk-co-03', panel: ['hr_director', 'training_manager', 'external_peer'], citation_en: 'Leads the reactivity reviews across crews.', citation_ar: 'يقود مراجعات التفاعلية عبر الأطقم في جميع الوحدات.' });
    expect(p.ok).toBe(true);
    await as('chco');
    const a = await b.rpc.recogniseAuthority({ action: 'approve', id: p.data!.id });
    expect(a.ok && a.data?.status === 'recognised').toBe(true);
    expect(digest()).toBe(before);
    await applySkills(b, 'w-sro-02', todayIso());
    expect(digest()).toBe(before);
    expect(rows('person_skills').find((r) => r.person_id === 'w-sro-02' && r.skill_id === 'sk-co-03')?.level).toBe(4);
    expect(rows('skill_evidence').some((r) => r.ref_table === 'authority_recognitions')).toBe(false);
    // the schema has no level 5: bands stop at Authority, which is not a level
    expect(SCHEMA.authority_recognitions.cols.level_at_proposal).toContain('=4');
  });
  it('acceptance: an Authority recognition needs two different approvers and writes a ledger row', async () => {
    await as('chco');
    const own = await b.rpc.recogniseAuthority({ action: 'propose', person_id: 'w-sro-03', skill_id: 'sk-co-03', panel: ['hr_director', 'skill_owner', 'external_peer'], citation_en: 'Leads the reactivity reviews across crews.', citation_ar: 'يقود مراجعات التفاعلية عبر الأطقم في جميع الوحدات.' });
    expect(own.ok).toBe(true);
    const mc = await b.rpc.recogniseAuthority({ action: 'approve', id: own.data!.id });
    expect(mc.code).toBe('maker_checker');
    expect(mc.message).toBe(AUTH_MSG.maker_checker);
    // the seeded proposal (by the training manager): the training manager cannot decide; the HR director can
    await as('training-mgr');
    const tm = await b.rpc.recogniseAuthority({ action: 'approve', id: 'ar:w-rp-01:sk-rp-01:1' });
    expect(tm.code).toBe('forbidden');
    await as('chco');
    const l0 = ledger();
    const ok = await b.rpc.recogniseAuthority({ action: 'approve', id: 'ar:w-rp-01:sk-rp-01:1' });
    expect(ok.ok).toBe(true);
    expect(ledger()).toBe(l0 + 1);
    const row = rows('authority_recognitions').find((r) => r.id === 'ar:w-rp-01:sk-rp-01:1');
    expect(row.decided_by).toBe('p-chco');
    expect(row.proposed_by).toBe('p-training-mgr');
    expect(row.decided_by).not.toBe(row.proposed_by);
    expect(row.review_due).toBe(addYearsIso(todayIso(), 3));
    expect(rows('notifications').some((n) => n.id === 'nt-ar-ar:w-rp-01:sk-rp-01:1-recognised' && n.person_id === 'w-rp-01')).toBe(true);
    // "not yet" needs a note and writes no ledger row; withdrawing a current recognition writes one
    const ny0 = await b.rpc.recogniseAuthority({ action: 'not_yet', id: 'ar:w-qa-01:sk-qa-01:1' });
    expect(ny0.code).toBe('invalid');
    const l1 = ledger();
    const ny = await b.rpc.recogniseAuthority({ action: 'not_yet', id: 'ar:w-qa-01:sk-qa-01:1', note: 'Bring one reviewed supplier change first.' });
    expect(ny.ok && ledger() === l1).toBe(true);
    const wd = await b.rpc.recogniseAuthority({ action: 'withdraw', id: 'ar:w-rp-01:sk-rp-01:1', note: 'Withdrawn for the unit test.' });
    expect(wd.ok && ledger() === l1 + 1).toBe(true);
  });
  it('propose refusals: only Experts, never yourself, never security skills, one open proposal, assessors do not propose', async () => {
    const P = { action: 'propose', person_id: 'w-sro-02', skill_id: 'sk-co-03', panel: ['hr_director', 'training_manager', 'external_peer'], citation_en: 'Leads the reactivity reviews across crews.', citation_ar: 'يقود مراجعات التفاعلية عبر الأطقم في جميع الوحدات.' };
    await as('k-instructor');
    expect((await b.rpc.recogniseAuthority(P)).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.recogniseAuthority({ ...P, skill_id: 'sk-fs-ai-verify' })).code).toBe('not_eligible');
    expect((await b.rpc.recogniseAuthority({ ...P, person_id: 'p-training-mgr', skill_id: 'sk-co-01' })).code).toBe('maker_checker');
    expect((await b.rpc.recogniseAuthority({ ...P, skill_id: 'sk-sa-01' })).code).toBe('restricted');
    expect((await b.rpc.recogniseAuthority({ ...P, person_id: 'w-sro-01' })).code).toBe('conflict');
    expect((await b.rpc.recogniseAuthority({ ...P, panel: ['hr_director'] })).code).toBe('invalid');
    const ctx = { me: 'p-training-mgr', person: { id: 'w-sro-02', kind: 'staff', status: 'active' }, skill: skill('sk-co-03'), level: 4, open: false };
    expect(checkPropose(P, ctx)).toBe('ok');
    expect(checkPropose(P, { ...ctx, level: 3 })).toBe('not_expert');
    expect(authResultCode('not_expert')).toBe('not_eligible');
    expect(checkDecide('approve', { status: 'proposed', proposed_by: 'p-chco' }, { me: 'p-chco', isDecider: true, note: null })).toBe('maker_checker');
    expect(checkDecide('approve', { status: 'recognised', proposed_by: 'x' }, { me: 'p-chco', isDecider: true, note: null })).toBe('state');
    expect(checkDecide('withdraw', { status: 'proposed', proposed_by: 'p-training-mgr' }, { me: 'p-training-mgr', isDecider: false, note: 'Proposed in error, withdrawn.' })).toBe('ok');
  });
  it('RBAC: recognitions are read by the person and recognition R/W/A only; candidates only for recognition holders; scale map and descriptors public', async () => {
    await as(null);
    expect((await b.list('authority_recognitions')).length).toBe(0);
    expect((await b.list('scale_maps')).length).toBe(35);
    expect((await b.list('skill_descriptors')).length).toBe(pub.length);
    expect((await b.list('level_attributes')).length).toBe(24);
    await as('sro');
    expect((await b.list('authority_recognitions')).map((r) => r.id)).toEqual(['ar:p-sro:sk-ld-02:1']);
    expect(await b.rpc.authorityCandidates()).toEqual([]);
    await as('k-hr-analyst');
    expect((await b.list('authority_recognitions')).length).toBe(0);
    for (const p of ['chco', 'training-mgr', 'k-auditor']) {
      await as(p);
      expect((await b.list('authority_recognitions')).length, p).toBe(T.authority_recognitions.length);
    }
    await as('chco');
    const c = await b.rpc.authorityCandidates();
    expect(c.length).toBeGreaterThan(20);
    expect(c.every((x) => skill(x.skill_id).area !== 'security' && skill(x.skill_id).fs_area !== 'cyber_hygiene')).toBe(true);
    expect(c.find((x) => x.person_id === 'w-sro-01' && x.skill_id === 'sk-co-03')?.recognition_status).toBe('recognised');
  });
});

describe('FS23/FS24 · routes, benchmarks and i18n', () => {
  it('seven routes with the right guards; every page shows its benchmark chips', () => {
    const ids = ['competencies-levels', 'competencies-descriptors', 'competencies-descriptor', 'competencies-scale', 'my-levels', 'admin-descriptors', 'admin-authority'];
    for (const id of ids) expect(routes.find((r) => r.id === id), id).toBeTruthy();
    expect(routes.find((r) => r.id === 'competencies-scale')!.guard).toEqual({});
    expect(routes.find((r) => r.id === 'admin-authority')!.guard).toEqual({ signedIn: true, grant: { res: 'recognition', levels: ['A', 'R'] } });
    expect(FEATURE_BENCHMARKS.FS23).toEqual(['SFIA9', 'SSG-SF', 'IAEA-1917']);
    expect(FEATURE_BENCHMARKS.FS24).toEqual(['SFIA9', 'DIGCOMP', 'UAE-NQF']);
    for (const [f, fs] of [['LevelsPage', 'FS23'], ['DescriptorLibraryPage', 'FS23'], ['DescriptorPage', 'FS23'], ['DescriptorsAdminPage', 'FS23'], ['ScaleMapPage', 'FS24'], ['AuthorityAdminPage', 'FS24'], ['MyLevelsPage', 'FS24']])
      expect(readFileSync(`src/modules/m02/${f}.tsx`, 'utf8'), f).toContain(`<BenchmarkChips feature="${fs}"`);
  });
  it('the four RPCs are mapped for the Supabase backend; the migration is additive', async () => {
    const calls: string[] = [];
    const reads: string[] = [];
    const m = makeSupabaseM02({ call: async (fn: string) => { calls.push(fn); return { ok: true, code: 'ok', message: '', data: null } as never; }, rpc: async (fn: string) => { reads.push(fn); return [] as never; } } as never);
    await m.saveDescriptor(base);
    await m.setLevelRange({ skill_id: 'x', min_level: 1, max_level: 2, basis: 'full', rationale_en: '', rationale_ar: '' });
    await m.recogniseAuthority({ action: 'approve', id: 'x' });
    await m.authorityCandidates();
    expect(calls).toEqual(['kafaa_save_descriptor', 'kafaa_set_level_range', 'kafaa_recognise_authority']);
    expect(reads).toEqual(['kafaa_authority_candidates']);
    const sql = readFileSync('supabase/migrations/20261010234001_kafaa_fs34_descriptors_scale.sql', 'utf8');
    expect(/\b(drop\s+\w+|delete\s+from|truncate)\b/i.test(sql.replace(/--[^\n]*/g, ''))).toBe(false); // "revoke ... delete on" is a grant, not a delete
    for (const msg of [...Object.values(DESC_MSG), ...Object.values(AUTH_MSG)]) expect(sql.includes(`'${msg.replace(/'/g, "''")}'`), msg).toBe(true);
  });
  it('EN and AR are complete for the FS23/FS24 keys (and the refusal codes have AR text)', () => {
    const flat = (o: any, p = ''): Record<string, string> => Object.entries(o).reduce((a, [k, v]) => (typeof v === 'object' ? { ...a, ...flat(v, `${p}${k}.`) } : { ...a, [`${p}${k}`]: v as string }), {}); // eslint-disable-line @typescript-eslint/no-explicit-any
    const fe = flat(en);
    const fa = flat(ar);
    const mine = Object.keys(fe).filter((k) => /^(lv|sc|au|ml|da|dl|dp|ci|area)\./.test(k));
    expect(mine.length).toBeGreaterThan(300);
    for (const k of mine) expect(fa[k]?.trim(), k).toBeTruthy();
    for (const c of ['person', 'self', 'skill', 'restricted', 'obsolete', 'not_expert', 'conflict', 'panel', 'citation']) expect(fa[`au.msg.${c}`], c).toBeTruthy();
    for (const c of Object.keys(DESC_MSG).filter((x) => !['not_signed_in', 'forbidden'].includes(x))) expect(fa[`da.msg.${c}`], c).toBeTruthy();
  });
});
