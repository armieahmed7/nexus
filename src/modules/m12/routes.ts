// M12 routes (owner: G5). Paths, guards and nav placement for this module. Shared registry: src/routes/registry.ts
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

export const routes: RouteDef[] = [
  { id: 'home', path: '/', module: 'M12', zone: 'public', guard: {}, spec: "§5 /", component: lazy(() => import('./HomePage')) },
  { id: 'about', path: '/about', module: 'M12', zone: 'public', guard: {}, nav: { lens: 'public', section: 'about', order: 90 }, parent: 'home', spec: "§5 /about", component: lazy(() => import('./AboutPage')) },
  { id: 'about-structure', path: '/about/structure', module: 'M12', zone: 'public', guard: {}, parent: 'about', spec: "§5 /about/structure", component: lazy(() => import('./AboutStructurePage')) },
  { id: 'community', path: '/community', module: 'M12', zone: 'public', guard: {}, nav: { lens: 'public', section: 'about', order: 91 }, parent: 'home', spec: "§5 /community · M12", component: lazy(() => import('./CommunityPage')) },
  { id: 'esg', path: '/esg', module: 'M12', zone: 'public', guard: {}, nav: { lens: 'public', section: 'about', order: 92 }, parent: 'community', spec: "§5 /esg · M12", component: lazy(() => import('./EsgPage')) },
  { id: 'emergency', path: '/emergency', module: 'M12', zone: 'public', guard: {}, parent: 'community', spec: "M12 emergency information", component: lazy(() => import('./EmergencyPage')) },
  { id: 'faq', path: '/faq', module: 'M12', zone: 'public', guard: {}, parent: 'home', spec: "§5 /faq", component: lazy(() => import('./FaqPage')) },
  { id: 'contact', path: '/contact', module: 'M12', zone: 'public', guard: {}, parent: 'home', spec: "§5 /contact", component: lazy(() => import('./ContactPage')) },
  { id: 'legal', path: '/legal/:page', module: 'M12', zone: 'public', guard: {}, parent: 'home', spec: "§5 /legal/*", component: lazy(() => import('./LegalPage')) },
];
