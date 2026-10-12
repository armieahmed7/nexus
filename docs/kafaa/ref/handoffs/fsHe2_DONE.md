# fsHe2 DONE: FS73 Emirati pipeline by competency + FS74 Future Skills Wallet target (wave H, engineer 2, M37)

Branch `fsHe2`, stacked on `fsG-integration-qa` (not merged to `main`). Live Supabase was not available: nothing was applied live.
CONTRACT changelog entry: "2026-10-12 · FS wave H · E2".

## Files (owned)

- `kafaa/src/modules/m37/pipeline.ts` (FS73 rules, import-free), `wallet.ts` (FS74 rules), `EmiratiPipelinePage.tsx`, `FutureWalletPage.tsx`, `FutureWalletCounterPage.tsx`
- additions to `kafaa/src/modules/m37/{routes.ts, national.ts, ui.tsx, backend/schema.ts, backend/rpc.ts, backend/local.ts, backend/supabase.ts}`
- `kafaa/src/i18n/m37.{en,ar}.json` (`ep.*`, `fw.*`, `fwc.*`, 3 route titles, `measure.wallet_share`, `table.wallet_targets`)
- `kafaa/supabase/migrations/20261010282001_kafaa_fs82_emirati_wallet.sql`
- `kafaa/scripts/seed/ext/fs73-emirati-wallet.mjs` (FINALIZE_LAST)
- `kafaa/scripts/validate/fs82-emirati-wallet.mjs`
- `kafaa/tests/unit/fs82-emirati-wallet.test.ts` (32 tests), `kafaa/tests/unit/fs82-pages.test.tsx` (9 tests)
- generated: `types.gen.ts`, `20261008120100_kafaa_schema.sql`, `20261008120300_kafaa_rls.sql`, `seed.json`, `seed.sql` (only the two new tables, 2 `tag_links` rows, 1 `plan_activities` row change)
- shared one-line edit (marked, logged): `kafaa/scripts/validate/fs72-national-alignment.mjs` `WORLD` gains `wallet_targets`, `core_skills`

## Acceptance tick list

### FS73 Emirati pipeline by competency
- [x] **The protected-input test still passes for every engine.** `tests/unit/w3e5-no-protected-inputs.test.ts` green (69/69); FS73/FS74 add no engine card and no ranked surface (`fs63-engine-lint` green, 13/13). Named tests: `fs82-emirati-wallet` > "FS73 · acceptance 1" (no engine card names an FS73/FS74 function; static scan of the wallet rule; trapped-row run of the wallet rule reads no protected field; nationality is read by `pipeline.ts` only). PGlite: "acceptance FS73: nationality is read only inside the suppressed aggregate (kafaa_ep_area) ...".
- [x] **Every cell under 10 is suppressed.** `fs82-emirati-wallet` > "FS73 · acceptance 2" (seed, every scope; shares only beside count and base; a group of 9 shows `<10`, 10 shows the count). PGlite: "acceptance FS73: every cell under 10 is suppressed (342 of 506 people cells null ...)" and the generated-edits check. Page: `fs82-pages` > "the HR director sees the pipeline ... suppressed cells with "<10"".
- [x] **Never reachable by observers or partners (guard test).** `fs82-emirati-wallet` > "FS73 · acceptance 3" (anyRole guard hr_analyst, hr_director, auditor and no workforce_analytics grant; observers, partner users/admins, universities, managers, employees, training manager, admin refused; the local RPC returns null for them). `fs82-pages` > "observers and partners never reach the page: the guard shows the forbidden screen ...". PGlite: "acceptance FS73: HR analyst, HR director and auditors read the pipeline; observers, partners ... get null; anonymous cannot execute".
- [x] Concept roles never enter (QA_A gap for M23 readers): `fs82-emirati-wallet` > "concept roles never enter, even with a slate full of Emirati successors"; PGlite "a slate on a concept role never enters".

