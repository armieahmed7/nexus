# fsCe1 — FS17 future-skill learning pathways + FS18 curated external catalogue

Branch `fsCe1` (worktree `/workspace/kafaa-fsCe1`, from master `cacc25a`), commit `8d69497`. Not pushed.

## Acceptance

### FS17 — learning pathways
- [x] **Every future skill has an L1 pathway, and every pathway shows its envelope and weekly hours.**
  - 48 of 48 FS02 future skills have a published L1 pathway (security area and obsolete skills are excluded).
  - 95 pathways in total: 48 L1, 41 L2 and 6 L3 published, plus 1 L3 draft.
  - Each pathway has a 3 to 6 month envelope and 0.5 to 10 weekly hours.
  - The catalogue card, the pathway page and the Coach card all show `EnvelopeLine` (months, weeks, hours a week, total hours, and whether it fits).
  - Tested by `fs31-pathways` "every future skill has an L1 pathway…", by `fs31-pages` "the catalogue lists a pathway for every future skill…", and by the validator.
- [x] **Coach cards carry reasons.**
  - `rankPathways` ranks against 2030 role gaps (`gap_2030`, `rising_2030`) as well as today's role (`today_role`), plus goal, lifecycle, fit and requested-step reasons.
  - Each card has a `<WhyThis>` panel listing its reasons.
  - Tested by `fs31-pathways` "Coach cards … carry reasons (lintRanked clean)…" and `fs31-pages` "the Coach tab ranks pathways with reasons".
- [x] **Peer times under 10 are suppressed.**
  - `peerStats` and `kafaa_pw_peer` give no median and no completed count below `minGroupSize` (10). The started count is shown only when it is 10 or more.
  - The UI marks this with `PeerLine data-suppressed`.
  - Tested by `fs31-pathways` "peer completion times under 10 are suppressed" (TS equals SQL) and by `fs31-pages`.
- [x] **Learn, practice and assess run in one sequence; steps resolve at run time; an empty step is "requested" and feeds the FS57 backlog.**
  - The sequence rule is enforced in `pathwayProblems` and in the SQL check.
  - Resolution order: pins first, then automatic discovery (courses, external items, opportunities, credentials, fitness), up to 4 items per step.
  - `kafaa_pathway_gaps` holds the backlog, refreshed by `kafaa_refresh_pathway_gaps` (training manager only).
  - The rule is written once in TS (`resolvePathway`) and once in SQL (`kafaa_pw_resolve`). PGlite parity holds for every pathway.

### FS18 — curated external catalogue
- [x] **Every item cites its provider URL and an as-of date.**
  - There are 11 seeded items, each with an https `provider_url`, an https `url`, `as_of` and `sources[]`.
  - The table check `kafaa_external_resources_fs18_ck` makes https and as-of mandatory.
  - The UI shows `ExternalCard` with a source link and the as-of date.
- [x] **Items failing the criteria cannot be published (RPC refusal).**
  - `kafaa_publish_external_resource` refuses with `criteria_failed` when any published required criterion (relevance, provider standing, language) scores below its minimum. It refuses with `invalid` on structural problems.
  - The local backend behaves the same way.
  - The seed includes a draft that fails relevance (`xr-iaea-nuclear-security-elearning`) and a passing draft awaiting review (`xr-enen2plus`).
- [x] **Self-declared completions are labelled and never become verified evidence.**
  - `kafaa_record_external_completion` writes `external_completions.evidence = 'self_declared'`.
  - It also writes one F30 xAPI "experienced" statement (source `console`, `stored_by` = learner, context extension `evidence: self-declared`).
  - It never writes `kafaa_skill_evidence`.
  - Pathway progress counts a self-declared step but labels it (`SelfDeclaredChip`). A verified completion is preferred when one exists.
- [x] **Items show in the Coach and in pathways with an "external" chip** (`ExternalChip`, `data-type="external"` items).

### RBAC
- Staff read (internal_content R).
- My progress needs skills_profile Own.
- Writes are training_manager only: save pathway, refresh gaps, save, publish and retire external items.
- Auditor and instructor have read-only training pages.
- Anonymous and partner users see nothing. The validator and unit tests check this.

### Benchmarks
`<BenchmarkChips>` appears on every page:
- FS17: ENTITLE, CORP, LIGHTCAST.
- FS18: ENTITLE, NUC-NET, NEA.

### EN + AR
332 new keys in `src/i18n/m19.{en,ar}.json`. RTL is tested (`fs31-pages` "renders in Arabic"). `check:i18n` passes.

## Routes (6, m19)
| id | path | guard | nav |
|---|---|---|---|
| learn-pathways | /learn/pathways | internal_content R | my/growth 21.5 |
| learn-pathway | /learn/pathways/:id | internal_content R | (smoke id pw-ai-verify-l1) |
| my-pathways | /my/pathways | skills_profile Own | my |
| learn-external | /learn/external | internal_content R | |
| training-pathways | /training/pathways | anyRole training_manager, instructor, auditor | training 47.5 |
| training-external | /training/external | anyRole training_manager, instructor, auditor | |

The Coach also has a new "Future skills" tab (`MyCoachPage` → `FutureSkillsCoach`).

## Data
- **Migration:** `supabase/migrations/20261010231001_kafaa_fs31_pathways_catalogue.sql`.
- **Tables (7):**
  - kafaa_pathways, kafaa_pathway_steps (versioned, never deleted), kafaa_pathway_enrolments, kafaa_pathway_gaps;
  - kafaa_external_resources, kafaa_catalogue_criteria, kafaa_external_completions.
  - The generated DDL and RLS also land in 120100 and 120300.
