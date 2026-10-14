/**
 * Pure business rules shared by pages and the LocalBackend (SQL mirrors live in the kafaa_* RPCs).
 * Source: KAFAA-SPEC-001 M02/M03/M07 and FANR-REG-17. Kafa'a is a tracker, not an authority:
 * these functions only interpret mirrored records; they never decide eligibility or licensing outcomes.
 */
import { RULES, MIN_GROUP_SIZE } from '../auth/policy';
import { hoursSinceSyncOf } from './mirrorClock.ts';

export const DAY = 86_400_000;
export const toDate = (d: string | Date) => (typeof d === 'string' ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d);
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const todayIso = () => isoDate(new Date());
/** Whole calendar days (UTC) from `from` to `to`, like SQL `date - date`. Times of day are ignored, so a 6 Oct expiry read at
 * 17:00 on 8 Oct is 2 days ago (rounding the millisecond difference made it 3 after midday). */
const dayNumber = (d: string | Date) => Math.floor(toDate(d).getTime() / DAY);
export const daysBetween = (from: string | Date, to: string | Date) => dayNumber(to) - dayNumber(from);

/** UAE working days: Monday to Friday (weekend Saturday-Sunday). Public holidays are not modelled in the demo. */
export function addWorkingDays(from: string | Date, n: number): string {
  const d = new Date(toDate(from).getTime());
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (!(RULES.weekendDays as readonly number[]).includes(dow)) added++;
  }
  return isoDate(d);
}

export function quarterOf(d: string | Date): string {
  const x = toDate(d);
  return `${x.getUTCFullYear()}-Q${Math.floor(x.getUTCMonth() / 3) + 1}`;
}
export function quarterEnd(q: string): string {
  const [y, n] = q.split('-Q').map(Number);
  return isoDate(new Date(Date.UTC(y, n * 3, 0)));
}

// ───────────── M03 proficiency (REG-17 Art. 11)
export interface ShiftCounts {
  shifts_8h: number;
  shifts_12h: number;
  sro_role_shifts: number;
  scheduled_remaining_8h: number;
  scheduled_remaining_12h: number;
  scheduled_remaining_sro: number;
}
export interface ProficiencyStatus {
  met: boolean;
  atRisk: boolean;
  sroMet: boolean | null;
  sroAtRisk: boolean | null;
  messages: { code: string; en: string; ar: string }[];
}
export function proficiency(sp: ShiftCounts, isSro: boolean): ProficiencyStatus {
  const met = sp.shifts_8h >= RULES.shiftMin8h || sp.shifts_12h >= RULES.shiftMin12h;
  const reachable = sp.shifts_8h + sp.scheduled_remaining_8h >= RULES.shiftMin8h || sp.shifts_12h + sp.scheduled_remaining_12h >= RULES.shiftMin12h;
  const atRisk = !met && !reachable;
  const sroMet = isSro ? sp.sro_role_shifts >= RULES.sroRoleShiftMin : null;
  const sroAtRisk = isSro ? !sroMet && sp.sro_role_shifts + sp.scheduled_remaining_sro < RULES.sroRoleShiftMin : null;
  const messages: ProficiencyStatus['messages'] = [];
  if (atRisk) messages.push({ code: 'shift_min_at_risk', en: `Quarterly minimum at risk: ${sp.shifts_8h} of ${RULES.shiftMin8h} eight-hour (or ${sp.shifts_12h} of ${RULES.shiftMin12h} twelve-hour) shifts, and the remaining scheduled shifts cannot meet it.`, ar: 'الحد الأدنى ربع السنوي معرّض للخطر: لا تكفي النوبات المجدولة المتبقية لبلوغه.' });
  if (sroAtRisk) messages.push({ code: 'sro_role_at_risk', en: `SRO-role minimum at risk: ${sp.sro_role_shifts} of ${RULES.sroRoleShiftMin} shifts in the SRO role, ${sp.scheduled_remaining_sro} scheduled.`, ar: `الحد الأدنى لنوبات دور المشغّل الأول معرّض للخطر: ${sp.sro_role_shifts} من ${RULES.sroRoleShiftMin}.` });
  return { met, atRisk, sroMet, sroAtRisk, messages };
}

