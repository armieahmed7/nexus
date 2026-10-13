# nexus

Monorepo for the ENEC NEXUS programme. All code changes and deploys for the projects below happen from this repository.

## Repository layout

| Path | Contents |
|---|---|
| [`kafaa/`](kafaa/) | **Kafa'a Nuclear Skills Platform**, a concept portal inside ENEC NEXUS (Vite + React + TypeScript, Supabase backend). Imported with its full git history (master at `558cdcf`, end of FS wave D, including every merged wave and engineer branch). Its own [`kafaa/README.md`](kafaa/README.md) and the engineering contract [`kafaa/CONTRACT.md`](kafaa/CONTRACT.md) describe the app in depth. |
| [`docs/kafaa/`](docs/kafaa/) | Plan, research packs, QA reports, engineer hand-offs, deploy docs and the **hand-over for waves E to I**. Start with [`docs/kafaa/README_FIRST.md`](docs/kafaa/README_FIRST.md). |
| [`netlify.toml`](netlify.toml) | Netlify build settings for the `enec-kafaa` site (base directory `kafaa`). |

## Running Kafa'a locally

Requires Node 22 (tested with v22.22.0).

```bash
cd kafaa
npm ci
cp .env.example .env.local     # then fill in VITE_NEXUS_DEMO_PASSWORD; .env.local is gitignored
npm run dev                    # Vite dev server on http://localhost:5173/kafaa/
```

Other scripts (run inside `kafaa/`):

- `npm run build` runs code generation, the i18n check, `tsc` and `vite build` (output in `dist/kafaa/`).
- `npm run build:deploy` runs the build and then `scripts/make-deploy.mjs`, which assembles `deploy_out/`.
- `npm run verify` is the full gate: gen, i18n, typecheck, vitest, migration validation (PGlite, no Supabase needed), public-payload check, build and Playwright smoke tests (run `npx playwright install chromium` first).

### Environment variables (names only; see [`kafaa/.env.example`](kafaa/.env.example))

| Variable | Purpose |
|---|---|
| `VITE_KAFAA_BACKEND` | `supabase` (default) or `local` (in-browser store seeded from `src/seed/seed.json`). |
| `VITE_SUPABASE_URL` | Supabase project URL. Defaults to the NEXUS project `hlirqxoddysxtdezwcgv`. |
| `VITE_SUPABASE_ANON_KEY` | Public anon key. Leave empty to use the built-in default in `src/config.ts`. |
| `VITE_NEXUS_URL` | Target of NEXUS deep links (the header no longer has a "Back to NEXUS" link). Defaults to `https://enecai.xyz/`. |
| `VITE_NEXUS_DEMO_PASSWORD` | Shared NEXUS demo-account password, baked into the bundle at build time so role-card sign-in works off the NEXUS origin. **Never commit it**: `.env.local` locally, Netlify environment variables for deploys. |
| `KAFAA_E2E_PASSWORD` | Optional, only for `scripts/e2e-supabase.mjs` (live end-to-end check). |

None of these is a server secret: the app only uses the public anon key, and RLS plus RPCs enforce access.

## Deploying Kafa'a (Netlify site `enec-kafaa`)

Live at https://enec-kafaa.netlify.app/kafaa/.

**Continuous deployment from this repo (recommended).** Link the `enec-kafaa` site to this repository. [`netlify.toml`](netlify.toml) already sets:

| Setting | Value |
|---|---|
| Base directory | `kafaa` |
| Build command | `npm run build:deploy` |
| Publish directory | `deploy_out` (relative to the base, i.e. `kafaa/deploy_out`) |
| Node version | `22` (`NODE_VERSION`) |
| Environment variable to set in the Netlify UI | `VITE_NEXUS_DEMO_PASSWORD` (the others have working defaults) |

The build publishes `_redirects` (`/` to `/kafaa/`, the `/kafaa/.well-known/*` issuer rewrite above the SPA fallback), `.well-known/kafaa-issuer.json`, and `kafaa/` (`index.html`, `ojt-sw.js`, `issuer/kafaa-issuer.json`, hashed assets under `kafaa/assets/`). `make-deploy.mjs` fails the build if any of these is missing or the redirect order is wrong.

**Manual zip upload (previous method).** Run `npm run build:deploy` inside `kafaa/` and upload `kafaa/deploy_out/` as a zip. `make-deploy.mjs` writes a `netlify.toml` with `publish = "."` and an empty command into `deploy_out/` so a zip upload publishes the prebuilt files as they are; a git-linked build ignores that file. See [`docs/kafaa/ref/deploy/DEPLOY_READY.md`](docs/kafaa/ref/deploy/DEPLOY_READY.md).

Never change the `enec-nexus` Netlify site or `enecai.xyz` from Kafa'a work.

## Database (Supabase)

`kafaa/supabase/migrations/` holds every Kafa'a migration (`kafaa_*` tables and RPCs) and `kafaa/supabase/seed.sql` the demo seed. The live Supabase project `hlirqxoddysxtdezwcgv` (shared with ENEC NEXUS) **already has every migration in this repo applied**: do not re-apply them there. New migrations go into the same folder and are applied once, by the person or agent shipping the change. Never run DROP, DELETE, TRUNCATE or ALTER on anything that is not `kafaa_*`.

## Security notes

- **Demo signing key:** `kafaa/supabase/migrations/20261009111001_kafaa_w1e1_passport.sql` contains the private seed of the F04 credential wallet key `key-1` (`kafaa_badge_issuer_seed()`, not executable by API roles). It is a **demo-only key** for the synthetic demo tenant. **Rotate it before any real use.**
- The anon JWT in `kafaa/src/config.ts` is the public Supabase anon key, shipped in the bundle by design.
- `.env`, `.env.local`, `node_modules/`, `dist/` and `deploy_out/` are gitignored. Never commit the demo password, a Netlify token or a Supabase service key.
