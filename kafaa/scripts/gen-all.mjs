// npm run gen: regenerate everything derived from src/auth/policy.ts, src/data/schema.ts and scripts/seed/*.
import { execFileSync } from 'node:child_process';
for (const s of ['scripts/gen-schema.mjs', 'scripts/gen-policy.mjs', 'scripts/build-seed.mjs', 'scripts/gen-route-guards.mjs' /* readiness 2026-10-13 */]) {
  execFileSync(process.execPath, ['--no-warnings', s], { stdio: 'inherit' });
}
