# Kafa'a: deploy-ready build

Prepared on 8 Oct 2026; updated 10 Oct 2026 after FS wave A and FS wave B, and 11 Oct 2026 after FS wave C. **Nothing has been deployed, and Netlify was not touched.** This file lists the exact commands for whoever runs the deploy. Read `DEPLOY_PLAN.md` for why Kafa'a goes to a separate site first.

## What is in the folder

`/workspace/kafaa/deploy_out/` is built from `master` with `npm run build:deploy`.

```
deploy_out/
  _redirects        / /kafaa/ 302
                    /kafaa /kafaa/ 301
                    /kafaa/.well-known/* /.well-known/:splat 200!   (issuer keys; above the SPA rule)
                    /kafaa/* /kafaa/index.html 200
  netlify.toml      [build] publish = "."  command = ""   (a zip upload publishes the folder as is)
  .well-known/      kafaa-issuer.json   (deploy root: Netlify does not publish nested dot-directories such as /kafaa/.well-known/)
  kafaa/            index.html, favicon.svg, issuer/kafaa-issuer.json (the wallet's "issuer keys" link), assets/*
                    (Vite base /kafaa/, so all assets are under /kafaa/assets/)
```

### Runtime behaviour of this build

- **Backend:** the default is `supabase`, using the live NEXUS project `hlirqxoddysxtdezwcgv` and its `kafaa_*` tables and RPCs. Setting `VITE_KAFAA_BACKEND=local` at build time gives the offline demo tenant instead. Visitors can also switch with the backend chip.
- **Sign-in:** a NEXUS role card signs in to Supabase Auth with `<persona>@demo.enec-nexus.ae` and the shared demo password. The session is stored in NEXUS's format: `nexus.auth.v1.sessions`, `nexus.active` and `nexus.auth.v1.consent`.
  - The password is baked in at build time from `/workspace/kafaa/.env.local` (`VITE_NEXUS_DEMO_PASSWORD`). That file is gitignored and never committed. NEXUS ships the same password in its own bundle by design.
  - The 14 Kafa'a-only personas (student, university, observer, ECP officer and others) have no NEXUS accounts. They work only on the local backend.
- **Back to NEXUS:**
  - When the page is served on `https://enecai.xyz`, the link is `/`.
  - On any other origin it is `https://enecai.xyz/`. The same rule applies to NEXUS deep links on `/admin/nexus`.
  - To change the target, set `VITE_NEXUS_URL` at build time.

## Rebuild (only if `master` changed)

```bash
cd /workspace/kafaa
# .env.local must contain VITE_NEXUS_DEMO_PASSWORD=<the shared NEXUS demo password>; never commit it
npm ci
npm run build:deploy          # gen + i18n check + typecheck + vite build + assemble deploy_out/
```

`scripts/make-deploy.mjs` checks the result:

- The four `_redirects` lines are present, with the `/kafaa/.well-known/*` rewrite above the SPA rule.
- The issuer profile exists at `deploy_out/.well-known/kafaa-issuer.json` and `deploy_out/kafaa/issuer/kafaa-issuer.json`.
- `index.html` references `/kafaa/assets/`.
- It warns if the demo password was not set for the build.

## Deploy: Phase 1, a separate site (no effect on `enec-nexus`)

**Option A: Netlify MCP**, as in `DEPLOY_PLAN.md` steps 1 and 3.

1. `netlify-project-services-updater` / `create-new-project` with name `enec-kafaa` in Armie's team. Record the returned site id.
2. `netlify-deploy-services-updater` / `deploy-site` with that site id. It returns a one-time command. Run it **from the deploy folder**, so that only `deploy_out` is zipped:
   ```bash
   cd /workspace/kafaa/deploy_out && npx -y @netlify/mcp@latest --site-id <enec-kafaa site id> --proxy-path "<proxy url from deploy-site>"
   ```
   Do not echo the proxy URL into chat or reports. It is a 30-minute credential.

**Option B: Netlify CLI** with Armie's own auth (`netlify login`). Never use the token that was pasted on 29 Sep.

```bash
npx -y netlify-cli@17.38.1 deploy --dir=/workspace/kafaa/deploy_out --site=<enec-kafaa site id> --prod
```

### Verify after deploy

- `https://<site>/` redirects to `/kafaa/`.
- `/kafaa/careers/roles/senior-reactor-operator` and `/kafaa/ar/careers` load as deep links.
- `/kafaa/issuer/kafaa-issuer.json`, `/.well-known/kafaa-issuer.json` and `/kafaa/.well-known/kafaa-issuer.json` return the issuer JSON (not the app HTML).
- Sign in as `nse`, then open `/kafaa/my`.
- "Back to NEXUS" goes to `https://enecai.xyz/`.

## Phase 2: mount at `enecai.xyz/kafaa/` (needs the NEXUS function sources)

This needs one `enec-nexus` deploy that carries the four functions. See `DEPLOY_PLAN.md` §2 and §3.

Add these lines above the `/*` rule in the NEXUS `_redirects`. **Do not** add Kafa'a's `/ /kafaa/ 302` line there.

