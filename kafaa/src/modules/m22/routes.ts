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
  // F17 Communities of practice and expert finder
  { id: 'communities', path: '/communities', module: 'M22', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'knowledge', order: 55 }, parent: 'my', spec: 'BACKLOG F17 · /communities', component: lazy(() => import('./CommunitiesPage')) },
  { id: 'communities-experts', path: '/communities/experts', module: 'M22', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'knowledge', order: 56 }, parent: 'communities', spec: 'BACKLOG F17 · expert finder (opted-in people only)', component: lazy(() => import('./ExpertsPage')) },
  { id: 'communities-sessions', path: '/communities/sessions', module: 'M22', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'knowledge', order: 57 }, parent: 'communities', spec: 'BACKLOG F17 · knowledge-sharing session catalogue (BM25 search)', component: lazy(() => import('./SessionsPage')) },
  { id: 'community-thread', path: '/communities/thread/:threadId', module: 'M22', zone: 'staff', guard: STAFF, parent: 'communities', spec: 'BACKLOG F17 · moderated Q&A thread', component: lazy(() => import('./ThreadPage')) },
  { id: 'communities-detail', path: '/communities/:id', module: 'M22', zone: 'staff', guard: STAFF, parent: 'communities', spec: 'BACKLOG F17 · community: charter, steward, events, Q&A, moderation', component: lazy(() => import('./CommunityPage')) },
];
