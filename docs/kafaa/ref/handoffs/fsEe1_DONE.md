# fsEe1 DONE: FS38 SMR delta overlay + FS39 plant literacy and reference-plant log + FS40 digital-twin diagnosis drills (M31)

Branch `fsEe1` (worktree `/workspace/nexus-fsEe1`). Code commit `8bb8c2d`, then this file. Live Supabase was not touched. Netlify was not touched.

## Acceptance

### FS38 · SMR delta overlay for every Barakah role
- [x] **All 28 roles have a delta for at least their 3 most relevant technology families.** 88 published deltas plus 2 drafts. Each current role has ranks 1-3 or more. Concept roles never get a delta and are never offered as "my role".
  - Test: `fs51-next-gen.test.ts` › "acceptance 1: all 28 current roles have a published delta for at least their 3 most relevant technology families (never a concept role)".
  - Test: `fs51-pages.test.tsx` › "staff: my delta for my current role ..." (the role picker lists only the 28 current roles).
  - PGlite: `fs51-next-gen.mjs` › "acceptance (FS38): all 28 current roles ...".
- [x] **Every delta cites at least 2 sources.** Each source is https and has an as-of date. Every URL comes from `docs/kafaa/ref/research/nuclear_energy.md`.
  - Test: "acceptance 2: every delta cites at least 2 https sources with as-of dates, all from the research packs".
  - The editor and the RPC refuse to publish a delta with fewer than two sources.
- [x] **publicTextIsClean passes on every delta.** This covers EN and AR text and the dimension texts. The stricter FS05 check (deployment claims) also passes. Every delta says "no deployment decision implied", and every FS38 page shows the planning note.
  - Test: "acceptance 3: publicTextIsClean passes on every delta (EN and AR) and every delta says \"no deployment decision implied\"".
  - Test: "the clean-text patterns are the FS05 ones ..." (the regexes are equal to `m01/roleProfiles.ts`).
- [x] **HR matrix built from the FS05 2035 profiles and the six ADVANCE families.** Cells under 10 are suppressed.
  - TS = SQL: `kafaa_smr_matrix_core` equals `matrixStats`. PGlite also checks `kafaa_smr_needs` over 90 deltas and `kafaa_smr_readiness` over 281 staff x delta pairs.
  - Test: "nextGenMatrix: HR and admins only; it equals matrixStats() ...".
- [x] **RBAC.** The public summary and staff reads use `skills_taxonomy` R. Edits use `frameworks` W/A, are versioned and audited, and publishing writes a ledger entry. Security, safeguards and cyber roles stay path-only.
  - Tests: "saveSmrDelta: framework owners only ..."; "security, safeguards and cyber roles stay path-only ..."; the editor page test.

### FS39 · Plant literacy for everyone and a reference-plant log
- [x] **The module runs offline with no network calls after load.** The scenarios are a static TS module.
  - Test: `fs51-pages.test.tsx` › "acceptance 1: the plant explainer runs offline ...". It walks all 4 scenarios (15 steps) while spying on `fetch`, every `b.rpc` method, `b.list`, `b.get`, `b.insert`, `b.update` and Storage writes. There are zero calls.
- [x] **Confirmed visits write evidence; unconfirmed ones do not.** A confirmed visit writes kind `ojt`, basis `validated`, `ref_table = 'plant_visits'`, skill `sk-fs-tr-techlit`, at level 1-2. Logged, declined and withdrawn visits write nothing. The host is never the visitor (maker-checker).
  - Test: "acceptance 2: confirmed visits write evidence; unconfirmed ones do not (seed and local flow)".
  - Test: "the host can never be the visitor; only the named host confirms; partners are refused".
  - Page test: "the host tab lists visits waiting for me; confirming writes the evidence (Arabic)".
  - PGlite: maker-checker, evidence, ledger, notification and recompute checks.
- [x] **No real plant parameters, and the SIMULATED chip is on every screen.** All values are integer indices from 0 to 100. There are no units and no numbers in the step text.
  - Test: "acceptance 3: the explainer contains no real plant parameters ...".
  - Page test (same offline test): the SIMULATED chip is present on every step and on the picker.

