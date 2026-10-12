# Kafa'a · كفاءة

Kafa'a is a concept nuclear skills platform for ENEC. It covers careers, qualification, operator licensing support, training, assessments, the talent pipeline, workforce analytics, partners, universities, safety culture and Dalil, a governed AI guide. It runs inside ENEC NEXUS at `/kafaa/`, reuses the NEXUS role-card session, and records material actions in the NEXUS evidence ledger.

It is a concept: data is synthetic or comes from public sources, every person is a role card, and Kafa'a mirrors the licensee's systems instead of acting as an authority.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173/kafaa/ (local backend, seeded in the browser)
npm run verify         # gen, i18n check, typecheck, unit tests, migration validation, public payload check, build, smoke tests
npm run build && npm run preview   # production build served at http://localhost:4173/kafaa/
```

Sign in at `/kafaa/sign-in` with any role card. The default backend is the live NEXUS project; the `local` backend works offline and the backend chip in the header switches to it (and resets its demo data).

### Backends

| | `local` (fallback) | `supabase` (default) |
|---|---|---|
| Data | `src/seed/seed.json` in the browser, saved as `localStorage["kafaa.local.v1"]` | `kafaa_*` tables in NEXUS project `hlirqxoddysxtdezwcgv` |
| Identity | any of the 57 personas | the 43 NEXUS role cards: the sign-in screen signs in to Supabase Auth with the card's demo account (password from `VITE_NEXUS_DEMO_PASSWORD` at build time, never committed) and stores the session in NEXUS's format, so on the NEXUS origin the session is shared both ways |
| Rules | `src/data/access.ts` + `src/data/local/rpc.ts` | RLS + `kafaa_*` SECURITY DEFINER RPCs |
| Ledger | `ledger_local` table | NEXUS `ledger_entries` via `nexus_append_ledger` |

Choose with `VITE_KAFAA_BACKEND` (`supabase` unless set to `local`; see `.env.example`) or per browser from the backend chip (`localStorage["kafaa.backend"]`). Never commit `.env.local`.

"Back to NEXUS" and NEXUS deep links are root-relative when Kafa'a is served on the NEXUS origin and point to `VITE_NEXUS_URL` (default `https://enecai.xyz/`) everywhere else.

### Deploy folder

`npm run build:deploy` builds and assembles `deploy_out/`: `_redirects` at the root (`/ → /kafaa/`, `/kafaa → /kafaa/`, SPA fallback for `/kafaa/*`) and the app under `deploy_out/kafaa/`.

## Future-skills programme (FS01-FS84)

The future-skills and competencies programme (`docs/kafaa/ref/PLAN.md`) was built in waves A to I; every feature, its routes, tests, status and open issues are in `docs/kafaa/ref/PROGRAMME_STATUS.md`, and each wave's QA report is `docs/kafaa/ref/QA_<wave>.md`. Waves E to I reach the live project through the ordered live-apply bundles in `docs/kafaa/ref/live_apply/wave<W>/` (apply in order, compare with each `EXPECTED.md`, then merge: merging to `main` deploys production).

## Where things are

- `CONTRACT.md`: how the module groups build on the foundation (ownership, conventions, repository rule, i18n, guards, acceptance checklists).
- `docs/spec-rev-a.txt`: the product spec. `docs/RBAC.md`: the access matrix (generated).
- `src/data/schema.ts`: tables, columns, read rules and write modes. `npm run gen` turns it into types, SQL, RLS, the policy matrix and the seed.
- `supabase/migrations/`: SQL applied to the live project in file order. `scripts/validate-migrations.mjs` checks it against PGlite.
- `scripts/gen-rls-perf.mjs`: regenerates `20261008140000_kafaa_rls_perf.sql` (RLS rules with caller-only helpers evaluated once per query) and proves the visible rows are unchanged for 25 identities × every table. Rerun after adding policies (about 25 minutes).
- `playwright.e2e.config.ts` + `tests/e2e/`: full E2E QA against `vite preview` in supabase mode (route × role sweep, key journeys, Arabic RTL, mobile, screenshot set). One worker; needs the build made with `.env.local`.
- `scripts/seed-chunks.mjs`: splits `supabase/seed.sql` into ordered, idempotent chunks for size-limited SQL consoles.
- `scripts/e2e-supabase.mjs`: live end-to-end check (NEXUS sign-in, RLS read, one RPC write with audit and ledger). Needs `KAFAA_E2E_PASSWORD` in the environment.
