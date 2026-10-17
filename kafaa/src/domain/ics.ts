// SHR-01 · "Add to calendar": a small, pure RFC 5545 (iCalendar) builder. No DOM, no network, nothing stored.
// The page turns the text into a Blob and downloads it, so the file never leaves the browser except into the person's own
// calendar app (no third-party "add to calendar" links).
//
// Choices, so every calendar app reads the same thing:
// - Timed events are written in UTC with a trailing Z (DTSTART:20261020T040000Z). ENEC sites run on Asia/Dubai (UTC+4, no
//   daylight saving), so 08:00 in Barakah is 04:00Z; the calendar app shows it in the reader's own zone. No VTIMEZONE needed.
// - Deadlines, expiries and due dates are all-day events (DTSTART;VALUE=DATE), with the exclusive DTEND the day after.
// - TEXT values are escaped (backslash, semicolon, comma, newline) and every content line is folded at 75 octets of UTF-8,
//   never inside a character, so Arabic text survives. Lines end in CRLF.

export interface IcsEvent {
  /** Unique and stable per item (the same session gives the same UID, so re-importing updates rather than duplicates). */
  uid: string;
  summary: string;
  /** 'YYYY-MM-DD' makes an all-day event; anything else is read as a timestamp (ISO 8601 with Z or an offset). */
  start: string;
  /** Same kind as start. All-day: exclusive end, default the next day. Timed: default start + 1 hour. */
  end?: string | null;
  description?: string | null;
  location?: string | null;
  /** Link back to the page in Kafa'a. */
  url?: string | null;
}

export interface IcsOptions {
  /** Calendar name shown by some apps (X-WR-CALNAME). */
  name?: string;
  /** Language of SUMMARY / DESCRIPTION / LOCATION (RFC 5545 LANGUAGE parameter), e.g. 'en' or 'ar'. */
  lang?: string;
  /** DTSTAMP; defaults to now. Tests pass a fixed date. */
  now?: Date;
}

export const ICS_UID_DOMAIN = 'upskill.enecai.xyz';
export const ICS_MIME = 'text/calendar;charset=utf-8';
const CRLF = '\r\n';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Escape a TEXT value (RFC 5545 §3.3.11). Control characters other than newline are dropped. */
export function icsEscape(value: string): string {
  return value
    .replace(/\r\n?|\n/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

const octets = (cp: number) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);

/** Fold one content line at 75 octets (RFC 5545 §3.1): CRLF then a space, never splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let cur = '';
  let used = 0;
  let limit = 75;
  for (const ch of line) {
    const n = octets(ch.codePointAt(0)!);
    if (used + n > limit) {
      out.push(cur);
      cur = ' ';
      used = 1;
      limit = 75;
    }
    cur += ch;
    used += n;
  }
  out.push(cur);
  return out.join(CRLF);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A timestamp in UTC basic format: 20261020T040000Z. Returns null when it cannot be read. */
export function icsUtc(ts: string | Date): string | null {
  const d = typeof ts === 'string' ? new Date(DATE_ONLY.test(ts) ? `${ts}T00:00:00Z` : ts) : ts;
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** A calendar date in basic format: 20261214. Returns null for anything that is not a real YYYY-MM-DD date. */
export function icsDate(date: string): string | null {
  if (!DATE_ONLY.test(date)) return null;
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return null;
  return date.replace(/-/g, '');
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** All-day when start is a plain YYYY-MM-DD date. */
export function isAllDay(e: Pick<IcsEvent, 'start'>): boolean {
  return DATE_ONLY.test(e.start);
}

function uidOf(raw: string): string {
  const clean = raw.replace(/[\s\u0000-\u001F\u007F]+/g, '-');
  return clean.includes('@') ? clean : `${clean}@${ICS_UID_DOMAIN}`;
}

function eventLines(e: IcsEvent, stamp: string, lang?: string): string[] | null {
  if (!e.uid || !e.summary) return null;
  const textParam = lang ? `;LANGUAGE=${lang}` : '';
  const lines = ['BEGIN:VEVENT', `UID:${uidOf(e.uid)}`, `DTSTAMP:${stamp}`];
  if (isAllDay(e)) {
    const start = icsDate(e.start);
    if (!start) return null;
    const endIso = e.end && DATE_ONLY.test(e.end) && e.end > e.start ? e.end : nextDay(e.start);
    lines.push(`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${icsDate(endIso)}`, 'TRANSP:TRANSPARENT');
  } else {
    const startD = new Date(e.start);
    if (Number.isNaN(startD.getTime())) return null;
    const endD = e.end ? new Date(e.end) : null;
    const end = endD && !Number.isNaN(endD.getTime()) && endD > startD ? endD : new Date(startD.getTime() + 3_600_000);
    lines.push(`DTSTART:${icsUtc(startD)}`, `DTEND:${icsUtc(end)}`);
  }
  lines.push(`SUMMARY${textParam}:${icsEscape(e.summary)}`);
  if (e.location) lines.push(`LOCATION${textParam}:${icsEscape(e.location)}`);
  const desc = [e.description, e.url].filter(Boolean).join('\n\n');
  if (desc) lines.push(`DESCRIPTION${textParam}:${icsEscape(desc)}`);
  // eslint-disable-next-line no-control-regex
  if (e.url && /^https?:\/\/[^\s\u0000-\u001F\u007F]+$/.test(e.url)) lines.push(`URL;VALUE=URI:${e.url}`);
  lines.push('END:VEVENT');
  return lines;
}

/** The whole VCALENDAR as a string with CRLF line endings. Events that cannot be read (bad date, no title) are left out. */
export function buildIcs(events: IcsEvent[], opts: IcsOptions = {}): string {
  const stamp = icsUtc(opts.now ?? new Date())!;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', "PRODID:-//Kafa'a//Upskill calendar export//EN", 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (opts.name) lines.push(`X-WR-CALNAME:${icsEscape(opts.name)}`);
  const seen = new Set<string>();
  for (const e of events) {
    const uid = uidOf(e.uid || '');
    if (seen.has(uid)) continue;
    const ev = eventLines(e, stamp, opts.lang);
    if (!ev) continue;
    seen.add(uid);
    lines.push(...ev);
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** How many events buildIcs would write (same rules, used for labels and the "nothing to add" state). */
export function countIcsEvents(events: IcsEvent[]): number {
  return buildIcs(events, { now: new Date(0) }).split(CRLF).filter((l) => l === 'BEGIN:VEVENT').length;
}

/** A safe file name: kafaa-my-learning.ics. */
export function icsFileName(base: string): string {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'calendar';
  return `kafaa-${slug}.ics`;
}

/** Only items on or after today (dates) or still to end (timestamps), so the "upcoming" files stay small. */
export function upcomingOnly(events: IcsEvent[], now = new Date()): IcsEvent[] {
  const today = now.toISOString().slice(0, 10);
  return events.filter((e) => {
    if (isAllDay(e)) return (e.end && DATE_ONLY.test(e.end) ? e.end > today : e.start >= today);
    const end = new Date(e.end || e.start);
    return !Number.isNaN(end.getTime()) && end.getTime() >= now.getTime();
  });
}

/** The calendar date in Asia/Dubai (UTC+4, no daylight saving) for a date or a timestamp; null when unreadable. */
export function dubaiDate(value: string | null | undefined): string | null {
  if (!value) return null;
  if (DATE_ONLY.test(value)) return icsDate(value) ? value : null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 4 * 3_600_000).toISOString().slice(0, 10);
}
