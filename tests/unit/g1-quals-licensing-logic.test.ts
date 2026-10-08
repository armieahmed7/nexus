/** Pure M02/M03 page logic: effective evaluations, masking, gap analysis, who-is-qualified, working-day clocks, risk order. */
import { describe, expect, it } from 'vitest';
import { displayView, effective, qualGap, qualifiedForTask, taskRows, type EvalLite, type RecordLite, type StandardLite } from '../../src/modules/m02/quals';
import { riskOf, workingDaysLeft, keyDates, REG17_RULES } from '../../src/modules/m03/licensing';

const NOW = new Date('2026-10-08T10:00:00Z');
const ev = (id: string, task: string, result: 'pass' | 'fail' | 'pending', date: string, extra: Partial<EvalLite> = {}): EvalLite => ({ id, record_id: 'r1', task_id: task, person_id: 'p1', method: 'ojt', evaluator_person_id: 'e1', evaluator_role: 'Evaluator', result, date, critical_failed: false, supervisor_ack_by: null, supervisor_ack_at: null, correction_of: null, correction_reason: null, created_at: `${date}T08:00:00Z`, ...extra });
const rec = (status: string, expires: string | null, extra: Partial<RecordLite> = {}): RecordLite => ({ id: 'r1', person_id: 'p1', standard_id: 's1', status, qualified_on: '2025-01-01', expires_on: expires, needs_review: false, security_mirror_only: false, ...extra });

describe('M02 qualification logic', () => {
  it('a correction supersedes the entry it corrects', () => {
    const evals = [ev('a', 't1', 'fail', '2026-09-01'), ev('b', 't1', 'pass', '2026-09-02', { correction_of: 'a', correction_reason: 'wrong form' })];
    expect(effective(evals).map((e) => e.id)).toEqual(['b']);
    expect(taskRows(['t1', 't2'], 'r1', evals).map((r) => r.status)).toEqual(['passed', 'not_started']);
  });
  it('the latest effective result wins', () => {
    const rows = taskRows(['t1'], 'r1', [ev('a', 't1', 'pass', '2026-01-01'), ev('b', 't1', 'fail', '2026-06-01')]);
    expect(rows[0].status).toBe('failed');
    expect(rows[0].history).toHaveLength(2);
  });
  it('due within 30 days, expired after, and security records masked', () => {
    expect(displayView(rec('qualified', '2026-11-02'), NOW).view).toBe('due');
    expect(displayView(rec('qualified', '2026-09-20'), NOW).view).toBe('expired');
    const m = displayView(rec('qualified', '2026-11-02', { security_mirror_only: true }), NOW);
    expect(m).toEqual({ view: 'qualified', days: null, notice: null, masked: true });
    expect(displayView(rec('expired', '2026-09-20', { security_mirror_only: true }), NOW).view).toBe('not_qualified');
  });
  it('gap analysis matches records across versions by code and includes all-staff standards', () => {
    const stds: StandardLite[] = [
      { id: 's1', code: 'A', role_ids: ['ro'], discipline: 'Ops', status: 'superseded', security_restricted: false },
      { id: 's1-v2', code: 'A', role_ids: ['ro'], discipline: 'Ops', status: 'current', security_restricted: false },
      { id: 'get', code: 'GET', role_ids: [], discipline: 'All staff', status: 'current', security_restricted: false },
      { id: 'x', code: 'X', role_ids: ['other'], discipline: 'Ops', status: 'current', security_restricted: false },
    ];
    const g = qualGap(stds, [rec('qualified', '2027-06-01')], 'ro', NOW);
    expect(g.map((x) => [x.standard.code, x.status])).toEqual([['A', 'held'], ['GET', 'missing']]);
  });
  it('who is qualified needs an in-force record and a passed task', () => {
    const recs = [rec('qualified', '2027-01-01'), rec('expired', '2026-01-01', { id: 'r2', person_id: 'p2' })];
    expect(qualifiedForTask(recs, [ev('a', 't1', 'pass', '2026-01-01')], 's1', 't1', NOW).map((r) => r.id)).toEqual(['r1']);
    expect(qualifiedForTask(recs, [ev('a', 't1', 'fail', '2026-01-01')], 's1', 't1', NOW)).toEqual([]);
  });
});

describe('M03 licensing logic', () => {
  it('working-day clock skips the UAE weekend (Saturday, Sunday)', () => {
    expect(workingDaysLeft('2026-10-08', '2026-10-13')).toBe(3);
    expect(workingDaysLeft('2026-10-13', '2026-10-08')).toBe(-3);
    expect(workingDaysLeft('2026-10-09', '2026-10-12')).toBe(1);
  });
  it('risk order: lapsed before stale before medical before proficiency before renewal', () => {
    const base = { id: 'l', person_id: 'p', type: 'SRO', issued_on: '2023-01-01', expires_on: '2028-01-01', status: 'valid', last_synced: '2026-10-08T04:00:00Z' };
    const sp = { shifts_8h: 6, shifts_12h: 0, sro_role_shifts: 1, scheduled_remaining_8h: 2, scheduled_remaining_12h: 0, scheduled_remaining_sro: 0 };
    expect(riskOf({ ...base, status: 'lapsed' }, null, null, NOW).risk).toBe('lapsed');
    expect(riskOf({ ...base, last_synced: '2026-10-01T00:00:00Z' }, null, null, NOW).risk).toBe('stale');
    expect(riskOf(base, { due_on: '2026-09-01', flag: 'fit' }, sp, NOW).risk).toBe('medical');
    expect(riskOf(base, { due_on: '2027-09-01', flag: 'fit' }, sp, NOW).risk).toBe('proficiency');
    expect(riskOf({ ...base, expires_on: '2027-06-01' }, null, null, NOW).risk).toBe('renewal');
    expect(riskOf(base, null, null, NOW).risk).toBe('ok');
  });
  it('key dates include the withdrawal date two years after a lapse', () => {
    const k = keyDates({ id: 'l', person_id: 'p', type: 'RO', issued_on: '2021-10-06', expires_on: '2026-10-06', status: 'lapsed', last_synced: '2026-10-08T00:00:00Z', lapsed_on: '2026-10-08' }, { due_on: '2027-08-08' }, { window_end: '2027-12-31' }, NOW);
    expect(k.find((x) => x.kind === 'withdrawal')?.date).toBe('2028-10-08');
    expect(k.map((x) => x.date)).toEqual([...k.map((x) => x.date)].sort());
  });
  it('REG-17 rules are held as data with article references', () => {
    expect(REG17_RULES.find((r) => r.id === 'proficiency')?.params).toEqual({ s8: 7, s12: 5, sro: 2 });
    expect(REG17_RULES.every((r) => r.article)).toBe(true);
  });
});
