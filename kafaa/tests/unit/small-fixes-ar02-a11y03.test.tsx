// @vitest-environment jsdom
/**
 * AR-02: the privacy marker for groups under 10 reads "أقل من 10" in Arabic (a bare "<10" is mirrored into "10>" by the bidi
 * algorithm, which reads as "more than 10"), in every chart and in the committee pack, and stays "<10" in English and CSV.
 * A11Y-03: on phones the Ask Dalil button is a 44 px icon button that tucks away on scroll down and while typing, comes back
 * on scroll up or focus, keeps its accessible name, and stays off /speak-up.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { BarChart, Donut, Heatmap } from '../../src/ui/charts';
import { DalilLauncher } from '../../src/shell/DalilLauncher';
import { ROUTE_BY_ID } from '../../src/routes/registry';
import { SUPPRESSED_CELL, packRows } from '../../src/modules/m25/eff';
import commonAr from '../../src/i18n/common.ar.json';
import commonEn from '../../src/i18n/common.en.json';
import { renderPage } from './g1-harness';

function Charts() {
  const data = [{ label: 'Operations', value: 42 }, { label: 'Maintenance', value: null, suppressed: true }];
  return (
    <>
      <BarChart title="bars" data={data} />
      <Donut title="donut" data={data} />
      <Heatmap title="heat" rows={['a']} cols={['x', 'y']} value={(_r, c) => (c === 'x' ? { v: 12 } : { v: null, suppressed: true })} />
    </>
  );
}

describe('AR-02 privacy marker', () => {
  it('uses Arabic words, not a mirrored "<10", in the Arabic dictionary', () => {
    expect(commonEn.suppressedShort).toBe('<10');
    expect(commonAr.suppressedShort).toBe('أقل من 10');
    expect(commonAr.suppressedShort).not.toMatch(/[<>]/);
  });

  it('renders the marker in Arabic in bar, donut and heatmap charts', async () => {
    const { container } = await renderPage(<Charts />, { path: '/ar/workforce' });
    await waitFor(() => expect(screen.getByTestId('heatmap')).toBeTruthy());
    expect(container.textContent).not.toContain('<10');
    expect(screen.getByTestId('donut-chart').textContent).toContain('أقل من 10');
    expect(screen.getByTestId('bar-chart').textContent).toContain('أقل من 10');
    const cell = screen.getByTestId('heatmap').querySelector('td[data-suppressed="true"]')!;
    expect(cell.textContent).toBe('أقل من 10');
    expect(cell.getAttribute('title')).toBe(commonAr.suppressed);
  });

  it('keeps "<10" in English', async () => {
    await renderPage(<Charts />, { path: '/workforce' });
    await waitFor(() => expect(screen.getByTestId('heatmap')).toBeTruthy());
    expect(screen.getByTestId('heatmap').querySelector('td[data-suppressed="true"]')!.textContent).toBe('<10');
    expect(screen.getByTestId('donut-chart').textContent).toContain('<10');
  });

  it('keeps "<10" in the committee-pack export rows (the CSV), which the page swaps for the localised marker', () => {
    expect(SUPPRESSED_CELL).toBe('<10');
    expect(packRows([], () => ({ code: '', title: '' }), () => '', 'y', 'n')).toEqual([]);
  });
});

describe('A11Y-03 Ask Dalil button on phones', () => {
  const realMatch = window.matchMedia;
  afterEach(() => {
    window.matchMedia = realMatch;
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
  });
  const phone = (matches: boolean) => {
    window.matchMedia = ((q: string) => ({ matches, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  };
  const scrollTo = (y: number) =>
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
    });

  it('is an icon button with its name kept for screen readers, tucked on scroll down and shown on scroll up or focus', async () => {
    phone(true);
    await renderPage(
      <>
        <input data-testid="field" />
        <DalilLauncher route={ROUTE_BY_ID.learn} />
      </>,
      { path: '/learn' },
    );
    const btn = await screen.findByTestId('dalil-launcher');
    expect(btn.className).toContain('h-11 w-11');
    expect(btn.querySelector('.sr-only')!.textContent).toBe('Ask Dalil');
    expect(screen.getByTestId('dalil-launcher-spacer').getAttribute('aria-hidden')).toBe('true');
    expect(btn.getAttribute('data-tucked')).toBe('false');
    scrollTo(400);
    expect(btn.getAttribute('data-tucked')).toBe('true');
    expect(btn.className).toContain('pointer-events-none');
    scrollTo(200);
    expect(btn.getAttribute('data-tucked')).toBe('false');
    scrollTo(600);
    expect(btn.getAttribute('data-tucked')).toBe('true');
    act(() => btn.focus());
    expect(btn.getAttribute('data-tucked')).toBe('false');
    fireEvent.focusIn(screen.getByTestId('field'));
    expect(btn.getAttribute('data-tucked')).toBe('true');
    fireEvent.focusOut(screen.getByTestId('field'));
    expect(btn.getAttribute('data-tucked')).toBe('false');
  });

  it('never tucks on wider screens', async () => {
    phone(false);
    await renderPage(<DalilLauncher route={ROUTE_BY_ID.learn} />, { path: '/learn' });
    const btn = await screen.findByTestId('dalil-launcher');
    scrollTo(800);
    expect(btn.getAttribute('data-tucked')).toBe('false');
  });

  it('stays off /speak-up', async () => {
    phone(true);
    const { container } = await renderPage(<DalilLauncher route={ROUTE_BY_ID['speak-up']} />, { path: '/speak-up' });
    await new Promise((r) => setTimeout(r, 100));
    expect(container.querySelector('[data-testid="dalil-launcher"]')).toBeNull();
    expect(container.querySelector('[data-testid="dalil-launcher-spacer"]')).toBeNull();
  });
});
