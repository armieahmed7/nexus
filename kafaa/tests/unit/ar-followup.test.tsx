// @vitest-environment jsdom
/** [Arabic follow-up 2026-10-14] English that still showed on Arabic pages:
 *   1 vacancy locations   /ar/pathways vacancy cards render vacancies.location_ar through pick(), like /ar/careers/jobs; staff can
 *                         enter the Arabic location on a new vacancy
 *   2 regulation refs     entry-route citations ("FANR-REG-17 Art. 4") and other English-only rule_ref values render in Arabic
 *                         through localizeRef (i18n layer): "Art." -> "المادة", codes such as FANR-REG-17 kept as written
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { renderPage } from './g1-harness';
import { localizeRef } from '../../src/i18n';
import PathwaysPage from '../../src/modules/m06/PathwaysPage';
import CareersRolePage from '../../src/modules/m01/CareersRolePage';
import LicensingPage from '../../src/modules/m03/LicensingPage';
import { createEngine } from '../../src/modules/m13/dalil/engine';
import { buildCorpus } from '../../src/modules/m13/dalil/corpus';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import seed from '../../src/seed/seed.json';

const W = { timeout: 30000 };
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;

describe('1 · vacancy locations in Arabic', () => {
  it('/ar/pathways shows the Arabic location on every vacancy card', async () => {
    const { container } = await renderPage(<PathwaysPage />, { path: '/ar/pathways' });
    await waitFor(() => expect(container.textContent).toContain('براكة، منطقة الظفرة'), W);
    expect(container.textContent).not.toContain('Barakah, Al Dhafra');
    expect(container.textContent).not.toContain('Abu Dhabi');
  }, 90000);
  it('/pathways (English) still shows the English location', async () => {
    const { container } = await renderPage(<PathwaysPage />, { path: '/pathways' });
    await waitFor(() => expect(container.textContent).toContain('Barakah, Al Dhafra'), W);
    expect(container.textContent).not.toContain('براكة');
  }, 90000);
  it('the vacancy editor has an Arabic location field, prefilled for Barakah', () => {
    const src = readFileSync('src/modules/m06/TalentContentPage.tsx', 'utf8');
    expect(src).toContain("{ key: 'location_ar', label: t('m06.talent.locationAr'), type: 'text', dir: 'rtl' }");
    expect(src).toContain("location: 'Barakah, Al Dhafra', location_ar: 'براكة، منطقة الظفرة'");
  });
});

describe('2 · regulation and source references in Arabic', () => {
  it('localizeRef translates the words around a code and keeps the code', () => {
    const cases: [string, string][] = [
      ['FANR-REG-17 Art. 4', 'FANR-REG-17 المادة 4'],
      ['FANR-REG-17 Art. 4, 7, 10', 'FANR-REG-17 المواد 4 و7 و10'],
      ['FANR-REG-17 Art. 4, 8, 10, 11', 'FANR-REG-17 المواد 4 و8 و10 و11'],
      ['FANR-REG-12 Art. 23', 'FANR-REG-12 المادة 23'],
      ['FANR-REG-17 Art. 13 (every 6 months)', 'FANR-REG-17 المادة 13 (كل 6 أشهر)'],
      ['FANR-REG-17 Art. 13 (within 3 working days)', 'FANR-REG-17 المادة 13 (خلال 3 أيام عمل)'],
      ['FANR-REG-17 Art. 7 (60 days ahead)', 'FANR-REG-17 المادة 7 (قبل 60 يوماً)'],
      ['FANR-REG-17 Art. 4 (LO: high-school diploma)', 'FANR-REG-17 المادة 4 (المشغّل الميداني: شهادة الثانوية العامة)'],
      ['FANR-REG-08 V2', 'FANR-REG-08 الإصدار 2'],
      ['FANR-REG-17', 'FANR-REG-17'],
      ['SR2024 p.51', 'SR2024، ص 51'],
      ['ENEC talent pipeline', 'مسار المواهب في ENEC'],
      ['ENEC GPO release (Aug 2025)', 'بيان ENEC عن برنامج GPO (أغسطس 2025)'],
      ['IAEA SSG-75 §3.17', 'دليل الوكالة الدولية للطاقة الذرية SSG-75، البند 3.17'],
      ['IAEA SSG-75 §3.28-3.34', 'دليل الوكالة الدولية للطاقة الذرية SSG-75، البنود 3.28-3.34'],
      ['FANR-REG-10; IAEA safeguards agreement', 'FANR-REG-10؛ اتفاق الضمانات مع الوكالة الدولية للطاقة الذرية'],
    ];
    for (const [en, ar] of cases) expect([en, localizeRef(en, 'ar')]).toEqual([en, ar]);
    // English is untouched; Arabic and empty input pass through.
    for (const [en] of cases) expect(localizeRef(en, 'en')).toBe(en);
    expect(localizeRef('FANR-REG-17 المادة 4', 'ar')).toBe('FANR-REG-17 المادة 4');
    expect(localizeRef(null, 'ar')).toBe('');
    expect(localizeRef('Something unknown', 'ar')).toBe('Something unknown');
  });
  it('every seeded entry-route reference renders without English words in Arabic', () => {
    const refs = new Set(T.job_roles.flatMap((r) => (Array.isArray(r.entry_routes) ? r.entry_routes : []).map((e: Row) => String(e.rule_ref ?? ''))).filter(Boolean));
    expect(refs.size).toBeGreaterThan(0);
    for (const ref of refs) expect([ref, localizeRef(ref, 'ar').replace(/\b(FANR-REG-\d+|SR\d{4}|ENEC|GPO|SSG-\d+)\b/g, '')]).not.toEqual([ref, expect.stringMatching(/[A-Za-z]{2,}/)]);
  });
  it('/ar/careers/roles/senior-reactor-operator: entry-route citations read "FANR-REG-17 المادة 4"', async () => {
    await renderPage(<CareersRolePage />, { path: '/ar/careers/roles/senior-reactor-operator', route: '/ar/careers/roles/:slug' });
    const list = await screen.findByTestId('m01-entry-routes', {}, W);
    expect(list.textContent).toContain('FANR-REG-17 المادة 4');
    expect(list.textContent).not.toContain('Art.');
  }, 90000);
  it('/careers/roles/senior-reactor-operator (English) keeps "FANR-REG-17 Art. 4"', async () => {
    await renderPage(<CareersRolePage />, { path: '/careers/roles/senior-reactor-operator', route: '/careers/roles/:slug' });
    const list = await screen.findByTestId('m01-entry-routes', {}, W);
    expect(list.textContent).toContain('FANR-REG-17 Art. 4');
  }, 90000);
  it('/ar/licensing: the RO and SRO route lists cite the article in Arabic', async () => {
    await renderPage(<LicensingPage />, { path: '/ar/licensing' });
    const ro = await screen.findByTestId('m03-routes-reactor-operator', {}, W);
    expect(within(ro).getAllByText('FANR-REG-17 المادة 4').length).toBeGreaterThan(0);
    expect(ro.textContent).not.toContain('Art.');
    expect(screen.getByTestId('m03-elig-result').textContent).toContain('(FANR-REG-17 المادة 4)');
  }, 90000);
  it('Dalil entry-route answers cite the article in Arabic (and in English on /ask)', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    await b.reset();
    b.setPersona(null);
    const corpus = await buildCorpus(b, { signedIn: false, personId: null });
    const engine = createEngine('retrieval-v1');
    const a = await engine.answer({ question: 'ما هي متطلبات الالتحاق بوظيفة مشغل المفاعل؟', lang: 'ar', mode: 'public' }, corpus);
    expect(a.intent).toBe('entry_requirements');
    expect(a.bullets!.join(' ')).toContain('FANR-REG-17 المادة 4');
    expect(a.bullets!.join(' ')).not.toContain('Art.');
    expect(a.citations.some((c) => c.label === 'FANR-REG-17 المادة 4')).toBe(true);
    const en = await engine.answer({ question: 'What are the RO entry requirements?', lang: 'en', mode: 'public' }, corpus);
    expect(en.bullets!.every((x) => x.includes('FANR-REG-17 Art. 4'))).toBe(true);
  });
  it('every page that prints an English-only rule_ref goes through the i18n layer', () => {
    const uses: [string, string][] = [
      ['src/modules/m01/CareersRolePage.tsx', 'refText(r.rule_ref)'],
      ['src/modules/m01/CareersComparePage.tsx', 'refText(r.rule_ref)'],
      ['src/modules/m03/LicensingPage.tsx', 'refText(r.rule_ref)'],
      ['src/modules/m03/LicensingPage.tsx', 'refText(c.ruleRef)'],
      ['src/modules/m01/shared.tsx', "refText(pick(edge, 'rule_ref'))"],
      ['src/modules/m01/CareersPathsPage.tsx', "refText(pick(s.edge, 'rule_ref'))"],
      ['src/modules/m01/CareersPlanPage.tsx', "refText(pick(e, 'rule_ref'))"],
      ['src/modules/m03/LicensingValidityPage.tsx', 'refText(x.rule_ref)'],
      ['src/modules/m03/LicensingCalendarPage.tsx', 'refText(e.o.rule_ref)'],
      ['src/modules/m18/shared.tsx', 'refText(r.rule_ref)'],
      ['src/modules/m18/MyRoadmapPage.tsx', 'localizeRef(b.rule_ref, lang)'],
      ['src/modules/m13/career/engine.ts', 'localizeRef(primary.rule_ref, lang)'],
      ['src/modules/m13/career/engine.ts', 'localizeRef(b.rule_ref, lang)'],
    ];
    for (const [f, s] of uses) expect([f, readFileSync(f, 'utf8').includes(s)]).toEqual([f, true]);
  });
});