### FS40 · Digital-twin diagnosis drills
- [x] **All series are synthetic and labelled SIMULATED.** Each drill has a SYN-TW code and SIMULATED / محاكاة in its system name. Authoring refuses non-synthetic codes and plant-security wording.
  - Test: "acceptance 1: all series are synthetic and labelled SIMULATED (SYN-TW codes, EN and AR)".
- [x] **Scoring is identical in TS and SQL.** `kafaa_tw_score` equals `scoreTwinDrill` on all 77 seeded attempts and on 400 generated submissions (PGlite). The submission check, authoring check and stats are equal too.
  - Test: "acceptance 2: scoring is identical in TS and SQL ...". Every seeded attempt replays, and the local RPC returns the rule's score.
- [x] **A completed drill writes evidence for the twin and plant-data skills it names, capped at level 2.** Evidence is kind `assessment` with `ref_table = 'twin_attempts'`. The latest attempt replaces earlier evidence, and an F01 recompute keeps it.
  - Test: "acceptance 3: a completed drill writes evidence ... (2,000 generated submissions, perfect run, retake, recompute)".
- [x] **RBAC.** Attempts are Own only. Keys are readable only through `secure_items` (staff read none). Authoring needs `secure_items` A (the training manager). Stats go to `secure_items` W/A or `skills_profile` Agg, suppressed under 10.
  - Tests: "staff never read a key ..."; "twinStats ..."; "saveTwinScenario ...".

## Routes (+9, EN + AR/RTL)
- `/careers/next-gen` (`careers-next-gen`, public)
- `/my/next-gen` (skills_profile Own)
- `/workforce/next-gen` (workforce_strategy Agg/R)
- `/admin/next-gen` (frameworks W/A)
- `/learn/plant-literacy` (signed in; static)
- `/my/plant-log` (skills_profile Own; tabs "My visits" and "To confirm")
- `/my/twin-drills` (skills_profile Own)
- `/my/twin-drills/:id` (smoke `tw-fw-bearing`)
- `/training/twin-drills` (secure_items W/A)

Every page shows `<BenchmarkChips feature="FS38|FS39|FS40">` and has loading, empty and error states. Derived results show `<WhyThis>`. Material actions go through a `ConfirmDialog`.

## Tables / RPCs
- **Tables:** `kafaa_smr_deltas`, `kafaa_plant_visits`, `kafaa_twin_scenarios`, `kafaa_twin_keys`, `kafaa_twin_attempts`. They are generated into the 120100/120300 files and repeated in the FS51 migration. RLS is created once.
- **RPCs** (authenticated only):
  - `kafaa_save_smr_delta`, `kafaa_next_gen_matrix`
  - `kafaa_plant_hosts`, `kafaa_log_visit`, `kafaa_confirm_visit`, `kafaa_withdraw_visit`
  - `kafaa_submit_twin_drill`, `kafaa_twin_stats`, `kafaa_save_twin_scenario`
- **Helpers** (revoked from public, anon and authenticated):
  - `kafaa_smr_arr`, `kafaa_smr_alen`, `kafaa_smr_truthy`, `kafaa_smr_profile`, `kafaa_smr_needs`, `kafaa_smr_readiness`, `kafaa_smr_matrix_core`, `kafaa_smr_problem`
  - `kafaa_pv_problem`, `kafaa_pv_level`, `kafaa_pv_hosts`, `kafaa_pv_notify`
  - `kafaa_tw_uniq`, `kafaa_tw_score`, `kafaa_tw_sub_problem`, `kafaa_tw_opts`, `kafaa_tw_sub`, `kafaa_tw_problem`, `kafaa_tw_stats_core`
  - Uses from earlier waves: `kafaa_air_str` / `kafaa_air_int` (FS45), `kafaa_rpv_text_clean` (FS05) and `kafaa_res_contact` (F21).
