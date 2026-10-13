# Kafa'a source package

Snapshot of the Kafa'a Nuclear Skills Platform repo (a concept portal inside ENEC NEXUS) at the end of FS wave D.

- Commit: `558cdcf216e6c1235c463e515d21f7ab62a0f1cb` on `master` (2026-10-11 13:34 UTC), "FS wave D integration and QA: cross-feature wiring, QA migration, tests, fixes"
- Working tree was clean when packaged.

## Files

| File | Size | SHA-256 |
|---|---|---|
| `kafaa-source.bundle` | 13.9 MB | `c4015d7aee317fd71b28020e4fb9de9cba1a886b376548f3602cb7bfc5b110b6` |
| `kafaa-source-558cdcf.tar.gz` | 8.4 MB | `87fd1fce7998c8e6e1649b299c21bbb9d01e8eeeb29d35c6b66d838a89baed6d` |

Both files are under the Slack limit, so neither is split. Use one or the other:

- **The bundle** holds the full git history: `master` plus all 51 wave and engineer branches (`w1e1`...`w5e5`, `g1`...`g5`, `fsAe1`...`fsDe5`).
- **The tarball** is `git archive HEAD`: the working tree only, with no git history. It unpacks into `kafaa/`.

## Restore

```bash
# Option A: full history
git clone kafaa-source.bundle kafaa        # checks out master
cd kafaa
git branch -r                              # every branch, as origin/<name>
# To make GitHub the remote:
#   git remote set-url origin git@github.com:<you>/<repo>.git
#   git push origin --all

# Option B: no git
tar -xzf kafaa-source-558cdcf.tar.gz       # creates ./kafaa
cd kafaa
```

## Build and run

- Node 22 (packaged and tested with v22.22.0). npm comes with Node. `package-lock.json` is included.
- `npm ci` installs 268 packages in about 10 s.
- `npm run typecheck` runs `tsc --noEmit`. It passed on a fresh extract of the tarball.
- `npm run dev` starts Vite. `npm run build` runs gen, i18n check, tsc and vite build. `npm run build:deploy` runs the build and then makes `deploy_out/`.
- `npm run verify` is the full gate: gen, i18n, typecheck, vitest, migration validation, public-payload check, build and Playwright smoke tests. Playwright needs `npx playwright install chromium` first.
- `npm run migrations:validate` replays every migration in PGlite, locally. It does not need Supabase.

`node_modules`, `dist`, `deploy_out`, `test-results`, `.env` and `.env.local` are gitignored and are not in either file.

## Environment variables (names only; see `.env.example`)

| Variable | Purpose |
|---|---|
| `VITE_KAFAA_BACKEND` | `supabase` (default) or `local`. `local` runs an in-browser store seeded from `src/seed/seed.json`. |
| `VITE_SUPABASE_URL` | Supabase project URL (the NEXUS project `hlirqxoddysxtdezwcgv`). |
| `VITE_SUPABASE_ANON_KEY` | Public anon key. Leave it empty to use the built-in default in `src/config.ts`. |
| `VITE_NEXUS_URL` | Target of NEXUS deep links when the app is not served on the NEXUS origin. |
| `VITE_NEXUS_DEMO_PASSWORD` | Shared NEXUS demo-account password. Set it only in `.env.local`, which is gitignored. Never commit it. |
| `KAFAA_E2E_PASSWORD` | Used only by `scripts/e2e-supabase.mjs` (live end-to-end check). |

None of these is a server secret. The app uses only the public anon key; RLS and RPCs enforce access.

## Database

- `supabase/migrations/` contains 68 migration files (`20261008120100_kafaa_schema.sql` ... `20261010249001_kafaa_fs4qa_integration.sql`). `supabase/seed.sql` (17 MB) holds the demo seed.
- The live Supabase project (`hlirqxoddysxtdezwcgv`, shared with ENEC NEXUS) already has every migration applied. Do not re-apply them to that project. Use them only to rebuild a fresh database.

## Secrets scan

Every file in the tarball and every commit in the bundle was searched for `service_role`, `sb_secret_`, `SUPABASE_SERVICE`, `BEGIN ... PRIVATE KEY`, JWTs and the demo password. There were no hits apart from these two known items:

- The anon JWT appears in `src/config.ts` and `scripts/e2e-supabase.mjs`. Its role is `anon`, and it is public by design.
- `supabase/migrations/20261009111001_kafaa_w1e1_passport.sql` holds the F04 badge-issuer key, `kafaa_badge_issuer_seed()`. It is a documented **demo key** for the synthetic demo tenant, and no API role can execute that function. The migration and `scripts/seed/ext/f03-passport.mjs` need it, so it is kept. Rotate it before any real use.
