/** M05 (G2): separation of duties, item security (logs, exports, AI corpus), JPM critical steps, retakes, appeals, item analysis. */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { scoreJpm } from '../../src/domain/rules';
import { appealWindow, itemAnalysis, retakeEligibility, scoreAnswers, ITEM_EXPORT_FIELDS } from '../../src/domain/learning';
import { toCsv } from '../../src/ui/DataTable';
import { itemCsvColumns } from '../../src/modules/m05/itemCsv';
import seed from '../../src/seed/seed.json';

let b: LocalBackend;
async function as(persona: string | null) {
  b.setPersona(persona);
  await b.whenReady();
}
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

const secureStems = () => b.raw('item_versions').filter((v) => !v.is_practice).flatMap((v) => [v.stem_en, v.stem_ar]);

describe('M05 acceptance', () => {
  it('a user with the item-writer role cannot approve their own item (maker_checker, audited)', async () => {
    await as('training-mgr');
    const r = await b.rpc.itemReview('it-get-13', 'approve');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('maker_checker');
    const audit = b.raw('audit_events').find((e) => e.seq === r.audit_seq)!;
    expect(audit.outcome).toBe('refused');
    // writer -> different reviewer -> different approver works
    await as('k-instructor');
    expect((await b.rpc.itemReview('it-reactor-theory-11', 'review')).ok).toBe(true);
    await as('training-mgr');
    expect((await b.rpc.itemReview('it-reactor-theory-11', 'approve')).ok).toBe(true);
    // items cannot be changed directly (RPC only)
    expect((await b.update('items', 'it-thermo-12', { status: 'approved' })).ok).toBe(false);
  });

  it('secure item text never appears in logs, exports or AI prompts', async () => {
    await as('k-instructor');
    const secret = 'ZETA-SECURE-STEM-7731';
    const saved = await b.rpc.saveItem({ bank: 'secure', topic: 'Reactor theory', competency_id: 'pf-01', difficulty: 'medium', reference: 'Generic', stem_en: `${secret} k-eff?`, stem_ar: `${secret} ؟`, options: [{ id: 'a', en: 'One', ar: 'واحد' }, { id: 'b', en: 'Two', ar: 'اثنان' }], answer: 'a', rationale_en: '', rationale_ar: '', change_note: 'new' });
    expect(saved.ok).toBe(true);
    await b.rpc.itemReview(saved.data!.id, 'submit');
    // exam delivery and submission also log
    await as('k-lo-trainee');
    const s = await b.rpc.startAttempt('at-5');
    await b.rpc.submitAttempt('at-5', s.data!.items.map((i) => ({ item_id: i.item_id, answer: 'a' })));
    const stems = [...secureStems(), secret];
    // 1. logs: no audit reason, action or entity carries secure item text
    const log = JSON.stringify(b.raw('audit_events'));
    for (const stem of stems) expect(log.includes(stem.slice(0, 40))).toBe(false);
    // 2. exports: the item bank CSV never includes stem, options, key or rationale
    await as('k-instructor');
    const items = await b.list('items');
    const versions = await b.list('item_versions');
    const rows = items.map((i) => ({ ...i, version: versions.find((v) => v.item_id === i.id && v.version === i.current_version) }));
    const csv = toCsv(rows, itemCsvColumns());
    for (const stem of stems) expect(csv.includes(stem.slice(0, 40))).toBe(false);
    for (const k of ITEM_EXPORT_FIELDS) expect(csv).toContain(k);
    // 3. AI prompts: no Dalil corpus document carries secure item text
    const corpus = JSON.stringify((seed as unknown as { tables: Record<string, unknown[]> }).tables.corpus_docs);
    for (const stem of stems) expect(corpus.includes(stem.slice(0, 40))).toBe(false);
  });

  it('a failed critical step fails the JPM regardless of total score', async () => {
    const steps = [{ n: 1, critical: false }, { n: 2, critical: false }, { n: 3, critical: true }, { n: 4, critical: true }, { n: 5, critical: false }];
    const r = scoreJpm(steps, [{ n: 1, result: 'pass' }, { n: 2, result: 'pass' }, { n: 3, result: 'fail' }, { n: 4, result: 'pass' }, { n: 5, result: 'pass' }]);
    expect(r.scorePct).toBe(80);
    expect(r.result).toBe('fail');
    await as('k-instructor');
    const rec = await b.rpc.recordJpm('jpm-qs-lo-turbine-t2', 'p-k-lo-trainee', [{ n: 1, result: 'pass' }, { n: 2, result: 'pass' }, { n: 3, result: 'fail' }, { n: 4, result: 'pass' }, { n: 5, result: 'pass' }]);
    expect(rec.data).toMatchObject({ result: 'fail', critical_failed: true });
    expect((await b.rpc.recordJpm('jpm-qs-lo-turbine-t2', 'p-k-instructor', [])).code).toBe('self_sign');
  });
});