- **Shared redefinition** (same signatures, between `@@SHARED-BEGIN/END`): `kafaa_skill_states_v2` and `kafaa_skills_apply`. Their recorded lists are now `'fitness_attempts','adaptive_attempts','task_attempts','ai_drill_attempts','plant_visits','twin_attempts'`.
- **Migration:** `supabase/migrations/20261010251001_kafaa_fs51_next_gen.sql`. It is additive and idempotent, and contains no destructive keyword anywhere.

## For the later live apply (local PGlite values)
### Function md5 (`md5(prosrc)`)
| Function | md5 |
|---|---|
| kafaa_skill_states_v2 | 11e261797ab215128cda525c2febc423 |
| kafaa_skills_apply | f7bf866caa17d209b0b2edefa6db3b20 |
| kafaa_save_smr_delta | 67aa471b7e583c7e8f42ed04232911a5 |
| kafaa_next_gen_matrix | 8e588f7f5ef12d5cb10440a927f1c65b |
| kafaa_plant_hosts | 8611ba44d9622c83264fa09af31cf643 |
| kafaa_log_visit | c5076dd1e0b739a6256fd28e15048622 |
| kafaa_confirm_visit | 05d92ca9a4675b897916f7bee7696fe3 |
| kafaa_withdraw_visit | 9353359ec6d977771b1d0ea9f8a5a8dc |
| kafaa_submit_twin_drill | 0dd3cdc9a5daeb2b638e961a95359f6c |
| kafaa_twin_stats | 6feb37ba1e70f10bac819eb1854fc8e2 |
| kafaa_save_twin_scenario | e45c7bded4bd800c8c9c679129c0ebb0 |
| kafaa_smr_arr | e8d090e86004224d3a8be4132b02d3be |
| kafaa_smr_alen | e176849eb3091e84731e5e3e4da41900 |
| kafaa_smr_truthy | 2e83a7c7216281694dc16c6dcfa046ad |
| kafaa_smr_profile | 37031fbc47cfa737b210c8f55ce7416d |
| kafaa_smr_needs | 9e688356be898403d2af28f0af6e4409 |
| kafaa_smr_readiness | 3a5c84774b71314a8f01686b1d56cc1a |
| kafaa_smr_matrix_core | b8dae85563d8f0dd70c7e5e302ebacd8 |
| kafaa_smr_problem | c3c788e94a5dbeb920d0f144ba76787b |
| kafaa_pv_problem | d17d0eeb7e298a998d1d1e022125291e |
| kafaa_pv_level | e87121e8daf41e31256921a30bd9a49f |
| kafaa_pv_hosts | 7cca40bfcf097b7b3f097f64d633b1e8 |
| kafaa_pv_notify | 1da8ce7093b54dc3ddc5981e2374e743 |
| kafaa_tw_uniq | 78cd66a826941c5de92fc8285db1e3f9 |
| kafaa_tw_score | 643db491ed084b5cc61f12a3b4ff6e2c |
| kafaa_tw_sub_problem | 42d270d561da4d27654c448e4fcb1034 |
| kafaa_tw_opts | b75fcb8860f2b661cb43c087b7af8031 |
| kafaa_tw_sub | deb39ba615abfb8e9cf11f8f5665340e |
| kafaa_tw_problem | 31233458836b84cccb986a10573ed897 |
| kafaa_tw_stats_core | 91e0bc067e23266c35133f4cabb0a78e |

### Rows
Digests are `left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8)` after all migrations plus `supabase/seed.sql`.

| Table | Rows | Digest |
|---|---|---|
| kafaa_smr_deltas | 90 | 7a80f851 |
| kafaa_plant_visits | 27 | f55e4792 |
| kafaa_twin_scenarios | 5 | 1f4e0bc8 |
| kafaa_twin_keys | 5 | 4f55b52f |
| kafaa_twin_attempts | 77 | e9ae2adc |
| skill_evidence where ref_table = plant_visits | 18 | 33c94c2a |
| skill_evidence where ref_table = twin_attempts | 87 | 513bbb3a |
| person_skills (all; `id:level:active`) | 3080 | 3c41cf40 |

