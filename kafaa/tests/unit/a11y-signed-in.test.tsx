// @vitest-environment jsdom
/**
 * Accessibility fixes found by the signed-in axe sweep (tests/smoke/a11y.spec.ts, 2026-10-17):
 *   1 ScrollRegion is a keyboard stop (and a named region with `label`) only while its content overflows
 *   2 DataTable and Heatmap scroll boxes use it, named by their caption
 *   3 the funnel keeps its numbers at full strength (no fading opacity on the bars)
 *   4 dot indicators that carry a label are images (aria-label is not allowed on a plain span)
 *   5 the needs-matrix drill buttons include their visible count in their name
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ScrollRegion } from '../../src/ui/ScrollRegion';
import { DataTable } from '../../src/ui/DataTable';
import { Funnel, Heatmap } from '../../src/ui/charts';
import { FactorDots } from '../../src/modules/m24/ui';
import { translate } from '../../src/i18n';
import { renderPage } from './g1-harness';

/** jsdom has no layout: give elements a fixed client width and a scroll width taken from data-w, and a ResizeObserver stub. */
function fakeLayout() {
  const proto = HTMLElement.prototype;
  const saved = { sw: Object.getOwnPropertyDescriptor(proto, 'scrollWidth'), cw: Object.getOwnPropertyDescriptor(proto, 'clientWidth'), ro: (globalThis as { ResizeObserver?: unknown }).ResizeObserver };
  Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => 300 });
  Object.defineProperty(proto, 'scrollWidth', { configurable: true, get(this: HTMLElement) { return Number(this.querySelector('[data-w]')?.getAttribute('data-w') ?? 300); } });
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} disconnect() {} };
  return () => {
    if (saved.sw) Object.defineProperty(proto, 'scrollWidth', saved.sw);
    if (saved.cw) Object.defineProperty(proto, 'clientWidth', saved.cw);
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = saved.ro;
  };
}

afterEach(cleanup);

describe('1 · ScrollRegion', () => {
  it('takes keyboard focus and a region name only when its content overflows', () => {
    const restore = fakeLayout();
    try {
      render(<><ScrollRegion label="Wide table" data-testid="wide"><div data-w="900" /></ScrollRegion><ScrollRegion label="Narrow" data-testid="narrow"><div data-w="200" /></ScrollRegion></>);
      const wide = screen.getByTestId('wide');
      expect(wide.getAttribute('tabindex')).toBe('0');
      expect(wide.getAttribute('role')).toBe('region');
      expect(wide.getAttribute('aria-label')).toBe('Wide table');
      expect(wide.className).toBe('overflow-x-auto');
      const narrow = screen.getByTestId('narrow');
      expect(narrow.hasAttribute('tabindex')).toBe(false);
      expect(narrow.hasAttribute('role')).toBe(false);
      expect(narrow.hasAttribute('aria-label')).toBe(false);
    } finally {
      restore();
    }
  });
  it('without a label it is focusable but not a region; without ResizeObserver it stays a plain box', () => {
    const restore = fakeLayout();
    try {
      render(<ScrollRegion className="card overflow-x-auto" data-testid="box"><div data-w="900" /></ScrollRegion>);
      const box = screen.getByTestId('box');
      expect(box.getAttribute('tabindex')).toBe('0');
      expect(box.hasAttribute('role')).toBe(false);
      expect(box.className).toBe('card overflow-x-auto');
    } finally {
      restore();
    }
    cleanup();
    render(<ScrollRegion data-testid="plain"><div data-w="900" /></ScrollRegion>);
    expect(screen.getByTestId('plain').hasAttribute('tabindex')).toBe(false);
  });
});

describe('2 · DataTable and Heatmap scroll boxes', () => {
  it('are named by their caption when they overflow', async () => {
    const restore = fakeLayout();
    try {
      const { container } = await renderPage(<DataTable rows={[{ id: 'a' }]} rowKey={(r) => r.id} columns={[{ key: 'id', header: <span data-w="900">Id</span>, value: (r) => r.id }]} caption="Course list" searchable={false} />);
      const box = container.querySelector('[role="region"]');
      expect(box?.getAttribute('aria-label')).toBe('Course list');
      expect(box?.getAttribute('tabindex')).toBe('0');
      cleanup();
      await renderPage(<Heatmap title="Coverage" rows={['r']} cols={['c']} value={() => ({ v: 1 })} colLabel={() => 'wide'} />);
      const hm = screen.getByTestId('heatmap');
      // The stub reads data-w from descendants; the heatmap has none, so it does not overflow here and stays a plain box.
      expect(hm.hasAttribute('tabindex')).toBe(false);
    } finally {
      restore();
    }
  });
});

describe('3 · Funnel', () => {
  it('draws every stage at full opacity so the white numbers keep their contrast', async () => {
    const { container } = await renderPage(<Funnel title="Pipeline" stages={[{ label: 'A', value: 40 }, { label: 'B', value: 20 }, { label: 'C', value: 5 }]} />);
    const bars = [...container.querySelectorAll<HTMLElement>('[data-testid="funnel-chart"] .h-7')];
    expect(bars).toHaveLength(3);
    for (const b of bars) expect(b.style.opacity).toBe('');
  });
});

describe('4 · labelled dot indicators', () => {
  it('FactorDots is an image with its label', async () => {
    await renderPage(<FactorDots value={4} label="Attrition factor 4 of 5" />);
    const el = screen.getByRole('img', { name: 'Attrition factor 4 of 5' });
    expect(el.getAttribute('title')).toBe('Attrition factor 4 of 5');
  });
});

describe('5 · drill button names carry the visible count (both languages)', () => {
  it('EN and AR strings put the count first', () => {
    expect(translate('en', 'm25.needs.drillAria', { n: '12', source: 'Role curriculum' })).toBe('12: drill down into Role curriculum');
    expect(translate('ar', 'm25.needs.drillAria', { n: '١٢', source: 'منهج الدور' })).toBe('١٢: التفرّع في منهج الدور');
  });
});
