/**
 * Route registry: every Kafa'a route, collected from src/modules/<mXX>/routes.ts. Each route is also served under /ar.
 * Validated at load (unique ids and paths, parents exist); a bad registration throws in dev and fails the smoke test.
 */
import { matchPath } from 'react-router-dom';
import type { RouteDef } from './types';
import { routes as m01 } from '../modules/m01/routes';
import { routes as m02 } from '../modules/m02/routes';
import { routes as m03 } from '../modules/m03/routes';
import { routes as m04 } from '../modules/m04/routes';
import { routes as m05 } from '../modules/m05/routes';
import { routes as m06 } from '../modules/m06/routes';
import { routes as m07 } from '../modules/m07/routes';
import { routes as m08 } from '../modules/m08/routes';
import { routes as m09 } from '../modules/m09/routes';
import { routes as m10 } from '../modules/m10/routes';
import { routes as m11 } from '../modules/m11/routes';
import { routes as m12 } from '../modules/m12/routes';
import { routes as m13 } from '../modules/m13/routes';
import { routes as m14 } from '../modules/m14/routes';
import { routes as m16 } from '../modules/m16/routes';

export const ROUTES: RouteDef[] = [...m12, ...m01, ...m02, ...m03, ...m04, ...m05, ...m06, ...m07, ...m08, ...m09, ...m10, ...m11, ...m13, ...m14, ...m16];

export function validateRoutes(list: RouteDef[]): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const r of list) {
    if (ids.has(r.id)) errs.push(`duplicate route id ${r.id}`);
    if (paths.has(r.path)) errs.push(`duplicate path ${r.path}`);
    if (!r.path.startsWith('/')) errs.push(`path must start with / (${r.id})`);
    if (r.path === '/ar' || r.path.startsWith('/ar/')) errs.push(`paths must not include the /ar prefix (${r.id})`);
    ids.add(r.id);
    paths.add(r.path);
  }
  for (const r of list) if (r.parent && !ids.has(r.parent)) errs.push(`unknown parent ${r.parent} for ${r.id}`);
  return errs;
}
const errors = validateRoutes(ROUTES);
if (errors.length) throw new Error(`Route registry invalid:\n${errors.join('\n')}`);

export const ROUTE_BY_ID: Record<string, RouteDef> = Object.fromEntries(ROUTES.map((r) => [r.id, r]));

/** Find the route for a path (without the /ar prefix). Static paths win over param paths. */
export function routeForPath(path: string): { def: RouteDef; params: Record<string, string> } | null {
  const sorted = [...ROUTES].sort((a, b) => Number(a.path.includes(':')) - Number(b.path.includes(':')));
  for (const def of sorted) {
    const m = matchPath({ path: def.path, end: true }, path);
    if (m) return { def, params: m.params as Record<string, string> };
  }
  return null;
}

/** Fill a route path with params: href('careers-role', { slug: 'ro' }) → /careers/roles/ro */
export function href(id: string, params: Record<string, string> = {}): string {
  const def = ROUTE_BY_ID[id];
  if (!def) throw new Error(`unknown route ${id}`);
  return def.path.replace(/:(\w+)/g, (_, k) => encodeURIComponent(params[k] ?? ''));
}
