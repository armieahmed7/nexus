/** FS80 Automation and agent gallery with builder credit (FS wave I · E2, M29): one named test per acceptance criterion on the local path,
 *  plus the shared rules, RBAC, maker-checker, the seed and i18n. The SQL path (kafaa_atm_problem = automationProblem, decisions, adoption
 *  gate, level, statistics, RLS, live RPC flows, table checks, grants, additivity) is proved by scripts/validate/fs92-automation-gallery.mjs. */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m29.en.json';
import ar from '../../src/i18n/m29.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m29/routes';
import { aiRung, type RungCell, type SkillTrackRow } from '../../src/modules/m29/fluency';
import {
  AUTOMATION_STATUSES, BUILDER_SKILL, REUSE_AT, adoptProblem, automationProblem, builderEvidenceId, builderLevel, creditReasons, decisionProblem, galleryStats, looksLikeCode, sortGallery,
  type AutomationInput,
} from '../../src/modules/m29/automations';
import { isRecordedEvidence } from '../../src/domain/skills';
import { ATM_MSG } from '../../src/modules/m29/backend/local.fs80';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const A = T.automations;
const AD = T.automation_adoptions;
const staffIds = T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id as string);
const sys = T.ai_systems.map((s) => ({ id: s.id as string, status: s.status as string }));
const inputOf = (a: Row, action = 'submit'): AutomationInput => ({
  id: a.id, title_en: a.title_en, title_ar: a.title_ar, kind: a.kind, purpose_en: a.purpose_en, purpose_ar: a.purpose_ar, data_used_en: a.data_used_en, data_used_ar: a.data_used_ar,
  data_classes: [...a.data_classes], system_id: a.system_id, owner_person_id: a.owner_person_id, oversight_en: a.oversight_en, oversight_ar: a.oversight_ar, benefit_en: a.benefit_en,
  benefit_ar: a.benefit_ar, how_en: a.how_en, how_ar: a.how_ar, min_rung: a.min_rung, action,
});
const base = inputOf(A.find((a) => a.id === 'atm-procedure-revision-digest')!);
const fresh = (over: Partial<AutomationInput> = {}): AutomationInput => ({ ...base, id: undefined, title_en: 'Permit lookup helper', title_ar: 'مساعد البحث عن التصاريح', owner_person_id: 'p-buyer', ...over });
const rungOf = (b: LocalBackend, pid: string) => aiRung(pid, b.raw('ai_rungs' as never) as unknown as RungCell[], b.raw('ai_skill_tracks' as never) as unknown as SkillTrackRow[],
  (b.raw('person_skills' as never) as unknown as Row[]).filter((s) => s.active && s.person_id === pid) as never).rung;

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => b.raw(t as never) as unknown as Row[];
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

