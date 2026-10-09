// @vitest-environment jsdom
/** Wave-5 QA fixes found by the browser E2E run.
 *   1. The local demo tenant persists only the tables changed since the seed: the whole tenant (about 11.6 million characters after
 *      wave 5) exceeded the localStorage quota, so every local change was silently lost on reload (F36 nudges-off journey).
 *   2. F38: the log form offers the preceptors kept on the device when offline (the preceptor list is an RPC).
 *   4. F34: in the parent view's Arabic block on the English page, every as-of date reads in Arabic ("حتى"), not "as of".
 *   3. F36: the digest period label prints the year without a thousands separator ("Week 41, 2026", not "2,026"). */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { config } from '../../src/config';
import { I18nProvider } from '../../src/i18n';
import { cachePreceptors, cachedPreceptors, preceptorKey } from '../../src/modules/m02/ojtQueue';
import { usePeriodLabel } from '../../src/shell/digest/DigestPanel';
import { screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import JourneyParentsPage from '../../src/modules/m06/JourneyParentsPage';

describe('local demo tenant persistence', () => {
  it('a change survives a reload (new backend instance) and the stored payload stays far below the quota', async () => {
    localStorage.clear();
    const a = new LocalBackend();
    await a.whenReady();
    a.setPersona('k-ro');
    await a.whenReady();
    const r = await a.rpc.setDigestPrefs({ enabled: false, frequency: 'weekly', quiet_start: null, quiet_end: null, muted_kinds: [] });
    expect(r.ok, r.code).toBe(true);
    await new Promise((res) => setTimeout(res, 400)); // debounce
    const raw = localStorage.getItem(config.localStorageKey)!;
    expect(raw).toBeTruthy();
    expect(raw.length).toBeLessThan(2_000_000);
    const stored = JSON.parse(raw);
    expect(stored.v).toBe(2);
    expect(Object.keys(stored.tables)).toContain('digest_prefs');
    expect(Object.keys(stored.tables)).not.toContain('skill_evidence'); // untouched tables come from the seed
    const b = new LocalBackend();
    await b.whenReady();
    expect((b.raw('digest_prefs') as any[]).find((p) => p.person_id === 'p-k-ro')?.enabled).toBe(false);
    expect(b.raw('skill_evidence').length).toBe(a.raw('skill_evidence').length);
    await b.reset();
    expect(localStorage.getItem(config.localStorageKey)).toBeNull();
    const c = new LocalBackend();
    await c.whenReady();
    expect((c.raw('digest_prefs') as any[]).find((p) => p.person_id === 'p-k-ro')?.enabled ?? true).toBe(true);
  });
  it('an older full snapshot (v1) is ignored rather than half-loaded', async () => {
    localStorage.setItem(config.localStorageKey, JSON.stringify({ v: 1, seedStamp: 'x', tables: { people: [] } }));
    const b = new LocalBackend();
    await b.whenReady();
    expect(b.raw('people').length).toBeGreaterThan(300);
  });
});

describe('F38 offline preceptor list', () => {
  it('keeps the last preceptor list per task on the device and reads it back', () => {
    localStorage.clear();
    expect(cachedPreceptors('p-qc-inspector', 'qs-qa-t2')).toBeNull();
    cachePreceptors('p-qc-inspector', 'qs-qa-t2', [{ id: 'p-sq-lead', name_en: 'Supplier Quality Lead' }]);
    cachePreceptors('p-qc-inspector', 'qs-qa-t1', [{ id: 'p-head-sq', name_en: 'Head of Supplier Quality' }]);
    expect(cachedPreceptors<{ id: string }>('p-qc-inspector', 'qs-qa-t2')!.map((p) => p.id)).toEqual(['p-sq-lead']);
    expect(cachedPreceptors<{ id: string }>('p-qc-inspector', 'qs-qa-t1')!.map((p) => p.id)).toEqual(['p-head-sq']);
    expect(cachedPreceptors('p-other', 'qs-qa-t2')).toBeNull();
    localStorage.setItem(preceptorKey('p-qc-inspector'), '{broken');
    expect(cachedPreceptors('p-qc-inspector', 'qs-qa-t2')).toBeNull();
  });
  it('the log form falls back to the cached list when offline', () => {
    const src = require('node:fs').readFileSync('src/modules/m02/ojtUi.tsx', 'utf8') as string;
    expect(src).toMatch(/navigator\.onLine === false\) \{ setPre\(cached \?\? \[\]\)/);
  });
});

describe('F36 period label', () => {
  it('prints the year without grouping in English and Arabic', () => {
    const wrap = ({ children }: { children: ReactNode }) => createElement(MemoryRouter, { initialEntries: ['/my'] }, createElement(I18nProvider, null, children));
    const { result } = renderHook(() => usePeriodLabel(), { wrapper: wrap });
    expect(result.current('2026-W41')).toBe('Week 41, 2026');
    expect(result.current('2026-F21')).toMatch(/2026$/);
    const wrapAr = ({ children }: { children: ReactNode }) => createElement(MemoryRouter, { initialEntries: ['/ar/my'] }, createElement(I18nProvider, null, children));
    const ar = renderHook(() => usePeriodLabel(), { wrapper: wrapAr });
    expect(ar.result.current('2026-W41')).not.toMatch(/2,026|٢٬٠٢٦/);
  });
});

describe('F34 parent view: Arabic block dates in Arabic', () => {
  it('on the English page the Arabic block says حتى and the English block says as of', async () => {
    await renderPage(createElement(JourneyParentsPage), { path: '/pathways/journey/parents?stage=finishing_school&route=dnt' });
    const ar = await screen.findByTestId('m06-parents-ar', {}, { timeout: 20000 });
    await waitFor(() => expect(within(ar).getAllByTestId('m06-journey-fact').length).toBeGreaterThan(5), { timeout: 20000 });
    for (const li of within(ar).getAllByTestId('m06-journey-fact')) {
      expect(li.textContent).toMatch(/حتى/);
      expect(li.textContent).not.toMatch(/as of/);
    }
    for (const li of within(screen.getByTestId('m06-parents-en')).getAllByTestId('m06-journey-fact')) expect(li.textContent).toMatch(/as of/);
  }, 60000);
});
