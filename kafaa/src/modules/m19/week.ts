// EMP-09: weekly goal progress from the learner's own learning record (xAPI statements with a duration). Weeks run Monday to
// Sunday on the Asia/Dubai calendar. Only recorded time counts (some activities record none), so pages say "recorded hours".
import { dubaiDate } from '../../domain/ics';
import { durationMinutes } from '../m27/xapi';
import type { CoachCard } from './coach';

export interface WeekBucket { start: string; minutes: number }
type Stmt = { occurred_at: string; result?: unknown };

const DAY = 86_400_000;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** The Monday that starts the week of a yyyy-mm-dd date. */
export function weekStart(date: string): string {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -dow);
}

/** Recorded minutes per week for the last `weeks` weeks, oldest first; the last bucket is the week of `today`. */
export function weeklyRecorded(rows: Stmt[], today: string, weeks = 8): WeekBucket[] {
  const current = weekStart(today);
  const out: WeekBucket[] = Array.from({ length: weeks }, (_, i) => ({ start: addDays(current, -7 * (weeks - 1 - i)), minutes: 0 }));
  const idx = new Map(out.map((b, i) => [b.start, i]));
  for (const r of rows) {
    const day = dubaiDate(r.occurred_at);
    if (!day) continue;
    const i = idx.get(weekStart(day));
    if (i == null) continue;
    out[i].minutes += durationMinutes((r.result as { duration?: unknown } | null | undefined)?.duration);
  }
  return out;
}

/** Today on the Asia/Dubai calendar (weeks follow the site calendar, not UTC). */
export const dubaiToday = (now = new Date()) => dubaiDate(now.toISOString()) as string;

/** Days left in the week of `today`, counting today (Monday = 7, Sunday = 1). */
export function daysLeftInWeek(today: string): number {
  return 7 - Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${weekStart(today)}T00:00:00Z`)) / DAY);
}

/** Coach items that fit in the hours left this week: pinned (expiring, must-keep) first, then the feed order; at most `max`. */
export function fitsInTimeLeft(feed: CoachCard[], hoursLeft: number, max = 3): CoachCard[] {
  if (hoursLeft <= 0) return [];
  const order = [...feed.filter((c) => c.pinned), ...feed.filter((c) => !c.pinned)];
  const out: CoachCard[] = [];
  let used = 0;
  for (const c of order) {
    if (out.length >= max) break;
    if (c.hours == null || c.hours <= 0 || used + c.hours > hoursLeft) continue;
    out.push(c);
    used += c.hours;
  }
  return out;
}
