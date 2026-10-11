# Kafa'a docs

Planning, hand-over and deploy documents for the Kafa'a portal (the app itself is in [`../../kafaa/`](../../kafaa/)).

| File | What it is |
|---|---|
| [`README_FIRST.md`](README_FIRST.md) | Start here: reading order and rules for whoever continues waves E to I. |
| [`HANDOVER_WAVES_E_TO_I.md`](HANDOVER_WAVES_E_TO_I.md) | Full hand-over: status after wave D, access, deploy procedure, conventions, feature cards for waves E to I, open issues, definition of done. |
| [`SOURCE_README.md`](SOURCE_README.md) | Notes from the source package (build, env var names, database, secrets scan). |
| [`ref/PLAN.md`](ref/PLAN.md), [`ref/audit.md`](ref/audit.md), [`ref/BACKLOG.md`](ref/BACKLOG.md) | Programme plan, audit and backlog. |
| [`ref/research/`](ref/research/) | Benchmark research packs (the only allowed source for figures). |
| [`ref/QA_A.md`](ref/QA_A.md), [`ref/QA_B.md`](ref/QA_B.md), [`ref/QA_C.md`](ref/QA_C.md) | Wave QA reports. |
| [`ref/handoffs/`](ref/handoffs/) | Per-engineer hand-offs for FS waves A to D. |
| [`ref/deploy/`](ref/deploy/) | `DEPLOY_PLAN.md`, `DEPLOY_READY.md`, `DEPLOY_DONE.md`. |

## Reading these docs in this repository

These documents were written before the code moved to GitHub, so they use the old locations:

- `/workspace/kafaa` (and "the tarball" / "the bundle") means [`kafaa/`](../../kafaa/) in this repository. Its full git history (master plus every merged wave branch) is preserved here.
- Deploys described as zip uploads of `deploy_out/` still work, but the preferred path is now Netlify continuous deployment from this repo (see the root [`README.md`](../../README.md)).
- `ref/qa_scripts/` and `ref/workflows/` mentioned in the hand-over were helper scripts for the previous agent's environment and are not included.

## Security notes

- **Demo signing key (F04):** `kafaa/supabase/migrations/20261009111001_kafaa_w1e1_passport.sql` contains the private seed of the credential wallet's server key `key-1` (function `kafaa_badge_issuer_seed()`, not executable by API roles). It is a **demo-only key** for the synthetic demo tenant. **Rotate it before any real use.**
- The Supabase anon JWT in `kafaa/src/config.ts` and `kafaa/scripts/e2e-supabase.mjs` is the public anon key (role `anon`), shipped in the bundle by design.
- The shared NEXUS demo password is never committed. Put it in `kafaa/.env.local` (gitignored) for local builds, or in Netlify's environment variables for deploys.
