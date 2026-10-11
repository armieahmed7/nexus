/** FS36 AI-literacy register + FS37 governed AI sandbox drills (FS wave D · E5, M29): one test per acceptance criterion on the local
 *  path, plus the shared rules, RBAC, the seed and i18n. The SQL path (kafaa_air_coverage = coverage(), kafaa_dr_score = scoreDrill(),
 *  problem checks, stats, RLS, live RPC flows, grants) is proved by scripts/validate/fs45-ai-register.mjs (PGlite). */
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m29.en.json';
import ar from '../../src/i18n/m29.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m29/routes';
import { aiRung, type RungCell, type SkillTrackRow } from '../../src/modules/m29/fluency';
import { PACK_STATEMENT, THRESHOLD, buildPack, coverage, hasClaim, packRows, rawSystemPct, systemProblem, type GroupLite, type PersonRung } from '../../src/modules/m29/register';
import { DRILL_EVIDENCE_CAP, ERROR_KINDS, drillProblem, drillStats, normFlags, scoreDrill, submissionProblem, type DrillKey } from '../../src/modules/m29/drills';
import { RECORDED_REF_TABLES, isRecordedEvidence } from '../../src/domain/skills';
import { todayIso } from '../../src/domain/rules';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = seed as unknown as { tables: Record<string, Row[]>; personas: Row[] };
const T = S.tables;
const cells = T.ai_rungs.map((c) => ({ id: c.id, rung: c.rung, dimension: c.dimension }));
const lit = T.ai_skill_tracks.filter((t) => t.track === 'literacy').map((t) => t.skill_id as string);
const keyOf = (id: string): DrillKey => { const k = T.ai_drill_keys.find((x) => x.drill_id === id)!; return { errors: k.errors, protocol: k.protocol, pass_pct: k.pass_pct }; };
const staffIds = T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id as string);
const perfect = (id: string) => { const k = keyOf(id); return { drill_id: id, flags: k.errors.map((e) => ({ segment_id: e.segment_id, kind: e.kind })), answers: k.protocol.map((x) => ({ id: x.id, choice: x.correct })) }; };
const rungsFrom = (states: Row[]): PersonRung[] => {
  const by = new Map<string, Row[]>();
  for (const s of states) if (s.active) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)!).push(s);
  return T.people.filter((p) => p.kind === 'staff' && p.status === 'active').sort((a, b) => (a.id < b.id ? -1 : 1)).map((p) => {
    const r = aiRung(p.id, T.ai_rungs as unknown as RungCell[], T.ai_skill_tracks as unknown as SkillTrackRow[], (by.get(p.id) ?? []) as never);
    return { person_id: p.id, family_id: p.job_family_id ?? null, rung: r.rung, met: r.cells.filter((c) => c.met).map((c) => c.id) };
  });
};

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

describe('FS36 · coverage is computed from FS09 rungs, never entered by hand (acceptance 1)', () => {
  it('the register tables have no coverage, percentage or count column to type a number into', () => {
    for (const t of ['ai_systems', 'ai_system_users']) expect(Object.keys(SCHEMA[t].cols).filter((c) => /cov|pct|percent|count|covered|users_n/.test(c))).toEqual([]);
  });
  it('aiLiteracyCoverage equals coverage() over aiRung of every active staff member (HR scope: the 6 published systems)', async () => {
    await as('chco');
    const v = await b.rpc.aiLiteracyCoverage();
    expect(v?.scope).toBe('all');
    const sys = (b.raw('ai_systems' as never) as unknown as Row[]).filter((s) => s.listed && s.status !== 'retired');
    const t = coverage(sys as never, (b.raw('ai_system_users' as never) as unknown as Row[]).map((g) => ({ ...g })) as GroupLite[], rungsFrom(b.raw('person_skills' as never) as unknown as Row[]), cells, 10, THRESHOLD);
    const { scope, as_of, ...rest } = v!;
    expect(rest).toEqual(t);
    expect(v!.systems.length).toBe(6);
  });
  it('coverage moves when people\'s evidence moves: removing 15 people\'s AI literacy states lowers it', async () => {
    const c = new LocalBackend(); await c.whenReady(); await c.reset();
    c.setPersona('chco'); await c.whenReady();
    const before = (await c.rpc.aiLiteracyCoverage())!.systems.find((x) => x.system_id === 'ais-drafting')!;
    const rungs = rungsFrom(c.raw('person_skills' as never) as unknown as Row[]);
    const covered = rungs.filter((p) => p.rung >= 1).slice(0, 15).map((p) => p.person_id);
    for (const s of (c.raw('person_skills' as never) as unknown as Row[]).filter((x) => covered.includes(x.person_id) && lit.includes(x.skill_id) && x.active)) c.rawUpdate('person_skills' as never, s.id, { active: false } as never);
    const after = (await c.rpc.aiLiteracyCoverage())!.systems.find((x) => x.system_id === 'ais-drafting')!;
    expect(after.pct!).toBeLessThan(before.pct!);
    expect(after.covered! + 15).toBe(before.covered!);
  }, 120000);
  it('"fully implemented" must be carried by coverage: the seed label holds and the RPC refuses a full label under 80%', async () => {
    const people = rungsFrom(T.person_skills);
    for (const s of T.ai_systems.filter((x) => x.maturity === 'full')) expect(rawSystemPct(T.ai_system_users.filter((g) => g.system_id === s.id) as never, people)).toBeGreaterThanOrEqual(THRESHOLD);
    await as('ai-governance');
    const mn = T.ai_systems.find((s) => s.id === 'ais-meeting-notes')!;
    const r = await b.rpc.saveAiSystem({ ...(mn as Row), maturity: 'full', groups: T.ai_system_users.filter((g) => g.system_id === mn.id) as never } as never);
    expect(r.code).toBe('invalid');
    expect(r.message).toMatch(/80%/);
  });
});

