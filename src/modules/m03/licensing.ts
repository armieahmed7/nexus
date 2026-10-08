/**
 * M03 pure helpers: FANR-REG-17 rules as data (numbers come from RULES, shared with SQL via kafaa_rules()), working-day
 * clocks, risk ordering for the validity list and the upcoming-dates timeline. Interprets mirrored records only.
 */
import { RULES } from '../../auth/policy';
import { addWorkingDays, daysBetween, isoDate, licenceView, medicalView, proficiency, quarterEnd, quarterOf, toDate, withdrawalDate, type ShiftCounts } from '../../domain/rules';

/** REG-17 rules encoded by the tracker. Text lives in i18n under m03.rules.<id>.{req,tracker}; numbers here. */
export const REG17_RULES = [
  { id: 'ro_eligibility', article: 'Art. 4', params: {} },
  { id: 'sro_eligibility', article: 'Art. 4', params: {} },
  { id: 'exams', article: 'Art. 7', params: { notice: RULES.fanrExamNoticeDays, reminder: RULES.fanrExamReminderDays } },
  { id: 'validity', article: 'Art. 8', params: { years: RULES.certificateYears, months: RULES.licenceRenewalTaskMonths } },
  { id: 'medical', article: 'Art. 10', params: { months: RULES.medicalIntervalMonths } },
  { id: 'proficiency', article: 'Art. 11', params: { s8: RULES.shiftMin8h, s12: RULES.shiftMin12h, sro: RULES.sroRoleShiftMin } },
  { id: 'lapse', article: 'Art. 13', params: { days: RULES.lapseReportWorkingDays } },
  { id: 'withdrawal', article: 'REG-17', params: { years: RULES.withdrawalAfterYearsNonValid } },
  { id: 'programme', article: 'Art. 13', params: { days: RULES.candidateListDaysBeforeStart, months: RULES.trainingPlanReportMonths } },
  { id: 'requal', article: 'Art. 11', params: {} },
] as const;

const isWorkingDay = (d: Date) => !(RULES.weekendDays as readonly number[]).includes(d.getUTCDay());
/** UAE working days from `from` (exclusive) to `to` (inclusive); negative when `to` has passed. */
export function workingDaysLeft(from: string, to: string): number {
  if (to === from) return 0;
  const sign = to > from ? 1 : -1;
  const [a, b] = sign > 0 ? [from, to] : [to, from];
  let n = 0;
  const d = toDate(a);
  while (isoDate(d) < b) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorkingDay(d)) n++;
  }
  return sign * n;
}
export { addWorkingDays };

export interface LicLite {
  id: string;
  person_id: string;
  type: string;
  status: string;
  expires_on: string;
  last_synced: string;
  lapsed_on?: string | null;
  issued_on: string;
}
export type Risk = 'lapsed' | 'withdrawn' | 'suspended' | 'stale' | 'medical' | 'proficiency' | 'renewal' | 'ok' | 'pending';
/** One risk per certified person, most urgent first: lapsed > stale > medical overdue > proficiency at risk > renewal window. */
export function riskOf(l: LicLite, med: { due_on: string; flag: string } | null | undefined, sp: ShiftCounts | null | undefined, now = new Date()): { risk: Risk; rank: number; days: number } {
  const v = licenceView(l, now);
  const isSro = l.type !== 'RO';
  if (l.status === 'lapsed') return { risk: 'lapsed', rank: 0, days: v.daysToExpiry };
  if (l.status === 'withdrawn') return { risk: 'withdrawn', rank: 0, days: v.daysToExpiry };
  if (l.status === 'suspended') return { risk: 'suspended', rank: 1, days: v.daysToExpiry };
  if (l.status === 'pending') return { risk: 'pending', rank: 6, days: v.daysToExpiry };
  if (v.stale) return { risk: 'stale', rank: 2, days: v.daysToExpiry };
  if (med && medicalView(med, now) === 'overdue') return { risk: 'medical', rank: 3, days: v.daysToExpiry };
  if (sp) {
    const p = proficiency(sp, isSro);
    if (p.atRisk || p.sroAtRisk) return { risk: 'proficiency', rank: 4, days: v.daysToExpiry };
  }
  if (v.view === 'renewal_due') return { risk: 'renewal', rank: 5, days: v.daysToExpiry };
  return { risk: 'ok', rank: 9, days: v.daysToExpiry };
}

export interface KeyDate {
  id: string;
  date: string;
  kind: 'expiry' | 'renewal_start' | 'medical' | 'quarter_end' | 'requal_end' | 'withdrawal';
}
/** Upcoming dates for one operator (sorted). */
export function keyDates(l: LicLite | null, med: { due_on: string } | null, requal: { window_end: string } | null, now = new Date()): KeyDate[] {
  const out: KeyDate[] = [];
  if (l) {
    out.push({ id: 'expiry', date: l.expires_on, kind: 'expiry' });
    const rs = toDate(l.expires_on);
    rs.setUTCMonth(rs.getUTCMonth() - RULES.licenceRenewalTaskMonths);
    out.push({ id: 'renewal', date: isoDate(rs), kind: 'renewal_start' });
    if (l.status === 'lapsed' && l.lapsed_on) out.push({ id: 'withdrawal', date: withdrawalDate(l.lapsed_on), kind: 'withdrawal' });
  }
  if (med) out.push({ id: 'medical', date: med.due_on, kind: 'medical' });
  out.push({ id: 'quarter', date: quarterEnd(quarterOf(now)), kind: 'quarter_end' });
  if (requal) out.push({ id: 'requal', date: requal.window_end, kind: 'requal_end' });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Share of the 5-year validity elapsed, 0..100. */
export function validityElapsedPct(issued: string, expires: string, now = new Date()): number {
  const total = daysBetween(issued, expires);
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((daysBetween(issued, now) * 100) / total)));
}
