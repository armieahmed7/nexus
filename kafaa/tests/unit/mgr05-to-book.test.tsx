// @vitest-environment jsdom
/** MGR-05: the "To book" worklist on /training/cohorts: assigned or approved training without a seat on a scheduled session, grouped by
 *  course with the open sessions, crew-only simulator sessions, "Book N" through rpc.enrolCourse (books the existing enrolment), EN/AR. */
import { beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import seed from '../../src/seed/seed.json';
import TrainingCohortsPage from '../../src/modules/m04/TrainingCohortsPage';
import { eligibleFor, groupByCourse, openSessions, pickForSession, toBookList } from '../../src/modules/m04/toBook';
import type { CoursesRow, EnrolmentsRow, PeopleRow, SessionsRow } from '../../src/data/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const NOW = '2026-10-08T06:00:00.000Z';
const enrolments = T.enrolments as EnrolmentsRow[];
const sessions = T.sessions as SessionsRow[];
const courses = new Map((T.courses as CoursesRow[]).map((c) => [c.id, c]));
const people = new Map((T.people as PeopleRow[]).map((p) => [p.id, p]));
const list = () => toBookList(enrolments, sessions, courses, people, NOW, T.training_records);

beforeAll(() => Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true, configurable: true }));

describe('MGR-05 rules (seed)', () => {
  it('lists assigned or approved enrolments without a seat on a scheduled session, active people only', () => {
    const xs = list();
    expect(xs.length).toBeGreaterThan(20);
    for (const x of xs) {
      expect(['assigned', 'approved']).toContain(x.e.status);
      expect(x.e.session_id && sessions.find((s) => s.id === x.e.session_id)?.status === 'scheduled').toBeFalsy();
      if (x.person) expect(x.person.status).toBe('active');
    }
  });
  it('leaves out self-paced e-learning that is not run as sessions, keeps e-learning that is (HU-201)', () => {
    const ids = new Set(list().map((x) => x.e.course_id));
    expect(ids.has('c-sec-aw')).toBe(false);
    expect(ids.has('c-hu-ref')).toBe(true);
  });
  it('COCT is licence-critical and comes first', () => {
    const xs = list();
    expect(xs.find((x) => x.e.course_id === 'c-coct')?.priority).toBe('licence_critical');
    expect(xs[0].priority).toBe('licence_critical');
    expect(groupByCourse(xs, sessions, enrolments, NOW)[0].courseId).toBe('c-coct');
  });
  it('an enrolment booked on a cancelled session needs a seat again', () => {
    const e = list()[0].e;
    const s = { ...sessions.find((x) => x.course_id === e.course_id)!, id: 'ses-x', status: 'cancelled' as const };
    const xs = toBookList(enrolments.map((x) => (x.id === e.id ? { ...x, session_id: 'ses-x' } : x)), [...sessions, s], courses, people, NOW);
    expect(xs.some((x) => x.e.id === e.id)).toBe(true);
  });
  it('prerequisites as rpc.enrolCourse checks them: people without them are listed but never offered a seat', () => {
    const xs = list();
    const coct = xs.filter((x) => x.e.course_id === 'c-coct');
    expect(coct.every((x) => x.missing.includes('c-coit-exam'))).toBe(true); // seed: no COIT exam record for these people
    const hu = xs.filter((x) => x.e.course_id === 'c-hu-ref');
    expect(hu.length).toBeGreaterThan(1);
    expect(hu.every((x) => x.missing.length === 0)).toBe(true);
    const s = sessions.find((x) => x.course_id === 'c-coct')!;
    expect(eligibleFor({ ...s, crew: null }, xs)).toEqual([]);
  });
  it('open sessions: scheduled, not started, with free seats; crew sessions take their own crew only; booking is capped at free seats', () => {
    const open = openSessions('c-coct', sessions, enrolments, NOW);
    expect(open.length).toBeGreaterThan(0);
    for (const o of open) expect(o.free).toBe(Math.max(0, o.s.capacity - o.taken));
    const xs = list();
    const o = open[0];
    const ready = xs.map((x) => ({ ...x, missing: [] }));
    const crewOnly = eligibleFor(o.s, ready);
    expect(crewOnly.length).toBeGreaterThan(0);
    for (const x of crewOnly) {
      expect(x.e.course_id).toBe('c-coct');
      if (o.s.crew) expect(x.person?.crew).toBe(o.s.crew);
    }
    expect(pickForSession({ ...o, free: 1 }, ready)).toHaveLength(1);
    expect(openSessions('c-coct', sessions, enrolments, '2099-01-01T00:00:00Z')).toEqual([]);
  });
});

