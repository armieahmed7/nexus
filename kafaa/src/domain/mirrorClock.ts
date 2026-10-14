// Mirror freshness clock (readiness fixes 2026-10-13, finding 1). Import-free: the PGlite validators and seed builders load it too.
/**
 * The demo tenant's mirrors of the systems of record (licence and medical records, the shift roster, the integration heartbeats) are a
 * snapshot taken at MIRROR_AS_OF. Judging their age against the wall clock turned every licence "Not confirmed (stale sync)" a few days
 * after seeding, and it got worse every day. Sync freshness is therefore measured at min(now, MIRROR_AS_OF): the records seeded as
 * deliberately stale (w-sro-05's licence, the occupational-health feed) stay stale, the others stay fresh, and a record synced after
 * the snapshot (an RPC that sets last_synced = now()) counts as fresh. Expiry dates, due dates and every other clock keep the wall
 * clock. SQL mirror: kafaa_mirror_now() (20261013200003_kafaa_ready_mirror_clock.sql). A deployment fed by live connectors sets this
 * to null (and kafaa_mirror_now() to now()), so freshness follows the wall clock again.
 */
export const MIRROR_AS_OF: string | null = '2026-10-08T08:00:00Z';
/** The clock sync freshness is judged against: the earlier of `now` and MIRROR_AS_OF. */
export function mirrorNow(now: Date = new Date()): Date {
  if (!MIRROR_AS_OF) return now;
  const cap = new Date(MIRROR_AS_OF);
  return cap.getTime() < now.getTime() ? cap : now;
}
/** Hours between a mirror record's last sync and the mirror clock (never negative). */
export const hoursSinceSyncOf = (lastSynced: string, now: Date = new Date()) => Math.max(0, (mirrorNow(now).getTime() - new Date(lastSynced.length === 10 ? `${lastSynced}T00:00:00Z` : lastSynced).getTime()) / 3_600_000);
