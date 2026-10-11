# fsAe4 · FS05 Future role profiles (Now, 2030, 2035) · DONE

Branch `fsAe4` (worktree `/workspace/kafaa-fsAe4`), commit `6b2e00d`, not pushed. Live Supabase `hlirqxoddysxtdezwcgv`: additive kafaa_* only.

## Acceptance (card FS05)
- [x] 28/28 current roles have a published 2030 version (also now and 2035): 84 current-role versions. Live: 28 published 2030 rows for current roles.
- [x] 11/11 concept (future) roles have a profile with at least 4 requirements (2035 for all 11, plus 2030 for the 3 "prepare now" roles) and 1 to 3 inbound `career_paths` edges of kind `future` (19 edges).
- [x] `findPaths` reaches every concept role from at least one current role (unit test plus planner page test).
- [x] All public text (titles, summaries, rationales, why texts, EN and AR) passes `publicTextIsClean` plus the stricter `profileTextIsClean` (no headcount, sites or deployment claims). Every version reads "planning assumption, no deployment decision implied".
- [x] Security, safeguards and cyber roles (`security-officer`, `safeguards-specialist`) carry `path_only = true` with no requirements, enforced in TS `checkVersion` and SQL `kafaa_rpv_check`. The UI shows a path-level notice.
- [x] RBAC: published versions are public read (`public_content` where `is_public`); drafts and history are read by training manager, instructors (sat R) and admin/auditor (audit_log). Write is RPC only: frameworks A (admin) or sat A (training manager). Live anon reads 98 of 101 (no drafts, no superseded rows).
- [x] RPC `saveRoleProfileVersion`: audited (`role_profile.save`, `role_profile.publish`, refusals too); ledger `kafaa.role_profile.publish` on publish (NEXUS personas; skipped for Kafa'a-only personas, per contract).
- [x] Data: `career_paths.kind` with `future`; `job_roles.lifecycle` (`current` or `concept`); new table `role_profile_versions` (role, horizon now/2030/2035, version, status draft/published/superseded, requirements, drivers, rationale EN/AR, sources, as_of).
- [x] Benchmarks: SG-JTM, SSG-SF and IAEA-WFP chips (BenchmarkChips drawer with source URLs). Reads `kafaa_benchmarks` when FS01's `benchmarks` table is in SCHEMA, else a local fallback. Profile sources cite sg-jtm, ssg-trends-2025, IAEA SSG-75, NG-T-3.10, ENEC technology/Presight/TII and WNN ADVANCE.
- [x] Full EN and AR (RTL); both backends (LocalBackend and Supabase map `kafaa_save_role_profile_version`).

## Routes
- `/careers/roles/:slug?tab=horizons`: new "Now, 2030, 2035" tab on the role page. It has a horizon switch, a diff table (new, raised, same, lowered, dropped), `<WhyThis>`, drivers, sources, benchmark chips and the concept roles this role leads to. Concept role pages show a banner, how to get there, and the concept profile.
- `/careers/horizons` (new, public, `careers-horizons`): tiles, charts, change heatmap, role table, concept cards, method card, and a drafts list for editors.
- `/careers/roles/:slug/profile` (new, `careers-profile-edit`, training manager or admin): editor with live checks, save draft, publish with confirm, version history.
- Changed: `/careers` (a concept-roles section), `/careers/paths` (a "future" tab), `/careers/plan` (concept targets and a concept skills card).

## Tables and RPCs
- `kafaa_role_profile_versions` (RLS per statement), plus columns `kafaa_job_roles.lifecycle` and `kafaa_career_paths.kind` (named checks, indexes).
- `kafaa_save_role_profile_version(p jsonb)` (authenticated). Internal helpers (revoked from public, anon and authenticated): `kafaa_rpv_text_clean`, `kafaa_rpv_message`, `kafaa_rpv_check`.
- Migration `supabase/migrations/20261010214001_kafaa_fs14_role_profiles.sql`, applied live as `kafaa_fs14_role_profiles`. The 4 function bodies are md5-identical to PGlite.
- Live seed (on conflict do nothing):
  - 11 concept job_roles: digest 41ee73fd... matches local.
  - 19 future edges: digest de186d28... matches local.
  - 101 role_profile_versions: digest 38dc3127... matches seed.json.
- Seed: `scripts/seed/ext/fs05-role-profiles.mjs` adds 11 concept roles, 19 future edges and 101 versions. These include a superseded RO 2030 v1 and 2 open drafts for the editor demo. Every row is checked by `checkVersion`.

## Tests
- `tests/unit/fs14-role-profiles.test.ts` (16): one per acceptance criterion, plus RBAC, the RPC lifecycle, refusals, rules and i18n.
- `tests/unit/fs14-pages.test.tsx` (13): EN and AR role tab, security notice, concept page, map, future tab, planner, overview, drafts, editor.
- `scripts/validate/fs14-role-profiles.mjs`: PGlite checks with 22 assertions (RLS as real roles, RPC, audit, ledger, refusals).
- Gates: gen, check:i18n, typecheck, migrations:validate (1004 checks, including fs14), check:public and build all pass. Unit suite: 1,742 of 1,744 pass. The 2 failures are the route-count pins (208 vs 206) in w4-integration and w5-integration, left for the integration lead. Under shared-machine load, 3 page tests timed out and one worker (w1e3-coach) crashed; all 4 files pass when rerun in isolation (30 + 22 tests).

## Shared edits (logged in the CONTRACT.md changelog, 2026-10-10 FS05)
- `src/data/schema.ts` M01 columns; `src/data/ext/{schema,rpc,local,supabase}.ts` registration lines.
- `scripts/validate-migrations.mjs` and `tests/unit/g1-rpc.test.ts` count 28 roles as `lifecycle = 'current'`.
- Two concept titles avoid "advanced", so Dalil's `en-advance` eval is not hijacked.

## Gaps and hand-offs
- The route count is now 208 (2 new routes). The pins in `tests/unit/w4-integration.test.tsx` and `tests/e2e/sweep.spec.ts` (206) are for the integration lead to bump.
- FS02: skill-kind `ref_id`s (`sk-*`) are FS05-local. Remap them to the FS02 skills catalogue after merge, in the seed builder's `WHY`, `ADD` and `ROLE_ADD` tables.
- FS01: benchmark chips use the local fallback until `kafaa_benchmarks` is merged.
- FS11 and FS15: reuse the concept roles and future edges; do not duplicate them.
- No Playwright or browser runs (per instructions). Live RPC writes were not exercised, to keep live data unchanged; RPC behaviour is proven in PGlite. Live RLS was spot-checked as anon.