// ───────────── Mirror freshness clock (readiness fixes 2026-10-13, finding 1): see ./mirrorClock.ts
export { MIRROR_AS_OF, mirrorNow, hoursSinceSyncOf } from './mirrorClock.ts';

// ───────────── M03 licence display (stale sync never shows "valid")
export type LicenceView = 'valid' | 'renewal_due' | 'lapsed' | 'suspended' | 'withdrawn' | 'pending' | 'stale';
export function licenceView(l: { status: string; expires_on: string; last_synced: string }, now = new Date()): { view: LicenceView; daysToExpiry: number; stale: boolean; hoursSinceSync: number } {
  const hoursSinceSync = hoursSinceSyncOf(l.last_synced, now);
  const stale = hoursSinceSync > RULES.staleSyncHours;
  const daysToExpiry = daysBetween(now, l.expires_on);
  let view: LicenceView = l.status as LicenceView;
  if (l.status === 'valid') view = daysToExpiry <= RULES.licenceRenewalTaskMonths * 30.4 ? 'renewal_due' : 'valid';
  if (stale) view = 'stale';
  return { view, daysToExpiry, stale, hoursSinceSync };
}
export function medicalView(m: { due_on: string; flag: string }, now = new Date()): 'ok' | 'due_soon' | 'overdue' | 'not_confirmed' {
  const d = daysBetween(now, m.due_on);
  if (d < 0) return 'overdue';
  if (m.flag !== 'fit') return 'not_confirmed';
  return d <= 30 ? 'due_soon' : 'ok';
}
/** FANR withdraws a certificate after 2 consecutive years of non-validity. */
export function withdrawalDate(lapsedOn: string): string {
  const d = toDate(lapsedOn);
  d.setUTCFullYear(d.getUTCFullYear() + RULES.withdrawalAfterYearsNonValid);
  return isoDate(d);
}
export const lapseReportDue = (detectedOn: string) => addWorkingDays(detectedOn, RULES.lapseReportWorkingDays);
export const examNoticeDue = (examDate: string) => isoDate(new Date(toDate(examDate).getTime() - RULES.fanrExamNoticeDays * DAY));
export const examNoticeReminder = (examDate: string) => isoDate(new Date(toDate(examDate).getTime() - RULES.fanrExamReminderDays * DAY));
export const candidateListDue = (start: string) => isoDate(new Date(toDate(start).getTime() - RULES.candidateListDaysBeforeStart * DAY));

// ───────────── M02 qualification display and notices (90 / 60 / 30 days)
export type QualView = 'qualified' | 'due' | 'expired' | 'in_progress' | 'planned' | 'suspended' | 'renewed';
export function qualView(r: { status: string; expires_on?: string | null }, now = new Date()): { view: QualView; daysToExpiry: number | null; notice: 90 | 60 | 30 | null } {
  if (!r.expires_on) return { view: r.status as QualView, daysToExpiry: null, notice: null };
  const d = daysBetween(now, r.expires_on);
  let view = r.status as QualView;
  if (['qualified', 'due', 'renewed'].includes(r.status)) view = d < 0 ? 'expired' : d <= 30 ? 'due' : 'qualified';
  const notice = d < 0 ? null : (([...RULES.expiryNoticeDays].sort((a, b) => a - b).find((n) => d <= n) ?? null) as 90 | 60 | 30 | null);
  return { view, daysToExpiry: d, notice };
}

