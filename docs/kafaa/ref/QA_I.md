# FS wave I integration and QA (FS78-FS84), 12 Oct 2026

Repo `/workspace/nexus` (app in `kafaa/`), branch `fsI-integration-qa`. It was cut from `origin/fsH-integration-qa` (`693dc66`, wave H, draft PR #4 to `main`) and is **stacked on it**: the draft PR targets `fsH-integration-qa` and must be retargeted to `main` after wave H merges. Waves E, F and G are on `main` (PRs #1-#3). Commits: the merges `2314bff` (fsIe1), `1896ed1` (fsIe2), `a04ac09` (fsIe3), `094c132` (fsIe4) and `5f404d6` (fsIe5), then the QA commits (wiring `1dd60f4`; live-apply bundle, E2E, fixes and this report). The branch was pushed to `origin/fsI-integration-qa` only. `main`, `fsH-integration-qa` and the Netlify settings were not touched. **Live Supabase was not available in this session, so nothing was applied live.** Apply the wave-H bundle and then the wave-I bundle before these branches reach `main`, because merging to `main` deploys production. Wave I is the last wave: the programme-wide acceptance table is `docs/kafaa/ref/PROGRAMME_STATUS.md`.

## Merge
- `fsIe1`..`fsIe5` were merged `--no-ff` in slot order (script `merge.sh` in the session scratchpad, the wave-H recipe):
  - fsIe1 (`b42be07`): FS78 learning balance and protected study time, FS79 verified external certificates with trust tiers (M34);
  - fsIe2 (`ecfd405`): FS80 automation and agent gallery with builder credit (M29);
  - fsIe3 (`d771585`): FS81 transition plans and ladder-rung protection (M30);
  - fsIe4 (`8f3eb8b`): FS82 rolling mobility micro-grants, FS83 UAE energy consortium trainee cohort (M36);
  - fsIe5 (`f32d441`): FS84 team 2030 capability targets and the organisation skills inventory (M17).
- fsIe2 had been rebased on `a290f1a`, whose grants-hardening file moved to the separate `audit-fixes` PR, so that file stays out of this branch.
- Conflicts came up only in:
  - the generated files: taken from ours and regenerated with `npm run gen` after each merge;
  - the CONTRACT changelog: both sides kept;
  - the four recorded-evidence invariant lists: tokens unioned (`external_certs`, `automations`, `grant_applications`, `consortium_visits`).

  No conflict markers are left, and `npm run gen` is stable.
- All five slots were complete. fsIe2's hand-off had no gate results after its rebase, so the lead ran those gates on the integration branch and filled them into `handoffs/fsIe2_DONE.md`.

## Cross-feature wiring (CONTRACT changelog "FS wave I integration and QA")
The wiring lives in:
- migration `20261010299001_kafaa_fs9qa_integration.sql`;
- seed `scripts/seed/ext/fsqa9-integration.mjs`: FINALIZE_LAST, changes no row, and fails `npm run gen` if a wiring invariant breaks;
- PGlite validator `scripts/validate/fsqa9-integration.mjs` (12 checks);
- unit test `tests/unit/fsqa9-integration.test.tsx` (16 tests, one per wiring criterion);
- E2E `tests/e2e/fswaveI.spec.ts`.

What it wires and proves:
- **FS79 -> M17, extra item (a): FS79 and FS84 together, without either slot editing M17 outside its own folder.** The lead made these shared M17 edits and logged them. New `src/modules/m17/xcUi.tsx` shows every external certificate with its `trustTier()` / `<TrustTierBadge>` on `/my/skills/wallet` and `/my/skills/credentials`. Unverified certificates read "Claimed (not verified)" with their status.
- **FS32 learner record (CLR-shaped):**
  - A verified, unexpired certificate is a record item of the new kind `xcert`, and its status is the trust tier.
  - Its statement is an AchievementCredential that names the issuer and the tier and says "Kafa'a is not the issuer and not an authority".
  - The QA migration redefines `kafaa_lr_refs_ok` (now accepts `xcert:`), `kafaa_lr_items` and `kafaa_lr_bundle` from their fs43 bodies, with the same signatures, still closed to API roles.
  - The record, the share wizard and the public verify page show the tier.
  - A revoked certificate leaves the record and every shared link (PGlite, unit test, journey I2).
- **FS84 on the same M17 pages:** an unverified certificate writes no evidence, so it never moves `orgSkillInventory` or the data-quality figures (unit test). The 24 F11 team targets stay at horizon `current`, and every 2028/2030 target names its role-profile versions (seed invariant and PGlite).
- **Passport evidence labels:** `useEvidenceLabel` names:
  - certificate evidence: title, issuer, reference, and the tier in the drawer;
  - builder credit (`automations`);
  - accepted grant outputs (`grant_applications`);
  - host-confirmed consortium visits (`consortium_visits`).
- **3.9 recorded evidence:** the four wave-I evidence ref_tables use recorded kinds (credential, ojt, rating, ojt). So `RECORDED_REF_TABLES`, `kafaa_skill_states_v2` and `kafaa_skills_apply` keep their pre-wave bodies, and a recompute keeps all four (PGlite and local).
- **FS81, extra item (b): settled decision verified.** `kafaa_transition_plans` has a single read rule (`own_profile` Own on `person_id`), and HR reads through the RPCs.
  - PGlite and unit tests prove that the crew B shift manager (`sro`) reads none of the three team plans (table, `kafaa_transition_plan_view`, `kafaa_transition_plans`), only their own.
  - The training manager, HR analysts, auditors and admins read none.
  - Journey I4 proves the same in the browser.
  - The `policy.ts` comment that said managers see their team's plans was corrected (comment only, no grant change).
- **FS78 <- FS30/FS18:** one credit unit (10 h) in both modules. Only outcome-gated FS18 catalogue items can be charged. Approved study time writes no FS30 ledger row: an entitlement is not an earned credit (logged).
- **FS80 <- FS36:** every gallery entry references its `kafaa_ai_systems` row (FK). Builder credit comes only from an approved, adopted entry.
- **FS82/FS83:** budgets are SIMULATED. The partner organisations are synthetic and labelled. Visit evidence is written only after host confirmation.
- **Entry links** (one marked line each, logged):
  - new `src/shell/GuardedLink.tsx`, which renders only when the target route's guard lets the viewer in;
  - `/workforce/skills-outlook` -> `/workforce/skills-inventory` (HR only);
  - the energy academy -> `/ecosystem/consortium`;
  - `/training/simulator` -> `/workforce/rung-alerts`.

  All new keys exist in EN and AR.
- **Route pins** moved 380 -> 401 in the 12 pin files, each listing the 21 wave-I route ids per module: M34 5, M29 4, M30 4, M36 6, M17 2.

## Live-apply bundle (`docs/kafaa/ref/live_apply/waveI/`)
- Generated by `kafaa/scripts/live-apply-bundle.mjs` from `docs/kafaa/ref/live_apply/waveI.config.json`, and checked by `kafaa/scripts/verify-live-bundle.mjs`.
- **Pre-wave state = the state after the wave-H bundle** (`waveH/EXPECTED.md`). `EXPECTED.md` says so in section 0 and gives the md5 each redefined shared function must have live before the apply: `kafaa_lr_bundle`, `kafaa_lr_items`, `kafaa_lr_refs_ok` and `kafaa_team_coverage`.
- 12 parts in apply order, each at most ~60 KB:
  - 1-6: the five feature migrations (fs91 p1, fs92 p1, fs93 p1, fs94 p1-p2, fs95 p1);
  - 7: the QA migration (`kafaa_fs9qa_integration_p1`);
  - 8-11: seed rows (`insert ... on conflict (id) do nothing`, `kafaa.seeding` on; 15 tables);
  - 12: the replay (`kafaa_fs9qa_replay_p1`: `kafaa_skills_apply` for 15 people).
- **Statements that update existing rows (each needs a person's approval at apply time), `EXPECTED.md` section 1a:**
  - The parts contain no top-level `update`.
  - **The replay part `kafaa_fs9qa_replay_p1` updates existing rows** through `kafaa_skills_apply`.
    - Guard: for each of the 15 people, `if exists (select 1 from kafaa_people where id = x)`.
    - Scope: derived states only; recorded evidence is kept.
    - Rows: locally, 14 existing `kafaa_person_skills` rows are updated in place (5 from FS79 certificate evidence of 7 holders, 9 from FS80 builder credit of 9 builders, one person in both) and 3 new rows are inserted. Live, the same 14 rows plus any stale derived state of those 15 people; compare by id, because live holds extra journey rows for `p-k-ro`, `p-sro` and `p-nse`.
    - The generator now lists this replay in section 1a. This is a shared edit to `live-apply-bundle.mjs` (`replay_row_update` in the config), logged in CONTRACT.
  - **Not a statement, but noted:** the 24 existing `kafaa_team_skill_targets` rows take the defaults of the two new columns (`horizon` 'current', `profile_version_ids` '{}') through the additive `alter table ... add column if not exists`. No UPDATE is needed.
- `EXPECTED.md` lists the md5 of all 134 new or redefined function bodies, 21 table digests (11 new tables, the new rows of existing tables, the replayed person-skill slice) and the grants: anon executes nothing new, authenticated only the wave's RPCs.
- **Dry run:** the post-wave-H state (`origin/fsH-integration-qa`'s migrations and seed) was loaded into PGlite on top of the Supabase default privileges, then all 12 parts were applied twice. **134/134 md5s, 21/21 digests and 2/2 table-grant rows are equal** (`qa_logs_I/live_apply_dryrun.txt`).
- Checks:
  - no removal words anywhere, comments and strings included;
  - every DDL/DML target is a `kafaa_*` object (the only non-kafaa match is the English phrase "update your" inside a refusal message string);
  - ALTER only on `kafaa_*` tables.

## Gates (final)
- gen: OK; regenerating leaves every generated file unchanged (37,718 rows across 367 tables; 57 personas; `qa_logs_I/gen.txt`). fsqa9 prints its invariants: 6 verified certificates in 12 holders' learner records, 9 certificate evidence rows by tier, 16 gallery entries on register rows, 10 SIMULATED plans with reviews, FS78 unit 10 h = FS30, 35 FS84 targets with versions.
- check:i18n: OK (40 namespaces, EN/AR in parity).
- typecheck: clean.
- check:public: OK (77 public tables, no personal columns).
- migrations:validate: "All migration checks passed" (98 migrations plus the seed applied twice, 2,584 checks, 0 failures, 22.8 min). This includes `fsqa9-integration` (12 checks) and the engineers' fs91..fs95 validators (`qa_logs_I/migrations_validate.txt`).
- vite build: OK. build:deploy, plain and with `NODE_OPTIONS=--max-old-space-size=4096` (the netlify.toml limit), both OK (2 min 38 s and 2 min 34 s; run on a copy of the working tree so the unit lane kept its files). `deploy_out/kafaa/index.html` keeps both badge-hiding lines. The issuer JSON is at `/.well-known/kafaa-issuer.json`, `/kafaa/.well-known/kafaa-issuer.json` and `/kafaa/issuer/kafaa-issuer.json`, and `kafaa/ojt-sw.js` is present. `_redirects` keeps its order (`/` 302, `/kafaa` 301, `/kafaa/.well-known/*` 200!, `/kafaa/*` 200). There is no `service_role` or `sb_secret_` anywhere (`qa_logs_I/build_deploy.txt`). `deploy_out/` is gitignored and was not committed or deployed.
- **Unit tests: 190 files, 3,360 tests, all green.** They ran one file per vitest process in one lane (`docs/kafaa/ref/qa_logs_I/unit_lanes.sh 1`, in two slices because a background job runs at most 2 h; per-file results in `qa_logs_I/unit_summary.txt`). This includes the 12 route-pin files at 401, `fsqa9-integration` (16/16) and the engineers' fs91..fs95 files. The three page files that ran before the 390 px chip fix were rerun green: fs12-pages, fs13-pages and fs14-pages.

## Browser E2E (one Chromium, workers=1, vite preview, local mode, clock fixed on 2026-10-12 09:00 Abu Dhabi)
- **Journeys `tests/e2e/fswaveI.spec.ts`: 8 of 8 pass (1.8 min, rerun on the final build).** They cover every wave-I acceptance criterion:
  - I1 FS78: the balance equals grants minus approved use. Only outcome-gated catalogue items can be charged. A study-time request is decided by a second person (the line manager), with an audit row. HR reads the published rule and the suppressed groups.
  - I2 FS79 + M17: unverified certificates write no evidence and read "claimed". A verifier, never the holder, verifies through reviewed crosswalk rows only. The trust tier shows on the certificate page, the wallet, the micro-credentials page, the learner record and the passport evidence.
  - I3 FS80: the gallery holds metadata only (nothing runs in Kafa'a), and each entry links its register row. Approval alone writes no evidence. The first adoption of an approved entry writes the builder's credit. A builder never adopts their own entry.
  - I4 FS81: my plan is SIMULATED with review dates and names every alerted task with its practice. Plans are for the person and HR only: the crew B manager, the training manager and the HR analysts get nothing. Rung alerts name no person.
  - I5 FS82: the round to 10 Oct is closed and the round to 10 Dec is open. Budgets are SIMULATED. Statistics under 10 are suppressed. The HR director decides after the deadline, with an audit row. Auditors can only read.
  - I6 FS83: partner organisations are synthetic and labelled. Each partner sees only its own trainees. A visit writes evidence only after host confirmation (here the programme office, on behalf, with the host reference).
  - I7 FS84: each team target shows the 2030 role-profile version it came from. The inventory suppresses cells under 10. The data-quality figures equal the rule.
  - I8 wiring: the inventory link from the skills outlook (HR only), the consortium link from the energy academy, the rung-alerts link from the simulator page, and Arabic RTL on the wave-I pages.
- **Visual `visual.spec.ts -g fsi`: 74 of 74 pass.** This covers 32 pages in RTL and 32 at 390 px, including the pages the wiring touched, all checked by eye on contact sheets, plus the 10 shots in `docs/kafaa/ref/shots_I/`.
- **Route sweep (local mode, `E2E_BACKEND=local`):** live Supabase was not reachable, so the sweep ran on the local backend for the wave-I modules and every module the wiring touched (M34, M29, M30, M36, M17, M04, M07, M09): 124 routes x 17 sessions = 2,108 checks: 899 ok, 1,102 forbidden as expected, 107 sign-in as expected; **0 mismatches, 0 console or text issues** (18/18 tests, 42.0 min; `qa_logs_I/sweep_summary.txt`). The full sweep in supabase mode must run after the live apply, with `gulfhydro-qa` for partner isolation.

## Bugs fixed during QA
1. **Sweep crashed for every session** with `SyntaxError: Unexpected identifier 'as'`. Two FS78 routes (`team-study-time`, `workforce-learning-balances`) write their guards inline with TS casts (`'recognition' as const`), and the route loader only stripped casts from named guard constants. `tests/smoke/routes.ts` now strips `as const` from inline guards too, so the guard text evaluates as JS. This affects the sweep and smoke loaders only; the app is unchanged.
2. At 390 px, the role chips on `/my/skills` (Passport header, `PassportView.tsx`) and the "rung below" chip on `/workforce/rung-alerts` (`m30/ui.fs81.tsx`) overflowed the screen. The chips now wrap (`max-w-full whitespace-normal text-start`).
3. The live-apply generator listed only top-level `update` statements in section 1a, so the replay part, which updates existing person-skill rows, did not appear in the row-update list. It is now listed with its guard and row counts (shared script, logged).

## Screenshots
`docs/kafaa/ref/shots_I/` holds 10 shots:
- 01-08 in EN: my learning balance, external certificates, wallet with trust tiers, automation gallery, my transition plan, micro-grants, consortium, team 2030 targets;
- 09: the skills inventory in AR;
- 10: the learner record at mobile width.

## Remaining issues
- **The live apply has not been done** (no Supabase access in this session). Apply `waveH/` and then `waveI/`, after waves E-G are confirmed live, and compare each with its `EXPECTED.md`. Approve the one replay part listed in section 1a. Then run the full route sweep in supabase mode (handover 3.11) and every journey spec on the deployed commit (programme close-out).
- **Not wired, logged for later:**
  - the M19 `external_completions` "verified" hook into FS79 (fsIe1 5);
  - an expiry sweep for the evidence of a certificate that expires after verification: the record drops it by date, but the evidence stays active (fsIe1 6);
  - FS75/F36 items for waiting study-time decisions and certificates (fsIe1 7), AI-governance approvals (fsIe2 5) and due plan reviews (fsIe3 4).

  None of these is on a wave-I card.
- FS78: contractors get no balance (no recognition grant).
- FS80: the per-entry adoption counter is not suppressed (it counts reuse of a tool; logged).
- FS81: overdue and due-soon states depend on the run date. `k-ro`, `k-lo-trainee` and `k-hr-analyst` are local-only personas, tested on the local backend and in PGlite.
- FS84: 2028 targets sit half-way between today's level and the 2030 profile (the assumption is shown on the page). Live figures can differ, because live holds extra journey rows.
- Netlify builds no deploy preview for stacked PRs (base other than `main`). The deploy build was proved locally under the Netlify memory limit instead (see Gates).
