// The generated route manifest, tests/fixtures/routes.manifest.json (npm run gen, scripts/gen-route-guards.mjs). Tests take the route total
// from here instead of pinning a number, and tests/unit/route-manifest.test.ts diffs the live registry against it, so adding a route means
// running npm run gen and committing the regenerated files, not editing a dozen tests (TECH-09, 2026-10-17).
// Read with fs (not a JSON import) so it works the same in vitest and in Playwright specs.
import { readFileSync } from 'node:fs';

export interface ManifestGuard { signedIn?: boolean; anyRole?: string[]; grant?: { res: string; levels: string[] }; noTelemetry?: boolean }
export interface ManifestRoute { id: string; path: string; module: string; zone: string; guard: ManifestGuard }

export const ROUTE_MANIFEST_FILE = 'tests/fixtures/routes.manifest.json';
export const ROUTE_MANIFEST: ManifestRoute[] = JSON.parse(readFileSync(ROUTE_MANIFEST_FILE, 'utf8'));
/** How many routes the registry has (each is mounted twice by the router: at /<path> and /ar/<path>). */
export const ROUTE_COUNT = ROUTE_MANIFEST.length;
/** Every route id, sorted: for loaders that do not keep router order (tests/smoke/routes.ts reads module folders). */
export const ROUTE_IDS_SORTED = ROUTE_MANIFEST.map((r) => r.id).sort();
