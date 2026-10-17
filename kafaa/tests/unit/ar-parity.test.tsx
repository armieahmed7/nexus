// @vitest-environment jsdom
/**
 * Arabic parity for English-only data (2026-10-17):
 *   1 closed vocabularies stored in English get display labels (src/i18n/dataLabels.ts): organisations.country,
 *     skill_frameworks.version_label, adv_technologies.designs; unknown values are shown as stored
 *   2 kafaa_sessions.location_ar: the seed finalizer, the live migration and the schema agree, every seeded session has one
 *   3 the signed credentials listed on /ar/verify/record show the Arabic name they carry (display only)
 *   4 the pages show the Arabic on /ar and the English on unprefixed paths
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { countryKey, countryName, countryOptions, frameworkVersion, techDesigns, translate } from '../../src/i18n';
import { credName } from '../../src/modules/m17/learnerRecord';
import { AR, finalize } from '../../scripts/seed/ext/zz-ar-parity.mjs';
import PartnersPage from '../../src/modules/m09/PartnersPage';
import FrameworksPage from '../../src/modules/m28/FrameworksPage';
import FuturePage from '../../src/modules/m11/FuturePage';
import VerifyRecordPage from '../../src/modules/m17/VerifyRecordPage';
import TrainingSchedulePage from '../../src/modules/m04/TrainingSchedulePage';
import seed from '../../src/seed/seed.json';
import smoke from '../../src/modules/m17/smoke.json';

const W = { timeout: 30000 };
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const tAr = (k: string, v?: Record<string, string | number>) => translate('ar', k, v);
const tEn = (k: string, v?: Record<string, string | number>) => translate('en', k, v);
const ARABIC = /[؀-ۿ]/;

beforeAll(() => Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true, configurable: true }));

describe('1 · display labels for closed vocabularies', () => {
  it('countries: pairs, both UAE spellings, unknown values unchanged', () => {
    expect(countryName(tAr, 'France / Italy')).toBe('فرنسا / إيطاليا');
    expect(countryName(tEn, 'France / Italy')).toBe('France / Italy');
    expect(countryName(tAr, 'AE')).toBe('الإمارات العربية المتحدة');
    expect(countryName(tAr, 'UAE')).toBe(countryName(tAr, 'AE'));
    expect(countryName(tEn, 'AE')).toBe('UAE');
    expect(countryName(tAr, 'USA / Japan')).toBe('الولايات المتحدة / اليابان');
    expect(countryName(tAr, 'Atlantis')).toBe('Atlantis');
    expect(countryName(tAr, 'France / Atlantis')).toBe('France / Atlantis');
    expect(countryName(tAr, null)).toBe('');
    expect(countryKey('France / Italy')).toBe('fr/it');
    expect(countryKey('AE')).toBe(countryKey('UAE'));
    expect(countryKey('Atlantis')).toBe('Atlantis');
  });

  it('country filter options: one per country, labelled in the page language', () => {
    const opts = countryOptions(tAr, ['UAE', 'AE', 'France / Italy', null, 'Korea']);
    expect(opts).toHaveLength(3);
    expect(opts.find((o) => o.value === 'ae')!.label).toBe('الإمارات العربية المتحدة');
    expect(opts.find((o) => o.value === 'fr/it')!.label).toBe('فرنسا / إيطاليا');
    expect(countryOptions(tEn, ['AE', 'UAE'])).toEqual([{ value: 'ae', label: 'UAE' }]);
  });

  it('every seeded organisation country has an Arabic label', () => {
    const missing = [...new Set(T.organisations.map((o) => o.country).filter(Boolean))].filter((c) => !ARABIC.test(countryName(tAr, c)));
    expect(missing).toEqual([]);
  });

  it('framework version words are translated; numbers and product names stay as stored', () => {
    expect(frameworkVersion(tAr, 'current references')).toBe('المراجع الحالية');
    expect(frameworkVersion(tAr, 'current')).toBe('الإصدار الحالي');
    expect(frameworkVersion(tEn, 'current references')).toBe('current references');
    expect(frameworkVersion(tAr, '2.2')).toBe('2.2');
    expect(frameworkVersion(tAr, 'O*NET OnLine')).toBe('O*NET OnLine');
    // every seeded label is a number/version code, a product name, or translated
    const words = T.skill_frameworks.map((f) => f.version_label as string).filter((v) => /^[a-z ]+$/.test(v ?? ''));
    expect(words.length).toBeGreaterThan(0);
    for (const v of words) expect(frameworkVersion(tAr, v)).toMatch(ARABIC);
  });

  it('reactor designs: values with English words get Arabic, design codes stay as written', () => {
    expect(techDesigns(tAr, 'Natrium; lead-cooled fast reactor')).toBe('ناتريوم؛ مفاعل سريع مبرّد بالرصاص');
    expect(techDesigns(tAr, 'AP1000 and others')).toBe('AP1000 وتصاميم أخرى');
    expect(techDesigns(tEn, 'AP1000 and others')).toBe('AP1000 and others');
    expect(techDesigns(tAr, 'BWRX-300')).toBe('BWRX-300');
    for (const d of T.adv_technologies.map((x) => x.designs as string)) {
      if (/\b[a-z]{3,}\b/.test(d)) expect(techDesigns(tAr, d), d).toMatch(ARABIC);
    }
  });
});

describe('2 · kafaa_sessions.location_ar', () => {
  const MIG = readFileSync('supabase/migrations/20261017120001_kafaa_ar_parity_session_location.sql', 'utf8');
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

  it('every seeded session has an Arabic location from the finalizer map', () => {
    expect(T.sessions.length).toBeGreaterThan(0);
    for (const s of T.sessions) expect(s.location_ar, s.id).toBe(AR['sessions.location'][s.location]);
  });

  it('the finalizer throws on a location without Arabic and clears an empty one', () => {
    expect(() => finalize({ sessions: [{ id: 'x', location: 'Somewhere new' }] })).toThrow(/no Arabic/);
    const t = { sessions: [{ id: 'y', location: '' } as Record<string, unknown>] };
    finalize(t);
    expect(t.sessions[0].location_ar).toBeNull();
  });

  it('the live migration adds the column and fills every mapped value, guarded and idempotent', () => {
    expect(MIG).toMatch(/alter table public\.kafaa_sessions add column if not exists location_ar text;/);
    for (const [en, ar] of Object.entries(AR['sessions.location'])) {
      expect(MIG).toContain(`update public.kafaa_sessions set location_ar = ${q(ar)} where location = ${q(en)} and coalesce(location_ar, '') = '';`);
    }
    // only kafaa_sessions, no deletes, no grants, no policies
    expect(MIG.replace(/^--.*$/gm, '')).not.toMatch(/\b(delete|drop|grant|revoke|policy|truncate)\b/i);
    for (const m of MIG.replace(/^--.*$/gm, '').matchAll(/\b(?:update|alter table)\s+([\w.]+)/gi)) expect(m[1]).toBe('public.kafaa_sessions');
  });

  it('the schema DSL declares the column (nullable)', () => {
    expect(readFileSync('src/data/schema.ts', 'utf8')).toMatch(/location: 'text', location_ar: 'text\?'/);
  });
});

describe('3 · signed credential names on the record verification page', () => {
  const badge = { name: 'HU-101 Human performance core tools', nameAr: 'HU-101 الأدوات الأساسية للأداء البشري', credentialSubject: { achievement: { name: 'Human performance core tools', nameAr: 'الأدوات الأساسية للأداء البشري', humanCode: 'HU-101' } } };
  const statement = { name: 'Systems thinking', credentialSubject: { achievement: { humanCode: 'SK-12', name: 'Systems thinking', nameAr: 'التفكير المنظومي' } } };
  it('Arabic name on /ar (top-level nameAr, else code + achievement nameAr), English otherwise', () => {
    expect(credName(badge, 'ar')).toBe('HU-101 الأدوات الأساسية للأداء البشري');
    expect(credName(badge, 'en')).toBe('HU-101 Human performance core tools');
    expect(credName(statement, 'ar')).toBe('SK-12 التفكير المنظومي');
    expect(credName({ name: 'External', credentialSubject: { achievement: {} } }, 'ar')).toBe('External');
    expect(credName({ id: 'urn:x' }, 'en')).toBe('urn:x');
  });
});

describe('4 · pages', () => {
  it('/ar/partners offers countries in Arabic (one UAE option); /partners in English', async () => {
    const { container, unmount } = await renderPage(<PartnersPage />, { path: '/ar/partners' });
    await waitFor(() => expect(container.querySelector('[data-testid="skeleton"]')).toBeNull(), W);
    await waitFor(() => expect(container.textContent).toContain('فرنسا / إيطاليا'), W);
    expect(container.textContent).not.toContain('France / Italy');
    const opts = [...container.querySelectorAll('option')].map((o) => o.textContent);
    expect(opts.filter((o) => o === 'الإمارات العربية المتحدة')).toHaveLength(1);
    unmount();
    const en = await renderPage(<PartnersPage />, { path: '/partners' });
    await waitFor(() => expect(en.container.textContent).toContain('France / Italy'), W);
  }, 90000);

  it('/ar/skills/frameworks shows the version words in Arabic', async () => {
    const { container } = await renderPage(<FrameworksPage />, { path: '/ar/skills/frameworks' });
    await waitFor(() => expect(container.textContent).toContain('المراجع الحالية'), W);
    expect(container.textContent).not.toContain('current references');
  }, 90000);

  it('/ar/future shows the reactor design phrases in Arabic', async () => {
    const { container } = await renderPage(<FuturePage />, { path: '/ar/future' });
    await waitFor(() => expect(container.textContent).toContain('ناتريوم؛ مفاعل سريع مبرّد بالرصاص'), W);
    expect(container.textContent).not.toContain('lead-cooled');
  }, 90000);

  it('/ar/verify/record/<token> lists the signed credentials by their Arabic names', async () => {
    const token = (smoke as Record<string, Record<string, string>>)['verify-record'].token;
    await renderPage(<VerifyRecordPage />, { path: `/ar/verify/record/${token}`, route: '/ar/verify/record/:token' });
    const sigs = await screen.findByTestId('m17-lr-verify-sigs', undefined, W);
    const names = [...sigs.querySelectorAll('li > span:first-child')].map((s) => s.textContent ?? '');
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n, n).toMatch(ARABIC);
    expect(sigs.textContent).not.toContain('Human performance core tools');
  }, 90000);

  it('/ar/training/schedule shows session locations in Arabic and the form takes an Arabic location', async () => {
    const { container } = await renderPage(<TrainingSchedulePage />, { path: '/ar/training/schedule?when=all', persona: 'training-mgr' });
    await waitFor(() => expect(container.textContent).toContain('مركز التدريب على المحاكاة'), W);
    expect(container.textContent).not.toContain('Simulator Training Center');
    fireEvent.click(screen.getByTestId('m04-session-new'));
    const dialog = await screen.findByRole('dialog', undefined, W);
    expect(within(dialog).getByLabelText('المكان (بالعربية)')).toBeTruthy();
  }, 90000);
});
