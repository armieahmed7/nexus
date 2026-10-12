# fsFe1 DONE: FS50 Critical Future-Skills Register and FS51 Three-scenario Skill Forecasting Bands (FS wave F · E1, M35)

Branch `fsFe1`, cut from `fsE-integration-qa`. Not merged anywhere. Nothing was applied to live Supabase.

ENEC NEXUS / Kafa'a is a demo and is not affiliated with ENEC. Every person is synthetic, and every forecast number is labelled SIMULATED.

## Acceptance (one named test per criterion)

Logic tests are in `kafaa/tests/unit/fs61-strategy-forecasts.test.ts` and page tests in `kafaa/tests/unit/fs61-pages.test.tsx`. The SQL side is proved in PGlite by `kafaa/scripts/validate/fs61-strategy-forecasts.mjs`.

- [x] **FS50-1: progress is computed, never typed, and suppressed under 10.** Tests:
  - "the register has no progress column; the board computes progress from counted skill states and suppresses under 10"
  - "progressOf: 9 holders at the target level are suppressed, 10 are shown, claims never count"
  - "a typed progress field on save is ignored: the stored row has none and the board still computes it"
  - Page: "HR director: the register board with tiles, computed progress (suppressed under 10), attention ranking and FS50 chips"
  - Validator: "SQL board = criticalBoard" and the suppression checks.
- [x] **FS50-2: every row has an owner and a decision rationale.** Tests:
  - "all 13 seeded rows name an owning function and an active role card, a decision and an EN/AR rationale"
  - "the check refuses a missing owner, a partner owner, an English-only rationale, a security or obsolete skill and plans of another skill"
  - "saveCriticalSkill refuses a row without an owner or a rationale, and duplicates (local = SQL messages)"
  - Validator: kafaa_crs_problem = criticalProblem.
- [x] **FS50-3: each quarterly review writes an audit row and a ledger row.** Tests:
  - "the HR director records the quarter review: one audit row and one ledger row, the computed snapshot, once per quarter"
  - "only the HR director reviews, only adopted rows; a decision change needs an EN/AR rationale and is kept in the history"
  - "the seeded 2026-Q3 reviews hold the computed snapshot; reviewState flags due and overdue rows"
  - Page: "a register row: owner, decision with rationale, computed progress, KPIs; the HR director records the quarter review (audit + ledger)"
  - Validator: the review flow in a rolled-back transaction checks the audit row, the ledger row and already_reviewed.
- [x] **FS51-1: every number is labelled SIMULATED with a definitions link.** Tests:
  - "every result and every saved version is marked SIMULATED with its method; the method page holds the definitions"
  - "a saved version gets the SIMULATED mark and the next version number of the annual cycle"
  - Page: "training manager: every number SIMULATED with a definitions link; …"
  - Page: "the method page holds the definitions, assumptions and the not-modelled list (EN and AR)"
  - The SQL check `name like '%(SIMULATED)'` is in the migration.
- [x] **FS51-2: resetting the assumptions reproduces the baseline exactly.** Tests:
  - "the empty set, the defaults and a reset after a change give the identical baseline; the released 2026 version equals it"
  - Page: "… a what-if changes the band and reset reproduces the baseline exactly"
  - Validator: TS = SQL parity over 73 assumption sets, and every stored version equals a recompute.
- [x] **FS51-3: skills with fewer than 10 holders are suppressed.** Tests:
  - "every shown skill has 10+ measured holders and 10+ people in roles that need it; suppressed skills carry no numbers"
  - "a skill with no profile demand is "not yet modelled", never suppressed or shown"
  - Page: the suppressed list shows no numbers.
- Also covered:
  - Rules, RBAC and seed (4 tests).
  - Model, scenarios, generations, version blocking, release (5 tests).
  - Routes, benchmarks and i18n (2 tests).
  - Pages: versions blocked by the methodology change, skill detail with Why this?, generations, Arabic rendering.

## Routes (+7, all guarded by `workforce_strategy` Agg/R/W/A, never public, no staff grant)

| id | path | nav |
|---|---|---|
| workforce-critical-skills | /workforce/critical-skills | 68.1 under workforce |
| workforce-critical-skill | /workforce/critical-skills/:id | |
| workforce-skill-forecasts | /workforce/skill-forecasts | 68.2 under workforce |
| workforce-skill-forecast | /workforce/skill-forecasts/skills/:skillId | |
| workforce-skill-forecast-versions | /workforce/skill-forecasts/versions | |
| workforce-skill-generations | /workforce/skill-forecasts/generations | |
| workforce-skill-forecast-method | /workforce/skill-forecasts/method | |

Smoke samples are in `kafaa/src/modules/m35/smoke.json`: `cs-sk-fs-ai-verify` and `sk-fs-ai-verify`.

## Tables and RPCs

The migration is `kafaa/supabase/migrations/20261010261001_kafaa_fs61_strategy_forecasts.sql`. It is additive and idempotent. RLS is written in the perf form `(SELECT kafaa_has_grant('workforce_strategy', ...))`.

**Tables:**
- `kafaa_critical_skills` (13 seed rows)
- `kafaa_critical_skill_reviews` (9)
- `kafaa_skill_forecasts` (4)

All three are read with the workforce_strategy agg_ok rule and written only through the RPCs.

**RPCs** (SECURITY DEFINER, executable by authenticated only):
- `kafaa_critical_skill_board()`
- `kafaa_save_critical_skill(p)`
- `kafaa_review_critical_skill(p)`
- `kafaa_compute_skill_forecast(p_params)`
- `kafaa_save_skill_forecast(p)`
- `kafaa_release_skill_forecast(p_id, p_summary_en, p_summary_ar)`