describe('FS80 · nothing executes inside Kafa\'a: no code storage, metadata only (acceptance 1)', () => {
  it('the gallery tables have no code, script, file, link or command column, and every seeded entry is metadata only', () => {
    for (const t of ['automations', 'automation_adoptions']) expect(Object.keys(SCHEMA[t].cols).filter((c) => /code|script|url|link|file|command|payload|endpoint|source_text/.test(c))).toEqual([]);
    expect(SCHEMA.automations.write.mode).toBe('rpc');
    expect(A.every((a) => a.metadata_only === true)).toBe(true);
  });
  it('automationProblem refuses code, scripts, links, file names and credentials in any text (EN and AR)', () => {
    for (const bad of ['Open https://tools.example/run', 'Runs <script>x</script>', 'Uses function(x) => x', 'paste ```code```', 'run.ps1 nightly', 'curl the export', 'www.example share', 'see file:///c/x', 'javascript:alert(1)'])
      expect(automationProblem({ ...base, how_en: bad }, { systems: sys, staff: staffIds })).toBe('code');
    expect(automationProblem({ ...base, how_ar: 'شغّل الملف run.py' }, { systems: sys, staff: staffIds })).toBe('code');
    expect(automationProblem({ ...base, how_en: 'Log in with the password on the note' }, { systems: sys, staff: staffIds })).toBe('secret');
    expect(automationProblem({ ...base, how_ar: 'أدخل كلمة المرور' }, { systems: sys, staff: staffIds })).toBe('secret');
    expect(looksLikeCode('Read the digest, then open each controlled copy.')).toBe(false);
  });
  it('submitAutomation (local) refuses a link or code with the "metadata only" message and stores no code anywhere', async () => {
    await as('buyer');
    const r1 = await b.rpc.submitAutomation(fresh({ how_en: 'Open https://tools.example/run and press start.' }));
    const r2 = await b.rpc.submitAutomation(fresh({ purpose_en: 'Calls eval(input) on each row.' }));
    expect(r1.ok).toBe(false); expect(r1.code).toBe('invalid'); expect(r1.message).toMatch(/metadata only/);
    expect(r2.code).toBe('invalid');
    expect(raw('automations').some((a) => /https?:\/\/|eval\(/.test(JSON.stringify(a)))).toBe(false);
  });
  it('the pages render entry text as plain text: no HTML injection, no links built from entry text, no network call', () => {
    for (const f of ['GalleryPage', 'AutomationPage', 'MyBuildsPage', 'GalleryAdminPage', 'fs80ui']) {
      const src = readFileSync(`src/modules/m29/${f}.tsx`, 'utf8');
      expect(src).not.toMatch(/dangerouslySetInnerHTML|fetch\(|window\.open|eval\(|new Function/);
      expect(src).not.toMatch(/href=\{[^}]*(how|purpose|data_used|oversight|benefit)/);
    }
  });
});

describe('FS80 · evidence is written only after approval and the first adoption (acceptance 2)', () => {
  it('builderLevel: 0 until approved and adopted once, 2 from the first adopter, 3 from 5; retired entries keep what they earned', () => {
    for (const s of AUTOMATION_STATUSES) for (let n = 0; n <= 7; n++) {
      const want = !(s === 'approved' || s === 'retired') || n < 1 ? 0 : n >= REUSE_AT ? 3 : 2;
      expect(builderLevel(s, n)).toBe(want);
    }
  });
  it('the seed: every builder credit belongs to an approved (or retired) entry with an adopter, dated on or after the first adoption; an approved entry without adopters has none', () => {
    const ev = T.skill_evidence.filter((e) => e.ref_table === 'automations');
    expect(ev.length).toBe(9);
    for (const e of ev) {
      const a = A.find((x) => x.id === e.ref_id)!;
      expect(['approved', 'retired']).toContain(a.status);
      expect(a.adoption_count).toBeGreaterThanOrEqual(1);
      expect(e.observed_on >= a.first_adopted_on).toBe(true);
      expect([e.kind, e.basis, e.skill_id, e.person_id, e.level]).toEqual(['ojt', 'validated', BUILDER_SKILL, a.builder_person_id, builderLevel(a.status, a.adoption_count)]);
    }
    for (const a of A.filter((x) => x.status !== 'approved' && x.status !== 'retired')) expect(ev.some((e) => e.ref_id === a.id)).toBe(false);
    expect(ev.some((e) => e.ref_id === 'atm-bilingual-notice' || e.ref_id === 'atm-requisition-spec-check')).toBe(false);
  });
  it('local flow: submit -> approve writes no evidence; the first adoption writes level 2; the fifth raises it to level 3 in place', async () => {
    const c = new LocalBackend(); await c.whenReady(); await c.reset();
    c.setPersona('buyer'); await c.whenReady();
    const s = await c.rpc.submitAutomation(fresh({ min_rung: 1 }));
    expect(s.ok).toBe(true); expect(s.data!.status).toBe('submitted');
    const id = s.data!.id;
    c.setPersona('ai-governance'); await c.whenReady();
    const ap = await c.rpc.decideAutomation({ id, decision: 'approve' });
    expect(ap.ok).toBe(true); expect(ap.data!.listed).toBe(true);
    const evRows = () => (c.raw('skill_evidence' as never) as unknown as Row[]).filter((e) => e.ref_table === 'automations' && e.ref_id === id);
    expect(evRows().length).toBe(0);
    const adopters = ['sro', 'chco', 'training-mgr', 'k-hr-analyst', 'k-instructor', 'k-ro', 'nse'];
    const levels: number[] = [];
    for (const p of adopters) {
      c.setPersona(p); await c.whenReady();
      const pid = c.identity().personId!;
      if (rungOf(c, pid) < 1) continue;
      const r = await c.rpc.adoptAutomation({ id });
      expect(r.ok).toBe(true);
      levels.push(r.data!.builder_level);
      if (levels.length === REUSE_AT) break;
    }
    expect(levels[0]).toBe(2);
    expect(levels[REUSE_AT - 1]).toBe(3);
    expect(evRows().length).toBe(1);
    expect(evRows()[0]).toMatchObject({ id: builderEvidenceId(id), person_id: 'p-buyer', kind: 'ojt', basis: 'validated', level: 3, active: true, skill_id: BUILDER_SKILL });
    await applySkills(c, 'p-buyer', '2026-10-12');
    expect(evRows()[0].active).toBe(true);
    expect(isRecordedEvidence(evRows()[0] as never)).toBe(true);
    const st = (c.raw('person_skills' as never) as unknown as Row[]).find((x) => x.person_id === 'p-buyer' && x.skill_id === BUILDER_SKILL && x.active);
    expect(st?.level).toBe(3);
  }, 180000);
  it('an entry that is not approved cannot be adopted (and so writes nothing), and builder credit never moves the FS09 rung', async () => {
    await as('sro');
    const r = await b.rpc.adoptAutomation({ id: 'atm-eng-change-impact' });
    expect(r.ok).toBe(false); expect(r.code).toBe('not_found');
    for (const e of T.skill_evidence.filter((x) => x.ref_table === 'automations')) expect(T.ai_skill_tracks.find((t) => t.skill_id === e.skill_id)?.track).toBe('engineering');
    const reasons = creditReasons(A.find((a) => a.id === 'atm-procedure-revision-digest') as never);
    expect(reasons.map((x) => x.code)).toEqual(['approved', 'adopted', 'level', 'engineering']);
  });
});

describe('FS80 · each entry links to its AI-system register row (acceptance 3)', () => {
  it('every seeded entry names an existing kafaa_ai_systems row (schema reference too)', () => {
    expect(SCHEMA.automations.cols.system_id).toMatch(/ref:ai_systems/);
    const ids = new Set(T.ai_systems.map((s) => s.id));
    expect(A.every((a) => ids.has(a.system_id))).toBe(true);
  });
  it('an entry must run on a published register row: unknown, draft or retired systems are refused', async () => {
    expect(automationProblem({ ...base, system_id: 'ais-nope' }, { systems: sys, staff: staffIds })).toBe('system');
    expect(automationProblem({ ...base, system_id: 'ais-chem-triage' }, { systems: sys, staff: staffIds })).toBe('system_closed');
    expect(automationProblem({ ...base, system_id: 'ais-chat-pilot' }, { systems: sys, staff: staffIds })).toBe('system_closed');
    await as('buyer');
    const r = await b.rpc.submitAutomation(fresh({ system_id: 'ais-chem-triage' }));
    expect(r.code).toBe('invalid'); expect(r.message).toMatch(/published in the register/);
  });
});

describe('FS80 · RBAC: ai_literacy W/Own submit, A (AI governance) decides, R (staff) reads', () => {
  it('route guards: gallery and entry ai_literacy R, my builds Own, the review page A', () => {
    const g = (id: string) => routes.find((r) => r.id === id)!.guard;
    expect(g('workforce-ai-automations')).toMatchObject({ signedIn: true, grant: { res: 'ai_literacy', levels: ['R'] } });
    expect(g('workforce-ai-automation')).toMatchObject({ signedIn: true, grant: { res: 'ai_literacy', levels: ['R'] } });
    expect(g('my-ai-builds')).toMatchObject({ signedIn: true, grant: { res: 'ai_literacy', levels: ['Own'] } });
    expect(g('admin-ai-automations')).toMatchObject({ signedIn: true, grant: { res: 'ai_literacy', levels: ['A'] } });
  });
  it('reads (local RLS): staff see approved entries only; builders their own in every status; admins and auditors all; adoption rows only by the adopter', async () => {
    await as('buyer');
    const staffView = await b.list('automations' as never);
    expect(staffView.length).toBe(A.filter((a) => a.status === 'approved').length + raw('automations').filter((a) => a.builder_person_id === 'p-buyer' && a.status !== 'approved').length);
    expect((staffView as Row[]).filter((a) => a.builder_person_id !== 'p-buyer').every((a) => a.status === 'approved')).toBe(true);
    await as('nse');
    expect((await b.list('automations' as never) as Row[]).some((a) => a.id === 'atm-supplier-followup-agent' && a.status === 'returned')).toBe(true);
    await as('k-auditor');
    expect((await b.list('automations' as never)).length).toBe(raw('automations').length);
    await as('outage-planner');
    const ads = await b.list('automation_adoptions' as never) as Row[];
    expect(ads.length).toBeGreaterThanOrEqual(1);
    expect(ads.every((x) => x.person_id === 'p-outage-planner')).toBe(true);
    await as(null);
    expect((await b.list('automations' as never)).length).toBe(0);
  });
  it('partners cannot submit; staff cannot decide; the training manager cannot decide', async () => {
    await as('alnoor-gm');
    expect((await b.rpc.submitAutomation(fresh())).code).toBe('forbidden');
    await as('buyer');
    expect((await b.rpc.decideAutomation({ id: 'atm-eng-change-impact', decision: 'approve' })).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.decideAutomation({ id: 'atm-eng-change-impact', decision: 'approve' })).message).toBe(ATM_MSG.forbidden_decide);
  });
  it('maker-checker: AI governance never decides an entry it built or owns; a second admin does; return and reject need a reason', async () => {
    await as('ai-governance');
    const own = await b.rpc.submitAutomation(fresh({ owner_person_id: 'p-ai-governance', title_en: 'Register review reminder', title_ar: 'تذكير مراجعة السجل' }));
    expect(own.ok).toBe(true);
    expect((await b.rpc.decideAutomation({ id: own.data!.id, decision: 'approve' })).code).toBe('maker_checker');
    expect((await b.rpc.decideAutomation({ id: 'atm-fuel-shipment-letter', decision: 'return' })).message).toBe(ATM_MSG.note);
    await as('k-admin');
    expect((await b.rpc.decideAutomation({ id: own.data!.id, decision: 'approve' })).ok).toBe(true);
    expect(decisionProblem({ status: 'submitted', builder_person_id: 'p-x', owner_person_id: 'p-o' }, 'approve', null, 'p-o')).toBe('maker_checker');
    expect(decisionProblem({ status: 'approved', builder_person_id: 'p-x', owner_person_id: 'p-o' }, 'approve', null, 'p-g')).toBe('state');
  });
  it('adoption: never the builder, once per person, and only from the entry\'s minimum FS09 rung', async () => {
    expect(adoptProblem({ status: 'approved', builder_person_id: 'p-a', min_rung: 1 }, { person_id: 'p-a', rung: 3 }, false)).toBe('own_build');
    expect(adoptProblem({ status: 'approved', builder_person_id: 'p-a', min_rung: 1 }, { person_id: 'p-b', rung: 3 }, true)).toBe('already');
    expect(adoptProblem({ status: 'approved', builder_person_id: 'p-a', min_rung: 3 }, { person_id: 'p-b', rung: 2 }, false)).toBe('rung_low');
    await as('outage-planner');
    expect((await b.rpc.adoptAutomation({ id: 'atm-outage-lookahead' })).code).toBe('own_build');
    expect((await b.rpc.adoptAutomation({ id: 'atm-shift-turnover-brief' })).code).toBe('already');
  });
  it('the builder edits only a draft or returned entry; someone else\'s entry reads as not found; a returned entry resubmits as a new version', async () => {
    await as('nse');
    expect((await b.rpc.submitAutomation(inputOf(A.find((a) => a.id === 'atm-requisition-spec-check')!))).code).toBe('locked');
    const fixed = await b.rpc.submitAutomation({ ...inputOf(A.find((a) => a.id === 'atm-supplier-followup-agent')!), data_classes: ['internal'],
      data_used_en: 'The meeting action list (internal); supplier contact details stay in the supplier record.', oversight_en: 'The specification engineer reads and sends each email herself.' });
    expect(fixed.ok).toBe(true); expect(fixed.data).toMatchObject({ status: 'submitted', version: 2 });
    await as('buyer');
    expect((await b.rpc.submitAutomation(inputOf(A.find((a) => a.id === 'atm-oe-lesson-quiz')!, 'draft'))).code).toBe('not_found');
  });
});

describe('FS80 · statistics, seed and i18n', () => {
  it('galleryStats suppresses people counts under 10 and never breaks out security, safeguards or cyber; HR and governance only', async () => {
    const s = galleryStats(A as never, AD as never, 10);
    expect(s.families.every((f) => f.adopters === null || f.adopters >= 10)).toBe(true);
    expect(s.families.some((f) => ['security', 'safeguards', 'cyber'].includes(f.family_id))).toBe(false);
    expect(s.builders === null || s.builders >= 10).toBe(true);
    expect(s.adoptions).toBe(AD.length);
    await as('buyer'); expect(await b.rpc.automationStats()).toBeNull();
    await as('chco'); expect((await b.rpc.automationStats())?.approved).toBeGreaterThanOrEqual(10);
  });
  it('the seed has every status, counters equal adoption rows, never the builder, and the gallery order is not personal', () => {
    for (const s of AUTOMATION_STATUSES) expect(A.some((a) => a.status === s)).toBe(true);
    for (const a of A) expect(a.adoption_count).toBe(AD.filter((x) => x.automation_id === a.id).length);
    expect(AD.some((x) => A.find((a) => a.id === x.automation_id)!.builder_person_id === x.person_id)).toBe(false);
    expect(new Set(AD.map((x) => `${x.automation_id}|${x.person_id}`)).size).toBe(AD.length);
    const listed = A.filter((a) => a.status === 'approved');
    expect(sortGallery(listed as never).map((a) => a.id)).toEqual(sortGallery([...listed].reverse() as never).map((a) => a.id));
    expect(A.every((a) => automationProblem(inputOf(a, a.status === 'draft' ? 'draft' : 'submit'), { systems: sys.map((s) => (a.status === 'retired' && s.id === a.system_id ? { ...s, status: 'published' } : s)), staff: staffIds }) === null)).toBe(true);
  });
  it('EN and AR keys are in parity for the gallery, and every route has a title and purpose in both languages', () => {
    const flat = (o: Row, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(flat((ar as Row).atm).sort()).toEqual(flat((en as Row).atm).sort());
    for (const id of ['workforce-ai-automations', 'workforce-ai-automation', 'my-ai-builds', 'admin-ai-automations']) {
      expect(routes.some((r) => r.id === id)).toBe(true);
      for (const d of [en, ar] as Row[]) { expect(d.routes[id].title).toBeTruthy(); expect(d.routes[id].purpose).toBeTruthy(); }
    }
    expect(flat((ar as Row).atm).every((k) => String(k.split('.').reduce((o: Row, x) => o[x], (ar as Row).atm)).trim().length > 0)).toBe(true);
  });
});
