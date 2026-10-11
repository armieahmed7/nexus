// M24 routes (Knowledge continuity; owner W3 · E2, features F20 Knowledge loss risk assessment and F21 Knowledge capture studio).
// Registered once by F01 in src/routes/registry.ts. Route ids are i18n keys (m24.routes.<id>.title|purpose) and are visited by the
// smoke suite automatically; param routes take their sample params from smoke.json.
// Access: the knowledge base and the capture studio are for staff (knowledge R); the review queue for interviewers and the KM owner
// (knowledge W/A); the KLRA for the KM owner (A), department heads (Scope) and HR aggregates (Agg) only, never staff-wide.
import { lazy } from 'react';
import type { RouteDef } from '../../routes/types';

const STAFF = { signedIn: true, grant: { res: 'knowledge' as const, levels: ['R' as const] } };
const REVIEW = { signedIn: true, grant: { res: 'knowledge' as const, levels: ['W' as const, 'A' as const] } };
const KLRA = { signedIn: true, grant: { res: 'knowledge' as const, levels: ['A' as const, 'Scope' as const, 'Agg' as const] } };
const KLRA_ROWS = { signedIn: true, grant: { res: 'knowledge' as const, levels: ['A' as const, 'Scope' as const] } };

export const routes: RouteDef[] = [
  { id: 'knowledge', path: '/knowledge', module: 'M24', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'knowledge', order: 58 }, parent: 'my', spec: 'BACKLOG F21 · /knowledge (knowledge base: BM25 over assets, OE and courses)', component: lazy(() => import('./KnowledgePage')) },
  { id: 'knowledge-asset', path: '/knowledge/assets/:assetId', module: 'M24', zone: 'staff', guard: STAFF, parent: 'knowledge', spec: 'BACKLOG F21 · knowledge asset with citations, used-by count, read before requal', component: lazy(() => import('./AssetPage')) },
  { id: 'knowledge-capture', path: '/knowledge/capture', module: 'M24', zone: 'staff', guard: STAFF, nav: { lens: 'my', section: 'knowledge', order: 59 }, parent: 'knowledge', spec: 'BACKLOG F21 · /knowledge/capture (structured capture interviews, SME profile)', component: lazy(() => import('./CapturePage')) },
  { id: 'knowledge-capture-session', path: '/knowledge/capture/:sessionId', module: 'M24', zone: 'staff', guard: STAFF, parent: 'knowledge-capture', spec: 'BACKLOG F21 · plan -> hold -> transcribe, deterministic enrichment, draft and submit', component: lazy(() => import('./SessionPage')) },
  { id: 'knowledge-review', path: '/knowledge/review', module: 'M24', zone: 'staff', guard: REVIEW, nav: { lens: 'my', section: 'knowledge', order: 60 }, parent: 'knowledge', spec: 'BACKLOG F21 · two-person review (technical + security and content check) and publish', component: lazy(() => import('./ReviewPage')) },
  { id: 'knowledge-klra', path: '/knowledge/klra', module: 'M24', zone: 'staff', guard: KLRA, nav: { lens: 'my', section: 'knowledge', order: 61 }, parent: 'knowledge', spec: 'BACKLOG F20 · /knowledge/klra (register, risk matrix, department heatmap, thresholds)', component: lazy(() => import('./KlraPage')) },
  { id: 'knowledge-klra-position', path: '/knowledge/klra/:positionId', module: 'M24', zone: 'staff', guard: KLRA_ROWS, parent: 'knowledge-klra', spec: 'BACKLOG F20 · position: factors with reasons, quarterly history, mitigation plan', component: lazy(() => import('./KlraPositionPage')) },
];
