import { describe, expect, it } from 'vitest';
import { addWorkingDays, daysBetween, lapseReportDue, licenceView, proficiency, scoreJpm, suppress, canDisplace, qualView } from '../../src/domain/rules';

describe('UAE working days (Mon–Fri)', () => {
  it('lapse detected Thursday 8 Oct 2026 is reportable by Tuesday 13 Oct (3 working days)', () => {
    expect(lapseReportDue('2026-10-08')).toBe('2026-10-13');
  });
  it('skips Saturday and Sunday', () => {
    expect(addWorkingDays('2026-10-09', 1)).toBe('2026-10-12');
  });
});

describe('FANR-REG-17 shift proficiency', () => {
  it('flags the SRO-role minimum at risk when the remaining schedule cannot meet it', () => {
    const p = proficiency({ shifts_8h: 6, shifts_12h: 0, sro_role_shifts: 0, scheduled_remaining_8h: 2, scheduled_remaining_12h: 0, scheduled_remaining_sro: 1 }, true);
    expect(p.atRisk).toBe(false);
    expect(p.sroAtRisk).toBe(true);
    expect(p.messages.map((m) => m.code)).toContain('sro_role_at_risk');
  });
  it('meets the quarterly minimum with 5 twelve-hour shifts', () => {
    expect(proficiency({ shifts_8h: 0, shifts_12h: 5, sro_role_shifts: 0, scheduled_remaining_8h: 0, scheduled_remaining_12h: 0, scheduled_remaining_sro: 0 }, false).met).toBe(true);
  });
});

describe('licence display', () => {
  it('never shows a stale-synced licence as valid', () => {
    const v = licenceView({ status: 'valid', expires_on: '2029-01-01', last_synced: '2026-10-01T00:00:00Z' }, new Date('2026-10-08T00:00:00Z'));
    expect(v.view).toBe('stale');
    expect(v.stale).toBe(true);
  });
  it('fresh licence is valid', () => {
    const v = licenceView({ status: 'valid', expires_on: '2029-01-01', last_synced: '2026-10-07T12:00:00Z' }, new Date('2026-10-08T00:00:00Z'));
    expect(v.view).toBe('valid');
  });
});

describe('JPM scoring', () => {
  const steps = [1, 2, 3, 4, 5].map((n) => ({ n, critical: n === 3 || n === 4 }));
  it('a failed critical step fails the JPM regardless of score', () => {
    const r = scoreJpm(steps, [1, 2, 4, 5].map((n): { n: number; result: 'pass' | 'fail' } => ({ n, result: 'pass' })).concat([{ n: 3, result: 'fail' }]));
    expect(r.scorePct).toBe(80);
    expect(r.criticalFailed).toBe(true);
    expect(r.result).toBe('fail');
  });
  it('all steps passed is a pass', () => {
    expect(scoreJpm(steps, steps.map((s) => ({ n: s.n, result: 'pass' as const }))).result).toBe('pass');
  });
});

describe('aggregates and booking', () => {
  it('suppresses groups under 10', () => {
    expect(suppress(42.5, 7)).toEqual({ value: null, suppressed: true });
    expect(suppress(42.5, 12)).toEqual({ value: 42.5, suppressed: false });
  });
  it('licence-critical simulator bookings cannot be displaced by elective use', () => {
    expect(canDisplace({ status: 'booked', booking_kind: 'coct', priority: 1 }, 'elective')).toBe(false);
  });
  it('qualification due within 30 days shows as due with a 30-day notice', () => {
    const q = qualView({ status: 'qualified', expires_on: '2026-11-02' }, new Date('2026-10-08T00:00:00Z'));
    expect(q.view).toBe('due');
    expect(q.notice).toBe(30);
  });
});

describe('calendar day differences (QA fix: no rounding of time of day)', () => {
  it('an expiry on 6 Oct read at 17:06 on 8 Oct is 2 days ago, as SQL date arithmetic says', () => {
    expect(daysBetween(new Date('2026-10-08T17:06:00Z'), '2026-10-06')).toBe(-2);
    expect(licenceView({ status: 'lapsed', expires_on: '2026-10-06', last_synced: '2026-10-08T08:00:00Z' }, new Date('2026-10-08T17:06:00Z')).daysToExpiry).toBe(-2);
  });
  it('something due today is 0 days away all day long', () => {
    expect(daysBetween(new Date('2026-10-08T00:01:00Z'), '2026-10-08')).toBe(0);
    expect(daysBetween(new Date('2026-10-08T23:59:00Z'), '2026-10-08')).toBe(0);
    expect(daysBetween('2026-10-08', '2027-04-01')).toBe(175);
  });
});
