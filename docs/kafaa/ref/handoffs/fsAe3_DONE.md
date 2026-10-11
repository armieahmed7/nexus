# fsAe3 · FS04 One future-skill keyspace and a computed future-skills radar (M11) — DONE

Branch `fsAe3` (worktree `/workspace/kafaa-fsAe3`, from master `06d23f1`). Not pushed. Live SQL applied to `hlirqxoddysxtdezwcgv`.

## Acceptance (PLAN.md FS04)
- [x] **Every as-* id and every radar or gap-plan key resolves to at least one sk-* skill.** `future_skill_map` (58 rows): 27/27 ADVANCE skills (F01 `skills.adv_skill_ids` mapping + 6 foundation rows), 8/8 radar keys, all gap-plan keys (radar keys or sk-* ids). `adv_skills.sk_ids`, `future_skills.sk_id`, `skill_gap_plans.sk_id` back-filled. Proved in TS (`unresolvedKeys`, unit test AC1) and SQL (PGlite). Keyspace page shows "27 / 27", "8 / 8".
- [x] **Scenario A and B differ for at least 6 of 8 radar skills.** All 8 differ. Root cause fixed: `'Scenario B (SIMULATED)'.includes('A')` in `scripts/seed/content.mjs` gave B Scenario A's values; corrected in the FS04 seed builder. Every row now has a sourced SIMULATED assumption EN/AR (https sources + as-of). B keeps A's total (396), so the F35 outlook's mean ADVANCE index and its stored results are unchanged (seed and live).
- [x] **Radar readiness equals the SQL aggregate on the seed (PGlite), and cells under 10 people are suppressed.** `kafaa_future_radar` = TS `futureRadar` for both scenarios, also after admin keyspace edits (validator fs13). Readiness = share of active staff at the target level on the key's catalogue skills (transfers 1, adapts 0.5, new 1); cells with population or ready people < 10 return null value and count plus an upper bound; per-family cells (security/safeguards/cyber never broken out). Seed: 7 of 8 shown, salt-chemistry suppressed; 2 of 15 families shown.
- [x] Gap plans re-keyed to sk-* (old key kept as label); `saveSkillGapPlan` redefined (TS + SQL) to stamp sk_id and accept sk-* ids.
- [x] Public /future pages unchanged; `publicTextIsClean` passes (map notes, i18n `pub`, `ks`, `bench`).
- [x] RBAC: radar = HR analyst / CHCO office (workforce_analytics Agg) and auditors (R); managers, training manager, observers, instructors, anonymous refused. Map = frameworks R (public), W/edit admin only via audited RPC.
- [x] Benchmarks shown: IAEA-WFP and ESCO chips with drawer (owner, year, what we borrow, where it shows, sources) on both pages; reads `kafaa_benchmarks` when FS01 lands, fallback rows otherwise.

## Routes
- `/workforce/future` (rewritten): scenario switch A/B, adoption what-if, radar (demand, other scenario dashed, computed readiness), stat tiles (staff measured, high gaps, unplanned, suppressed cells), gap table with catalogue-skill chips, suppressed chips with upper bound, "≥" gap lower bounds, `<WhyThis>` per cell, sourced scenario-assumption cards with deltas, job-family readiness heatmap, gap plans with catalogue skill, plan editor (radar keys or catalogue skills; shows resolution), bridge coverage.
- `/workforce/future/keyspace` (new, `workforce-future-keyspace`; HR analyst/director, auditor, admin): coverage tiles, credit legend, tabs ADVANCE / radar / gap plans / full crosswalk (CSV), admin edit drawer (relation, level, primary, active; security skills not offered; last active row locked).

## Tables / RPCs
- New `kafaa_future_skill_map` (rpc writes, frameworks R). Columns: `future_skills.sk_id, target_level, assumption_en/ar, sources`; `adv_skills.sk_ids`; `skill_gap_plans.sk_id`.
- RPCs: `futureRadar(scenario)` → `kafaa_future_radar` (+ internal `kafaa_future_radar_compute`, `kafaa_fk_rows`, `kafaa_fk_sync`); `saveFutureSkillMap(input)` → `kafaa_save_future_skill_map` (admin, audited; forbidden/invalid/not_found/security_restricted/conflict); `saveSkillGapPlan` → `kafaa_save_skill_gap_plan` (redefined).
- Migration `supabase/migrations/20261010213001_kafaa_fs13_keyspace.sql`. Live: `kafaa_fs13_keyspace_part1_tables` + `kafaa_fs13_keyspace_part2_functions`; function bodies md5-identical to local (b7551af5…). Data: 58 map rows inserted `on conflict do nothing`; kafaa_future_skills (16 rows: B values, assumptions, sources, sk_id), kafaa_adv_skills.sk_ids and the 3 existing plans' sk_id updated in place (kafaa_* rows only, row-audit quiet); gp-4..gp-7 inserted. Digests live = seed.json: map 5c1e358f…, future_skills 4e31fc68…, plans 97561a0c…, adv b95b5dc9….

## Files
`src/modules/m11/{keyspace.ts,KeyspacePage.tsx,Benchmarks.tsx,WorkforceFuturePage.tsx,routes.ts,backend/*}`, `src/i18n/m11.{en,ar}.json`, `scripts/seed/ext/fs04-keyspace.mjs`, `scripts/validate/fs13-keyspace.mjs`, `tests/unit/fs13-keyspace.test.ts` (11), `tests/unit/fs13-pages.test.tsx` (6), migration above. Shared one-liners: `src/data/ext/{schema,rpc,local,supabase}.ts`; M11 block of `src/data/schema.ts`; CONTRACT.md changelog entry. Regenerated: types.gen.ts, 120100/120300 SQL, seed.json, seed.sql, RBAC.md.

## Gates
gen ✓ · check:i18n ✓ (EN/AR parity) · typecheck ✓ · fs13 + m11 unit tests ✓ (24) · migrations:validate ✓ (all checks incl. 15 fs13) · check:public ✓ · build ✓. Full unit suite (serial, `--no-file-parallelism`; the parallel run is OOM-killed on this box): 1717 passed, 2 failed = only the route-count pins (206) in `w4-integration.test.tsx:159` and `w5-integration.test.ts:95`, which now read 207 because of the new keyspace route; the integration lead updates them. Commit `1aa3c23` on `fsAe3`.

## Gaps / notes for integration
- Route count 206 → 207 (pinned tests owned by the integration lead).
- `BenchmarkChips` (m11) should be swapped for FS01 `<BenchmarkChip>` when merged; it already reads `benchmarks` if present.
- FS02 new catalogue skills (advanced_reactor, ai_data) can be added to the map by an admin or a later seed; no code change needed. Thin evidence on new skills is why salt-chemistry is suppressed.
- Legacy `future_skills.readiness` (hand-entered) kept, no longer displayed.
- No Playwright run (not integration lead).
