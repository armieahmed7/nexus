// @vitest-environment jsdom
/** EMP-01: the "This week" digest is live. The run is a snapshot of the day it was built, so the row works out days and overdue from
 *  the item's date and today at render, shows an item handled since the build as done (re-checked against its own source row), uses
 *  plural forms for day counts in English and Arabic, and opening the panel marks the earlier digests' notices read. */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { renderPage } from './g1-harness';
import { pluralCategory, translate, translateCount } from '../../src/i18n';
import { DigestItemRow } from '../../src/shell/digest/DigestItemRow';
import { useDoneItems } from '../../src/shell/digest/useDigest';
import { isItemDone, liveDays, liveItem, liveSource } from '../../src/shell/digest/live';
import type { DigestItem } from '../../src/shell/digest/rules';

const W = { timeout: 30000 };
const item = (patch: Partial<DigestItem>): DigestItem => ({
  id: 'conversation:career_conversations:p-k-ro', kind: 'conversation', urgency: 3, ref_table: 'career_conversations', ref_id: 'p-k-ro', title_en: 'Your six-monthly career conversation', title_ar: 'حوارك المهني نصف السنوي',
  meta_en: null, meta_ar: null, link: '/my/career/conversations', due_on: '2026-10-14', days: 1, score: null, why: [{ code: 'conversation_due', vars: { date: '2026-10-14' } }], ...patch,
});
const ME = 'p-k-ro';

describe('EMP-01 · days are worked out at render, not read from the build day', () => {
  it('a conversation built on 13 Oct as "due in 1 day" is 3 days overdue on 17 Oct', () => {
    const i = item({});
    expect(liveDays(i, '2026-10-13')).toBe(1);
    expect(liveDays(i, '2026-10-17')).toBe(-3);
    expect(liveItem(i, '2026-10-17').days).toBe(-3);
    expect(liveItem(i, '2026-10-13')).toBe(i); // unchanged on the build day
  });
  it('undated items keep their stored value; a days reason is recomputed (never below 0)', () => {
    expect(liveDays(item({ due_on: null, days: null }), '2026-10-17')).toBeNull();
    const exp = item({ kind: 'expiry', ref_table: 'qual_records', due_on: '2026-10-20', days: 7, why: [{ code: 'expiry_qual', vars: { days: 7, date: '2026-10-20' } }] });
    expect(liveItem(exp, '2026-10-17').why[0].vars?.days).toBe(3);
    expect(liveItem(exp, '2026-10-25').why[0].vars?.days).toBe(0);
    const coach = item({ kind: 'coach', due_on: '2026-10-20', days: 7, why: [{ code: 'x', key: 'm19.reasons.must_keep', vars: { days: 7 } }] });
    expect(liveItem(coach, '2026-10-17').why[0].vars?.days).toBe(7); // engine keys are left alone
  });

  it('renders "Overdue since 14 Oct 2026" on 17 Oct, and "Due in 1 day" (not "1 days") on 13 Oct', async () => {
    const { container, unmount } = await renderPage(<ol><DigestItemRow i={item({})} today="2026-10-17" /></ol>, { persona: 'k-ro', path: '/my' });
    await waitFor(() => expect(container.textContent).toContain('Overdue since 14 Oct 2026'), W);
    expect(container.textContent).not.toMatch(/Due in \d+ days?/);
    unmount();
    const r2 = await renderPage(<ol><DigestItemRow i={item({})} today="2026-10-13" /></ol>, { persona: 'k-ro', path: '/my' });
    await waitFor(() => expect(r2.container.textContent).toContain('Due in 1 day · 14 Oct 2026'), W);
    expect(r2.container.textContent).not.toContain('1 days');
  }, 90000);
  it('Arabic: "خلال يوم واحد" and "خلال يومين", never "خلال 1 يوماً"', async () => {
    const { container, unmount } = await renderPage(<ol><DigestItemRow i={item({})} today="2026-10-13" /></ol>, { persona: 'k-ro', path: '/ar/my' });
    await waitFor(() => expect(container.textContent).toContain('مستحق خلال يوم واحد'), W);
    expect(container.textContent).not.toMatch(/خلال\s*[1١]\s*يوماً/);
    unmount();
    const r2 = await renderPage(<ol><DigestItemRow i={item({})} today="2026-10-12" /></ol>, { persona: 'k-ro', path: '/ar/my' });
    await waitFor(() => expect(r2.container.textContent).toContain('مستحق خلال يومين'), W);
  }, 90000);
  it('a done item is ticked and says it was handled since the build', async () => {
    const { container } = await renderPage(<ol><DigestItemRow i={item({})} today="2026-10-17" done /></ol>, { persona: 'k-ro', path: '/my' });
    await waitFor(() => expect(screen.getByTestId('digest-done').textContent).toBe('Done since this digest was built'), W);
    expect(container.querySelector('[data-testid="digest-item"]')?.getAttribute('data-done')).toBe('true');
  }, 90000);
});