describe('FS36 · groups under 10 are suppressed (acceptance 2)', () => {
  it('small groups show no n, covered, pct or gaps; big groups show cells of 10 or more only', async () => {
    await as('k-auditor');
    const v = (await b.rpc.aiLiteracyCoverage())!;
    const dalil = v.systems.find((x) => x.system_id === 'ais-dalil')!;
    const builders = dalil.groups.find((g) => g.group_id === 'ais-dalil-g2')!;
    expect(builders).toEqual({ group_id: 'ais-dalil-g2', n: null, covered: null, pct: null, gaps: [] });
    for (const s of v.systems) for (const g of s.groups) {
      expect(g.n === null || g.n >= 10).toBe(true);
      expect(g.covered === null || g.covered >= 10).toBe(true);
      for (const x of g.gaps) expect(x.n === null || x.n >= 10).toBe(true);
    }
    expect(v.systems.some((s) => s.system_id === 'ais-chem-triage')).toBe(true); // auditors see the draft entry
  });
  it('the rule itself: a 9-person group is suppressed, a 10-person group is shown', () => {
    const ppl = (n: number, fam: string) => Array.from({ length: n }, (_, i) => ({ person_id: `x${fam}${i}`, family_id: fam, rung: i % 3, met: [] as string[] }));
    const g = (id: string, fam: string): GroupLite => ({ id, system_id: 's', family_ids: [fam], all_staff: false, side: 'deployer', required_rung: 1, required_cells: [], active: true, sort: 1 });
    const c = coverage([{ id: 's', status: 'published', maturity: 'partial' }], [g('a', 'f9'), g('b', 'f10')], [...ppl(9, 'f9'), ...ppl(10, 'f10')], cells, 10);
    expect(c.systems[0].groups[0].pct).toBeNull();
    expect(c.systems[0].groups[1].pct).toBe(60);
    expect(c.systems[0].groups[1].covered).toBeNull(); // 6 covered: under 10
  });
});

