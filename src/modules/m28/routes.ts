// M28 routes (Skills Intelligence; owners: wave B E1 (FS07, FS08) and wave H E1 (FS70, FS71, FS72)). Registered once by FS01 (wave A) in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M28', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m28.routes.<id>.title|purpose in src/i18n/m28.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: put sample params in src/modules/m28/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
// Every page shows its <BenchmarkChips feature="FSnn" /> (src/ui) from the feature card's benchmark list (PLAN.md section 4).
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'skills', path: '/skills', module: 'M28', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 11.9 }, parent: 'home', spec: 'PLAN FS07 · /skills: every published skill, filters, EN/AR search over names and alternative labels', component: lazy(() => import('./SkillsExplorerPage')) },
  { id: 'skills-frameworks', path: '/skills/frameworks', module: 'M28', zone: 'public', guard: {}, parent: 'skills', spec: 'PLAN FS08 · /skills/frameworks: crosswalk coverage matrix, per-framework lists, CASE-shaped JSON and CSV export', component: lazy(() => import('./FrameworksPage')) },
  { id: 'skills-skill', path: '/skills/:id', module: 'M28', zone: 'public', guard: {}, parent: 'skills', spec: 'PLAN FS07 · /skills/:id: definition, level essence, roles now and in 2030, learning, crosswalk tab (FS08), sources', component: lazy(() => import('./SkillPage')) },
  { id: 'admin-skills-alignments', path: '/admin/skills/alignments', module: 'M28', zone: 'admin', guard: { signedIn: true, anyRole: ['admin', 'training_manager', 'instructor', 'auditor'] }, nav: { lens: 'admin', section: 'admin', order: 6.6 }, parent: 'admin', spec: 'PLAN FS08 · /admin/skills/alignments: edit, review (maker-checker) and retire crosswalk rows; auditors read', component: lazy(() => import('./AlignmentsAdminPage')) },
];
