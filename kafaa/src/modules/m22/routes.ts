// M22 routes (Leadership and communities; owner W2 · E5, features F16 Leadership journeys and F17 Communities of practice).
// Registered once by F01 in src/routes/registry.ts. Route ids are i18n keys (m22.routes.<id>.title|purpose) and are visited by
// the smoke suite automatically; param routes take their sample params from smoke.json.
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const STAFF = { signedIn: true, grant: { res: 'knowledge' as const, levels: ['R' as const] } };

export const routes: RouteDef[] = [
  // F16 Leadership journeys
  { id: 'leadership', path: '/leadership', module: 'M22', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'leadership', order: 50 }, parent: 'my', spec: 'BACKLOG F16 · /leadership (Enterprise Nuclear Leadership Academy pathway)', component: lazy(() => import('./LeadershipPage')) },
  { id: 'leadership-programme', path: '/leadership/programmes/:id', module: 'M22', zone: 'staff', guard: STAFF, parent: 'leadership', spec: 'BACKLOG F16 · programme facts with sources, eligibility, nomination', component: lazy(() => import('./ProgrammePage')) },
  { id: 'leadership-360', path: '/leadership/360', module: 'M22', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Own'] } }, nav: { lens: 'my', section: 'leadership', order: 51 }, parent: 'leadership', spec: 'BACKLOG F16 · leadership behaviours 360 (>= 5 raters, anonymous)', component: lazy(() => import('./Leadership360Page')) },
  { id: 'leadership-nominations', path: '/leadership/nominations', module: 'M22', zone: 'staff', guard: { signedIn: true, anyRole: ['manager', 'hr_director', 'training_manager', 'auditor'] }, nav: { lens: 'my', section: 'leadership', order: 52 }, parent: 'leadership', spec: 'BACKLOG F16 · nominateLeader / decideNomination (maker-checker)', component: lazy(() => import('./NominationsPage')) },
  { id: 'leadership-insights', path: '/leadership/insights', module: 'M22', zone: 'staff', guard: { signedIn: true, anyRole: ['auditor'], grant: { res: 'talent_review', levels: ['Agg', 'A'] } }, nav: { lens: 'my', section: 'leadership', order: 53 }, parent: 'leadership', spec: 'BACKLOG F16 · HR aggregates (>= 10)', component: lazy(() => import('./LeadershipInsightsPage')) },
  // FS46-FS47 (wave E · fsEe4): future leadership behaviours and the Future Leaders track
  { id: 'leadership-behaviours', path: '/leadership/behaviours', module: 'M22', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'leadership', order: 54 }, parent: 'leadership', spec: 'PLAN FS46 · behaviour catalogue with anchors at every rating point (EN/AR), coach cards, form versions', component: lazy(() => import('./LeadershipBehavioursPage')) },
  { id: 'leadership-future-leaders', path: '/leadership/future-leaders', module: 'M22', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'leadership', order: 54.5 }, parent: 'leadership', spec: 'PLAN FS47 · INMA-pattern competency model, cohort track, external programmes', component: lazy(() => import('./FutureLeadersPage')) },
  { id: 'leadership-future-leaders-manage', path: '/leadership/future-leaders/manage', module: 'M22', zone: 'staff', guard: { signedIn: true, anyRole: ['hr_analyst', 'hr_director', 'training_manager', 'auditor'] }, parent: 'leadership-future-leaders', spec: 'PLAN FS47 · nomination by HR, selection (maker-checker), modules, policy projects, suppressed statistics', component: lazy(() => import('./FutureLeadersManagePage')) },
  // F17 Communities of practice and expert finder
  { id: 'communities', path: '/communities', module: 'M22', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'knowledge', order: 55 }, parent: 'my', spec: 'BACKLOG F17 · /communities', component: lazy(() => import('./CommunitiesPage')) },
  { id: 'communities-experts', path: '/communities/experts', module: 'M22', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'knowledge', order: 56 }, parent: 'communities', spec: 'BACKLOG F17 · expert finder (opted-in people only)', component: lazy(() => import('./ExpertsPage')) },
  { id: 'communities-sessions', path: '/communities/sessions', module: 'M22', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'knowledge', order: 57 }, parent: 'communities', spec: 'BACKLOG F17 · knowledge-sharing session catalogue (BM25 search)', component: lazy(() => import('./SessionsPage')) },
  // FS48 (wave E · fsEe4): women in future nuclear skills (opt-in; HR aggregates only)
  { id: 'communities-women', path: '/communities/women-in-nuclear', module: 'M22', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'knowledge', order: 58 }, parent: 'communities', spec: 'PLAN FS48 · mentor circles, visiting placements, sponsored study (opt-in, withdrawable)', component: lazy(() => import('./WomenInNuclearPage')) },
  { id: 'communities-women-programme', path: '/communities/women-in-nuclear/programme', module: 'M22', zone: 'staff', guard: { signedIn: true, anyRole: ['hr_analyst', 'hr_director', 'training_manager', 'auditor'] }, parent: 'communities-women', spec: 'PLAN FS48 · pipeline metrics (aggregates, < 10 suppressed) and the programme owner desk', component: lazy(() => import('./WomenInNuclearProgrammePage')) },
  { id: 'community-thread', path: '/communities/thread/:threadId', module: 'M22', zone: 'staff', guard: STAFF, parent: 'communities', spec: 'BACKLOG F17 · moderated Q&A thread', component: lazy(() => import('./ThreadPage')) },
  { id: 'communities-detail', path: '/communities/:id', module: 'M22', zone: 'staff', guard: STAFF, parent: 'communities', spec: 'BACKLOG F17 · community: charter, steward, events, Q&A, moderation', component: lazy(() => import('./CommunityPage')) },
];
