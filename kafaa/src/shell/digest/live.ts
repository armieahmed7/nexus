// EMP-01: the digest is built once per period (kafaa_build_digest reuses the period's run), so its stored `days` and its list go
// stale during the week. These pure helpers let the page show it live: days and overdue are worked out from `due_on` and today at
// render time, and an item whose source row has since been handled is shown as done (ticked and greyed, never hidden). Display only:
// the stored run is a record and is not changed. Rules are the inverse of the gather rules in rules.ts / future.ts for each kind.
import { addDays, addMonths, CADENCE_DAYS, daysBetween, type DigestItem } from './rules';

type Row = Record<string, any>;
/** Same lists as rules.ts (CURRENT_QUAL, OPEN_ENROL). */
const CURRENT_QUAL = ['qualified', 'due', 'renewed'];
const OPEN_ENROL = ['assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress'];

/** Days from today to the item's date (negative = overdue). Items without a date keep their stored value. */
export function liveDays(i: Pick<DigestItem, 'due_on' | 'days'>, today: string): number | null {
  return i.due_on ? daysBetween(today, String(i.due_on).slice(0, 10)) : i.days;
}

/** The item with `days` (and any `days` reason variable) recomputed for today. */
export function liveItem(i: DigestItem, today: string): DigestItem {
  const days = liveDays(i, today);
  if (days === i.days) return i;
  return { ...i, days, why: i.why.map((w) => (!w.key && w.vars && typeof w.vars.days === 'number' ? { ...w, vars: { ...w.vars, days: Math.max(0, days ?? 0) } } : w)) };
}

/** Status checks on the item's own source row (ref_table / ref_id): true when the thing it asked for has been done. */
const ROW_DONE: Record<string, (r: Row, i: DigestItem) => boolean> = {
  mentoring_requests: (r) => r.status !== 'requested',
  opportunity_applications: (r) => r.status !== 'applied',
  ojt_logs: (r) => r.status !== 'pending_ack',
  ojt_eval_requests: (r) => r.status !== 'requested',
  plant_visits: (r) => r.status !== 'logged',
  roleplay_sessions: (r) => r.review_status !== 'requested',
  fellowship_milestones: (r) => r.status !== 'submitted',
  prearrival_shares: (r) => !!r.checked_at,
  career_conversations: (r) => r.status !== 'held',
  enrolments: (r) => !OPEN_ENROL.includes(r.status),
  qual_records: (r, i) => !CURRENT_QUAL.includes(r.status) || (!!r.expires_on && !!i.due_on && String(r.expires_on).slice(0, 10) > String(i.due_on).slice(0, 10)),
  licences: (r, i) => r.status !== 'valid' || (!!r.expires_on && !!i.due_on && String(r.expires_on).slice(0, 10) > String(i.due_on).slice(0, 10)),
};

/** What the page reads to re-check an item: its own row, or (for the per-person kinds) the rows that would close it. */
export interface LiveRows {
  row?: Row | null;
  /** skill_checkins: my rating rows on the check-in. */
  ratings?: Row[];
  /** conversation: my career conversations. mentoring: the agreement's sessions. refresher: my refresh_state rows. */
  related?: Row[];
}

/** The tables to read for one item, or null when the item cannot be closed by a later record (suggestions, opportunities, future nudges). */
export function liveSource(i: DigestItem): { table: string; id?: string; by?: Record<string, string> } | null {
  if (i.kind === 'conversation') return { table: 'career_conversations', by: { person_id: i.ref_id } };
  if (i.kind === 'refresher') return { table: 'refresh_state', by: { person_id: i.ref_id } };
  if (i.kind === 'mentoring') return { table: 'mentoring_agreements', id: i.ref_id };
  if (i.kind === 'approval' && i.ref_table === 'mentoring_agreements') return { table: 'mentoring_agreements', id: i.ref_id };
  if (i.kind === 'approval' && i.ref_table === 'skill_checkins') return { table: 'skill_checkins', id: i.ref_id };
  if ((i.kind === 'approval' || i.kind === 'coach' || i.kind === 'expiry') && ROW_DONE[i.ref_table]) return { table: i.ref_table, id: i.ref_id };
  return null;
}

/**
 * True when the item has been handled since the digest was built; false when it is still open or cannot be told (row not
 * readable, kind not checkable). `me` is the viewer, `today` the current day.
 */
export function isItemDone(i: DigestItem, live: LiveRows, me: string, today: string): boolean {
  if (i.kind === 'conversation') {
    // due = last held + 6 months; a conversation held after that last one closes it
    if (!i.due_on || !live.related) return false;
    const last = addMonths(String(i.due_on).slice(0, 10), -6);
    return live.related.some((c) => c.person_id === me && ['held', 'acknowledged'].includes(c.status) && c.held_on && String(c.held_on).slice(0, 10) > last);
  }
  if (i.kind === 'refresher') return !!live.related && !live.related.some((r) => r.person_id === me && String(r.due_on).slice(0, 10) <= today);
  if (i.kind === 'mentoring') {
    const a = live.row;
    if (!a) return false;
    if (a.status !== 'active') return true;
    if (!i.due_on || !live.related) return false;
    const last = addDays(String(i.due_on).slice(0, 10), -(CADENCE_DAYS[a.cadence] ?? 30));
    return live.related.some((s) => s.agreement_id === a.id && s.held_on && String(s.held_on).slice(0, 10) > last);
  }
  const r = live.row;
  if (!r) return false;
  if (i.kind === 'approval' && i.ref_table === 'mentoring_agreements') return r.status !== 'proposed';
  if (i.kind === 'approval' && i.ref_table === 'skill_checkins') {
    if (r.status !== 'open') return true;
    return !!live.ratings && !live.ratings.some((x) => x.rater_person_id === me && x.status === 'pending');
  }
  const done = ROW_DONE[i.ref_table];
  return done ? done(r, i) : false;
}