**Helpers** (execute revoked from public, anon and authenticated): `kafaa_sf_normalize`, `kafaa_sf_needs`, `kafaa_sf_base`, `kafaa_sf_survive`, `kafaa_sf_project`, `kafaa_sf_compute`, `kafaa_sf_for`, `kafaa_crs_problem`, `kafaa_crs_quarter`, `kafaa_crs_quarter_end`, `kafaa_crs_prev_quarter`, `kafaa_crs_held`, `kafaa_crs_target_for`, `kafaa_crs_progress`, `kafaa_crs_review_state`, `kafaa_crs_board_core`, `kafaa_crs_review_problem`.

**Ledger actions:**
- `kafaa.workforce.critical_skill_adopt`
- `kafaa.workforce.critical_skill_retire`
- `kafaa.workforce.critical_skill_review`
- `kafaa.workforce.forecast_release`

**Audit actions:** `critical.board`, `critical.save`, `critical.review`, `forecast.compute`, `forecast.save`, `forecast.release`, including refusals.

### Function md5 (first 8 hex of md5(prosrc), from the PGlite validator)

```
kafaa_compute_skill_forecast=d5b48924 kafaa_critical_skill_board=f2651197 kafaa_crs_board_core=afbc295b kafaa_crs_held=2f69670e
kafaa_crs_prev_quarter=c8b2992c kafaa_crs_problem=fc341d4e kafaa_crs_progress=a0ed15c0 kafaa_crs_quarter=7dd42a11
kafaa_crs_quarter_end=0bef1d5e kafaa_crs_review_problem=e2f07ae9 kafaa_crs_review_state=6d31c569 kafaa_crs_target_for=b8595553
kafaa_release_skill_forecast=e5bf1c0a kafaa_review_critical_skill=0d099e3b kafaa_save_critical_skill=8aae8c74
kafaa_save_skill_forecast=9ca79d34 kafaa_sf_base=23b89b26 kafaa_sf_compute=56e1de45 kafaa_sf_for=6c453998 kafaa_sf_needs=5a9b1aa4
kafaa_sf_normalize=40c8fead kafaa_sf_project=a6bb6802 kafaa_sf_survive=bc728777
```

### Table digests (row count, then the first 8 hex of the md5 of the ordered rows)

```
kafaa_critical_skills 13 260aa525
kafaa_critical_skill_reviews 9 0b70d3b4
kafaa_skill_forecasts 4 d7d9f738
```

## Seed

`kafaa/scripts/seed/ext/fs50-critical-skills.mjs` (FINALIZE_LAST) produces:

- **Forecasts:**
  - `sf-2025-v1`: established-only pilot, released.
  - `sf-2026-v1`: defaults, plans against ADVANCE, released by p-chco on 2026-10-06.
  - `sf-2026-v2` and `sf-2026-v3`: drafts.
- **Register:** 13 rows.
  - 11 active and 2 drafts from the HR analyst.
  - All four decisions are used.
  - The rows link 5 FS04 gap plans.
  - `sk-fs-ai-twin` carries a buy to borrow history entry.
- **Reviews:** nine 2026-Q3 reviews holding the computed snapshot. Two adopted rows have no review, so they read overdue.

The stored results equal a recompute on the final seed. To get there, the builder applies fsqa1's idempotent `remapRequirements` read-only.

Rows load with `insert ... on conflict (id) do nothing`. For a live apply, load the forecasts first, then the register rows, then the reviews.

## Tests and gates (run from `kafaa/`)

- `tests/unit/fs61-strategy-forecasts.test.ts`: 26 passed.
- `tests/unit/fs61-pages.test.tsx`: 9 passed.
- Directly affected suites, each run alone: `w0-scaffold` 5 passed; `m14-rbac` 291 passed.
- `npm run gen`: no unexpected diff. Only `meta.generated_at` changes between runs. The result is 34432 rows across 315 tables.
- `npm run check:i18n`: OK, 40 namespaces in parity.
- `npm run typecheck`: clean.
- `npm run check:public`: OK.
- `npx vite build`: OK.
- `npm run migrations:validate`: all migration checks passed, including `fs61-strategy-forecasts.mjs` with 34 checks.

## Gaps and hand-offs for the integration lead

1. **Route-count pins** go up by 7, from 315 to 322: `fs11-foundation`, `fsqa1/2/3/4/5-integration` and `tests/e2e/sweep.spec.ts`. I did not touch them.
2. **Live apply:** `20261010261001_kafaa_fs61_strategy_forecasts.sql` in parts (tables and RLS, helpers, RPCs, grants), then the seed rows for the three tables in this order: forecasts, register, reviews. Check the md5s and digests above.
3. **RLS perf form:** already written. Rerunning `gen-rls-perf.mjs` for the 3 tables should be a no-op.
4. **FS52** must keep the `src/modules/m07/outlook.ts` exports and the `BASELINE` values stable, along with SQL `kafaa_so_*`. FS51 reuses them read-only, and a change voids the stored FS51 results.
5. **FS54:** the M35 pages carry their own methodology banner (`m35-method-banner`). The FS54 site-wide methodology banner can wrap or replace it.
6. **FS55:** a possible engine card for the register attention ranking (`attentionOf`; it ranks register rows, not people).
7. **FS60** reads the FS50 board (`kafaa_critical_skill_board`). **FS64** reads released FS51 aggregates (`kafaa_skill_forecasts` where status = 'released').
8. **Not modelled:** 78 skills have no role-profile demand and are listed as "not yet modelled" instead of being given a number. Adding FS05 profile requirements brings them in automatically.
