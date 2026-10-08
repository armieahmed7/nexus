// Reads the route registry source files (no bundler needed) so the smoke test always covers every registered route.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SmokeRoute {
  id: string;
  path: string;
  module: string;
  guard: string;
}
export function loadRoutes(root = 'src/modules'): SmokeRoute[] {
  const out: SmokeRoute[] = [];
  for (const dir of readdirSync(root)) {
    let src = '';
    try {
      src = readFileSync(join(root, dir, 'routes.ts'), 'utf8');
    } catch {
      continue;
    }
    const re = /\{\s*id:\s*'([^']+)',\s*path:\s*'([^']+)',\s*module:\s*'([^']+)',\s*zone:\s*'[^']+',\s*guard:\s*(\{[^}]*\}[^}]*\}|\{[^}]*\})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) out.push({ id: m[1], path: m[2], module: m[3], guard: m[4] });
  }
  return out;
}

/** Sample values for path params (ids that exist in the seed). */
const PARAMS: Record<string, string> = {
  slug: 'senior-reactor-operator',
  programme: 'mustaqbali',
  id: 'c-get',
  form: 'form-basics',
  standard: 'qs-ro',
  page: 'privacy',
};
const PER_ROUTE: Record<string, Record<string, string>> = { 'partners-detail': { slug: 'kepco' } };
export function fill(r: SmokeRoute): string {
  return r.path.replace(/:(\w+)/g, (_, k) => (PER_ROUTE[r.id]?.[k] ?? PARAMS[k] ?? 'x'));
}
export const isPublic = (r: SmokeRoute) => !/signedIn|anyRole|grant/.test(r.guard);
