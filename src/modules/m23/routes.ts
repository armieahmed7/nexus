// M23 routes (Talent review and succession; owner W3 · E1, features F18 Talent review and F19 Succession planning).
// Registered once by F01 in src/routes/registry.ts. Route ids are i18n keys (m23.routes.<id>.title|purpose) and are visited by
// the smoke suite automatically; param routes take their sample params from smoke.json.
// Confidential (talent_review): managers (Scope), HR business partner (Scope/Agg), HR director (R/A). Employees, auditors,
// observers and partners are refused (403). Employees see only their agreed priorities at /my/development-priorities.
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const TALENT = { signedIn: true, grant: { res: 'talent_review' as const, levels: ['R' as const, 'A' as const, 'Scope' as const] } };
const TALENT_AGG = { signedIn: true, grant: { res: 'talent_review' as const, levels: ['Agg' as const, 'R' as const, 'A' as const] } };
const SUCCESSION = { signedIn: true, grant: { res: 'talent_review' as const, levels: ['R' as const, 'A' as const, 'Scope' as const, 'Agg' as const] } };

export const routes: RouteDef[] = [
  // F18 Talent review
  { id: 'talent-review', path: '/talent/review', module: 'M23', zone: 'staff', guard: TALENT, nav: { lens: 'my', section: 'talent', order: 80 }, parent: 'my', spec: 'BACKLOG F18 · /talent/review (review cycles per organisation unit)', component: lazy(() => import('./TalentReviewPage')) },
  { id: 'talent-review-insights', path: '/talent/review/insights', module: 'M23', zone: 'staff', guard: TALENT_AGG, nav: { lens: 'my', section: 'talent', order: 82 }, parent: 'talent-review', spec: 'BACKLOG F18 · aggregate exports suppress cells under 10 (women and Emirati splits)', component: lazy(() => import('./TalentInsightsPage')) },
  { id: 'talent-review-pool', path: '/talent/review/pool', module: 'M23', zone: 'staff', guard: TALENT, nav: { lens: 'my', section: 'talent', order: 81 }, parent: 'talent-review', spec: 'BACKLOG F18 · HiPo pool (feeds ESTADAD nominations, F16)', component: lazy(() => import('./HipoPoolPage')) },
  { id: 'talent-review-cycle', path: '/talent/review/:cycleId', module: 'M23', zone: 'staff', guard: TALENT, parent: 'talent-review', spec: 'BACKLOG F18 · 3×3 placement with the evidence panel and outlier flags', component: lazy(() => import('./CyclePage')) },
  { id: 'talent-review-calibration', path: '/talent/review/:cycleId/calibration', module: 'M23', zone: 'staff', guard: TALENT, parent: 'talent-review-cycle', spec: 'BACKLOG F18 · calibration session (HR facilitator) and lock (HR director, maker-checker)', component: lazy(() => import('./CalibrationPage')) },
  { id: 'my-development-priorities', path: '/my/development-priorities', module: 'M23', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Own'] } }, nav: { lens: 'my', section: 'career', order: 18.9 }, parent: 'my', spec: 'BACKLOG F18 · employees see "development priorities agreed", never their box', component: lazy(() => import('./MyPrioritiesPage')) },
  // F19 Succession planning
  { id: 'talent-succession', path: '/talent/succession', module: 'M23', zone: 'staff', guard: SUCCESSION, nav: { lens: 'my', section: 'talent', order: 83 }, parent: 'my', spec: 'BACKLOG F19 · /talent/succession (slates for critical and leadership roles)', component: lazy(() => import('./SuccessionPage')) },
  { id: 'talent-succession-slate', path: '/talent/succession/:slateId', module: 'M23', zone: 'staff', guard: SUCCESSION, parent: 'talent-succession', spec: 'BACKLOG F19 · successors, readiness, hard gates, gap actions, confirm', component: lazy(() => import('./SlatePage')) },
];