describe('FS36 · the pack states that Kafa\'a is not a regulator and the alignment is voluntary (acceptance 3)', () => {
  it('buildPack carries the flags and the bilingual statement; the CSV carries it on every row', () => {
    const p = buildPack([{ id: 'ais-x', name_en: 'X', name_ar: 'س', ai_role: 'deployer', use_class: 'information', maturity: 'planned', simulated: true, owner_en: 'o', owner_ar: 'م', measures: [], groups: [{ id: 'g', label_en: 'G', label_ar: 'ج', side: 'deployer', required_rung: 1, required_cells: [] }], review_due: null, version: 1 }],
      null, todayIso(), [{ id: 'AI-LIT', url: 'https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices' }]);
    expect(p.not_a_regulator).toBe(true);
    expect(p.voluntary_alignment).toBe(true);
    expect(p.statement_en).toMatch(/not a regulator/);
    expect(p.statement_en).toMatch(/voluntary alignment/);
    expect(p.statement_en).toMatch(/does not grant a presumption of compliance/);
    expect(p.statement_ar).toContain('ليست جهة تنظيمية');
    expect(p.statement_ar).toContain('مواءمة طوعية');
    expect(PACK_STATEMENT.en).toBe(p.statement_en);
    expect(packRows(p).every((r) => /voluntary alignment; Kafa'a is not a regulator/.test(String(r.statement)))).toBe(true);
  });
  it('no register text may claim compliance or certification (EN and AR)', async () => {
    expect(hasClaim('This tool is certified')).toBe(true);
    expect(hasClaim('النظام ممتثل')).toBe(true);
    expect(T.ai_systems.every((s) => systemProblem({ ...(s as Row), owner_person_id: s.owner_person_id, groups: T.ai_system_users.filter((g) => g.system_id === s.id) as never } as never, { families: T.job_families.map((f) => f.id), cells, staff: staffIds }) === null)).toBe(true);
    await as('ai-governance');
    const s = T.ai_systems.find((x) => x.id === 'ais-dalil')!;
    const r = await b.rpc.saveAiSystem({ ...(s as Row), purpose_en: 'Fully compliant with the EU AI Act.', groups: T.ai_system_users.filter((g) => g.system_id === s.id) as never } as never);
    expect(r.code).toBe('invalid');
    expect(r.message).toMatch(/does not certify or declare compliance/);
  });
});

describe('FS36 · RBAC and register writes', () => {
  it('staff read the 6 published entries and see no coverage; owners see only their own system', async () => {
    await as('buyer');
    expect((await b.list('ai_systems' as never)).length).toBe(6);
    expect(await b.rpc.aiLiteracyCoverage()).toBeNull();
    await as('outage-manager');
    const v = await b.rpc.aiLiteracyCoverage();
    expect(v?.scope).toBe('owner');
    expect(v?.systems.map((x) => x.system_id)).toEqual(['ais-outage-optimiser']);
    await as(null);
    expect((await b.list('ai_systems' as never)).length).toBe(0);
  });
  it('only ai_literacy A (admin / AI governance) writes; an edit versions and deactivates removed groups; publishing writes the ledger', async () => {
    await as('training-mgr');
    const s = T.ai_systems.find((x) => x.id === 'ais-pdm-advisor')!;
    const groups = T.ai_system_users.filter((g) => g.system_id === s.id);
    expect((await b.rpc.saveAiSystem({ ...(s as Row), groups: groups as never } as never)).code).toBe('forbidden');
    await as('ai-governance');
    const led0 = (b.raw('ledger_local' as never) as unknown as Row[]).length;
    const r = await b.rpc.saveAiSystem({ ...(s as Row), groups: [groups[0]] as never } as never);
    expect(r.ok).toBe(true);
    expect(r.data!.version).toBe(2);
    const after = (b.raw('ai_system_users' as never) as unknown as Row[]).filter((g) => g.system_id === s.id);
    expect(after.length).toBe(2);
    expect(after.find((g) => g.id === groups[1].id)!.active).toBe(false);
    expect((b.raw('ledger_local' as never) as unknown as Row[]).length).toBe(led0 + 1);
  });
});

describe('FS37 · scoring (identical in TS and SQL: acceptance 1)', () => {
  it('every seeded attempt replays exactly with scoreDrill (SQL parity is proved by the PGlite validator)', () => {
    for (const a of T.ai_drill_attempts) {
      const d = T.ai_drills.find((x) => x.id === a.drill_id)!;
      const s = scoreDrill(keyOf(a.drill_id), a.flags, a.answers, d.level);
      expect([s.pct, s.passed, s.level, s.found]).toEqual([a.pct, a.passed, a.level, a.found]);
    }
  });
  it('the rule: points, false flags, critical steps, pass mark and level', () => {
    const k = keyOf('ad-mov-pm');
    const all = perfect('ad-mov-pm');
    const p = scoreDrill(k, all.flags, all.answers, 2);
    expect([p.points, p.max, p.pct, p.passed, p.level]).toEqual([20, 20, 100, true, 2]);
    const wrongKind = scoreDrill(k, all.flags.map((f) => ({ ...f, kind: 'invented' })), all.answers, 2);
    expect(wrongKind.kinds_right).toBe(0);
    expect(wrongKind.passed).toBe(true); // 12 + 8 = 16/20 = 80%
    expect(wrongKind.level).toBe(1); // under 85%
    const crit = scoreDrill(k, all.flags, all.answers.map((a) => (a.id === 'p-use' ? { ...a, choice: (a.choice + 1) % 3 } : a)), 2);
    expect(crit.critical_ok).toBe(false);
    expect(crit.passed).toBe(false);
    expect(crit.level).toBe(0);
    const extra = scoreDrill(k, [...all.flags, { segment_id: 's1', kind: 'invented' }, { segment_id: 's1', kind: 'wrong_value' }], all.answers, 2);
    expect(extra.false_flags).toBe(1); // duplicates on a segment count once
    expect(normFlags([{ segment_id: 's1', kind: 'a' }, { segment_id: 's1', kind: 'b' }])).toEqual([{ segment_id: 's1', kind: 'a' }]);
  });
  it('submitDrill (local) returns exactly the rule\'s score; the key never reaches staff before they submit', async () => {
    await as('k-ro');
    expect((await b.list('ai_drill_keys' as never)).length).toBe(0);
    const drills = await b.list('ai_drills' as never) as unknown as Row[];
    expect(drills.length).toBe(6);
    expect(JSON.stringify(drills)).not.toMatch(/"correct":|"critical":|"explain_en"/);
    const sub = { ...perfect('ad-feedwater-sample'), flags: perfect('ad-feedwater-sample').flags.slice(0, 3) };
    const r = await b.rpc.submitDrill(sub);
    const t = scoreDrill(keyOf('ad-feedwater-sample'), sub.flags, sub.answers, 2);
    expect(r.ok).toBe(true);
    expect([r.data!.pct, r.data!.passed, r.data!.level, r.data!.found]).toEqual([t.pct, t.passed, t.level, t.found]);
    expect(r.data!.reasons).toEqual(t.reasons);
  });
  it('submissions are checked: unknown segments, unknown kinds and unanswered steps are refused; drafts are closed', async () => {
    await as('k-ro');
    const d = T.ai_drills.find((x) => x.id === 'ad-valve-lineup')!;
    expect(submissionProblem(d as never, [{ segment_id: 'zz', kind: 'invented' }], [])).toBe('segment');
    expect(submissionProblem(d as never, [{ segment_id: 's1', kind: 'typo' }], [])).toBe('kind');
    expect(submissionProblem(d as never, [], [])).toBe('protocol');
    expect((await b.rpc.submitDrill({ ...perfect('ad-valve-lineup'), answers: [] })).code).toBe('invalid');
    expect((await b.rpc.submitDrill({ drill_id: 'ad-outage-scope', flags: [], answers: [] })).message).toBe('This drill is not open');
    await as('alnoor-gm');
    expect((await b.rpc.submitDrill(perfect('ad-valve-lineup'))).code).toBe('forbidden');
  });
});

describe('FS37 · all documents are synthetic and marked as such (acceptance 2)', () => {
  it('every seeded drill document has a SYN- code and SYNTHETIC in both languages; the output is labelled SIMULATED', () => {
    for (const d of T.ai_drills) {
      expect(d.synthetic).toBe(true);
      expect(d.doc.code).toMatch(/^SYN-[A-Z]{2}-\d{3}$/);
      expect(d.doc.title_en).toMatch(/SYNTHETIC/);
      expect(d.doc.title_ar).toMatch(/اصطناعي/);
      expect(d.output.tool_en).toMatch(/SIMULATED/);
    }
  });
  it('authoring refuses a non-synthetic code and plant-security wording; only the training manager authors', async () => {
    const d: Row = { ...(T.ai_drills[0] as Row), key: keyOf(T.ai_drills[0].id) };
    expect(drillProblem(d as never, lit)).toBeNull();
    expect(drillProblem({ ...d, doc: { ...d.doc, code: 'OP-114' } } as never, lit)).toBe('synthetic');
    expect(drillProblem({ ...d, scenario_en: 'Check the security plan first.' } as never, lit)).toBe('restricted');
    await as('ai-governance');
    expect((await b.rpc.saveDrill({ ...d, id: null, status: 'draft' } as never)).code).toBe('forbidden');
    await as('training-mgr');
    const r = await b.rpc.saveDrill({ ...d, id: null, status: 'draft' } as never);
    expect(r.ok).toBe(true);
    expect((b.rawGet('ai_drills' as never, r.data!.id) as unknown as Row).synthetic).toBe(true);
    expect((await b.rpc.saveDrill({ ...d, id: null, doc: { ...d.doc, code: 'DOC-1' } } as never)).message).toMatch(/synthetic/);
  });
});

describe('FS37 · evidence never exceeds level 2 (acceptance 3)', () => {
  it('2,000 generated submissions never score a level above 2, even with a level-3 drill setting', () => {
    let seedN = 7;
    const rand = () => { seedN = (seedN * 1103515245 + 12345) % 2147483648; return seedN / 2147483648; };
    for (let g = 0; g < 2000; g++) {
      const d = T.ai_drills[Math.floor(rand() * T.ai_drills.length)];
      const k = keyOf(d.id);
      const flags = d.output.segments.filter(() => rand() < 0.6).map((s: Row) => ({ segment_id: s.id, kind: ERROR_KINDS[Math.floor(rand() * 6)] }));
      const ek = new Map(k.errors.map((e) => [e.segment_id, e.kind]));
      if (rand() < 0.5) for (const f of flags) if (ek.has(f.segment_id)) f.kind = ek.get(f.segment_id) as never;
      const answers = k.protocol.map((x) => ({ id: x.id, choice: rand() < 0.8 ? x.correct : 0 }));
      expect(scoreDrill(k, flags, answers, rand() < 0.2 ? 3 : d.level).level).toBeLessThanOrEqual(DRILL_EVIDENCE_CAP);
    }
    expect(drillProblem({ ...(T.ai_drills[1] as never as Row), key: keyOf(T.ai_drills[1].id), level: 3 } as never, lit)).toBe('level');
    expect(T.skill_evidence.filter((e) => e.ref_table === 'ai_drill_attempts').every((e) => e.level >= 1 && e.level <= 2)).toBe(true);
  });
  it('a perfect level-2 drill writes level-2 evidence (the cap); a failed retake replaces it; recompute keeps recorded drill evidence', async () => {
    await as('k-ro');
    const pid = 'p-k-ro';
    const ok = await b.rpc.submitDrill(perfect('ad-shift-turnover'));
    expect(ok.data!.level).toBe(2);
    const ev = (b.raw('skill_evidence' as never) as unknown as Row[]).filter((e) => e.person_id === pid && e.ref_table === 'ai_drill_attempts' && e.ref_id === ok.data!.attempt_id);
    expect(ev.map((e) => [e.level, e.kind, e.active])).toEqual([[2, 'assessment', true]]);
    expect(isRecordedEvidence(ev[0] as never)).toBe(true);
    expect(RECORDED_REF_TABLES).toContain('ai_drill_attempts');
    await applySkills(b, pid, todayIso());
    expect((b.rawGet('skill_evidence' as never, ev[0].id) as unknown as Row).active).toBe(true);
    const fail = await b.rpc.submitDrill({ drill_id: 'ad-shift-turnover', flags: [], answers: keyOf('ad-shift-turnover').protocol.map((x) => ({ id: x.id, choice: (x.correct + 1) % 3 })) });
    expect(fail.data!.passed).toBe(false);
    expect(fail.data!.evidence).toEqual([]);
    expect((b.rawGet('skill_evidence' as never, ev[0].id) as unknown as Row).active).toBe(false);
  });
});

describe('FS37 · training statistics are suppressed under 10', () => {
  it('drillStats: training manager and HR only; every cell 10+ or null', async () => {
    await as('buyer');
    expect(await b.rpc.drillStats()).toBeNull();
    await as('training-mgr');
    const s = (await b.rpc.drillStats())!;
    expect(s.attempts).toBeGreaterThan(100);
    for (const d of s.drills) expect(d.people === null || d.people >= 10).toBe(true);
    for (const k of s.missed_kinds) expect(k.planted === null || k.planted >= 10).toBe(true);
    const small = drillStats(T.ai_drill_attempts.slice(0, 5) as never, ['ad-valve-lineup'], 10);
    expect(small.drills[0].pass_pct).toBeNull();
    expect(small.people).toBeNull();
  });
});

describe('FS36/FS37 · routes, seed and i18n', () => {
  it('7 new routes with the planned guards; the drill bank and pack are not public', () => {
    const ids = ['workforce-ai-register', 'workforce-ai-system', 'workforce-ai-pack', 'admin-ai-register', 'my-ai-drills', 'my-ai-drill', 'training-ai-drills'];
    for (const id of ids) {
      const r = routes.find((x) => x.id === id)!;
      expect(r).toBeTruthy();
      expect(r.guard.signedIn).toBe(true);
    }
    expect(routes.find((r) => r.id === 'admin-ai-register')!.guard.grant).toEqual({ res: 'ai_literacy', levels: ['A'] });
  });
  it('every new page text exists in English and Arabic', () => {
    const flat = (o: Row, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
    const e = flat(en as Row).filter((k) => /^(reg|sys|pack|adm|dr|drill|tdr)\./.test(k));
    const a = new Set(flat(ar as Row));
    expect(e.length).toBeGreaterThan(300);
    expect(e.filter((k) => !a.has(k))).toEqual([]);
  });
});
