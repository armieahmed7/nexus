// M37 routes (National Alignment; owners: wave G E2 (FS62, FS63) and wave H E2 (FS73, FS74)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M37', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m37.routes.<id>.title|purpose in src/i18n/m37.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m37/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips ids={[...]} /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
// FS wave G · E2: the FS01 resource national_alignment (all staff R, hr_analyst R/Agg, hr_director R/W, admin R/W/A, auditors R; never public,
// partners or observers). Measures and the SIMULATED trend need Agg/W/A (checked by the RPCs); the maintenance page needs W/A.
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const NA = { signedIn: true, grant: { res: 'national_alignment' as const, levels: ['R' as const, 'Agg' as const, 'W' as const, 'A' as const] } };
const NA_W = { signedIn: true, grant: { res: 'national_alignment' as const, levels: ['W' as const, 'A' as const] } };
export const routes: RouteDef[] = [
  // FS62 National-strategy alignment layer
  { id: 'national-alignment', path: '/national/alignment', module: 'M37', zone: 'staff', guard: NA, nav: { lens: 'my', section: 'workforce', order: 69.1 }, parent: 'my', spec: 'FS62 /national/alignment · six national strategies (NES 2031, We the UAE 2031, National AI Strategy 2031, Net Zero 2050, Jahiz groups, UAE Centennial 2071) with pillars, goals and groups; sources with tiers, flags; counts computed from the data', component: lazy(() => import('./NationalAlignmentPage')) },
  { id: 'national-alignment-tag', path: '/national/alignment/:tagId', module: 'M37', zone: 'staff', guard: NA, parent: 'national-alignment', spec: 'FS62 · one national tag: EN/AR definition, sources with tiers, children, the filtered report of linked skills, programmes and targets with WhyThis and measures (Agg/W/A)', component: lazy(() => import('./NationalTagPage')) },
  { id: 'national-report', path: '/national/report', module: 'M37', zone: 'staff', guard: NA, nav: { lens: 'my', section: 'workforce', order: 69.15 }, parent: 'national-alignment', spec: 'FS62 /national/report · filtered report by strategy, tag and kind: a filter over the data, no typed totals; CSV, JSON and print', component: lazy(() => import('./NationalReportPage')) },
  { id: 'admin-national-tags', path: '/admin/national-tags', module: 'M37', zone: 'admin', guard: NA_W, nav: { lens: 'admin', section: 'admin', order: 9.7 }, parent: 'admin', spec: 'FS62 /admin/national-tags · maintain tags (EN/AR, sources, tiers computed) and curated links; derived links read-only; audited, ledger on add/retire', component: lazy(() => import('./AdminNationalTagsPage')) },
  // FS63 MoHRE occupation and skill-level mapping
  { id: 'national-occupations', path: '/national/occupations', module: 'M37', zone: 'staff', guard: NA, nav: { lens: 'my', section: 'workforce', order: 69.2 }, parent: 'my', spec: 'FS63 /national/occupations · 28 current roles: occupation label, MoHRE code only when verified (else "code pending review"), indicative skill level; not a MoHRE system; SIMULATED uplift trend (Agg/W/A, suppressed under 10)', component: lazy(() => import('./NationalOccupationsPage')) },
];
