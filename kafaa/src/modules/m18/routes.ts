// M18 routes (Career Navigator; owner: W1 engineer 2, features F05, F06 (W1) · F12 (W2)). Registered once by F01 in src/routes/registry.ts:
// add routes here only, never in shared routing files. Route ids are i18n keys (m18.routes.<id>.title|purpose).
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'my-career', path: '/my/career', module: 'M18', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Own'] } }, nav: { lens: 'my', section: 'career', order: 18 }, parent: 'my', spec: "F05 Career Navigator /my/career", component: lazy(() => import('./MyCareerPage')) },
  { id: 'my-career-roadmap', path: '/my/career/roadmap', module: 'M18', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Own'] } }, nav: { lens: 'my', section: 'career', order: 18.1 }, parent: 'my-career', spec: "F06 Career Roadmap and what-if /my/career/roadmap", component: lazy(() => import('./MyRoadmapPage')) },
  { id: 'team-career', path: '/team/career', module: 'M18', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Scope'] } }, nav: { lens: 'my', section: 'career', order: 18.5 }, parent: 'my', spec: "F05/F06 shared shortlists and roadmaps (manager view)", component: lazy(() => import('./TeamCareerPage')) },
  // F12 Career conversations (W2 · E2): employee preparation and acknowledgement, the line manager's workspace, HR aggregates
  { id: 'my-career-conversations', path: '/my/career/conversations', module: 'M18', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Own'] } }, nav: { lens: 'my', section: 'career', order: 18.2 }, parent: 'my-career', spec: 'BACKLOG F12 /my/career/conversations', component: lazy(() => import('./MyConversationsPage')) },
  { id: 'team-conversations', path: '/team/conversations', module: 'M18', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Scope'] } }, nav: { lens: 'my', section: 'career', order: 18.6 }, parent: 'my', spec: 'BACKLOG F12 /team/conversations (line manager of record)', component: lazy(() => import('./TeamConversationsPage')) },
  { id: 'workforce-career-conversations', path: '/workforce/career-conversations', module: 'M18', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Agg', 'A'] } }, nav: { lens: 'my', section: 'workforce', order: 69 }, parent: 'workforce', spec: 'BACKLOG F12 RBAC (HR aggregates by family, suppressed under 10)', component: lazy(() => import('./ConversationInsightsPage')) },
  // FS16 Role outlook labels with published criteria (FS wave B · E5): public criteria, thresholds and every role's label per year
  { id: 'careers-outlook-criteria', path: '/careers/outlook-criteria', module: 'M18', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 11.8 }, parent: 'careers', spec: 'FS16 role outlook labels with published criteria /careers/outlook-criteria', component: lazy(() => import('./CareersOutlookCriteriaPage')) },
  // FS34 Transferable-skills translator (FS wave D · E4): public, nothing stored; staff can translate their own passport
  { id: 'careers-translate', path: '/careers/translate', module: 'M18', zone: 'public', guard: {}, nav: { lens: 'public', section: 'careers', order: 11.9 }, parent: 'careers', spec: 'FS34 transferable-skills translator for career-changers /careers/translate', component: lazy(() => import('./CareersTranslatePage')) },
  // FS35 Career Health check (FS wave D · E4): Assess, Chart, Execute; own only
  { id: 'my-career-health', path: '/my/career/health', module: 'M18', zone: 'staff', guard: { signedIn: true, grant: { res: 'skills_profile', levels: ['Own'] } }, nav: { lens: 'my', section: 'career', order: 18.3 }, parent: 'my-career', spec: 'FS35 Career Health check (Assess, Chart, Execute) /my/career/health', component: lazy(() => import('./MyCareerHealthPage')) },
];