describe('M05 delivery, retakes and appeals', () => {
  it('exam delivery hides the key; the result is hidden until released; scoring is server-side', async () => {
    await as('k-ro');
    const s = await b.rpc.startAttempt('at-6');
    expect(s.ok).toBe(true);
    expect(s.data!.items.length).toBe(10);
    expect(JSON.stringify(s.data)).not.toMatch(/"answer"|rationale/);
    await b.rpc.submitAttempt('at-6', []);
    expect(b.rawGet('attempts', 'at-6')!.score).toBe(0);
    expect((await b.rpc.attemptFeedback('at-6')).code).toBe('invalid');
    expect(await b.list('responses')).toEqual([]); // candidates cannot read responses
  });

  it('retake rules: one attempt at a time, waiting period, limit, none after a pass', async () => {
    const rules = { max_attempts: 3, retake_wait_days: 7 };
    const failed = { id: 'a1', status: 'released', passed: false, released: true, submitted_at: '2026-10-01T09:00:00Z' };
    expect(retakeEligibility(rules, [failed], '2026-10-05T08:00:00Z')).toMatchObject({ ok: false, code: 'retake_wait', earliest: '2026-10-08' });
    expect(retakeEligibility(rules, [failed], '2026-10-08T08:00:00Z')).toMatchObject({ ok: true, attemptNo: 2, retakeOf: 'a1' });
    expect(retakeEligibility(rules, [failed, { ...failed, id: 'a2' }, { ...failed, id: 'a3' }], '2026-12-01')).toMatchObject({ ok: false, code: 'retake_limit' });
    expect(retakeEligibility(rules, [failed, { ...failed, id: 'a2', counts: false }, { ...failed, id: 'a3' }], '2026-12-01').ok).toBe(true);
    expect(retakeEligibility(rules, [{ ...failed, passed: true }], '2026-12-01').code).toBe('already_passed');
    await as('training-mgr');
    const r = await b.rpc.scheduleAttempt('form-reactor-theory', 'w-lo-04', new Date(Date.now() + 86_400_000).toISOString(), null);
    expect(r.ok).toBe(true);
    expect(r.data!.attempt_no).toBe(2);
    expect((await b.rpc.scheduleAttempt('form-reactor-theory', 'w-lo-04', new Date(Date.now() + 2 * 86_400_000).toISOString(), null)).code).toBe('result_pending');
  });

  it('an upheld appeal voids the item and rescores; the releasing evaluator cannot decide it', async () => {
    expect(appealWindow({ status: 'released', released_at: '2026-10-01T00:00:00Z' }, 10, new Date('2026-10-08T00:00:00Z')).open).toBe(true);
    await as('training-mgr');
    const r = await b.rpc.decideAppeal('ap-1', 'upheld', 'Arabic wording ambiguous', ['it-reactor-theory-07']);
    expect(r.ok).toBe(true);
    expect(r.data!.score).toBe(78);
    expect(b.rawGet('attempts', 'at-4')!.counts).toBe(false);
  });

  it('item analysis reports difficulty and discrimination from responses', () => {
    const attempts = Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, score: i * 10 }));
    const responses = attempts.flatMap((a, i) => [{ attempt_id: a.id, item_id: 'good', correct: i >= 5 }, { attempt_id: a.id, item_id: 'easy', correct: true }]);
    const stats = itemAnalysis(attempts, responses);
    const good = stats.find((s) => s.item_id === 'good')!;
    expect(good.p).toBe(0.5);
    expect(good.d).toBe(1);
    expect(stats.find((s) => s.item_id === 'easy')!.flag).toBe('too_easy');
    expect(scoreAnswers(['x', 'y', 'z'], { x: 'a', y: 'b' }, { x: 'a', y: 'a', z: 'c' }, ['z'])).toEqual({ correct: 1, total: 2, score: 50 });
  });
});
