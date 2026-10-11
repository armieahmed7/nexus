/** FS44 Expert lecture library + FS45 Localisation countdown (FS wave E · E3, M24): one named test per acceptance criterion on the local
 *  path, plus the shared rules, RBAC, the seed and i18n. The SQL path (kafaa_lc_* = lectures.ts, kafaa_lz_* = localisation.ts, RLS, RPC
 *  flows, grants, additivity) is proved by scripts/validate/fs53-lectures-localisation.mjs (PGlite). */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m24.en.json';
import ar from '../../src/i18n/m24.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m24/routes';
import { SYSTEM_FAMILIES } from '../../src/modules/m24/capture';
import { CONTRIB_MAX_LEVEL, LECTURE_FAMILIES, contributorsOf, decideProblem, evidenceSkills, lectureProblem, levelFor, resolvePosition, validatedContributions, type SkillLite } from '../../src/modules/m24/lectures';
import { TARGET_MAX, computeBoard, readiness, riskOf, statusProblem, type LocItem, type TrackState } from '../../src/modules/m24/localisation';
import { currencyView, deriveStage, initialDoneOn } from '../../src/modules/m02/instructors';
import { PROTECTED_INPUTS } from '../../src/modules/m16/transparency';
import { RECORDED_REF_TABLES, isRecordedEvidence } from '../../src/domain/skills';
import { hasContactDetails, postGuard } from '../../src/modules/m22/domain';
import { todayIso } from '../../src/domain/rules';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const skills = new Map<string, SkillLite>(T.skills.map((s) => [s.id, { id: s.id, area: s.area, competency_id: s.competency_id, lifecycle: s.lifecycle ?? null, fs_area: s.fs_area ?? null }]));
const secComps = new Set<string>(T.competencies.filter((c) => c.domain === 'security').map((c) => c.id));
const positionsOf = (pid: string) => T.klra_positions.filter((p) => p.person_id === pid && p.active).map((p) => ({ id: p.id, person_id: p.person_id, family_id: p.family_id, active: true, title_en: p.title_en, title_ar: p.title_ar }));
const policies = T.refusal_policies.map((p) => ({ category: p.category, patterns: p.patterns ?? [], enabled: p.enabled }));
const world = (speaker: string, pos: Row | null) => ({ skills, secComps, position: pos as never, speakerPositions: positionsOf(speaker), guard: (t: string) => postGuard(t, policies), contact: hasContactDetails, today: todayIso() });
const secSkill = T.skills.find((s) => s.area === 'security' || secComps.has(s.competency_id))!;
const draft = {
  title_en: 'Microreactor transport concepts for operators', title_ar: 'مفاهيم نقل المفاعلات الدقيقة للمشغلين',
  abstract_en: 'Notes on the published operating concepts for transportable units and what they mean for crew training.', abstract_ar: 'ملاحظات حول مفاهيم التشغيل المنشورة للوحدات القابلة للنقل وما تعنيه لتدريب الأطقم.',
  format: 'talk', lang: 'en' as const, delivered_on: '2026-09-01', duration_min: 30, skill_ids: ['sk-fs-adv-micro'], system_family: 'reactor_core', chapters: [{ at: 0, en: 'Concepts', ar: 'المفاهيم' }], submit: false,
};
const trackStates = (b: LocalBackend, on: string): TrackState[] => {
  const raw = (t: string) => b.raw(t as never) as unknown as Row[];
  return raw('instructor_tracks').map((t) => {
    const init = initialDoneOn(t.person_id, t.route, raw('training_records') as never);
    const stage = deriveStage(t as never, raw('instructor_observations').filter((o) => o.track_id === t.id) as never, init);
    const cur = currencyView(t as never, raw('teaching_hours').filter((x) => x.person_id === t.person_id).map((x) => ({ ...x, hours: Number(x.hours) })) as never, on);
    return { id: t.id, person_id: t.person_id, status: t.status, stage, discipline: t.discipline ?? '', standard_ids: [...(t.standard_ids ?? [])], currency: cur?.status ?? null };
  });
};

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const ev = (prefix: string) => (b.raw('skill_evidence' as never) as unknown as Row[]).filter((e) => String(e.id).startsWith(prefix));
const states = (pid: string) => (b.raw('person_skills' as never) as unknown as Row[]).filter((s) => s.person_id === pid && s.active).map((s) => `${s.id}|${s.level}|${s.confidence}`).sort();
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