### FS74 Future Skills Wallet target
- [x] **Wallet status is computed from evidence only.** `fs82-emirati-wallet` > "FS74 · acceptance 1" (claimed level 4 never counts; cyber item needs an awarded in-date MC-CYBER-HYGIENE; the seeded wallet equals the rule; AI and CEC items reuse FS09 `aiRung` / FS41 `cecLevel`). PGlite: "acceptance FS74: wallet status is computed from evidence only ..." and SQL `kafaa_fw_status` = `walletStatus` for all 106 active staff (seed and generated edits).
- [x] **The counter shows its definition and target date.** `fs82-emirati-wallet` > "FS74 · acceptance 2"; `fs82-pages` > "the counter shows its definition, the target date and who set it ...". PGlite "acceptance FS74: the counter shows its target (60 % by 2027-12-31) with who set it ... and when ...".
- [x] **Target date and value are a leadership setting, shown with who set them and when.** `fs82-emirati-wallet` > "FS74 · acceptance 3" (seeded setting by the HR director role card on 2026-10-05; `setWalletTarget` refusals, version 2 with history, audit + ledger); `fs82-pages` > "the HR director sets a new target after a confirmation ..." and "the HR analyst reads the counter but cannot set the target". PGlite "acceptance FS74 (kafaa_set_wallet_target) ...".
- [x] Each wallet links to the development plan: `fs82-emirati-wallet` > "FS74 · each wallet links to the development plan" (two tests); `fs82-pages` > "adding the open items to my plan is confirmed first ..."; PGlite "acceptance FS74 (kafaa_add_wallet_to_plan) ...".
- [x] FS62 hand-off (wallet target tagged to the national strategies, data only): `fs82-emirati-wallet` > "FS74 · wiring FS62"; PGlite "wiring FS62 <- FS74 ...".

## Routes (+3; pins left to the integration lead: 367 -> 370)

| id | path | guard |
|---|---|---|
| `national-emirati-pipeline` | `/national/emirati-pipeline` | `{ signedIn, anyRole: [hr_analyst, hr_director, auditor] }` |
| `my-future-wallet` | `/my/future-wallet` | `skills_profile` Own |
| `national-future-wallet` | `/national/future-wallet` | `national_alignment` Agg/W/A |

No param routes (no `smoke.json` change).

## Tables and RPCs

- `kafaa_pipeline_mirror` (SIMULATED de-identified HR mirror; no direct reads; write none) and `kafaa_wallet_targets` (leadership setting; read `national_alignment`; rpc on `workforce_strategy`).
- RPCs (authenticated only): `kafaa_emirati_pipeline(p_scope)`, `kafaa_my_future_wallet()`, `kafaa_future_wallet_counter()`, `kafaa_set_wallet_target(p)` (ledger `kafaa.national.wallet_target`), `kafaa_add_wallet_to_plan()` (writes M04 `kafaa_plan_activities` / `kafaa_dev_plans`, logged).
- Internal helpers (no API role): `kafaa_ep_add_months`, `kafaa_ep_allowed`, `kafaa_ep_roles`, `kafaa_ep_area`, `kafaa_ep_core`, `kafaa_fw_items`, `kafaa_fw_status`, `kafaa_fw_target_view`, `kafaa_fw_counter_core`, `kafaa_fw_target_problem`.
- **Redefined shared functions (from their newest bodies in fs72; fs7qa does not redefine them), `'wallet_targets'` added:** `kafaa_na_target`, `kafaa_na_link_problem`, `kafaa_na_links`, `kafaa_na_measure`, `kafaa_na_report_core`. Before applying live, compare the live md5 of these five with the fs72 local bodies.
- Not redefined: `kafaa_skill_states_v2`, `kafaa_skills_apply` (no evidence written), `kafaa_ai_rung`, `kafaa_cec_level`, `kafaa_dg_gather`.

## Local md5 (PGlite, `md5(prosrc)`)

```
kafaa_add_wallet_to_plan=5ee488bc1c5c0d9f218c5b9a3899b98f
kafaa_emirati_pipeline=ebcce8445a5efaa6ee50471263c028c1
kafaa_ep_add_months=1b0ea82a84652a9acb1bee8e507acdc0
kafaa_ep_allowed=0360974631ab3523af0fa7ed3dfc001f
kafaa_ep_area=bd59a0ccb5029f7bac50b6eaa1a39a81
kafaa_ep_core=1742be71db971726ad7647530fb29d62
kafaa_ep_roles=c09306a0ff78d8fe7da9135804fb52b7
kafaa_future_wallet_counter=79dcead1f05a6427198cbdd9c1be2aca
kafaa_fw_counter_core=33fb767168c5fc6b9b21a4cb6f7cd8c5
kafaa_fw_items=94c4b7ca5ad366c85f88c964554e9a28
kafaa_fw_status=d9e0541f135ec2d669eb8fdfb8bcb2f8
kafaa_fw_target_problem=33628c49c6be070d32e57218ad67687e
kafaa_fw_target_view=50b37329ba04d7e14eeb128691ffc40f
kafaa_my_future_wallet=026f07939f31c255be1194fc814999c6
kafaa_set_wallet_target=b8fa09e65e8e33ec69883481babb682c
kafaa_na_link_problem=6518decec3edf098ff577d8579f32490   (redefined)
kafaa_na_links=d39bee52fad4d85985261c869d2ce384          (redefined)
kafaa_na_measure=cb12ef8e35dcd08126c4e406123757d2        (redefined)
kafaa_na_report_core=fd4686d3c935119b6db6b544dfbaeb06    (redefined)
kafaa_na_target=0b5554d2f05e10d8fe91b91b6a9e2323         (redefined)
```

