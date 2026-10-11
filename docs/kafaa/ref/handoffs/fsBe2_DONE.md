# fsBe2 DONE: FS09 AI Fluency Ladder + FS10 AI and Digital Fitness Check (M29)

Branch `fsBe2` (worktree `/workspace/kafaa-fsBe2`), commit `12cc1fd`. Not pushed. Netlify not touched.

## Acceptance

### FS09 AI Fluency Ladder
- [x] Every staff persona sees a rung with at least one reason linking to evidence. Checked by the unit test, the seed builder (the build fails otherwise) and the validator.
- [x] All 20 job families have a role target (`ai_role_targets`). Every staff persona sees their family's target.
- [x] An AI-engineering skill never changes the literacy rung. Covered by a pure unit test (level 4, and also when a cell names the skill), the local path through F01 evidence and recompute, and SQL parity.
- [x] No points, streaks or leaderboards: column-name scan, i18n scan, and no person ids in the HR aggregate.
- [x] RBAC: Own for my rung; ai_literacy Agg for HR, suppressed under 10, with security/safeguards/cyber never broken out; rung definitions are public R. Partners and anonymous users get nothing.
- [x] Benchmark tie: `BenchmarkChips feature="FS09"` (AI-LIT, UAE-AI, LINKEDIN, DIGCOMP) on every page; `<WhyThis>` reasons on my rung; the dated org parameter sits beside the measured value.

### FS10 AI and Digital Fitness Check
- [x] A result in 20 items or fewer (18-20). The adaptive rule `nextStep` runs: difficulty 2, then 3 or 1, then a confirming item for weighted split areas.
- [x] Scoring is identical in TS and SQL: `scoreAttempt` = `kafaa_fit_score` on all 297 seeded attempts plus 300 generated ones; `nextStep`/`pickItem` = `kafaa_fit_next`/`kafaa_fit_pick`.
- [x] Evidence is never above level 2, even when every answer is right. The latest check replaces earlier check evidence, and the evidence survives recompute.
- [x] The org indicator is suppressed under 10 (counts, bands, trend and families).
- [x] RBAC: Own attempts only (answers only for my attempt and the item on screen; the key never leaves the server); ai_literacy Agg for HR; items W for the training manager (versioned, at least 2 active items per area x difficulty, plant-security wording refused); instructors read only.
- [x] One check per calendar quarter, with the next opening date. Ledger `kafaa.ai.fitness_check`. Audit events `ai.fitness.*`.

## Routes (5, EN + AR/RTL)
`/learn/ai-fluency` (public) · `/my/ai-fluency` (ai_literacy Own) · `/my/ai-fluency/check` · `/workforce/ai-fluency` (ai_literacy Agg) · `/training/ai-fitness/items` (secure_items W/A)

## Tables / RPCs
- Tables: `kafaa_ai_rungs`, `kafaa_ai_skill_tracks`, `kafaa_ai_role_targets`, `kafaa_ai_org_targets`, `kafaa_fitness_areas`, `kafaa_fitness_items`, `kafaa_fitness_attempts`
- RPCs: `kafaa_ai_fluency`, `kafaa_ai_fluency_stats`, `kafaa_start_fitness`, `kafaa_submit_fitness`, `kafaa_fitness_context`, `kafaa_fitness_stats`, `kafaa_save_fitness_item` (authenticated only). Internal helpers `kafaa_ai_rung`, `kafaa_ai_target_gap`, `kafaa_fit_*` are not executable by API roles.
- Shared redefinition (same signatures): `kafaa_skill_states_v2` and `kafaa_skills_apply` treat `ref_table = 'fitness_attempts'` assessment rows as recorded evidence. TS mirror: `isRecordedEvidence`/`isDerivedEvidence` in `src/domain/skills.ts`.
- Migration: `supabase/migrations/20261010222001_kafaa_fs22_ai_fluency.sql`

## Seed
16 cells, 16 tracks (11 literacy, 5 engineering), 20 family targets, 1 org target (60% Practitioner+ by 2027-12-31, demo parameter), 9 areas, 54 EN/AR items, 297 attempts for 100 staff (2025-Q4..2026-Q4), 1,563 evidence rows, 577 new FS02 states. The 71-skill digest is unchanged.
- `p-sro` took the check in 2026-Q4, so the page shows when the next check opens.
- `p-k-ro` has an improving trend across four quarters.

## Live (Supabase hlirqxoddysxtdezwcgv)
- Applied 2 migrations: `kafaa_fs22_ai_fluency_part1_tables_skill_states` and `..._part2_functions`.
- Loaded reference rows with `on conflict do nothing`. Full-row md5 equals PGlite.
- Replayed the attempts and evidence live. Digests are equal: attempts `297 a71830ca…`, evidence `1563 185ec228…`, items, rungs, targets, tracks and areas.
- Function-body md5 is equal for 8 functions, including v2 `02b3b6d9…` and apply `bf516adc…`.
- anon has no execute on any helper or RPC. No DROP or DELETE was run, and no NEXUS object was touched.
- Recomputed the 100 tested people at 2026-10-08. Their 577 fitness-skill states equal local. 722 of their other derived states were refreshed, because live holds evidence from other waves.

## Tests / gates
- gen, check:i18n (40 namespaces), typecheck, check:public, build: all green.
- `migrations:validate`: "All migration checks passed", including `scripts/validate/fs22-ai-fluency.mjs`.
- Unit: `tests/unit/fs22-ai-fluency.test.ts` (23) and `tests/unit/fs22-pages.test.tsx` (8): all pass.
- Full suite: 1889/1895 pass before the last fixes. Affected files were re-run green.
- Only the pinned route counts remain red (212 -> 217): `w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa1-integration`. They are left to the integration lead, as earlier waves did.

## Gaps / notes for the integration lead
- Route-count pins need 217 (more after the other wave-B branches).
- F35: fitness evidence makes 99 staff hold the `digital` family. The stored outlooks were re-derived; headline totals are unchanged. In `so-two-units-2032` and the withdrawn `so-attrition-stress` digital no longer falls short (10 -> 9), so the stress-test summary "Every family in scope falls short" is now off by one. Fix by excluding FS02-skill states from supply in `outlook.ts` + `kafaa_so_base`, or by rewording. Live stored outlooks and the live F23 snapshots of 2 reserve members were not changed.
- The FS04 `ai-governance` radar key now has holders (level <= 2 fitness evidence). The fsqa1 invariant test now excludes fitness-backed states.
- Playwright was not run (I am not the integration lead).
