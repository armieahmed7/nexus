// npm run gen: regenerate everything derived from src/auth/policy.ts, src/data/schema.ts and scripts/seed/*.
import { execFileSync } from 'node:child_process';
for (const s of ['scripts/gen-schema.mjs', 'scripts/gen-policy.mjs', 'scripts/build-seed.mjs']) {
  execFileSync(process.execPath, ['--no-warnings', s], { stdio: 'inherit' });
}
