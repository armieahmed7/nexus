// Reads the route registry source files (no bundler needed) so the smoke test always covers every registered route.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
    // Guards given by a named constant (`const OWN = { ... };` then `guard: OWN`) are inlined first, without TS casts.
    // String constants used inside those guards (`const LA = 'learning_analytics' as const;`, M25) are inlined into them first.
    const strs = [...src.matchAll(/^const (\w+) = ('[^']*')(?: as const)?;\s*$/gm)];
    for (const c of src.matchAll(/^const (\w+) = (\{.*\});\s*$/gm)) {
      let body = c[2].replace(/ as const/g, '');
      for (const k of strs) body = body.replace(new RegExp(`\\b${k[1]}\\b`, 'g'), k[2]);
      src = src.split(`guard: ${c[1]},`).join(`guard: ${body},`);
    }
    const re = /\{\s*id:\s*'([^']+)',\s*path:\s*'([^']+)',\s*module:\s*'([^']+)',\s*zone:\s*'[^']+',\s*guard:\s*(\{[^}]*\}[^}]*\}|\{[^}]*\})/g;
    let m: RegExpExecArray | null;
    // Inline guards can carry TS casts too (`res: 'recognition' as const`, FS78 M34): drop them so the guard text evaluates as JS (FS wave I QA).
    while ((m = re.exec(src))) out.push({ id: m[1], path: m[2], module: m[3], guard: m[4].replace(/ as const/g, '') });
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
const PER_ROUTE: Record<string, Record<string, string>> = { 'partners-detail': { slug: 'kepco' }, 'news-item': { slug: 'dnt-first-cohort' } /* G5 */ };
// F01 (wave 0): module owners give sample params in src/modules/<m>/smoke.json ({ "<route-id>": { "<param>": "<seed id>" } }).
for (const dir of existsSync('src/modules') ? readdirSync('src/modules') : []) {
  const f = join('src/modules', dir, 'smoke.json');
  if (existsSync(f)) Object.assign(PER_ROUTE, JSON.parse(readFileSync(f, 'utf8')) as Record<string, Record<string, string>>);
}
export function fill(r: SmokeRoute): string {
  return r.path.replace(/:(\w+)/g, (_, k) => (PER_ROUTE[r.id]?.[k] ?? PARAMS[k] ?? 'x'));
}
export const isPublic = (r: SmokeRoute) => !/signedIn|anyRole|grant/.test(r.guard);