describe('FS44 · validated contributions recompute skills; unvalidated ones do not (acceptance 1)', () => {
  it('acceptance FS44-1: a pending contribution writes nothing; validating it writes rating/validated evidence and recomputes the person\'s skills; a rejection writes nothing', async () => {
    await as('training-mgr');
    const c = b.rawGet('contributions' as never, 'ctb-lec-007') as unknown as Row;
    expect(c.status).toBe('pending');
    expect(ev('se:contrib:ctb-lec-007:')).toEqual([]);
    expect(states('w-eng-01').some((s) => s.startsWith('ps:w-eng-01:sk-fs-gr-lifecycle|'))).toBe(false);
    const r = await b.rpc.validateContribution('ctb-lec-007', 'validate', 'Checked against the linked skill');
    expect(r.ok).toBe(true);
    const rows = ev('se:contrib:ctb-lec-007:');
    expect(rows.map((e) => [e.skill_id, e.kind, e.basis, e.ref_table, e.ref_id, e.level])).toEqual([['sk-fs-gr-lifecycle', 'rating', 'validated', 'lectures', 'lec-007', 3]]);
    const st = (b.rawGet('person_skills' as never, 'ps:w-eng-01:sk-fs-gr-lifecycle') as unknown as Row);
    expect(st.active && st.level).toBe(3);
    const before = states('w-rp-02');
    const rj = await b.rpc.validateContribution('ctb-lec-008', 'reject', 'Please add your own outage examples');
    expect(rj.ok).toBe(true);
    expect(ev('se:contrib:ctb-lec-008:')).toEqual([]);
    expect(states('w-rp-02')).toEqual(before);
  });
  it('validated contribution evidence is recorded evidence: an F01 recompute keeps it', async () => {
    const row = ev('se:contrib:ctb-lec-001:')[0];
    expect(isRecordedEvidence(row as never)).toBe(true);
    expect(RECORDED_REF_TABLES).toEqual(expect.arrayContaining(['lectures', 'knowledge_assets']));
    await applySkills(b, row.person_id, todayIso());
    expect((b.rawGet('skill_evidence' as never, row.id) as unknown as Row).active).toBe(true);
  });
  it('maker-checker and RBAC: nobody validates their own contribution, staff cannot validate, a withdrawn source cannot be validated (but can be rejected)', async () => {
    await as('training-mgr');
    b.rawInsert('contributions' as never, { id: 'ctb-test-self', person_id: 'p-training-mgr', kind: 'lecture', contributor_role: 'speaker', ref_table: 'lectures', ref_id: 'lec-001', skill_ids: ['sk-fs-dp-dic'], level: 3, status: 'pending', submitted_on: '2026-10-01', evidence_ids: [] } as never);
    expect((await b.rpc.validateContribution('ctb-test-self', 'validate', '')).code).toBe('maker_checker');
    expect((await b.rpc.validateContribution('ctb-lec-007', 'validate', '')).code).toBe('invalid');
    expect((await b.rpc.withdrawLecture('lec-009', 'Recording needs an update')).ok).toBe(true);
    expect((await b.rpc.validateContribution('ctb-lec-009', 'validate', '')).code).toBe('source_unavailable');
    expect((await b.rpc.validateContribution('ctb-lec-009', 'reject', 'Lecture withdrawn before validation')).ok).toBe(true);
    await as('sro');
    expect((await b.rpc.validateContribution('ctb-lec-010', 'validate', '')).code).toBe('forbidden');
    expect(await b.rpc.contributionQueue()).toBeNull();
  });
  it('contribution levels never exceed 3; security, cyber-hygiene and obsolete skills carry no evidence', () => {
    expect([levelFor('speaker'), levelFor('sme'), levelFor('author')]).toEqual([3, 3, 2]);
    expect(Math.max(...T.contributions.map((c) => c.level))).toBeLessThanOrEqual(CONTRIB_MAX_LEVEL);
    expect(evidenceSkills(['sk-fs-cy-phishing', 'sk-fs-dp-paperwp', secSkill.id, 'sk-fs-dp-dic', 'sk-fs-dp-dic'], skills, secComps)).toEqual(['sk-fs-dp-dic']);
    expect(decideProblem({ id: 'x', person_id: 'p', status: 'pending' } as never, 'q', 'validate', '', true, 0)).toBe('skills');
  });
});

