// M17 routes (Skills Passport; owner: W1 engineer, features F03, F04 (W1) · F10, F11 (W2) · F32 (W5) · FS03 (future-skills wave A · E2)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Each route: { id, path, module: 'M17', zone, guard, nav?, parent?, spec, component }.
// Route ids are i18n keys (m17.routes.<id>.title|purpose in src/i18n/m17.{en,ar}.json) and are visited by the smoke suite automatically.
// Param routes: sample params in src/modules/m17/smoke.json.
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const OWN = { signedIn: true, grant: { res: 'skills_profile' as const, levels: ['Own' as const] } };
export const routes: RouteDef[] = [
  { id: 'my-skills', path: '/my/skills', module: 'M17', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 17 }, parent: 'my', spec: 'F03 /my/skills · Skills Passport', component: lazy(() => import('./MySkillsPage')) },
  { id: 'my-skills-wallet', path: '/my/skills/wallet', module: 'M17', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 18 }, parent: 'my-skills', spec: 'F04 /my/skills/wallet · Credential Wallet', component: lazy(() => import('./WalletPage')) },
  { id: 'my-skills-print', path: '/my/skills/print', module: 'M17', zone: 'staff', guard: OWN, parent: 'my-skills', spec: 'F03 printable passport', component: lazy(() => import('./PassportPrintPage')) },
  { id: 'team-passport', path: '/team/passport/:personId', module: 'M17', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Scope', 'A'] } }, parent: 'my-skills', spec: 'F03 passport, manager scope (read-only)', component: lazy(() => import('./TeamPassportPage')) },
  { id: 'verify-badge-check', path: '/verify/badge', module: 'M17', zone: 'public', guard: {}, parent: 'verify', spec: 'F04 /verify/badge · check a downloaded credential', component: lazy(() => import('./VerifyBadgePage')) },
  { id: 'verify-badge', path: '/verify/badge/:id', module: 'M17', zone: 'public', guard: {}, parent: 'verify-badge-check', spec: 'F04 /verify/badge/:id · public badge verification', component: lazy(() => import('./VerifyBadgePage')) },
  // W2 · w2e1: F10 Skill check-ins (360) and F11 Team capability heatmap
  { id: 'my-skills-checkins', path: '/my/skills/checkins', module: 'M17', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 18.5 }, parent: 'my-skills', spec: 'F10 /my/skills/checkins · Skill check-ins (self, manager, peer)', component: lazy(() => import('./CheckinsPage')) },
  { id: 'team-skills', path: '/team/skills', module: 'M17', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Scope', 'A', 'Agg'] } }, nav: { lens: 'my', section: 'team', order: 32 }, parent: 'team', spec: 'F11 /team/skills · Team capability heatmap and crew view', component: lazy(() => import('./TeamSkillsPage')) },
  { id: 'team-skills-validate', path: '/team/skills/validate', module: 'M17', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Scope', 'A'] } }, nav: { lens: 'my', section: 'team', order: 33 }, parent: 'team-skills', spec: 'F10 /team/skills/validate · Validate check-ins and calibration', component: lazy(() => import('./ValidatePage')) },
  // W5 · w5e1: F32 Stackable micro-credentials (definitions are managed in the "Micro-credentials" tab of /admin/frameworks)
  { id: 'my-skills-credentials', path: '/my/skills/credentials', module: 'M17', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 18.2 }, parent: 'my-skills', spec: 'F32 /my/skills/credentials · Stackable micro-credentials', component: lazy(() => import('./MicrocredsPage')) },
  // FS · wave A · E2: FS03 Honest skill states (decay classes, half-lives, confidence bands)
  { id: 'my-skills-confidence', path: '/my/skills/confidence', module: 'M17', zone: 'staff', guard: OWN, nav: { lens: 'my', section: 'skills', order: 18.1 }, parent: 'my-skills', spec: 'FS03 /my/skills/confidence · How sure are we (bands, sources, decay)', component: lazy(() => import('./MyConfidencePage')) },
  { id: 'admin-skills-confidence', path: '/admin/skills-confidence', module: 'M17', zone: 'admin', guard: { signedIn: true, anyRole: ['admin', 'training_manager', 'auditor', 'hr_analyst', 'hr_director'] }, nav: { lens: 'admin', section: 'admin', order: 6.5 }, parent: 'admin', spec: 'FS03 /admin/skills-confidence · Skill decay classes, half-lives and confidence', component: lazy(() => import('./SkillsConfidenceAdminPage')) },
];