### Live order
1. Tables and RLS.
2. Shared redefinition: check that the live bodies equal FS45's before applying.
3. Functions and grants.
4. Seed rows `on conflict (id) do nothing`.
5. Run `kafaa_skills_apply(p, '2026-10-08')` for the visit and drill people. Seed `person_skills` adds 41 FS02 states; 29 more change level.

## Seed (`scripts/seed/ext/fs38-next-gen.mjs`, FINALIZE_LAST)
- **Deltas:** 88 published plus 2 drafts (corporate x HTGR, instructor x fast reactor). 9 path-only rows cover security, safeguards and cyber. Sources come only from the research packs, as of 2026-10-10.
- **Visits:** 27 in total: 18 confirmed, 4 logged, 4 declined, 1 withdrawn. They wrote 18 evidence rows.
  - `qc-inspector` has two confirmed kinds, so level 2.
  - `buyer` has a visit waiting for `k-instructor`.
- **Drills:** 5 drills (4 published, 1 draft) with keys. 77 attempts by 24 staff, 39 of them passed. They wrote 87 evidence rows (L1-L2).
  - `sme-reviewer` has a perfect level-2 run.
- **Unchanged:** the original 71-skill states, F36 digests, F35 outlooks and F23 snapshots.
- **Seed diff vs baseline:** only `person_skills` (+41, ~29), `skill_evidence` (+105) and the 5 new tables change.

## Tests
- `tests/unit/fs51-next-gen.test.ts`: 24/24 pass.
- `tests/unit/fs51-pages.test.tsx`: 12/12 pass (EN and AR, offline spy, drill end to end, host confirmation, editor check).
- PGlite: `scripts/validate/fs51-next-gen.mjs`, 52 checks, all pass inside `npm run migrations:validate`.
- Shared files re-run: `fs11-catalogue` 13/13, `w0-skills` 14/14, `fs12-decay` 22/22. `fsqa1-integration` gives 17/18; the one failure is the route-count pin (expected 288, now 297), which is left to the lead.

## Gates
- `npm run gen`: pass. The generated files are committed, and a rerun leaves no diff.
- `npm run check:i18n`: pass (40 namespaces).
- `npm run typecheck`: pass.
- `npm run migrations:validate`: pass ("All migration checks passed").
- `npm run check:public`: pass.
- `npx vite build`: pass.
- Not run: the full unit suite (run one file at a time per the rules). Playwright was not run.

## Gaps / notes
- **Route-count pins:** these must move 288 -> 297 (+9, M31) in `w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa1/2/3/4-integration` and `tests/e2e/sweep.spec.ts`. Left to the integration lead.
- **Recorded evidence union (3.9):** FS44 adds `lectures` / `knowledge_assets`. Union them in `20261010259001_kafaa_fs5qa_integration.sql`.
- **Clean-text check:** the FS05 patterns (`profileTextIsClean` = `kafaa_rpv_text_clean`, a superset of `publicTextIsClean`) are copied into the import-free `nextgen.ts`. A unit test keeps them equal, and `publicTextIsClean` itself is asserted on every row.

## Hand-offs (integration lead)
- **PassportView labels:** use `m31.pv.evidenceLabel` for `plant_visits` and `m31.tw.evidenceLabel` for `twin_attempts`.
- **FS38 links:** link Future Me lanes and the ADVANCE pages to `/my/next-gen`. The delta training already points at `MC-SMR-FOUND`, FS19 courses, FS17 pathways and FS14 lanes.
- **FS40 routes:** list `/my/twin-drills` as a route for `MC-TWINS` (`satisfiability()`) and on gig `fg-dig-twin-validation`. Optionally add it to `kafaa_pw_discover`.
- **F36 digest:** add "approvals I owe" for pending host confirmations (notification kind `plant_visit`, link `/my/plant-log?tab=host`).
- **RLS perf:** rerun `gen-rls-perf` for the 5 new tables.
