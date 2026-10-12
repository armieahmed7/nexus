// @vitest-environment jsdom
/** FS58 Adaptive problem-solving practice + FS59 Role-play practice library with saved feedback (FS wave F · E5, M33): one test per
 *  acceptance criterion on the local path, plus the rules shared with SQL, RBAC, the seed and i18n. The SQL path (TS = SQL parity for
 *  kafaa_aps_judge / score / pick / next_reasons / problem / stats_core and kafaa_rp_norm / speak_up / eval / summary / problem / stats_core;
 *  RLS; live RPC flows; handover 3.9) is checked by scripts/validate/fs65-aps-roleplay.mjs (PGlite). jsdom: the persistence check reads
 *  the LocalBackend snapshot back from localStorage. */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m33.en.json';
import ar from '../../src/i18n/m33.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m33/routes';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { RECORDED_REF_TABLES } from '../../src/domain/skills';
import {
  APS_BANDS, APS_THEMES, apsPct, apsScenarioProblem, apsStats, bandOf, changeCount, judgeStage, pickScenario, responseOf, scoreAps, stageView,
  type ApsScenario,
} from '../../src/modules/m33/aps';
import {
  RP_KINDS, cueHit, evaluateTurn, rpNorm, rpScenarioProblem, speakUpTopic, summarise, evidenceSkills, type RpScenario,
} from '../../src/modules/m33/roleplay';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = seed as unknown as { tables: Record<string, Row[]>; personas: Row[] };
const T = S.tables;
const apsBank = T.aps_scenarios as unknown as ApsScenario[];
const rpBank = T.roleplay_scenarios as unknown as RpScenario[];
const coreIds = T.core_skills.map((c) => c.id as string);
const skillIds = T.skills.map((s) => s.id as string);
const evSkills = evidenceSkills(skillIds, new Map(T.skills.map((s) => [s.id as string, s as never])));
const AR = /[؀-ۿ]/;
const flat = (o: Row, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const snapshot = () => Object.fromEntries(Object.keys(SCHEMA).map((t) => [t, JSON.stringify(b.raw(t as never))]));
const changedTables = (before: Record<string, string>) => Object.keys(before).filter((t) => before[t] !== JSON.stringify(b.raw(t as never)));
beforeEach(async () => {
  try { localStorage.clear(); } catch { /* ignore */ }
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

/** Run one APS scenario to the end through the RPCs, always taking the expert's best option and judging every fact right. */
async function runBest(scenarioId: string | null) {
  const st = await b.rpc.startAps({ scenario_id: scenarioId });
  expect(st.ok, st.message).toBe(true);
  let step = st.data!;
  const sc = apsBank.find((x) => x.id === step.scenario.id)!;
  while (!step.done) {
    const stage = sc.stages.find((x) => x.id === step.stage!.id)!;
    const best = stage.options.findIndex((o) => o.eff === 3);
    const picks = (stage.cues ?? []).map((c, i) => (c.relevant ? i : -1)).filter((i) => i >= 0);
    const r = await b.rpc.submitAps({ attempt_id: step.attempt_id, stage_id: stage.id, choice: best, picks });
    expect(r.ok, r.message).toBe(true);
    step = r.data!;
  }
  return step;
}

describe('FS58 acceptance', () => {
  it('every scenario has at least one mid-task change (seed, the rule, the save RPC)', async () => {
    expect(apsBank.length).toBeGreaterThanOrEqual(6);
    for (const sc of apsBank) {
      expect(changeCount(sc), sc.id).toBeGreaterThanOrEqual(1);
      expect(sc.stages[0].kind).toBe('initial');
      expect(sc.stages.slice(1).every((x) => x.kind === 'change'), sc.id).toBe(true);
      expect(apsScenarioProblem(sc, { coreSkillIds: coreIds, skillIds }), sc.id).toBeNull();
    }
    const flatPlan = { ...apsBank[0], stages: [apsBank[0].stages[0]] };
    expect(apsScenarioProblem(flatPlan, { coreSkillIds: coreIds, skillIds })).toBe('stages');
    const noChange = { ...apsBank[0], stages: apsBank[0].stages.map((x) => ({ ...x, kind: 'initial' as const })) };
    expect(apsScenarioProblem(noChange, { coreSkillIds: coreIds, skillIds })).toBe('no_change');
    await as('training-mgr');
    const r = await b.rpc.saveApsScenario({ ...noChange, id: null, code: 'APS-ZZ-009' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('invalid');
    expect(SCHEMA.aps_scenarios.read).toEqual([{ res: 'secure_items' }]);
  });
  it('the change is revealed only after the previous answer, and the key only after each answer', async () => {
    await as('k-lo-trainee');
    const st = await b.rpc.startAps({ scenario_id: 'aps-os-001' });
    expect(st.ok).toBe(true);
    const sc = apsBank.find((x) => x.id === 'aps-os-001')!;
    expect(st.data!.stage!.id).toBe(sc.stages[0].id);
    const payload = JSON.stringify(st.data);
    expect(payload).not.toContain(sc.stages[1].info_en);
    expect(payload).not.toMatch(/"eff"|"relevant"|"debrief_en"|"note_en"|"keep"/);
    expect(st.data!.feedback).toBeNull();
    // the stage view itself never carries the key
    expect(JSON.stringify(stageView(sc.stages[1]))).not.toMatch(/"eff"|"relevant"|debrief|note_/);
    const r = await b.rpc.submitAps({ attempt_id: st.data!.attempt_id, stage_id: sc.stages[0].id, choice: 0, picks: [] });
    expect(r.ok).toBe(true);
    expect(r.data!.feedback).toEqual(judgeStage(sc.stages[0], 0, []));
    expect(r.data!.stage!.id).toBe(sc.stages[1].id);
    expect(r.data!.stage!.kind).toBe('change');
    // a stage not on screen is refused
    const skip = await b.rpc.submitAps({ attempt_id: st.data!.attempt_id, stage_id: sc.stages[sc.stages.length - 1].id === sc.stages[1].id ? 'zz' : sc.stages[2].id, choice: 0, picks: [] });
    expect(skip.ok).toBe(false);
  });
  it('results never gate a qualification: a full run writes only the practice row and an audit row (no evidence, no qualification, no ledger)', async () => {
    await as('k-lo-trainee');
    const before = snapshot();
    const done = await runBest('aps-cd-001');
    expect(done.done).toBe(true);
    expect(done.result!.score).toBe(100);
    expect(done.result!.band).toBe('strategic');
    expect(changedTables(before).sort()).toEqual(['aps_attempts', 'audit_events']);
    expect(JSON.stringify(done.result!.reasons)).toContain('aps_private');
    // no qualification, authorisation or talent table is touched by the module's local code either
    const src = (await import('../../src/modules/m33/backend/local.fs65.ts?raw')).default as string;
    const apsPart = src.slice(src.indexOf('startAps'), src.indexOf('startRoleplay'));
    expect(apsPart).not.toMatch(/'(skill_evidence|qualifications?|person_qualifications|authorizations|recognitions|talent_[a-z_]+|ledger[a-z_]*)'/);
  });
  it('each result shows a benchmark line and the scale definition: bands cover 0-100, the PIAAC figure is in the registry', () => {
    let next = 0;
    for (const band of APS_BANDS) { expect(band.min).toBe(next); next = band.max + 1; }
    expect(next).toBe(101);
    for (let s = 0; s <= 100; s++) expect(APS_BANDS.find((x) => s >= x.min && s <= x.max)!.id).toBe(bandOf(s));
    const piaac = T.benchmarks.find((x) => x.id === 'OECD-PIAAC')!;
    const fig = (piaac.figures as Row[]).find((f) => f.key === 'aps_oecd_average')!;
    expect(fig.value).toBe(251);
    expect(fig.scale_max).toBe(500);
    expect(FEATURE_BENCHMARKS.FS58).toEqual(['OECD-PIAAC', 'IAEA-1917']);
    // the scale is defined in both languages, with the note that PIAAC is a different scale (never converted)
    for (const d of [en, ar] as Row[]) {
      expect(d.aps.scale.note.length).toBeGreaterThan(80);
      expect(d.aps.scale.piaacNote.length).toBeGreaterThan(40);
      for (const band of APS_BANDS) expect(d.aps.band[band.id] && d.aps.bandSub[band.id]).toBeTruthy();
    }
    expect(en.aps.scale.piaacNote).toMatch(/different scale|never converted/);
  });
});

describe('FS58 rules and RBAC', () => {
  it('scoring: half-up percentage, three dimensions, overreacting and holding are both scored', () => {
    expect(apsPct(1, 3)).toBe(33);
    expect(apsPct(1, 2)).toBe(50);
    expect(apsPct(0, 0)).toBe(0);
    const sc = apsBank.find((x) => x.id === 'aps-cd-001')!;
    const keepStage = sc.stages.find((x) => x.kind === 'change' && x.options.some((o) => o.keep && o.eff === 3));
    expect(keepStage, 'a change where keeping the plan is best').toBeTruthy();
    const wrong = keepStage!.options.findIndex((o) => !o.keep);
    const fb = judgeStage(keepStage!, wrong, []);
    expect(fb.best_keep).toBe(true);
    const sco = scoreAps([responseOf(fb)]);
    expect(sco.reasons.map((r) => r.code)).toContain('aps_overreact');
    expect(sco.dims.adapt.pct).toBe(apsPct(fb.eff * 2, 6));
  });
  it('the suggestion ranks content, never people: least-practised first, rotated per person', () => {
    const pub = apsBank.filter((x) => x.status === 'published');
    const first = pickScenario(pub, new Map(), 1, 3)!;
    expect(pub.map((x) => x.id)).toContain(first);
    const done = new Map(pub.map((x) => [x.id, x.id === first ? 0 : 2]));
    expect(pickScenario(pub, done, 2, 3)).toBe(first);
    expect(pickScenario(pub, new Map(), 1, 4)).not.toBe(first);
  });
  it('Own only: nobody else reads my runs or submits to them; HR gets the aggregate, a line manager nothing; only the training manager edits', async () => {
    for (const p of ['chco', 'sro', 'training-mgr', 'k-instructor', 'qc-inspector']) {
      await as(p);
      const me = b.identity().personId;
      expect(((await b.list('aps_attempts' as never)) as Row[]).every((r) => r.person_id === me), p).toBe(true);
    }
    expect(SCHEMA.aps_attempts.read).toEqual([{ res: 'own_profile', person: 'person_id' }]);
    await as('nse');
    const open = (await b.list('aps_attempts' as never)) as Row[];
    const mine = open.find((r) => r.status === 'in_progress')!;
    expect(mine).toBeTruthy();
    await as('k-lo-trainee');
    const r = await b.rpc.submitAps({ attempt_id: mine.id, stage_id: (mine.stage_ids as string[])[0], choice: 0, picks: [] });
    expect(r.ok).toBe(false);
    await as('chco');
    const agg = await b.rpc.apsStats();
    expect(agg).not.toBeNull();
    expect(agg!.participants).toBeGreaterThanOrEqual(10);
    expect(JSON.stringify(agg)).not.toMatch(/"p-|person_id/);
    expect(agg!.bands.every((x) => x.people == null || x.people >= 10)).toBe(true);
    expect(agg).toEqual(apsStats(T.aps_attempts as never, b.raw('people' as never) as never, apsBank, '2026-10-08', 10));
    await as('sro');
    expect(await b.rpc.apsStats()).toBeNull();
    await as('k-instructor');
    const sc = apsBank[0];
    const ed = await b.rpc.saveApsScenario({ ...sc, id: sc.id, status: 'published' });
    expect(ed.ok).toBe(false);
    expect(ed.code).toBe('forbidden');
    await as('training-mgr');
    const ok = await b.rpc.saveApsScenario({ ...sc, id: sc.id, status: 'published', title_en: `${sc.title_en} (rev)` });
    expect(ok.ok, ok.message).toBe(true);
    expect(ok.data!.version).toBe(Number((sc as Row).version) + 1);
  });
  it('seed: synthetic runs across quarters, one open run for the demo NSE, eight themes named in both languages', () => {
    expect(T.aps_attempts.length).toBeGreaterThan(100);
    expect(new Set(T.aps_attempts.map((a) => a.person_id)).size).toBeGreaterThanOrEqual(20);
    expect(T.aps_attempts.filter((a) => a.person_id === 'p-nse' && a.status === 'in_progress').length).toBe(1);
    for (const a of T.aps_attempts.filter((x) => x.status === 'completed')) expect(bandOf(a.score)).toBe(a.band);
    for (const th of APS_THEMES) { expect((en.aps.theme as Row)[th]).toBeTruthy(); expect(AR.test((ar.aps.theme as Row)[th])).toBe(true); }
  });
});

describe('FS59 acceptance', () => {
  it('feedback history persists and is visible only to its owner', async () => {
    await as('qc-inspector');
    const st = await b.rpc.startRoleplay({ scenario_id: 'rp-pb-01' });
    expect(st.ok, st.message).toBe(true);
    const sc = rpBank.find((x) => x.id === 'rp-pb-01')!;
    let step = st.data!;
    while (!step.done) {
      const turn = sc.turns.find((x) => x.id === step.turn!.id)!;
      const r = await b.rpc.roleplayTurn({ session_id: step.session_id, turn_id: turn.id, text: turn.example_en });
      expect(r.ok, r.message).toBe(true);
      step = r.data!;
    }
    const sid = step.session_id;
    expect(step.result!.ready).toBe(true);
    // persists: the LocalBackend snapshot written to storage reads back in a new backend with the full ticks
    window.dispatchEvent(new Event('pagehide'));
    const again = new LocalBackend();
    again.setPersona('qc-inspector');
    await again.whenReady();
    const back = ((await again.list('roleplay_sessions' as never)) as Row[]).find((r) => r.id === sid)!;
    expect(back.status).toBe('completed');
    expect(back.turns.length).toBe(sc.turns.length);
    // owner-only: line managers, HR, the training manager, instructors and other staff read none of it
    for (const p of ['sro', 'chco', 'training-mgr', 'k-instructor', 'nse', 'k-ro']) {
      await as(p);
      const rows = (await b.list('roleplay_sessions' as never)) as Row[];
      expect(rows.some((r) => r.id === sid), p).toBe(false);
      expect(rows.every((r) => r.person_id === b.identity().personId), p).toBe(true);
    }
    expect(SCHEMA.roleplay_sessions.read).toEqual([{ res: 'own_profile', person: 'person_id' }]);
    // the seeded history is there for the owner
    await as('k-ro');
    expect(((await b.list('roleplay_sessions' as never)) as Row[]).map((r) => r.id).sort()).toEqual(['rp-s-0001', 'rp-s-0002']);
  });
  it('speak-up topics route to the existing channel and are never stored: no row, no audit, no ledger, no text anywhere (no telemetry)', async () => {
    const real = 'Honestly my supervisor told me to falsify the log last night zq7speak';
    expect(speakUpTopic(real)).toBe(true);
    expect(speakUpTopic('اريد الابلاغ عن تحرش من زميل')).toBe(true);
    expect(speakUpTopic('I would raise a concern with the shift supervisor and speak up early')).toBe(false);
    expect(routes.find((r) => r.path === '/speak-up')).toBeUndefined(); // the channel is M08's existing route
    await as('buyer');
    const open = ((await b.list('roleplay_sessions' as never)) as Row[]).find((r) => r.status === 'in_progress')!;
    const st = await b.rpc.startRoleplay({ scenario_id: open.scenario_id });
    expect(st.ok).toBe(true);
    const before = snapshot();
    const r = await b.rpc.roleplayTurn({ session_id: st.data!.session_id, turn_id: st.data!.turn!.id, text: real });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('speak_up');
    expect(r.audit_seq ?? null).toBeNull();
    expect((r.data as unknown as Row).route).toBe('/speak-up');
    expect(changedTables(before)).toEqual([]);
    expect(Object.values(snapshot()).some((s) => s.includes('zq7speak'))).toBe(false);
    // the review context gets the same treatment
    await as('k-ro');
    const before2 = snapshot();
    const q = await b.rpc.requestRoleplayReview({ session_id: 'rp-s-0002', reviewer_id: 'p-training-mgr', context: real });
    expect(q.code).toBe('speak_up');
    expect(changedTables(before2)).toEqual([]);
  });
  it('every scenario has a published rubric in EN and AR', () => {
    const pub = rpBank.filter((x) => x.status === 'published');
    expect(pub.map((x) => x.kind).sort()).toEqual([...RP_KINDS].sort());
    for (const sc of rpBank) {
      expect(rpScenarioProblem(sc, { coreSkillIds: coreIds, evidenceSkillIds: evSkills }), sc.id).toBeNull();
      expect(sc.rubric.length).toBeGreaterThanOrEqual(3);
      for (const c of sc.rubric) {
        expect(c.label_en && c.desc_en && c.tip_en, `${sc.id}/${c.id}`).toBeTruthy();
        expect(AR.test(c.label_ar) && AR.test(c.desc_ar) && AR.test(c.tip_ar), `${sc.id}/${c.id}`).toBe(true);
      }
    }
    expect(rpScenarioProblem({ ...rpBank[0], rubric: rpBank[0].rubric.map((c, i) => (i ? c : { ...c, desc_ar: '' })) }, { coreSkillIds: coreIds, evidenceSkillIds: evSkills })).toBe('criterion');
    // published scenarios are readable by staff (internal_content where listed); drafts by training staff only
    expect(SCHEMA.roleplay_scenarios.read).toEqual(expect.arrayContaining([{ res: 'secure_items' }]));
  });
});

describe('FS59 rules, review and evidence', () => {
  it('the example answers meet every criterion in both languages; whole-word and prefix cues; text is never stored', async () => {
    for (const sc of rpBank) for (const turn of sc.turns) for (const lang of ['en', 'ar'] as const) {
      const res = evaluateTurn(turn, sc.rubric, turn[`example_${lang}`]);
      expect(res.criteria.every((c) => c.pass), `${sc.id}/${turn.id}/${lang}`).toBe(true);
    }
    expect(cueHit(rpNorm('We will ESCALATE now'), 'escalat*')).toBe(true);
    expect(cueHit(rpNorm('descalate'), 'escalat*')).toBe(false);
    expect(rpNorm('إذاً، الإجراء!')).toBe(' اذا الاجراء ');
    await as('buyer');
    const open = ((await b.list('roleplay_sessions' as never)) as Row[]).find((r) => r.status === 'in_progress')!;
    const st = await b.rpc.startRoleplay({ scenario_id: open.scenario_id });
    const r = await b.rpc.roleplayTurn({ session_id: st.data!.session_id, turn_id: st.data!.turn!.id, text: 'We stop and check the procedure step first xq9answer' });
    expect(r.ok, r.message).toBe(true);
    expect(Object.values(snapshot()).some((s) => s.includes('xq9answer'))).toBe(false);
  });
  it('review: a named eligible reviewer only (never myself); only that reviewer decides; maker-checker; a decline needs a reason', async () => {
    await as('k-ro');
    const revs = (await b.rpc.roleplayReviewers())!;
    expect(revs.map((r) => r.id)).toContain('p-training-mgr');
    expect(revs.map((r) => r.id)).not.toContain('p-k-ro');
    expect((await b.rpc.requestRoleplayReview({ session_id: 'rp-s-0002', reviewer_id: 'p-nse', context: 'Before my next outage brief' })).ok).toBe(false);
    const ok = await b.rpc.requestRoleplayReview({ session_id: 'rp-s-0002', reviewer_id: 'p-k-instructor', context: 'Before my next outage brief' });
    expect(ok.ok, ok.message).toBe(true);
    expect((await b.rpc.requestRoleplayReview({ session_id: 'rp-s-0002', reviewer_id: 'p-k-instructor', context: 'Again please' })).code).toBe('conflict');
    await as('training-mgr');
    const other = await b.rpc.attachRoleplayEvidence({ session_id: 'rp-s-0002', decision: 'validate' });
    expect(other.ok).toBe(false);
    expect((await b.rpc.roleplayReviewQueue())!.items.some((x) => x.session_id === 'rp-s-0002')).toBe(false);
    await as('k-instructor');
    const queue = (await b.rpc.roleplayReviewQueue())!;
    const item = queue.items.find((x) => x.session_id === 'rp-s-0002')!;
    expect(item.review_context).toBe('Before my next outage brief');
    expect(JSON.stringify(item)).not.toMatch(/example_en|"text"/);
    expect((await b.rpc.attachRoleplayEvidence({ session_id: 'rp-s-0002', decision: 'decline', note: '' })).ok).toBe(false);
    await as('nse');
    expect((await b.rpc.attachRoleplayEvidence({ session_id: 'rp-s-0003', decision: 'validate' })).code).toBe('forbidden');
  });
  it('attach after validation: rating evidence, basis validated, ref_table roleplay_sessions (handover 3.9), skills recomputed, one ledger row', async () => {
    expect(RECORDED_REF_TABLES).toContain('roleplay_sessions');
    const seeded = T.skill_evidence.filter((e) => e.ref_table === 'roleplay_sessions');
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.every((e) => e.kind === 'rating' && e.basis === 'validated' && e.level >= 1 && e.level <= 2)).toBe(true);
    await as('training-mgr');
    const ledgerBefore = b.raw('ledger_local' as never).length;
    const r = await b.rpc.attachRoleplayEvidence({ session_id: 'rp-s-0003', decision: 'validate', note: 'Clear turnover with numbers' });
    expect(r.ok, r.message).toBe(true);
    expect(r.data!.review_status).toBe('validated');
    const ev = (b.raw('skill_evidence' as never) as Row[]).filter((e) => r.data!.evidence_ids.includes(e.id));
    expect(ev.length).toBe(r.data!.evidence_ids.length);
    expect(ev.every((e) => e.person_id === 'p-nse' && e.kind === 'rating' && e.basis === 'validated' && e.ref_table === 'roleplay_sessions' && e.ref_id === 'rp-s-0003')).toBe(true);
    expect(b.raw('ledger_local' as never).length).toBe(ledgerBefore + 1);
    const st = (b.raw('person_skills' as never) as Row[]).filter((x) => x.person_id === 'p-nse' && ev.some((e) => e.skill_id === x.skill_id));
    expect(st.length).toBe(ev.length);
    // the person is told; the session is now evidence in their own history
    expect((b.raw('notifications' as never) as Row[]).some((n) => n.id === 'nt-rp-rp-s-0003-validated')).toBe(true);
    expect(evSkills.every((id) => { const s = T.skills.find((x) => x.id === id)!; return s.area !== 'security' && s.fs_area !== 'cyber_hygiene'; })).toBe(true);
  });
  it('summary: pooled criteria rate, the scenario mark and reasons; HR aggregate suppressed under 10, a line manager nothing', async () => {
    const sc = rpBank.find((x) => x.id === 'rp-kt-01')!;
    const s1 = summarise([{ turn_id: sc.turns[0].id, criteria: sc.turns[0].criteria.map((id) => ({ id, pass: false })), words: 4 }], sc.rubric, sc.pass_pct);
    expect(s1.ready).toBe(false);
    expect(s1.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(['rp_score', 'rp_not_ready', 'rp_private']));
    await as('chco');
    const agg = (await b.rpc.roleplayStats())!;
    expect(agg.participants).toBeGreaterThanOrEqual(10);
    expect(agg.by_kind.every((k) => k.people == null || k.people >= 10)).toBe(true);
    expect(JSON.stringify(agg)).not.toMatch(/"p-|person_id/);
    await as('sro');
    expect(await b.rpc.roleplayStats()).toBeNull();
  });
});

describe('FS58/FS59 routes, chips and copy', () => {
  it('seven routes with the right guards and chips; EN/AR parity; no gamification wording; no regulatory claims', () => {
    const want: Record<string, string> = {
      'my-problem-solving': 'skills_profile', 'training-aps-scenarios': 'secure_items', 'learn-role-play': 'internal_content', 'my-role-play': 'skills_profile',
      'my-role-play-scenario': 'skills_profile', 'training-role-play': 'recognition', 'workforce-core-practice': 'skills_profile',
    };
    for (const [id, res] of Object.entries(want)) {
      const r = routes.find((x) => x.id === id)!;
      expect(r, id).toBeTruthy();
      expect(r.guard.grant?.res, id).toBe(res);
      expect((en.routes as Row)[id].title && (ar.routes as Row)[id].title, id).toBeTruthy();
    }
    expect(routes.find((x) => x.id === 'workforce-core-practice')!.guard.grant!.levels).toEqual(['Agg']);
    expect(routes.find((x) => x.id === 'training-role-play')!.guard.grant!.levels).toEqual(['A']);
    expect(FEATURE_BENCHMARKS.FS59).toEqual(['SKILLS-TECH', 'IAEA-1917']);
    const ek = flat({ aps: en.aps, rp: en.rp, wp: en.wp }).map(([k]) => k).sort();
    const ak = flat({ aps: ar.aps, rp: ar.rp, wp: ar.wp }).map(([k]) => k).sort();
    expect(ak).toEqual(ek);
    for (const [, v] of [...flat({ aps: en.aps, rp: en.rp, wp: en.wp }), ...flat({ aps: ar.aps, rp: ar.rp, wp: ar.wp })]) {
      expect(v).not.toMatch(/streak|badge|leaderboard|level up|\bXP\b/i);
      expect(v).not.toMatch(/FANR (requires|approved|certif)|regulator-approved|licensed by the regulator/i);
    }
  });
});
