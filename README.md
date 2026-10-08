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

Sign in at `/kafaa/sign-in` with any role card. The `local` backend works offline; use the backend chip in the header to reset the demo data.

### Backends

| | `local` (default) | `supabase` |
|---|---|---|
| Data | `src/seed/seed.json` in the browser, saved as `localStorage["kafaa.local.v1"]` | `kafaa_*` tables in NEXUS project `hlirqxoddysxtdezwcgv` |
| Identity | any of the 57 personas | the 43 NEXUS role cards (same-origin NEXUS session, or direct sign-in when `VITE_NEXUS_DEMO_PASSWORD` is set locally) |
| Rules | `src/data/access.ts` + `src/data/local/rpc.ts` | RLS + `kafaa_*` SECURITY DEFINER RPCs |
| Ledger | `ledger_local` table | NEXUS `ledger_entries` via `nexus_append_ledger` |

Choose with `VITE_KAFAA_BACKEND` (see `.env.example`) or per browser from the backend chip (`localStorage["kafaa.backend"]`). Never commit `.env.local`.

## Where things are

- `CONTRACT.md`: how the module groups build on the foundation (ownership, conventions, repository rule, i18n, guards, acceptance checklists).
- `docs/spec-rev-a.txt`: the product spec. `docs/RBAC.md`: the access matrix (generated).
- `src/data/schema.ts`: tables, columns, read rules and write modes. `npm run gen` turns it into types, SQL, RLS, the policy matrix and the seed.
- `supabase/migrations/`: SQL applied to the live project in file order. `scripts/validate-migrations.mjs` checks it against PGlite.
- `scripts/seed-chunks.mjs`: splits `supabase/seed.sql` into ordered, idempotent chunks for size-limited SQL consoles.
- `scripts/e2e-supabase.mjs`: live end-to-end check (NEXUS sign-in, RLS read, one RPC write with audit and ledger). Needs `KAFAA_E2E_PASSWORD` in the environment.