describe('FS44 · no security-restricted topic can be published (acceptance 2)', () => {
  it('acceptance FS44-2: security skills, security texts in English and Arabic and restricted positions are refused; publication re-screens the lecture', async () => {
    await as('sro');
    expect((await b.rpc.saveLecture({ ...draft, skill_ids: [secSkill.id] })).code).toBe('security_restricted');
    expect((await b.rpc.saveLecture({ ...draft, abstract_en: `${draft.abstract_en} Includes the perimeter layout.` })).code).toBe('security_restricted');
    expect((await b.rpc.saveLecture({ ...draft, title_ar: 'كاميرات المحطة ليلاً' })).code).toBe('security_restricted');
    expect((await b.rpc.saveLecture({ ...draft, abstract_en: `${draft.abstract_en} Call 0501234567.` })).code).toBe('contact_details');
    const secPos = { id: 'pos-x', family_id: 'security', active: true };
    expect(lectureProblem(draft, { ...world('p-x', secPos), speakerPositions: [secPos] } as never)?.code).toBe('security_restricted');
    await as('training-mgr');
    b.rawUpdate('lectures' as never, 'lec-013', { title_en: 'Night walkdowns along the perimeter fence' } as never);
    const r = await b.rpc.publishLecture('lec-013');
    expect(r.code).toBe('security_restricted');
    expect((b.rawGet('lectures' as never, 'lec-013') as unknown as Row).status).toBe('review');
    expect(T.lectures.every((l) => lectureProblem({ ...l, delivered_on: l.delivered_on }, world(l.speaker_id, l.position_id ? positionsOf(l.speaker_id).find((p) => p.id === l.position_id)! : null)) === null)).toBe(true);
  });
});