/** A future two-seat HU-201 session so the page has a session to book on whatever today's date is. */
const FUTURE = '2099-03-01T08:00:00.000Z';
function addSession() {
  const b = getLocalBackend();
  b.rawInsert('sessions', { id: 'ses-mgr05', course_id: 'c-hu-ref', starts_at: FUTURE, ends_at: '2099-03-01T16:00:00.000Z', location: 'Training centre room 4', location_ar: 'مركز التدريب، القاعة 4', instructor_person_id: null, capacity: 2, kind: 'class', crew: null, priority: 'mandatory', audience: 'staff', public_summary: false, status: 'scheduled' } as never);
}

describe('MGR-05 page: /training/cohorts?tab=book', () => {
  it('training manager: COCT first (prerequisites missing, no booking offered); books two HU-201 people on their existing enrolments', async () => {
    await renderPage(<TrainingCohortsPage />, { persona: 'training-mgr', path: '/training/cohorts?tab=book', prepare: addSession });
    const tab = await screen.findByRole('tab', { name: /To book/ });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    const cards = await screen.findByTestId('m04-tobook-courses', {}, { timeout: 15000 });
    const first = within(cards).getAllByRole('listitem')[0];
    expect(first.textContent).toMatch(/COCT-26/);
    expect(first.textContent).toMatch(/Licence-critical/);
    expect(within(first).getAllByTestId('m04-tobook-schedule')[0].getAttribute('href')).toBe('/training/schedule?course=c-coct');
    expect(within(first).getByTestId('m04-tobook-prereq').textContent).toMatch(/prerequisites/);
    expect(within(first).queryAllByTestId('m04-tobook-book')).toHaveLength(0);
    const hu = within(cards).getAllByRole('listitem').find((x) => /HU-201/.test(x.textContent ?? '') && x.tagName === 'LI' && x.querySelector('[data-testid="m04-tobook-schedule"]'))!;
    const b = getLocalBackend();
    const waiting = () => b.raw('enrolments').filter((e) => e.course_id === 'c-hu-ref' && e.status === 'assigned' && !e.session_id).length;
    const before = waiting();
    const row = within(hu).getAllByRole('listitem').find((x) => /2099/.test(x.textContent ?? ''))!;
    fireEvent.click(within(row).getByRole('button', { name: 'Book 2' }));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(b.raw('enrolments').filter((e) => e.session_id === 'ses-mgr05' && e.status === 'enrolled')).toHaveLength(2), { timeout: 15000 });
    expect(waiting()).toBe(before - 2);
  });
  it('filters by crew and shows the full list with a link to find a session', async () => {
    await renderPage(<TrainingCohortsPage />, { persona: 'training-mgr', path: '/training/cohorts?tab=book&bcrew=B' });
    await screen.findByTestId('m04-tobook-courses', {}, { timeout: 15000 });
    expect(screen.getAllByText('Find a session').length).toBeGreaterThan(0);
    expect(screen.getAllByText('B').length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('cell', { name: 'C' })).toHaveLength(0);
  });
  it('Arabic: the tab and the worklist read in Arabic', async () => {
    await renderPage(<TrainingCohortsPage />, { persona: 'training-mgr', path: '/ar/training/cohorts?tab=book' });
    expect(await screen.findByRole('tab', { name: /بانتظار الحجز/ })).toBeTruthy();
    await screen.findByTestId('m04-tobook-courses', {}, { timeout: 15000 });
    expect(screen.getByText('حسب الدورة')).toBeTruthy();
    expect(screen.getAllByText('ابحث عن جلسة').length).toBeGreaterThan(0);
  });
  it('the cohorts tab is still the default', async () => {
    await renderPage(<TrainingCohortsPage />, { persona: 'training-mgr', path: '/training/cohorts' });
    expect((await screen.findByRole('tab', { name: 'Cohorts' })).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByTestId('m04-cohort-by')).toBeTruthy();
  });
});