describe('EMP-01 · items handled since the build', () => {
  const T = '2026-10-17';
  it('conversation: a conversation held after the last one closes it; a draft does not', () => {
    const i = item({});
    expect(liveSource(i)).toEqual({ table: 'career_conversations', by: { person_id: ME } });
    const old = { person_id: ME, status: 'acknowledged', held_on: '2026-04-14' };
    expect(isItemDone(i, { related: [old, { person_id: ME, status: 'draft', held_on: null }] }, ME, T)).toBe(false);
    expect(isItemDone(i, { related: [old, { person_id: ME, status: 'held', held_on: '2026-10-15' }] }, ME, T)).toBe(true);
  });
  it('approvals close when their request leaves the waiting status', () => {
    const a = item({ id: 'approval:mentoring_requests:mr1', kind: 'approval', ref_table: 'mentoring_requests', ref_id: 'mr1', due_on: null, days: null });
    expect(isItemDone(a, { row: { status: 'requested' } }, ME, T)).toBe(false);
    expect(isItemDone(a, { row: { status: 'accepted' } }, ME, T)).toBe(true);
    const ag = item({ id: 'approval:mentoring_agreements:ma1', kind: 'approval', ref_table: 'mentoring_agreements', ref_id: 'ma1', due_on: null, days: null });
    expect(isItemDone(ag, { row: { status: 'proposed' } }, ME, T)).toBe(false);
    expect(isItemDone(ag, { row: { status: 'active' } }, ME, T)).toBe(true);
    const ck = item({ id: 'approval:skill_checkins:ck1', kind: 'approval', ref_table: 'skill_checkins', ref_id: 'ck1', due_on: null, days: null });
    expect(isItemDone(ck, { row: { status: 'open' }, ratings: [{ rater_person_id: ME, status: 'pending' }] }, ME, T)).toBe(false);
    expect(isItemDone(ck, { row: { status: 'open' }, ratings: [{ rater_person_id: ME, status: 'submitted' }] }, ME, T)).toBe(true);
  });
  it('mentoring: a session logged after the last one, or an agreement no longer active, closes it', () => {
    const m = item({ id: 'mentoring:mentoring_agreements:ma1', kind: 'mentoring', ref_table: 'mentoring_agreements', ref_id: 'ma1', due_on: '2026-10-04', days: -4 });
    const a = { id: 'ma1', status: 'active', cadence: 'monthly' };
    expect(isItemDone(m, { row: a, related: [{ agreement_id: 'ma1', held_on: '2026-09-04' }] }, ME, T)).toBe(false);
    expect(isItemDone(m, { row: a, related: [{ agreement_id: 'ma1', held_on: '2026-10-16' }] }, ME, T)).toBe(true);
    expect(isItemDone(m, { row: { ...a, status: 'closed' }, related: [] }, ME, T)).toBe(true);
  });
  it('expiry closes on renewal; refresher closes when nothing is due; unreadable rows and suggestions stay open', () => {
    const e = item({ id: 'expiry:qual_records:q1', kind: 'expiry', ref_table: 'qual_records', ref_id: 'q1', due_on: '2026-11-01', days: 20 });
    expect(isItemDone(e, { row: { status: 'qualified', expires_on: '2026-11-01' } }, ME, T)).toBe(false);
    expect(isItemDone(e, { row: { status: 'renewed', expires_on: '2029-11-01' } }, ME, T)).toBe(true);
    const r = item({ id: 'refresher:refresh_state:p-k-ro', kind: 'refresher', ref_table: 'refresh_state', ref_id: ME, due_on: '2026-10-13', days: 0 });
    expect(isItemDone(r, { related: [{ person_id: ME, due_on: '2026-10-16' }] }, ME, T)).toBe(false);
    expect(isItemDone(r, { related: [{ person_id: ME, due_on: '2026-10-20' }] }, ME, T)).toBe(true);
    expect(isItemDone(e, { row: null }, ME, T)).toBe(false);
    expect(liveSource(item({ id: 'opportunity:opportunities:o1', kind: 'opportunity', ref_table: 'opportunities', ref_id: 'o1' }))).toBeNull();
    expect(liveSource(item({ id: 'coach:coach:h1', kind: 'coach', ref_table: 'coach', ref_id: 'h1' }))).toBeNull();
  });

  function Probe({ items }: { items: DigestItem[] }) {
    const done = useDoneItems(items);
    return <p data-testid="probe">{items.map((i) => `${i.id}=${done.has(i.id) ? 'done' : 'open'}`).join(' ')}</p>;
  }
  it('k-ro on the local backend: a completed enrolment is done, an in-progress one stays open (RLS read of own rows)', async () => {
    const coach = (id: string) => item({ id: `coach:enrolments:${id}`, kind: 'coach', ref_table: 'enrolments', ref_id: id, due_on: '2026-11-22', days: 45, link: '/learn/course/c-hu' });
    await renderPage(<Probe items={[coach('en-134'), coach('en-135')]} />, { persona: 'k-ro', path: '/my' });
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('coach:enrolments:en-134=done coach:enrolments:en-135=open'), W);
  }, 90000);
});