describe('FS44 · each lecture links a skill and the KLRA position it protects, where one exists (acceptance 3)', () => {
  it('acceptance FS44-3: every seeded lecture links at least one skill and its speaker\'s KLRA position when the speaker holds one; saving links it automatically', async () => {
    for (const l of T.lectures) {
      expect(l.skill_ids.length).toBeGreaterThanOrEqual(1);
      const r = resolvePosition(null, positionsOf(l.speaker_id));
      expect(l.position_id).toBe(r ? r.id : null);
    }
    expect(T.lectures.some((l) => l.position_id === null)).toBe(true);
    await as('sro');
    const s = await b.rpc.saveLecture({ ...draft, submit: true });
    expect(s.ok).toBe(true);
    expect(s.data!.position_id).toBe(positionsOf('p-sro')[0].id);
    expect((await b.rpc.saveLecture({ ...draft, position_id: 'pos-w-mnt-01' })).code).toBe('invalid');
    await as('training-mgr');
    const p = await b.rpc.publishLecture(s.data!.id);
    expect(p.ok && p.data!.contribution_id).toBe(`ctb-${s.data!.id}`);
    await as('sro');
    expect((await b.rpc.publishLecture(s.data!.id)).code).toBe('forbidden');
  });
  it('publication is maker-checker and staff record only their own talks; partners have no access', async () => {
    await as('training-mgr');
    const own = await b.rpc.saveLecture({ ...draft, submit: true });
    expect(own.ok).toBe(true);
    expect((await b.rpc.publishLecture(own.data!.id)).code).toBe('maker_checker');
    await as('nse');
    expect((await b.rpc.saveLecture({ ...draft, speaker_id: 'p-sro' })).code).toBe('forbidden');
    await as('alnoor-gm');
    expect((await b.rpc.saveLecture(draft)).code).toBe('forbidden');
    expect(await b.rpc.localisationBoard()).toBeNull();
  });
  it('the seed has validated, pending and rejected contributions; every published asset has its SME and author contributions; FS72 reads a clean list', () => {
    const st = new Set(T.contributions.map((c) => c.status));
    expect([...st].sort()).toEqual(['pending', 'rejected', 'validated']);
    for (const a of T.knowledge_assets.filter((x) => x.status === 'published')) for (const k of contributorsOf('asset', a as never)) expect(T.contributions.some((c) => c.id === k.id && c.person_id === k.person_id)).toBe(true);
    const v = validatedContributions(T.contributions as never);
    expect(v.length).toBe(T.contributions.filter((c) => c.status === 'validated').length);
    expect(v.every((x) => x.skill_ids.length > 0 && x.level <= 3)).toBe(true);
    expect(T.skill_evidence.filter((e) => String(e.id).startsWith('se:contrib:')).every((e) => T.skills.find((s) => s.id === e.skill_id)!.fs_area)).toBe(true);
  });
});

describe('FS45 · every partner-delivered programme in the seed appears with a date (acceptance 1)', () => {
  it('acceptance FS45-1: the board lists every seeded item with a target date no later than 2030-12-31, its programme and partner', async () => {
    await as('nse');
    const v = (await b.rpc.localisationBoard())!;
    expect(v.items.length).toBe(T.localisation_items.length);
    expect(v.items.length).toBeGreaterThanOrEqual(12);
    for (const i of v.items) {
      expect(i.target_on <= TARGET_MAX && i.target_on >= i.baseline_on).toBe(true);
      expect(T.programmes.some((p) => p.id === i.programme_id)).toBe(true);
      expect(i.partner_en.length).toBeGreaterThan(0);
    }
    expect(v.items.every((i) => i.instructors === null)).toBe(true);
    expect(v.can_edit).toBe(false);
  });
});

