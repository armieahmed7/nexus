# fsAe5 · FS06 Task layer with AI exposure and change horizon (FS wave A · E5, M26)

Branch `fsAe5` (worktree `/workspace/kafaa-fsAe5`), based on master `06d23f1`. Not pushed.

## Acceptance (PLAN FS06)
- [x] All non-restricted JTA tasks are rated (91/91: OECD needs, horizon, driver, exposure, >=1 skill link); restricted tasks (4, security-officer) have null values, no skill links and are never returned (`taskFuture`, explorer, role/task pages). Enforced by `kafaa_sat_task_guard` (now also nulls future columns), check constraint `kafaa_jta_tasks_future_restricted_ck`, trigger `kafaa_fx_task_skill_guard`. Tests: `fs15-task-future` (seed + RPC), validator (guard, constraint, RPC).
- [x] `exposureOf` gives identical results in TS and SQL on the seed (PGlite: 95 seeded tasks + 600 generated cases + needs validator on 14 inputs; `kafaa_task_future` = TS view for all 91 tasks incl. reasons and skills).
- [x] Each edit writes one SAT change-log row (`sat_changes.area = 'future'`, closed, before/after snapshot) and one audit row (local unit test + PGlite).
- [x] RBAC: sat R (instructors, auditors) read; W = training manager (sat A) or an instructor designated SAT analyst by the training manager (`designateSatAnalyst`, ledgered). Refusals audited.
- [x] Benchmark tie on every FS06 surface: OECD-AICI, SSG-SF, ONET chips (drawer with borrow text, sources, as-of); sourced reference rows (`ai_exposure_refs`) shown as reference lines; O*NET-style driver badges with the published threshold (30%, min 3 rated tasks).
- [x] EN + AR complete (`check:i18n` parity), logical RTL utilities, digits via `useFormat`.

## Routes / UI
- New: `/training/sat/future` (`training-sat-future`): tiles, exposure mix donut, drivers bar chart, reference lines (ENEC share vs SSG 24% with method caveat, O*NET threshold), role x exposure heatmap, driver badges, exposure rule + AI capability reference table (SIMULATED), filterable explorer with CSV, SAT analysts (designate / withdraw for the training manager).
- `/training/sat`: "Future of the work" summary (exposure per role, link into the layer).
- `/training/sat/roles/:roleId`: Future column (exposure, horizon, driver, Why this?) + Future filter + link.
- `/training/sat/tasks/:taskId`: Future card (exposure + reasons, OECD need-vs-AI bars at the horizon, skills today/at horizon, history diff, editor with live preview for writers).
- `/training/sat/changes`: change-type filter; future edits render a before/after diff.

## Data / RPCs
- Migration `supabase/migrations/20261010215001_kafaa_fs15_task_future.sql` (additive, idempotent).
- Columns: `kafaa_jta_tasks` (+ai_capability_needed, exposure, change_horizon, tech_driver, future_by, future_on), `kafaa_sat_changes` (+area).
- Tables: `kafaa_jta_task_skills`, `kafaa_ai_capability_levels`, `kafaa_ai_exposure_refs`, `kafaa_sat_analysts` (RLS sat R/W/A, writes via RPC only).
- RPCs: `kafaa_set_task_future`, `kafaa_task_future`, `kafaa_designate_sat_analyst` (+ internal `kafaa_fx_*`, not executable by API roles). TS: `FutureRpc` in `src/modules/m26/backend/rpc.ts`, local `backend/future.local.ts`, Supabase map in `backend/supabase.ts`.
- Seed: `scripts/seed/ext/fs06-task-future.mjs` (27 SIMULATED capability levels, 6 sourced figures, 91 task ratings via archetypes, 246 task-skill links, 2 analysts, 7 future change-log rows). Mix: 30 AI-assisted, 28 partly automatable, 33 human core.
- Live `hlirqxoddysxtdezwcgv`: migration applied as `kafaa_fs15_task_future`; seed loaded (on conflict do nothing / update where exposure is null). 13 function bodies md5-identical to PGlite; 6 row digests identical; anon executes none, authenticated only the 3 RPCs.

## Tests and gates
- `tests/unit/fs15-task-future.test.ts` (14 tests), `tests/unit/fs15-pages.test.tsx` (9 tests, EN + AR), `scripts/validate/fs15-task-future.mjs` (~38 PGlite checks). `tests/unit/w4e2-sat.test.ts` route count 9 -> 10.
- Gates: see the gate summary at the end of this file.

## Gaps / notes for integration
- Task-to-skill links are in M26 `jta_task_skills`, not M09 `task_skill_links` (FK to `task_items`, standard required). Logged in CONTRACT.
- FS01 not yet merged: `BenchTies` in `m26/fxui.tsx` reads `kafaa_benchmarks` if present, else plan rows; swap to `<BenchmarkChip>` at integration.
- FS02 future skills (AI output verification etc.) do not exist yet; future links use existing skills (`sk-da-02-review`, `sk-da-01-twins`, `sk-mp-01-remote`, `sk-mp-02-dic`, `sk-pf-02-advcool`). Re-point after FS02 merges.
- AI capability levels are a seeded SIMULATED planning assumption (read-only, no editing UI); OECD's published per-domain levels are not in the research packs, so none are claimed.
- No Playwright run (not integration lead); route sweep count left to the integration lead.

## Gate summary (2026-10-10)
- gen: ok (219 SQL tables; seed 23,7xx rows). check:i18n: ok (29 namespaces, en/ar parity). typecheck: ok.
- unit: 89 files run (in chunks; the shared container OOM-killed a single full run). 87 files pass, including fs15-task-future (14), fs15-pages (9) and w4e2-sat (updated: route count 10, future rows have no impact). 2 expected failures for the integration lead: `w4-integration.test.tsx` and `w5-integration.test.ts` assert exactly 206 routes; FS06 adds `/training/sat/future` (207). Per PLAN section 2 the sweep count is updated by the wave integration lead only.
- migrations:validate: all checks passed (incl. 38 FS06 PGlite checks), migrations + seed applied twice.
- check:public: ok. build (vite): ok.
- Commit: `878e5a8` on branch `fsAe5` (not pushed).