describe('EMP-01 · plural forms (Intl.PluralRules)', () => {
  it('English one/other and Arabic zero/one/two/few/many/other', () => {
    expect([1, 2, 5].map((n) => translateCount('en', 'common.nDays', n))).toEqual(['1 day', '2 days', '5 days']);
    expect([0, 1, 2, 3, 11, 100].map((n) => pluralCategory('ar', n))).toEqual(['zero', 'one', 'two', 'few', 'many', 'other']);
    expect([1, 2, 3, 11, 100].map((n) => translateCount('ar', 'common.nDays', n))).toEqual(['يوم واحد', 'يومين', '3 أيام', '11 يوماً', '100 يوم']);
    expect(translateCount('en', 'digest.panel.items', 1)).toBe('1 item');
    expect(translateCount('ar', 'digest.panel.items', 4)).toBe('4 عناصر');
  });
  it('the shared "in N days" / "expired N days ago" strings take the counted phrase', () => {
    expect(translate('en', 'm02.inDays', { days: translateCount('en', 'common.nDays', 1) })).toBe('in 1 day');
    expect(translate('ar', 'm02.expiredAgo', { days: translateCount('ar', 'common.nDays', 2) })).toBe('انتهى قبل يومين');
    for (const f of ['src/modules/m02/shared.tsx', 'src/modules/m03/MyLicencePage.tsx', 'src/modules/m03/LicensingValidityPage.tsx', 'src/modules/m03/LicensingCalendarPage.tsx']) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/m02\.(inDays|expiredAgo)', \{ n:/);
    }
  });
  it('digest line strings no longer hard-code "{n} days" / "{n} يوماً"', () => {
    for (const l of ['en', 'ar']) {
      const s = readFileSync(`src/i18n/digest.${l}.json`, 'utf8');
      const lines = JSON.parse(s).line as Record<string, string>;
      for (const [k, v] of Object.entries(lines)) expect(v, k).not.toMatch(/\{n\} (days|يوماً)/);
    }
  });
});

describe('EMP-01 · opening the digest marks the shown digests read', () => {
  it('the panel marks the current notice and the earlier digests it lists', () => {
    const src = readFileSync('src/shell/digest/DigestPanel.tsx', 'utf8');
    expect(src).toContain('view?.earlierNotices');
    expect(readFileSync('src/shell/digest/useDigest.ts', 'utf8')).toContain('earlierNotices: current ?');
  });
});