describe('FS45 · readiness is computed from F31, not entered (acceptance 2)', () => {
  it('acceptance FS45-2: the table has no readiness column; the board equals computeBoard over the F31 tracks; a new track changes readiness', async () => {
    expect(Object.keys(SCHEMA.localisation_items.cols).some((c) => /ready|readiness|pct/.test(c))).toBe(false);
    await as('training-mgr');
    const on = todayIso();
    const v = (await b.rpc.localisationBoard())!;
    const items = (b.raw('localisation_items' as never) as unknown as Row[]).map((r) => ({ ...r, target_on: String(r.target_on).slice(0, 10), baseline_on: String(r.baseline_on).slice(0, 10) })) as LocItem[];
    const exp = computeBoard(items, trackStates(b, on), on);
    expect(v.items.map((i) => [i.id, i.readiness.pct, i.risk.level])).toEqual(exp.items.map((i) => [i.id, i.readiness.pct, i.risk.level]));
    expect(v.items.every((i) => Array.isArray(i.instructors))).toBe(true);
    const before = v.items.find((i) => i.id === 'loc-maint-ic')!.readiness;
    b.rawInsert('instructor_tracks' as never, { id: 'it-test-ic', person_id: 'w-mnt-03', person_name: 'Test', person_name_ar: 'اختبار', route: 'sme', discipline: 'Maintenance', standard_ids: ['qs-ic'], stage: 'ready', status: 'active', started_on: '2026-01-01', accepted_on: '2026-01-10' } as never);
    const after = (await b.rpc.localisationBoard())!.items.find((i) => i.id === 'loc-maint-ic')!.readiness;
    expect(before.pct).toBe(0);
    expect(after.tenths).toBeGreaterThan(before.tenths);
    expect(after.pipeline).toBe(before.pipeline + 1);
  });
  it('readiness never reads nationality, gender or age (every track row is trapped)', () => {
    const reads: string[] = [];
    const P = new Set<string>(PROTECTED_INPUTS);
    const trap = (r: Row) => new Proxy({ ...r, gender: 'f', nationality_flag: 'uae', nationality: 'uae', age: 40, birth_date: '1986-01-01' }, { get(t, k) { if (typeof k === 'string' && P.has(k)) reads.push(k); return Reflect.get(t, k); } });
    const tracks = trackStates(b, todayIso()).map(trap) as unknown as TrackState[];
    computeBoard(T.localisation_items as never, tracks, todayIso());
    expect(reads).toEqual([]);
  });
  it('the rules: stage weights, the qualified/lapsed split and the risk thresholds', () => {
    const it0 = { id: 'x', standard_ids: ['qs-a'], instructors_needed: 2, baseline_on: '2024-01-01', target_on: '2027-01-01', status: 'co_delivery' } as LocItem;
    const tr = (id: string, status: string, stage: string, currency: string | null = null): TrackState => ({ id, person_id: id, status, stage, standard_ids: ['qs-a'], currency });
    const r = readiness(it0, [tr('a', 'qualified', 'qualified', 'current'), tr('b', 'qualified', 'qualified', 'lapsed'), tr('c', 'active', 'solo'), tr('d', 'withdrawn', 'co_teach')]);
    expect([r.ready_now, r.lapsed, r.pipeline, r.tenths, r.pct, r.gap]).toEqual([1, 1, 1, 16, 80, 1]);
    expect(riskOf({ status: 'co_delivery', target_on: '2027-01-01' }, { ...r, pct: 40 }, '2026-10-11').level).toBe('high');
    expect(riskOf({ status: 'co_delivery', target_on: '2028-06-30' }, { ...r, pct: 70 }, '2026-10-11').level).toBe('medium');
    expect(riskOf({ status: 'co_delivery', target_on: '2030-06-30' }, { ...r, pct: 85 }, '2026-10-11').level).toBe('low');
    expect(riskOf({ status: 'on_hold', target_on: '2030-06-30' }, { ...r, pct: 85 }, '2026-10-11').level).toBe('medium');
    expect(riskOf({ status: 'co_delivery', target_on: '2026-06-30' }, r, '2026-10-11')).toMatchObject({ level: 'overdue', overdue: true, days_left: -103 });
    expect(riskOf({ status: 'transferred', target_on: '2026-06-30' }, r, '2026-10-11')).toMatchObject({ level: 'done', regressed: true });
    expect(statusProblem(it0, { status: 'transferred' }, r)).toBe('not_ready');
    expect(statusProblem(it0, { status: 'co_delivery', target_on: '2031-01-01', note: 'Moving for a reason' }, r)).toBe('target');
    expect(statusProblem(it0, { status: 'co_delivery', target_on: '2029-01-01' }, r)).toBe('note_required');
    expect(statusProblem(it0, { status: 'co_delivery' }, r)).toBe('unchanged');
    expect(statusProblem(it0, { status: 'uae_led_supervised' }, r)).toBe('ok');
  });
});

