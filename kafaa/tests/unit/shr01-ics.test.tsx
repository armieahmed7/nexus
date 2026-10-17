// @vitest-environment jsdom
/** SHR-01 · "Add to calendar": the RFC 5545 builder (escaping, folding at 75 octets, CRLF, all-day vs timed, Asia/Dubai times
 *  written in UTC with Z), the event builders in EN and AR, the "everything coming up" file for k-ro, and the button that
 *  saves the file from a Blob (no network, nothing stored). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { buildIcs, countIcsEvents, dubaiDate, foldLine, icsDate, icsEscape, icsFileName, icsUtc, upcomingOnly, type IcsEvent } from '../../src/domain/ics';
import { makeCalendarEvents, type CalendarDeps } from '../../src/shell/calendar/useCalendarEvents';
import { collectUpcoming } from '../../src/shell/calendar/upcoming';
import { localizeRef, translate, type Lang } from '../../src/i18n';
import { AddToCalendar } from '../../src/ui';
import { renderPage } from './g1-harness';

const NOW = new Date('2026-10-17T09:00:00Z');
const enc = new TextEncoder();
const readBlob = (b: Blob) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsText(b); }); // jsdom's Blob has no text()

/** A strict structural check of an .ics text (what a calendar parser needs). Returns the unfolded content lines. */
function validate(ics: string): string[] {
  expect(ics.endsWith('\r\n')).toBe(true);
  expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/); // no bare CR or LF
  const physical = ics.slice(0, -2).split('\r\n');
  for (const l of physical) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
  const lines: string[] = [];
  for (const l of physical) {
    if (l.startsWith(' ')) lines[lines.length - 1] += l.slice(1);
    else lines.push(l);
  }
  for (const l of lines) expect(l).toMatch(/^[A-Z][A-Z0-9-]*(;[A-Z-]+=[^:;]+)*:/);
  expect(lines[0]).toBe('BEGIN:VCALENDAR');
  expect(lines[lines.length - 1]).toBe('END:VCALENDAR');
  expect(lines).toContain('VERSION:2.0');
  expect(lines.some((l) => l.startsWith('PRODID:'))).toBe(true);
  let open = false;
  let props: string[] = [];
  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') { expect(open).toBe(false); open = true; props = []; continue; }
    if (l === 'END:VEVENT') {
      expect(open).toBe(true);
      open = false;
      const names = props.map((p) => p.split(/[;:]/)[0]);
      for (const req of ['UID', 'DTSTAMP', 'DTSTART', 'DTEND', 'SUMMARY']) expect(names.filter((n) => n === req)).toHaveLength(1);
      const start = props.find((p) => p.startsWith('DTSTART'))!;
      const end = props.find((p) => p.startsWith('DTEND'))!;
      if (start.startsWith('DTSTART;VALUE=DATE:')) {
        expect(start).toMatch(/^DTSTART;VALUE=DATE:\d{8}$/);
        expect(end).toMatch(/^DTEND;VALUE=DATE:\d{8}$/);
        expect(end.slice(-8) > start.slice(-8)).toBe(true);
      } else {
        expect(start).toMatch(/^DTSTART:\d{8}T\d{6}Z$/);
        expect(end).toMatch(/^DTEND:\d{8}T\d{6}Z$/);
        expect(end.slice(6) > start.slice(8)).toBe(true);
      }
      expect(props.find((p) => p.startsWith('DTSTAMP'))).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
      continue;
    }
    if (open) props.push(l);
  }
  expect(open).toBe(false);
  return lines;
}
const unescape = (v: string) => v.replace(/\\(n|N|\\|;|,)/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
const prop = (lines: string[], name: string) => lines.filter((l) => l.split(/[;:]/)[0] === name).map((l) => unescape(l.slice(l.indexOf(':') + 1)));

describe('SHR-01 · RFC 5545 text rules', () => {
  it('escapes backslash, semicolon, comma and newlines (TEXT), and drops other control characters', () => {
    expect(icsEscape('a\\b;c,d\ne\r\nf\rg')).toBe('a\\\\b\\;c\\,d\\ne\\nf\\ng');
    expect(icsEscape('tab\there\u0007')).toBe('tabhere');
    expect(icsEscape('Reactor: 100% ✓')).toBe('Reactor: 100% ✓'); // colon is not escaped in TEXT
  });
  it('folds at 75 octets with CRLF + space and never splits a UTF-8 character (Arabic, emoji)', () => {
    const ascii = `SUMMARY:${'x'.repeat(200)}`;
    const folded = foldLine(ascii);
    const parts = folded.split('\r\n');
    expect(parts[0]).toHaveLength(75);
    for (const p of parts.slice(1)) { expect(p.startsWith(' ')).toBe(true); expect(enc.encode(p).length).toBeLessThanOrEqual(75); }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(ascii);
    const ar = `SUMMARY;LANGUAGE=ar:${'تدريب على المحاكاة '.repeat(8)}🙂🙂`;
    const fa = foldLine(ar).split('\r\n');
    for (const p of fa) {
      expect(enc.encode(p).length).toBeLessThanOrEqual(75);
      expect(new TextDecoder('utf-8', { fatal: true }).decode(enc.encode(p))).toBe(p); // each physical line is whole UTF-8
    }
    expect(fa.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(ar);
    expect(foldLine('SHORT:line')).toBe('SHORT:line');
  });
  it('formats UTC timestamps and dates; rejects impossible dates', () => {
    expect(icsUtc('2026-10-20T08:00:00+04:00')).toBe('20261020T040000Z'); // 08:00 in Asia/Dubai is 04:00Z
    expect(icsUtc('2026-10-14T08:00:00Z')).toBe('20261014T080000Z');
    expect(icsUtc('nonsense')).toBeNull();
    expect(icsDate('2026-12-14')).toBe('20261214');
    expect(icsDate('2026-02-30')).toBeNull();
    expect(icsDate('2026-12-14T00:00:00Z')).toBeNull();
  });
  it('dubaiDate gives the Asia/Dubai calendar day of a timestamp', () => {
    expect(dubaiDate('2026-10-13')).toBe('2026-10-13');
    expect(dubaiDate('2026-10-13T21:00:00Z')).toBe('2026-10-14'); // 01:00 on the 14th in Dubai
    expect(dubaiDate('2026-10-13T19:59:00Z')).toBe('2026-10-13');
    expect(dubaiDate(null)).toBeNull();
    expect(dubaiDate('bad')).toBeNull();
  });
  it('a safe file name', () => {
    expect(icsFileName('My learning')).toBe('kafaa-my-learning.ics');
    expect(icsFileName('../../etc')).toBe('kafaa-etc.ics');
    expect(icsFileName('')).toBe('kafaa-calendar.ics');
  });
});

describe('SHR-01 · VCALENDAR and VEVENT', () => {
  const timed: IcsEvent = { uid: 'kafaa-session-s1', summary: 'Training: COCT, crew B; simulator', start: '2026-10-20T08:00:00+04:00', end: '2026-10-20T16:00:00+04:00', location: 'Simulator Training Center, Barakah', description: 'Line one\nLine two', url: 'https://upskill.enecai.xyz/kafaa/my/learning' };
  const allDay: IcsEvent = { uid: 'kafaa-plan-a1', summary: 'Due: INTILAQA', start: '2026-11-30' };
  it('writes a valid calendar: header, CRLF, folding, required properties, Dubai time in UTC with Z', () => {
    const ics = buildIcs([timed, allDay], { name: "Kafa'a: my training", now: NOW, lang: 'en' });
    const lines = validate(ics);
    expect(lines).toContain('CALSCALE:GREGORIAN');
    expect(lines).toContain('METHOD:PUBLISH');
    expect(lines).toContain("X-WR-CALNAME:Kafa'a: my training");
    expect(lines).toContain('DTSTAMP:20261017T090000Z');
    expect(lines).toContain('UID:kafaa-session-s1@upskill.enecai.xyz');
    expect(lines).toContain('DTSTART:20261020T040000Z');
    expect(lines).toContain('DTEND:20261020T120000Z');
    expect(lines).toContain('SUMMARY;LANGUAGE=en:Training: COCT\\, crew B\\; simulator');
    expect(lines).toContain('LOCATION;LANGUAGE=en:Simulator Training Center\\, Barakah');
    expect(lines).toContain('URL;VALUE=URI:https://upskill.enecai.xyz/kafaa/my/learning');
    expect(prop(lines, 'DESCRIPTION')[0]).toBe('Line one\nLine two\n\nhttps://upskill.enecai.xyz/kafaa/my/learning');
    expect(ics).not.toContain('VTIMEZONE'); // UTC throughout, so no zone definition is needed
  });
  it('all-day events use VALUE=DATE with the exclusive end on the next day and do not block time', () => {
    const lines = validate(buildIcs([allDay, { uid: 'x-eom', summary: 'Year end', start: '2026-12-31' }, { uid: 'x-span', summary: 'Window', start: '2026-11-01', end: '2026-11-04' }], { now: NOW }));
    expect(lines).toContain('DTSTART;VALUE=DATE:20261130');
    expect(lines).toContain('DTEND;VALUE=DATE:20261201');
    expect(lines).toContain('DTEND;VALUE=DATE:20270101');
    expect(lines).toContain('DTEND;VALUE=DATE:20261104');
    expect(lines.filter((l) => l === 'TRANSP:TRANSPARENT')).toHaveLength(3);
    expect(lines.some((l) => l.startsWith('SUMMARY;LANGUAGE'))).toBe(false); // no lang given, no parameter
  });
  it('timed events without (or with a bad) end last one hour', () => {
    const lines = validate(buildIcs([{ uid: 'a', summary: 'A', start: '2026-10-20T06:00:00Z' }, { uid: 'b', summary: 'B', start: '2026-10-20T06:00:00Z', end: '2026-10-20T05:00:00Z' }], { now: NOW }));
    expect(lines.filter((l) => l === 'DTEND:20261020T070000Z')).toHaveLength(2);
  });
  it('leaves out unreadable events and duplicates by UID, and keeps a long Arabic description intact', () => {
    const long = 'تقرير خطة التدريب الشاملة، القاعدة: FANR-REG-17; المسؤول: منسق الترخيص\n'.repeat(5);
    const ics = buildIcs([
      { uid: 'ok', summary: 'تدريب: محاكاة', start: '2026-10-21T04:00:00Z', description: long },
      { uid: 'ok', summary: 'duplicate', start: '2026-10-22' },
      { uid: 'bad-date', summary: 'x', start: '2026-02-30' },
      { uid: 'bad-ts', summary: 'x', start: 'not a date' },
      { uid: '', summary: 'no uid', start: '2026-10-22' },
      { uid: 'no-summary', summary: '', start: '2026-10-22' },
    ], { now: NOW, lang: 'ar' });
    const lines = validate(ics);
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(prop(lines, 'SUMMARY')).toEqual(['تدريب: محاكاة']);
    expect(prop(lines, 'DESCRIPTION')[0]).toBe(long);
    expect(countIcsEvents([{ uid: 'a', summary: 'A', start: '2026-10-22' }, { uid: 'a', summary: 'A', start: '2026-10-22' }])).toBe(1);
  });
  it('an unsafe URL is kept out of the URL property (still in the text)', () => {
    const lines = validate(buildIcs([{ uid: 'u', summary: 'U', start: '2026-10-22', url: 'javascript:alert(1)' }], { now: NOW }));
    expect(lines.some((l) => l.startsWith('URL'))).toBe(false);
  });
  it('upcomingOnly keeps today and later (dates) and anything not yet ended (timestamps)', () => {
    const ev = (start: string, end?: string): IcsEvent => ({ uid: start, summary: 's', start, end });
    const kept = upcomingOnly([ev('2026-10-16'), ev('2026-10-17'), ev('2026-10-18'), ev('2026-10-17T05:00:00Z', '2026-10-17T08:00:00Z'), ev('2026-10-17T08:00:00Z', '2026-10-17T10:00:00Z'), ev('2026-10-15', '2026-10-18')], NOW);
    expect(kept.map((e) => e.start)).toEqual(['2026-10-17', '2026-10-18', '2026-10-17T08:00:00Z', '2026-10-15']);
  });
});

// The builders as the pages use them, without React (same translations as useT / usePick).
function deps(lang: Lang): CalendarDeps {
  return {
    t: (k: string, v?: Record<string, string | number>) => translate(lang, k, v),
    pick: (row: object | null | undefined, field: string) => { const r = (row ?? {}) as Record<string, unknown>; return String((lang === 'ar' && r[`${field}_ar`] ? r[`${field}_ar`] : r[`${field}_en`]) ?? r[field] ?? ''); },
    f: { num: (n: number | null | undefined) => String(n), pct: (n: number | null | undefined) => `${n}%` } as CalendarDeps['f'],
    refText: (r: string | null | undefined) => localizeRef(r, lang),
    link: (path: string) => `https://upskill.enecai.xyz/kafaa${lang === 'ar' ? '/ar' : ''}${path}`,
  };
}
const seed = JSON.parse(readFileSync(`${process.cwd()}/src/seed/seed.json`, 'utf8')).tables as Record<string, Record<string, unknown>[]>;
const mine = <T,>(table: string, me: string) => seed[table].filter((r) => r.person_id === me) as T[];

describe('SHR-01 · event builders in the page language', () => {
  it('obligations carry the rule, the owner role and "Kafa\'a sends nothing to FANR" (EN and AR)', () => {
    const o = seed.reporting_obligations[0] as never;
    const en = makeCalendarEvents(deps('en')).obligation(o, '/licensing/calendar');
    expect(en.uid).toBe('kafaa-obligation-ro-1');
    expect(en.start).toBe('2026-11-11');
    expect(en.summary).toBe('Due: Candidate list for COIT class 2027 (draft)');
    expect(en.description).toContain('Rule: FANR-REG-17 Art. 13');
    expect(en.description).toContain('Owner: Licensing coordinator');
    expect(en.description).toContain("Kafa'a sends nothing to FANR.");
    expect(en.description).toContain('demo, synthetic data');
    expect(en.url).toBe('https://upskill.enecai.xyz/kafaa/licensing/calendar');
    const ar = makeCalendarEvents(deps('ar')).obligation(o, '/licensing/calendar');
    expect(ar.summary).toBe('موعد الاستحقاق: قائمة المرشحين لدفعة 2027 (مسودة)');
    expect(ar.description).toContain('لا ترسل كفاءة أي شيء');
    expect(ar.url).toBe('https://upskill.enecai.xyz/kafaa/ar/licensing/calendar');
    validate(buildIcs([en], { now: NOW, lang: 'en' }));
    validate(buildIcs([ar], { now: NOW, lang: 'ar' }));
  });
  it('sessions are timed from the stored UTC start/end, with the Arabic location on Arabic pages', () => {
    const s = seed.sessions.find((x) => x.id === 's-coct-b') as never;
    const c = seed.courses.find((x) => x.id === 'c-coct') as never;
    const en = makeCalendarEvents(deps('en')).session(s, c, '/my/learning', 'Simulator', 'enrolled');
    expect(en).toMatchObject({ uid: 'kafaa-session-s-coct-b', start: '2026-10-14T08:00:00Z', end: '2026-10-14T16:00:00Z', location: 'Simulator Training Center' });
    expect(en.summary.startsWith('Training: ')).toBe(true);
    expect(en.description).toContain('Crew B');
    expect(en.description).toContain('Status: Enrolled');
    const lines = validate(buildIcs([en], { now: NOW }));
    expect(lines).toContain('DTSTART:20261014T080000Z');
    const ar = makeCalendarEvents(deps('ar')).session(s, c, '/my/learning');
    expect(ar.location).toBe('مركز التدريب على المحاكاة');
    expect(ar.summary.startsWith('تدريب: ')).toBe(true);
  });
  it('assessments last the form time limit; security-restricted qualifications never get a date', () => {
    const cal = makeCalendarEvents(deps('en'));
    const a = { id: 'at-x', form_id: 'f', scheduled_for: '2026-10-20T06:00:00Z', status: 'scheduled' } as never;
    const e = cal.attempt(a, { id: 'f', title_en: 'Thermodynamics', title_ar: 'الديناميكا الحرارية', item_ids: ['1', '2'], time_limit_min: 90, pass_mark: 80 } as never, '/my/assessments')!;
    expect(e.end).toBe('2026-10-20T07:30:00.000Z');
    expect(e.summary).toBe('Assessment: Thermodynamics');
    expect(cal.attempt({ ...(a as object), scheduled_for: null } as never, undefined, '/my/assessments')).toBeNull();
    expect(cal.qualExpiry({ id: 'q', standard_id: 's', expires_on: '2027-01-01', security_mirror_only: true, source_system: 'TRS' } as never, undefined, '/my/quals')).toBeNull();
  });
});

describe('SHR-01 · everything coming up for k-ro (seed, 17 Oct 2026)', () => {
  const me = 'p-k-ro';
  const input = {
    enrolments: mine('enrolments', me), sessions: seed.sessions, courses: seed.courses, attempts: mine('attempts', me), forms: seed.assessment_forms,
    plans: mine('dev_plans', me), activities: mine('plan_activities', me), roles: seed.job_roles, quals: mine('qual_records', me), standards: seed.qual_standards,
    licence: mine('licences', me)[0] ?? null, medical: mine('medical_due', me)[0] ?? null, requal: mine('requal_cycles', me)[0] ?? null, tasks: mine('licensing_tasks', me), milestones: mine('exam_milestones', me),
  } as never;
  it('collects only upcoming items, each linked to the page it lives on, and writes one valid file', () => {
    const events = collectUpcoming(input, makeCalendarEvents(deps('en')), { now: NOW });
    const uids = events.map((e) => e.uid);
    expect(uids).toContain('kafaa-session-s-intilaqa'); // requested session on 29 Oct
    expect(uids).not.toContain('kafaa-session-s-coct-b'); // 14 Oct, already over
    expect(uids).not.toContain('kafaa-attempt-at-6'); // scheduled 8 Oct, in the past
    expect(uids).toEqual(expect.arrayContaining(['kafaa-plan-dp-k-ro-a1', 'kafaa-plan-dp-k-ro-a3', 'kafaa-qual-qr-p-k-ro-qs-ro', 'kafaa-licence-expiry-2029-08-01', 'kafaa-licence-medical-2027-08-08', 'kafaa-licence-requal-2027-12-31']));
    expect(uids.some((u) => u.startsWith('kafaa-plan-pa-cc'))).toBe(false); // closed plans stay out
    expect(events.find((e) => e.uid === 'kafaa-session-s-intilaqa')!.url).toBe('https://upskill.enecai.xyz/kafaa/my/learning');
    expect(events.find((e) => e.uid === 'kafaa-plan-dp-k-ro-a1')!.url).toBe('https://upskill.enecai.xyz/kafaa/my/plan');
    expect(events.find((e) => e.uid === 'kafaa-licence-expiry-2029-08-01')!.summary).toBe('Licence: Certificate expires');
    expect(events.every((e) => e.description?.includes('demo, synthetic data'))).toBe(true);
    const lines = validate(buildIcs(events, { now: NOW, lang: 'en', name: 'x' }));
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(events.length);
  });
  it('Arabic: the same UIDs with Arabic titles and /ar links', () => {
    const en = collectUpcoming(input, makeCalendarEvents(deps('en')), { now: NOW });
    const ar = collectUpcoming(input, makeCalendarEvents(deps('ar')), { now: NOW });
    expect(ar.map((e) => e.uid)).toEqual(en.map((e) => e.uid));
    expect(ar.find((e) => e.uid === 'kafaa-licence-expiry-2029-08-01')!.summary.startsWith('الرخصة: ')).toBe(true);
    expect(ar.every((e) => e.url!.startsWith('https://upskill.enecai.xyz/kafaa/ar/'))).toBe(true);
    validate(buildIcs(ar, { now: NOW, lang: 'ar' }));
  });
});

describe('SHR-01 · the button saves a Blob, sends nothing', () => {
  afterEach(() => vi.restoreAllMocks());
  it('downloads kafaa-<name>.ics as text/calendar, in the page language, without any network call', async () => {
    const blobs: Blob[] = [];
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => { blobs.push(b); return 'blob:test'; };
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const events: IcsEvent[] = [{ uid: 'kafaa-plan-a', summary: 'Due: A', start: '2026-11-30' }, { uid: 'kafaa-plan-b', summary: 'Due: B', start: '2026-12-31' }];
    const { container, unmount } = await renderPage(<AddToCalendar events={events} file="my-plan" calendarName="Kafa'a: my plan" />, { persona: 'k-ro', path: '/my/plan' });
    const btn = await waitFor(() => { const b = container.querySelector<HTMLButtonElement>('[data-testid="ics-download"]'); expect(b).toBeTruthy(); return b!; }, { timeout: 30000 });
    expect(btn.textContent).toBe('Add all to calendar');
    expect(btn.getAttribute('aria-label')).toBe('Add all to calendar (2 events)');
    const before = fetchSpy.mock.calls.length;
    fireEvent.click(btn);
    expect(click).toHaveBeenCalledTimes(1);
    expect(names).toEqual(['kafaa-my-plan.ics']);
    expect(blobs[0].type).toBe('text/calendar;charset=utf-8');
    const text = await readBlob(blobs[0]);
    validate(text);
    expect(text).toContain('SUMMARY;LANGUAGE=en:Due: A');
    expect(fetchSpy.mock.calls.length).toBe(before);
    unmount();
    const r2 = await renderPage(<AddToCalendar events={events.slice(0, 1)} compact itemTitle="ب" file="x" calendarName="x" />, { persona: 'k-ro', path: '/ar/my/plan' });
    const b2 = await waitFor(() => { const b = r2.container.querySelector<HTMLButtonElement>('[data-testid="ics-download"]'); expect(b).toBeTruthy(); return b!; }, { timeout: 30000 });
    expect(b2.textContent).toBe('أضف ب إلى التقويم');
    fireEvent.click(b2);
    expect(await readBlob(blobs[1])).toContain('SUMMARY;LANGUAGE=ar:Due: A');
    r2.unmount();
  }, 90000);
  it('renders nothing when there is nothing to add', async () => {
    const { container } = await renderPage(<div data-testid="wrap"><AddToCalendar events={[{ uid: 'x', summary: 'x', start: 'bad' }]} file="x" calendarName="x" /></div>, { persona: 'k-ro', path: '/my' });
    await waitFor(() => expect(container.querySelector('[data-testid="wrap"]')).toBeTruthy(), { timeout: 30000 });
    expect(container.querySelector('[data-testid="ics-download"]')).toBeNull();
  }, 90000);
});