## Table digests (count, `left(md5(string_agg(to_jsonb(t)::text, '|' order by id)), 8)`)

| table | rows | ids | rows digest |
|---|---|---|---|
| `kafaa_pipeline_mirror` | 554 | cdfe99ef | b2e632c7 |
| `kafaa_wallet_targets` | 1 | 079f585f | e1b83399 |
| `kafaa_tag_links` (whole table after the 2 new rows) | 54 | 2f7c7854 | 9100fda9 |
| `kafaa_plan_activities` where `id like 'pa-fs74-%'` | 1 | | 63474c13 |

Live seed load (on conflict (id) do nothing): `kafaa_pipeline_mirror` (554), `kafaa_wallet_targets` (1), `kafaa_tag_links` rows `tl:nt-jahiz:wallet_targets:wt-core-five`, `tl:nt-ai-2031:wallet_targets:wt-core-five` (after the table), `kafaa_plan_activities` `pa-fs74-p-k-ro-plant_data`. No UPDATE of an existing live row is needed.

## Tests and gates

- Unit (one file per process): `fs82-emirati-wallet` 32/32, `fs82-pages` 9/9, `w3e5-no-protected-inputs` 69/69, `fs72-pages` 8/8, `m14-rbac` 291/291, `fs63-engine-lint` 13/13. Expected pin failures left to the lead: `fsqa7-integration` "367 routes" (now 370) and `fs72-national-alignment` "five routes ..." (M37 route-id list now 8); the other route-count pin files (`w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa1..6`, `tests/e2e/sweep.spec.ts`) fail the same way.
- PGlite: `scripts/validate/fs82-emirati-wallet.mjs` all checks pass (also `fs72-national-alignment` and `fsqa7-integration` pass alone with the change). `npm run migrations:validate`: "All migration checks passed" (2322 checks, exit 0); the fs82 md5s and digests in the full run equal the ones below.
- `npm run gen` (no diff after the commit), `check:i18n`, `typecheck`, `check:public`, `vite build`: green.

## Settled decisions applied

- FS73 anyRole guard (hr_analyst, hr_director, auditor), not a new grant; the RPC checks the same roles.
- FS74 demo target = Appendix B value (60 % by 2027-12-31) recorded as a setting with who (HR director role card) and when (2026-10-05).
- External facts only from the research packs (wallet target sources: WAM Jahiz, Khaleej Times, both in `national_systems.md`); figures only through the benchmark chips. MC-H2-HEAT untouched (draft).

## Gaps and hand-offs for the integration lead

1. Route-count pins 367 -> 370 (+3 M37: `national-emirati-pipeline`, `my-future-wallet`, `national-future-wallet`), including the M37 route-id list in `tests/unit/fs72-national-alignment.test.ts`.
2. Live apply: migration (tables, RLS, functions; the five `kafaa_na_*` redefinitions), then seed rows (mirror, target, 2 tag links, 1 plan activity). Compare the five redefined `kafaa_na_*` bodies with the fs72 bodies live before applying.
3. The pipeline's successor section is live from the F19 slates and therefore thin in the demo tenant (21 internal successors in scope, 14 Emirati, every band under 10 and suppressed): this is honest, not tuned. Retention and progression come from the SIMULATED mirror (labelled on the page).
4. The wallet counter's headline is suppressed today (2 of 106 staff hold all five; plant-data basics is the bottleneck at 14 staff); the item bars, the distribution and the family heatmap carry the story. Honest seed.
5. FS75 (digest, same wave) may nudge open wallet items: the shape is `kafaa_fw_status(person, date)` / `walletStatus()` (items with `key`, `met`, `level`), plan activity ids `pa-fs74-<person>-<item>`.
6. Optional: a link from `/my/plan` (M04) and the FS09 ladder page to `/my/future-wallet` (not in my files).
7. Supabase demo personas: pipeline as `chco` or `presenter`; wallet as `nse` (no plan yet, so "add to my plan" creates a draft) or `sro`; counter and target setting as `chco`. Local: `k-ro` (4 of 5, last item already in the plan), `k-lo-trainee` (3 open items, active plan).