// ───────────── M03 eligibility explainer (non-binding; ENEC and FANR decide)
export interface ExperienceInput {
  highSchool: boolean;
  bsc: boolean;
  monthsQualifiedLO: number;
  monthsROatBarakah: number;
  monthsRoSroElsewhere: number;
  monthsFossilOrOther: number;
  monthsAtBarakah: number;
  monthsOnCrewAtBarakah: number;
  monthsNuclearAtBarakah: number;
  monthsAsLOatBarakah: number;
}
export interface RouteCheck {
  route: string;
  target: 'RO' | 'SRO';
  ruleRef: string;
  met: { en: string; ok: boolean }[];
}
export function routeChecks(x: ExperienceInput): RouteCheck[] {
  const ref = 'FANR-REG-17 Art. 4';
  return [
    { route: 'ro_lo36', target: 'RO', ruleRef: ref, met: [{ en: 'High-school diploma', ok: x.highSchool }, { en: '36 months as a fully qualified Local Operator', ok: x.monthsQualifiedLO >= 36 }] },
    { route: 'ro_other_plant', target: 'RO', ruleRef: ref, met: [{ en: '24 months as RO/SRO at another plant', ok: x.monthsRoSroElsewhere >= 24 }, { en: '12 months at Barakah', ok: x.monthsAtBarakah >= 12 }, { en: '6 months on crew at Barakah', ok: x.monthsOnCrewAtBarakah >= 6 }] },
    { route: 'ro_fossil', target: 'RO', ruleRef: ref, met: [{ en: '24 months at a fossil or different-type plant', ok: x.monthsFossilOrOther >= 24 }, { en: '12 months at Barakah', ok: x.monthsAtBarakah >= 12 }, { en: '9 months on crew at Barakah', ok: x.monthsOnCrewAtBarakah >= 9 }] },
    { route: 'sro_ro24', target: 'SRO', ruleRef: ref, met: [{ en: '24 months as RO at Barakah', ok: x.monthsROatBarakah >= 24 }] },
    { route: 'sro_bsc', target: 'SRO', ruleRef: ref, met: [{ en: 'BSc in engineering, engineering technology or a related science', ok: x.bsc }, { en: '24 months of nuclear work at Barakah', ok: x.monthsNuclearAtBarakah >= 24 }, { en: 'including 12 months as Local Operator', ok: x.monthsAsLOatBarakah >= 12 }] },
    { route: 'sro_other_plant', target: 'SRO', ruleRef: ref, met: [{ en: '24 months as RO, SRO or SRO-QI elsewhere', ok: x.monthsRoSroElsewhere >= 24 }, { en: '12 months at Barakah', ok: x.monthsAtBarakah >= 12 }, { en: '6 months on crew at Barakah', ok: x.monthsOnCrewAtBarakah >= 6 }] },
  ];
}

// ───────────── M07 suppression
export function suppress<T extends number | null | undefined>(value: T, groupSize: number | null | undefined): { value: T | null; suppressed: boolean } {
  if (groupSize == null || groupSize < MIN_GROUP_SIZE) return { value: null, suppressed: true };
  return { value, suppressed: false };
}

// ───────────── M05 JPM: a failed critical step fails the JPM regardless of total score
export function scoreJpm(criticalSteps: { n: number; critical: boolean }[], results: { n: number; result: 'pass' | 'fail' }[], passPct = 80) {
  let pass = 0;
  let criticalFailed = false;
  for (const s of criticalSteps) {
    const r = results.find((x) => x.n === s.n)?.result ?? 'fail';
    if (r === 'pass') pass++;
    else if (s.critical) criticalFailed = true;
  }
  const scorePct = criticalSteps.length ? Math.round((pass * 100) / criticalSteps.length) : 0;
  return { scorePct, criticalFailed, result: (criticalFailed ? 'fail' : scorePct >= passPct ? 'pass' : 'fail') as 'pass' | 'fail' };
}

// ───────────── M04 simulator priority (licence-critical training cannot be displaced)
export const bookingPriority = (kind: string) => (kind === 'coct' || kind === 'requal' ? 1 : kind === 'initial' || kind === 'maintenance' ? 2 : 4);
export function canDisplace(existing: { status: string; booking_kind: string; priority: number }, kind: string): boolean {
  if (existing.booking_kind === 'free' || existing.status === 'free' || existing.status === 'displaced') return true;
  return existing.priority > bookingPriority(kind);
}