```
/kafaa      /kafaa/                                     301
/kafaa/*    https://<enec-kafaa site>/kafaa/:splat      200
```

On that origin, "Back to NEXUS" becomes `/` automatically. The NEXUS and Kafa'a sessions are then shared both ways.

## Database state this build expects (already applied live)

- **Migrations (FS wave C, 11 Oct 2026):** all 62 `supabase/migrations/*.sql` files are applied. The six newest are the FS wave C migrations `20261010231001_kafaa_fs31_pathways_catalogue` (FS17/FS18), `20261010232001_kafaa_fs32_course_pack_academies` (FS19/FS20), `20261010233001_kafaa_fs33_assessment` (FS21/FS22), `20261010234001_kafaa_fs34_descriptors_scale` (FS23/FS24) and `20261010235001_kafaa_fs35_core_skills` (FS25/FS26), each applied in parts by its engineer, plus the wave QA migration `20261010239001_kafaa_fs3qa_integration.sql`. The QA migration was applied as `kafaa_fs3qa_integration_part1_pathway_assessment_items`, `_part2_pathway_gaps_refresh`, `_part3_evidence_key_order` and `_part3b_evidence_key_order`. Live function bodies and seed-row digests match local for every wave-C table; see `scratchpad/fs/QA_C.md`. `deploy_out/` was rebuilt from the FS wave C `master` and keeps the Netlify badge-hiding snippet. The app now has 259 routes.
- **Migrations (FS wave B, 10 Oct 2026):** all 56 `supabase/migrations/*.sql` files are applied. The six newest are the FS wave B migrations `20261010221001_kafaa_fs21_skills_crosswalk` (FS07/FS08), `20261010222001_kafaa_fs22_ai_fluency` (FS09/FS10), `20261010223001_kafaa_fs23_role_transformation` (FS11/FS12), `20261010224001_kafaa_fs24_future_readiness` (FS13/FS14) and `20261010225001_kafaa_fs25_future_roles` (FS15/FS16), each applied in parts by its engineer, plus the wave QA migration `20261010229001_kafaa_fs2qa_integration.sql`. The QA migration was applied as `kafaa_fs2qa_integration_part1_so_base_dg_gather`, `_part2_agenda_snapshot`, `_part3_f26_rows` and `_part1b_so_base`. Live function bodies and seed-row digests match local; see `scratchpad/fs/QA_B.md`. `deploy_out/` was rebuilt from the FS wave B `master` and keeps the Netlify badge-hiding snippet. The app now has 227 routes.
- **Migrations (FS wave A, 10 Oct 2026):** all 50 `supabase/migrations/*.sql` files are applied. The six newest are the FS wave A migrations `20261010211001_kafaa_fs11_foundation_catalogue` (FS01 benchmark registry + FS02 skills catalogue), `20261010212001_kafaa_fs12_decay` (FS03 skill decay; applied by the QA lead as `kafaa_fs12_decay_part1_tables_rules_states` and `kafaa_fs12_decay_part2_check_backfill_rpcs_grants`, then `kafaa_skills_apply(null, current_date)`), `20261010213001_kafaa_fs13_keyspace` (FS04), `20261010214001_kafaa_fs14_role_profiles` (FS05), `20261010215001_kafaa_fs15_task_future` (FS06) and the wave QA migration `20261010219001_kafaa_fs1qa_integration.sql` (applied as `kafaa_fs1qa_integration` and `kafaa_fs1qa_integration_part2_future_edges`). Live function bodies and seed-row digests match local; see `scratchpad/fs/QA_A.md`. `deploy_out/` was rebuilt from the FS wave A `master` and keeps the Netlify badge-hiding snippet. The app now has 212 routes.
- **Migrations (wave 5 note):** all 44 earlier files were applied on 9 Oct 2026 after wave 5. The newest are the five wave-5 migrations `20261009151001` to `20261009155001` (micro-credentials and OJT logbook, contractor passport, student journey, skills outlook, digest and Dalil career mode; applied in 12 parts by their engineers) and the integration migration `20261009159001_kafaa_w5qa_integration.sql` (applied as `kafaa_w5qa_integration_f38_digest_approvals`). Wave-4 note: `20261009141001` to `20261009149001` as before. `deploy_out/` was rebuilt from the wave-5 `master` and keeps the Netlify badge-hiding snippet from the source `index.html`; see `W5_QA.md`.
- **Service worker (wave 5):** `deploy_out/kafaa/ojt-sw.js` is registered only by the OJT logbook (`/kafaa/my/ojt`, scope limited to that page and its Arabic twin). It needs no Netlify setting; after deploy, open `/kafaa/my/ojt` and check in DevTools that the only registration has that scope.
- **Seed:** the merged seed is loaded. The exception is a small set of rows the Supabase MCP holds back because their text contains a guarded keyword: `consents`, the `applications` / `application_events` demo history, and one `content_pages` row. Loading them needs explicit user approval. The SQL is in `scratchpad/qa/load_deferred/`.