- **RPCs (12, authenticated only):**
  - kafaa_pathway_catalogue, kafaa_pathway_detail, kafaa_start_pathway, kafaa_complete_pathway, kafaa_withdraw_pathway, kafaa_save_pathway, kafaa_refresh_pathway_gaps;
  - kafaa_check_external_resource, kafaa_save_external_resource, kafaa_publish_external_resource, kafaa_retire_external_resource, kafaa_record_external_completion.
- **Internal helpers (16, revoked from API roles):** kafaa_pw_* (msgs, weeks, is_date, len, is_int, numv, skill_ok, problems, item, pin, discover, resolve, progress, peer), kafaa_xr_check, kafaa_xr_slug.
- **Rules:** `src/modules/m19/pathways.ts` (import-free) holds resolvePathway, pathwayProgress, peerStats, pathwayProblems, catalogueCheck, rankPathways and rankExternals.
- **Seed:** `scripts/seed/ext/fs17-pathways.mjs` (FINALIZE_LAST) produces:
  - 4 criteria, 11 external items (8 published, 1 retired, 2 drafts);
  - 95 pathways, 285 steps, 115 enrolments (synthetic staff plus demo personas), 215 open gaps;
  - 0 external completions.
- **Validator:** `scripts/validate/fs31-pathways.mjs` checks seed sanity, fresh-PGlite TS = SQL parity, RLS, RPC flows and audit rows.

## Live (Supabase hlirqxoddysxtdezwcgv) — additive kafaa_* only
- **Migration parts applied:**
  - `kafaa_fs31_pathways_catalogue_part1_tables_rls`
  - `…_part2_helpers`
  - `…_part3_rpcs_reads_progress`
  - `…_part4_rpcs_admin_external_grants`
- **Seed rows:** loaded with `insert … on conflict (id) do nothing` (compact jsonb_populate_recordset loaders, round-trip checked in PGlite first).
- **Row digests, live = PGlite (count:md5 of to_jsonb rows ordered by id):**
  - catalogue_criteria 4:f4eac603…
  - external_resources 11:75d5e22c…
  - pathways 95:4a88fcd4…
  - pathway_steps 285:233aaa7a…
  - pathway_enrolments 115:e64f3884…
  - pathway_gaps 215:2cf6435e…
  - external_completions 0
- **Function bodies:** 28 functions, combined md5 of `md5(prosrc)` is `b7da3f93…`, identical live and local.
- **Grants:** anon executes 0 of them; authenticated executes only the 12 RPCs.
- **Live resolution:** live has 32 opportunities against 25 locally. Live `kafaa_pw_resolve` still gives 215 requested steps, the same as the seeded backlog, so no live drift today.

## Tests
- `tests/unit/fs31-pathways.test.ts`: 18 tests, one or more per acceptance line, plus RBAC, versioning, routes and i18n.
- `tests/unit/fs31-pages.test.tsx`: 9 tests covering the catalogue (EN/AR), a pathway with a requested step and start, external chips, my pathways, the external catalogue with a self-declared completion, the Coach tab, and the training pages for the training manager and the read-only auditor.
- Both files pass.
- Full suite: the shared container was under memory pressure because sibling workers were running vitest and migrations at the same time, so many jsdom page files were OOM-killed (exit 137). Those kills were from the environment, not from test failures.
  - 60 files ran in the first pass, plus 4 chunks later. The only real failures are the expected route-count pins:
    - `w4-integration` "every route guard…": expected 227, got 233.
    - `w5-integration` "212 routes…".
    - `fsqa2-integration` "227 routes…".
  - `w5e1-pages` F32 failed once under load (70 s) and passed on its own (12/12).
  - Files not completed because of OOM: fs11–fs25 page tests, fsqa1-integration, g5-*, local-backend, m04-*, m21-pages, w0–w4 page and integration files, w5e3–w5e5 pages, w5qa-fixes. The integration lead should rerun them on a quiet container. fs11-foundation and fsqa1 will also need their route pins moved to 233.

## Gates (worktree, commit 8d69497)
- `npm run gen` passes and leaves no further diff.
- `check:i18n` passes.
- `typecheck` passes.
- `check:public` passes.
- `migrations:validate` passes: "All migration checks passed", including fs31-pathways.
- `vite build` passes.
- `vitest fs31-pathways + fs31-pages`: 27 of 27 tests pass.

## Gaps and notes
- **215 requested steps:** most steps have no live content yet. They resolve automatically once FS19 (fsCe2) seeds courses whose `objectives[]` carry `{skill_id, level}`. Running `kafaa_refresh_pathway_gaps` then marks them filled.
- **No seeded external completions:** F30 tests pin the seeded xAPI statements to `backfill(T)`, so completions exist only via the RPC (tested).
- **FS21 is not yet a resolver source:** it is a data-only coupling and is noted in the CONTRACT changelog.
- **Route-count pins:** they move from 227 to 233 (6 new routes) and are left to the integration lead. The affected tests are `w4-integration` "every route guard…" (expects 227), `w5-integration` "212 routes…", and the other route-count pins.
- **xAPI source:** completions use source `console`. The xapi source enum is fixed, and widening it would need a DROP.
- **Not run:** Playwright and browsers, as instructed.