describe('FS45 · items past their target are flagged and appear on the F22 handover board (acceptance 3)', () => {
  it('acceptance FS45-3: overdue items are flagged on the board and returned by localisationOverdue to F22 viewers (HR, managers, auditors)', async () => {
    await as('chco');
    const od = (await b.rpc.localisationOverdue())!;
    expect(od.items.length).toBeGreaterThanOrEqual(2);
    expect(od.items.every((i) => i.days_overdue > 0 && i.target_on < od.today && i.status !== 'transferred')).toBe(true);
    const board = (await b.rpc.localisationBoard())!;
    expect(board.items.filter((i) => i.risk.overdue).map((i) => i.id).sort()).toEqual(od.items.map((i) => i.id).sort());
    for (const p of ['chem-sup', 'k-auditor']) { await as(p); expect((await b.rpc.localisationOverdue())!.items.length).toBe(od.items.length); }
    await as('alnoor-gm');
    expect(await b.rpc.localisationOverdue()).toBeNull();
  });
  it('setLocalisationStatus: training manager only, transferred needs computed readiness, no target after 2030, reasons for moved dates; the change is ledgered', async () => {
    await as('k-instructor');
    expect((await b.rpc.setLocalisationStatus('loc-maint-elec', { status: 'co_delivery' })).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.setLocalisationStatus('loc-maint-elec', { status: 'transferred' })).code).toBe('not_ready');
    expect((await b.rpc.setLocalisationStatus('loc-maint-elec', { status: 'partner_led', target_on: '2031-03-31', note: 'Partner asked for more time' })).code).toBe('invalid');
    expect((await b.rpc.setLocalisationStatus('loc-maint-elec', { status: 'partner_led', target_on: '2030-03-31' })).code).toBe('note_required');
    const led0 = (b.raw('ledger_local' as never) as unknown as Row[]).length;
    const ok = await b.rpc.setLocalisationStatus('loc-maint-elec', { status: 'co_delivery', target_on: '2030-03-31', note: 'Joint delivery agreed for the next intake' });
    expect(ok.ok).toBe(true);
    expect((b.raw('ledger_local' as never) as unknown as Row[]).length).toBe(led0 + 1);
    const row = b.rawGet('localisation_items' as never, 'loc-maint-elec') as unknown as Row;
    expect([row.status, row.target_on, row.history.length]).toEqual(['co_delivery', '2030-03-31', 2]);
  });
});

describe('FS44/FS45 · routes, i18n, families', () => {
  it('four routes with the right guards; the lecture family list equals the capture studio list', () => {
    const ids = routes.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['knowledge-lectures', 'knowledge-lecture', 'knowledge-contributions', 'knowledge-localisation']));
    expect(routes.find((r) => r.id === 'knowledge-contributions')!.guard).toMatchObject({ grant: { res: 'knowledge', levels: ['A'] } });
    expect(routes.find((r) => r.id === 'knowledge-localisation')!.guard).toMatchObject({ grant: { res: 'knowledge', levels: ['R'] } });
    expect([...LECTURE_FAMILIES]).toEqual([...SYSTEM_FAMILIES]);
  });
  it('every FS44/FS45 string exists in English and Arabic', () => {
    const flat = (o: Row, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
    for (const k of ['lc', 'ctb', 'lz'] as const) {
      const a = flat((en as Row)[k]).sort();
      expect(flat((ar as Row)[k]).sort()).toEqual(a);
      expect(flat((ar as Row)[k]).every((x) => String(x.split('.').reduce((o: Row, s) => o[s], (ar as Row)[k])).trim().length > 0)).toBe(true);
    }
    const src = ['LecturesPage', 'LecturePage', 'ContributionsPage', 'LocalisationPage', 'fs44ui', 'links'].map((f) => readFileSync(`src/modules/m24/${f}.tsx`, 'utf8')).join('\n');
    const used = [...new Set([...src.matchAll(/'m24\.(lc|ctb|lz)\.([A-Za-z0-9_.]+)'/g)].map((m) => `${m[1]}.${m[2]}`))];
    const get = (o: Row, path: string) => path.split('.').reduce((x: Row | undefined, s) => (x ? x[s] : undefined), o);
    expect(used.filter((k) => typeof get(en as Row, k) !== 'string' || typeof get(ar as Row, k) !== 'string')).toEqual([]);
  });
});
