// @vitest-environment jsdom
/** EMP-09: the weekly goal on /my/coach shows progress from the learner's own learning record: recorded hours this week
 *  (Monday to Sunday, Asia/Dubai calendar) against the goal, the last 8 weeks as a small bar row, what is left, and coach
 *  items that fit in the time left (required first). Plural-aware hours in English and Arabic. No streaks or comparisons. */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderPage } from './g1-harness';
import MyCoachPage from '../../src/modules/m19/MyCoachPage';
import { daysLeftInWeek, dubaiToday, fitsInTimeLeft, weekStart, weeklyRecorded } from '../../src/modules/m19/week';
import { translateCount } from '../../src/i18n';
import type { CoachCard } from '../../src/modules/m19/coach';

const T = { timeout: 60000 };
const st = (occurred_at: string, duration?: string) => ({ occurred_at, result: duration ? { duration } : null });
const card = (id: string, hours: number | null, pinned: CoachCard['pinned'] = null) => ({ id, hours, pinned }) as CoachCard;

describe('EMP-09 · week helpers', () => {
  it('weeks start on Monday', () => {
    expect(weekStart('2026-10-17')).toBe('2026-10-12'); // Saturday
    expect(weekStart('2026-10-12')).toBe('2026-10-12'); // Monday
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // Sunday
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
  });
  it('days left counts today: Monday 7, Saturday 2, Sunday 1', () => {
    expect(daysLeftInWeek('2026-10-12')).toBe(7);
    expect(daysLeftInWeek('2026-10-17')).toBe(2);
    expect(daysLeftInWeek('2026-10-18')).toBe(1);
  });
  it('buckets recorded durations into the last 8 weeks on the Dubai calendar', () => {
    const w = weeklyRecorded([
      st('2026-10-13T08:00:00Z', 'PT1H30M'),
      st('2026-10-16T09:00:00Z', 'PT30M'),
      st('2026-10-11T21:00:00Z', 'PT1H'), // Sunday 21:00 UTC = Monday 01:00 in Dubai: this week
      st('2026-10-11T19:00:00Z', 'PT2H'), // Sunday 23:00 in Dubai: last week
      st('2026-10-14T08:00:00Z'), // no duration recorded
      st('2026-08-01T08:00:00Z', 'PT5H'), // older than 8 weeks
      st('2026-09-01T08:00:00Z', 'P1D'), // a day counts 8 hours
    ], '2026-10-17');
    expect(w.length).toBe(8);
    expect(w[7]).toEqual({ start: '2026-10-12', minutes: 180 });
    expect(w[6]).toEqual({ start: '2026-10-05', minutes: 120 });
    expect(w[0].start).toBe('2026-08-24');
    expect(w.find((b) => b.start === '2026-08-31')?.minutes).toBe(480);
    expect(w.reduce((n, b) => n + b.minutes, 0)).toBe(780);
  });
  it('what fits in the time left: required first, within the hours left, at most 3', () => {
    const feed = [card('a', 2), card('b', 1.5, 'must_keep'), card('c', null), card('d', 3), card('e', 0.5), card('f', 0.5)];
    expect(fitsInTimeLeft(feed, 2.5).map((c) => c.id)).toEqual(['b', 'e', 'f']);
    expect(fitsInTimeLeft(feed, 4).map((c) => c.id)).toEqual(['b', 'a', 'e']);
    expect(fitsInTimeLeft(feed, 0)).toEqual([]);
  });
  it('hours are plural-aware in English and Arabic', () => {
    expect(translateCount('en', 'm19.goal.nHours', 1)).toBe('1 hour');
    expect(translateCount('en', 'm19.goal.nHours', 2.5)).toBe('2.5 hours');
    expect(translateCount('ar', 'm19.goal.nHours', 1)).toBe('ساعة واحدة');
    expect(translateCount('ar', 'm19.goal.nHours', 2)).toBe('ساعتان');
    expect(translateCount('ar', 'm19.goal.nHours', 4)).toBe('4 ساعات');
    expect(translateCount('en', 'm19.goal.weekOf', 1, { done: '0.5' })).toBe('This week: 0.5 of 1 hour recorded');
    expect(translateCount('ar', 'm19.goal.weekOf', 4, { done: '1.5' })).toBe('هذا الأسبوع: سُجّلت 1.5 من 4 ساعات');
  });
});

describe('EMP-09 · /my/coach as k-ro (goal 4 h a week)', () => {
  it('shows this week’s recorded hours from the learning record, what is left, the 8-week bar row and items that fit', async () => {
    let expected = 0;
    await renderPage(<MyCoachPage />, {
      persona: 'k-ro', path: '/my/coach',
      prepare: (b) => {
        b.rawInsert('xapi_statements', { id: 'emp09-now', actor_person_id: 'p-k-ro', verb: 'experienced', object_type: 'knowledge_asset', object_id: 'ka-emp09', object_name: { 'en-US': 'EMP-09 test' }, result: { duration: 'PT1H' }, context: {}, occurred_at: new Date().toISOString(), stored_at: new Date().toISOString(), source: 'f21_knowledge', source_ref: 'emp09', stored_by: null, version: '1.0.3' } as never);
        const mine = b.raw('xapi_statements').filter((x) => x.actor_person_id === 'p-k-ro');
        const w = weeklyRecorded(mine, dubaiToday());
        expected = Math.round((w[7].minutes / 60) * 10) / 10;
      },
    });
    expect(expected).toBeGreaterThanOrEqual(1);
    const line = await screen.findByTestId('m19-goal-week', {}, T);
    const fmt = new Intl.NumberFormat('en-GB-u-nu-latn').format(expected);
    await waitFor(() => expect(line.textContent).toBe(`This week: ${fmt} of 4 hours recorded`), T);
    const left = screen.getByTestId('m19-goal-left').textContent ?? '';
    if (expected >= 4) expect(left).toMatch(/reached this week's goal/);
    else expect(left).toMatch(/^[\d.]+ hours? left, with \d+ days? to go this week \(Monday to Sunday\)\.$/);
    expect(left).not.toMatch(/\b1 (hours|days)\b/);
    const bars = screen.getByTestId('m19-goal-bars').querySelectorAll('li');
    expect(bars.length).toBe(8);
    expect(Number(bars[7].getAttribute('data-hours'))).toBe(expected);
    expect(bars[7].textContent).toMatch(/^Week of .+: /);
    if (expected < 4) expect(screen.getByTestId('m19-goal-fits').querySelectorAll('li').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m19-goal').textContent).toContain('Recorded hours come from your own learning record');
  }, 120000);

  it('Arabic: the week line and the bar row read in Arabic', async () => {
    await renderPage(<MyCoachPage />, { persona: 'k-ro', path: '/ar/my/coach' });
    const line = await screen.findByTestId('m19-goal-week', {}, T);
    await waitFor(() => expect(line.textContent).toMatch(/^هذا الأسبوع: سُجّلت .+ من 4 ساعات$/), T);
    expect(screen.getByTestId('m19-goal-bars').querySelectorAll('li')[0].textContent).toMatch(/^أسبوع /);
  }, 120000);
});
