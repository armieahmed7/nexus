/**
 * [FS wave B · E4 · FS13] Future Me readiness that learning can actually move (readiness rule v2). One test per acceptance criterion
 * plus the rule, the RPCs (LocalBackend = SQL mirror) and the engine card. SQL = TS on every seeded person is proved in PGlite by
 * scripts/validate/fs24-future-readiness.mjs; here the LocalBackend RPC is checked against the same TS rule.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { lintRanked } from '../../src/domain/engines';
import {
  creditBp, deltaOf, evidenceOptions, fullEvidence, index10, inputFor, learningActions, normSteps, previewEvidence, readinessV2, unreachableKeys, type RV2, type RV2Tables,
} from '../../src/modules/m21/readiness';
import { familyReasonsV2, itemReasons, rankRaises, toV1Family, v2Levels } from '../../src/modules/m21/raises';
import { FS13_CARD, FS13_KEYSPACE_ROWS } from '../../src/modules/m21/fs13data';
import { FS_QA_KEYSPACE_ROWS } from '../../src/domain/taxonomy';

type Row = Record<string, any>;
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const tabs = (x: Record<string, Row[]> = T): RV2Tables => ({ techs: x.adv_technologies, advSkills: x.adv_skills, map: x.future_skill_map, skills: x.skills, resources: x.future_resources, states: x.person_skills, enrolments: x.enrolments, trainingRecords: x.training_records, trackProgress: x.future_track_progress }) as never;
const rOf = (p: string, extra: Partial<{ courses: string[]; tracks: string[] }> = {}) => {
  const i = inputFor(p, tabs());
  return readinessV2({ ...i, completedCourses: [...new Set([...i.completedCourses, ...(extra.courses ?? [])])], completedTracks: [...new Set([...i.completedTracks, ...(extra.tracks ?? [])])] });
};
const hasIntro = (r: RV2) => r.families.some((f) => f.items.some((i) => i.l3 >= 1 && i.learn_opts.some((o) => o.course_id === 'c-adv-intro')));

describe('FS13 acceptance', () => {
  it('AC1: completing c-adv-intro raises the index for every family by a deterministic amount', () => {
    // every staff member (the PGlite validator repeats this for all seeded people against the SQL function)
    const fresh = T.people.filter((p) => p.kind === 'staff' && !hasIntro(rOf(p.id)));
    expect(fresh.length).toBeGreaterThan(60);
    for (const p of fresh) {
      const before = rOf(p.id);
      const after = rOf(p.id, { courses: ['c-adv-intro'] });
      expect(previewEvidence(before, { courses: ['c-adv-intro'] })).toEqual(after); // the preview is exactly what recording it gives
      const d = deltaOf(before, after);
      for (const f of d.families) expect(f.delta, `${p.id} ${f.tech_id}`).toBeGreaterThan(0);
    }
    // a person with no ADVANCE evidence at all: each covered skill moves from 0 to 1/3 credit (3333 basis points)
    const zero = T.people.find((p) => rOf(p.id).families.every((f) => f.index === 0))!;
    const d0 = deltaOf(rOf(zero.id), rOf(zero.id, { courses: ['c-adv-intro'] }));
    const covered = evidenceOptions(tabs() as never);
    for (const f of rOf(zero.id).families) {
      const k = f.items.filter((i) => covered.get(i.adv_skill_id)!.learn.some((o) => o.course_id === 'c-adv-intro')).length;
      expect(d0.families.find((x) => x.tech_id === f.tech_id)!.after).toBe(index10([...Array(k).fill(creditBp(0, 0, 1)), ...Array(f.n - k).fill(0)]) / 10);
    }
    expect(d0.families.map((f) => f.delta)).toEqual([6.7, 13.3, 6.7, 8.3, 11.1, 6.7]); // bwr, htgr (2 covered), fast, micro, msr, intl
  });

  it('AC2: an index of 100 is reachable through evidence alone, in every family', () => {
    expect(unreachableKeys({ advSkills: T.adv_skills as never, map: T.future_skill_map as never, skills: T.skills as never, resources: T.future_resources as never })).toEqual([]);
    for (const p of ['p-k-ro', 'p-sro', 'p-k-lo-trainee', 'p-training-mgr', 'w-ro-01', 'p-k-hr-analyst']) {
      const r = rOf(p);
      const full = previewEvidence(r, fullEvidence(r));
      expect(full.overall).toBe(100);
      for (const f of full.families) expect(f.index).toBe(100);
      expect(fullEvidence(r).skills!.every((s) => s.level === 3)).toBe(true);
    }
    // learning alone is honest: catalogue courses and tracks stop at the learning ceiling, below 100
    const r = rOf('p-k-lo-trainee');
    const allLearning = previewEvidence(r, { courses: learningActions(r).filter((a) => a.kind === 'course').map((a) => a.ref), tracks: learningActions(r).filter((a) => a.kind === 'track').map((a) => a.ref) });
    expect(allLearning.overall).toBeLessThan(100);
    expect(allLearning.overall).toBeGreaterThan(r.overall);
  });

  it('AC3: TS and the server agree on every seeded person (LocalBackend RPC here; the SQL function in PGlite)', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    await b.reset();
    for (const persona of ['k-ro', 'sro', 'k-lo-trainee', 'training-mgr', 'k-hr-analyst', 'k-instructor', 'chco']) {
      b.setPersona(persona);
      await b.whenReady();
      const me = b.identity().personId!;
      const r = await b.rpc.futureReadiness();
      expect(r.person_id).toBe(me);
      const { person_id, ...rest } = r;
      expect(person_id).toBe(me);
      expect(rest).toEqual(rOf(me));
    }
    const sql = readFileSync('supabase/migrations/20261010224001_kafaa_fs24_future_readiness.sql', 'utf8');
    expect(sql).toContain('create or replace function kafaa_fm_readiness_of(p_person text)');
    expect(readFileSync('scripts/validate/fs24-future-readiness.mjs', 'utf8')).toContain('kafaa_fm_readiness_of equals readinessV2 for all');
  }, 60000);
});

describe('FS13 rule v2', () => {
  it('credit closes part of the gap that is left: carry (transfers 2 x level, adapts 1 x level), direct, learning', () => {
    expect(creditBp(0, 0, 0)).toBe(0);
    expect(creditBp(6, 0, 0)).toBe(10000);
    expect(creditBp(3, 0, 0)).toBe(5000); // adapts at level 3 = half
    expect(creditBp(0, 3, 0)).toBe(10000); // the new capability at level 3 counts in full
    expect(creditBp(0, 0, 1)).toBe(3333);
    expect(creditBp(0, 0, 2)).toBe(6667);
    expect(creditBp(3, 0, 1)).toBe(6667); // 1 - 0.5 x 2/3
    expect(index10([10000, 0, 0])).toBe(333);
  });
  it('ceilings: 0 <= index, carry ceiling <= learning ceiling <= 100, for every seeded person', () => {
    for (const p of T.people.filter((x) => x.kind === 'staff')) {
      const r = rOf(p.id);
      expect(r.version).toBe(2);
      for (const f of r.families) {
        expect(f.index).toBeGreaterThanOrEqual(0);
        expect(f.index).toBeLessThanOrEqual(100);
        expect(f.carry_ceiling).toBeLessThanOrEqual(f.learn_ceiling);
        expect(f.learn_ceiling).toBeLessThan(100);
      }
    }
  });
  it('the FS04 keyspace drives it: FS13 rows give every ADAPTS skill a new-capability skill; security skills never count', () => {
    for (const [key, sk] of FS13_KEYSPACE_ROWS) expect(T.future_skill_map.some((m) => m.key === key && m.sk_id === sk && m.active && m.relation === 'new')).toBe(true);
    for (const a of T.adv_skills) for (const m of T.future_skill_map.filter((x) => x.key === a.id && x.active)) expect(a.sk_ids).toContain(m.sk_id);
    const qa = new Set(FS_QA_KEYSPACE_ROWS.map(([k, , s]) => `${k}:${s}`));
    expect(FS13_KEYSPACE_ROWS.every(([k, s]) => !qa.has(`${k}:${s}`))).toBe(true);
    const opts = evidenceOptions(tabs() as never);
    const sec = new Set(T.skills.filter((s) => s.area === 'security').map((s) => s.id));
    for (const o of opts.values()) expect([...o.carry.map((c) => c.sk_id), ...o.direct].some((x) => sec.has(x))).toBe(false);
    // a security skill held at level 4 changes nothing
    const i = inputFor('p-k-ro', tabs());
    expect(readinessV2({ ...i, states: [...i.states, { skill_id: 'sk-sa-01', level: 4, active: true }] })).toEqual(readinessV2(i));
  });
  it('a completed course counts at its level (1-2), a completed track at 1; enrolments in progress do not count', () => {
    const i = inputFor('p-training-mgr', tabs());
    const base = readinessV2(i);
    const smr = readinessV2({ ...i, completedCourses: [...i.completedCourses, 'c-adv-smr'] });
    const smrTrack = readinessV2({ ...i, completedTracks: [...i.completedTracks, 'trk-smr-ops'] });
    const item = (r: RV2, id: string) => r.families.flatMap((f) => f.items).find((x) => x.adv_skill_id === id)!;
    expect(item(smr, 'as-autonomous-control').learn_level).toBe(2);
    expect(item(smrTrack, 'as-autonomous-control').learn_level).toBe(1);
    expect(smr.overall).toBeGreaterThan(smrTrack.overall);
    expect(smrTrack.overall).toBeGreaterThan(base.overall);
    const t2 = { ...tabs(), enrolments: [...T.enrolments, { person_id: 'p-training-mgr', course_id: 'c-adv-smr', status: 'in_progress' }] } as never;
    expect(readinessV2(inputFor('p-training-mgr', t2))).toEqual(base);
  });
  it('"what raises it": ranked actions with +points equal to their preview, each with reasons; recorded learning is not offered again', () => {
    const r = rOf('p-k-ro');
    const ranked = rankRaises(r);
    expect(ranked.length).toBeGreaterThan(5);
    expect(lintRanked(ranked)).toEqual([]);
    for (const x of ranked) {
      expect(x.item!.delta).toBe(deltaOf(r, previewEvidence(r, x.item!.change)).overall);
      expect(x.item!.families.some((f) => f.delta > 0)).toBe(true);
    }
    const learn = ranked.filter((x) => x.item!.kind !== 'practice');
    for (let k = 1; k < learn.length; k++) expect(learn[k - 1].score).toBeGreaterThanOrEqual(learn[k].score);
    expect(ranked.some((x) => x.id === 'course:c-adv-intro')).toBe(true);
    const sro = rOf('p-sro'); // p-sro completed the orientation track
    expect(rankRaises(sro).some((x) => x.id === 'track:trk-orientation')).toBe(false);
    for (const f of r.families) {
      expect(familyReasonsV2(f).length).toBeGreaterThan(0);
      for (const it of f.items) expect(itemReasons(it).every((x) => x.key.startsWith('m21.reasons.'))).toBe(true);
    }
  });
  it('the F09 rankers read v2 through the adapter (bridges, resources, concept roles)', () => {
    const r = rOf('p-k-ro');
    const v1 = r.families.map((f) => toV1Family(f));
    expect(v1.map((f) => f.index)).toEqual(r.families.map((f) => f.index));
    expect(v1.every((f) => f.ceiling === r.families.find((x) => x.tech_id === f.tech_id)!.learn_ceiling)).toBe(true);
    expect(v2Levels(r).size).toBe(T.adv_skills.length);
  });
});

describe('FS13 RPCs (LocalBackend mirror of kafaa_future_readiness / kafaa_record_track_step)', () => {
  let b: LocalBackend;
  const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
  beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });

  it('readiness is for staff with a skills profile; partners and anonymous visitors are refused', async () => {
    await as(null);
    await expect(b.rpc.futureReadiness()).rejects.toThrow();
    await as('alnoor-gm');
    await expect(b.rpc.futureReadiness()).rejects.toThrow();
    await as('k-ro');
    expect((await b.rpc.futureReadiness()).families).toHaveLength(6);
  });

  it('track steps: complete trk-orientation -> learning evidence, exactly as previewed; audited, no ledger; undo reopens', async () => {
    await as('k-ro');
    const before = await b.rpc.futureReadiness();
    const led0 = b.raw('ledger_local').length;
    const total = (b.rawGet('adv_tracks', 'trk-orientation')!.modules as unknown[]).length;
    expect(normSteps(b.rawGet('future_track_progress', 'ftp:p-k-ro:trk-orientation')!.steps_done, total)).toEqual([0, 1]); // seeded: 2 of 4
    const s3 = await b.rpc.recordTrackStep('trk-orientation', 2);
    expect(s3.ok && s3.data!.status).toBe('in_progress');
    const s4 = await b.rpc.recordTrackStep('trk-orientation', 3);
    expect(s4.ok).toBe(true);
    expect(s4.data!.status).toBe('completed');
    expect(s4.data!.completed_at).toBeTruthy();
    const after = await b.rpc.futureReadiness();
    const { person_id: _a, ...a } = after;
    const { person_id: _b, ...bf } = before;
    expect(a).toEqual(previewEvidence(bf as never, { tracks: ['trk-orientation'] }));
    expect(after.overall).toBeGreaterThan(before.overall);
    const aud = b.raw('audit_events').filter((e) => e.action === 'future.track');
    expect(aud.length).toBeGreaterThanOrEqual(2);
    expect(aud.every((e) => e.ledger_status === 'not_applicable')).toBe(true);
    expect(b.raw('ledger_local').length).toBe(led0);
    const undo = await b.rpc.recordTrackStep('trk-orientation', 3, false);
    expect(undo.ok && undo.data!.status).toBe('in_progress');
    expect(undo.data!.completed_at).toBeNull();
    const { person_id: _c, ...back } = await b.rpc.futureReadiness();
    expect(back).toEqual(bf);
  });

  it('track step refusals and own-only reads', async () => {
    await as('k-ro');
    expect((await b.rpc.recordTrackStep('trk-orientation', 9)).code).toBe('invalid');
    expect((await b.rpc.recordTrackStep('trk-nope', 0)).code).toBe('not_found');
    await as('k-observer');
    expect((await b.rpc.recordTrackStep('trk-digital', 0)).code).toBe('forbidden');
    await as('gulfhydro-qa');
    expect((await b.rpc.recordTrackStep('trk-digital', 0)).code).toBe('forbidden');
    await as(null);
    expect((await b.rpc.recordTrackStep('trk-digital', 0)).code).toBe('not_signed_in');
    await as('training-mgr');
    expect((await b.list('future_track_progress')).every((r) => r.person_id === 'p-training-mgr')).toBe(true);
    await as('k-hr-analyst');
    expect((await b.list('future_track_progress')).filter((r) => r.person_id !== 'p-k-hr-analyst')).toEqual([]);
    expect((await b.insert('future_track_progress', { id: 'x', person_id: 'p-k-hr-analyst', track_id: 'trk-digital' } as never)).ok).toBe(false);
  });
});

describe('FS13 engine card (F24) and seed', () => {
  it('the Future Me card is at version 2 and names the v2 rule in TS and SQL', () => {
    const card = T.engine_cards.find((c) => c.id === 'future')!;
    expect(card.version).toBe(FS13_CARD.version);
    expect(card.scoring_functions).toEqual(FS13_CARD.scoring_functions);
    expect(card.scoring_functions).toContain('sql:kafaa_fm_readiness_of');
    expect(card.inputs_used.map((i: Row) => i.key)).toEqual(expect.arrayContaining(['future_skill_map', 'learning']));
    expect(card.inputs_excluded).toEqual(['gender', 'nationality_flag', 'age']);
  });
  it('the seed carries synthetic ADVANCE track progress (completed tracks and some in progress), own rows of synthetic people only', () => {
    const rows = T.future_track_progress;
    expect(rows.filter((r) => r.status === 'completed').length).toBeGreaterThan(50);
    expect(rows.some((r) => r.status === 'in_progress')).toBe(true);
    const people = new Set(T.people.map((p) => p.id));
    for (const r of rows) {
      expect(people.has(r.person_id)).toBe(true);
      expect(r.id).toBe(`ftp:${r.person_id}:${r.track_id}`);
      const n = (T.adv_tracks.find((x) => x.id === r.track_id)!.modules as unknown[]).length;
      expect(r.status === 'completed').toBe(normSteps(r.steps_done, n).length === n);
    }
  });
});
