# fsFe4 DONE: FS56 Skill-change effectiveness + FS57 Curriculum coverage scorer and gap-filling backlog (M25)

Branch `fsFe4` (pushed to `origin/fsFe4`; not merged anywhere), worktree `/workspace/nexus-fsFe4`, based on `fsE-integration-qa` `7b6b8e9`. Netlify not touched, no live Supabase calls, no Playwright run.

## Acceptance

### FS56 · Skill-change effectiveness (`/training/skill-change`, plus a card on `/training/effectiveness/:courseId`)
- [x] **Courses with fewer than 10 completers show "suppressed".**
  - Under 10 completers, every number on the row is null: completers, measured, before, after, change, moved, comparison and per-skill cells. The verdict is `suppressed` and the only reason is `sc_suppressed{min:10}`.
  - Every stored count is at least 10. The `window_open` reason does not leak a count under 10.
  - The seed has 9 suppressed items out of 26.
  - Tests:
    - `fs64-skill-change-coverage` "acceptance FS56-1: courses with fewer than 10 completers show "suppressed" (nothing else, in the rule, the seed and the RPC)"
    - `fs64-pages` "suppressed items show "suppressed" and nothing else; measured rows state their method and window; the drawer explains the method"
    - validator "acceptance (FS56): the 9 courses and pathways with fewer than 10 completers show only "suppressed"" and "seed: no stored count comes from fewer than 10 people"
- [x] **TS and SQL agree on the seed.**
  - `kafaa_sc_compute(date)` equals `skillChange()` on the live tables for the seed date and for 2026-03-31, 2026-07-15 and 2027-01-20.
  - The 26 stored rows equal `skillChange()` on the seed tables.
  - `kafaa_sc_report` equals `skillChangeReportOf()`.
  - `computeSkillChange` recomputes exactly the rule on both backends.
  - Tests:
    - `fs64-skill-change-coverage` "acceptance FS56-2: the stored table reproduces from the rule on the seed (SQL = TS is proved in PGlite by fs64-skill-change-coverage.mjs)"
    - the RBAC test, which recomputes and compares with the rule
    - validator "SQL kafaa_sc_compute equals skillChange() …", "the 26 stored rows equal skillChange() on the seed tables …", "SQL kafaa_sc_report equals skillChangeReportOf() …" and "computeSkillChange: training manager only … exactly as skillChange()"
- [x] **Each measured course states its comparison method and window.**
  - Every measured row has `method` set to `matched` (a pool of at least 10 colleagues with the same starting level, over the same window, who had not completed the item) or `before_after` (fewer than 10 such colleagues), and `window_days = 90`.
  - Reasons on these rows: `sc_change{before, after, days}`, `sc_moved`, `sc_matched{comp, net, people}` or `sc_no_comparison{min}`, then the verdict.
  - On the page, every table row shows the method chip and the window. The drawer has a method timeline (before = the last evidence before the start; after = evidence up to 90 days after completion). The F25 course card shows the method and window.
  - Tests:
    - `fs64-skill-change-coverage` "acceptance FS56-3: each measured course states its comparison method and window"
    - `fs64-pages` "suppressed items …" and "the F25 course page shows this course's skill change with its method and a link to the full table"
    - validator "seed: 26 learning items, every measured one states its comparison method and the 90-day window"
- [x] **Extras.**
  - Before and after levels come from F01 evidence history. The item's own transcript rows and self-claims never count. Inactive evidence keeps its historical date.
  - Security-area skills are never measured.
  - The L3 column links to the Kirkpatrick page.
  - EN and AR; `<WhyThis>` on every row and in the drawer; BenchmarkChips FS56 (FSC, ISO30414, SKILLS-TECH).

### FS57 · Curriculum coverage scorer (`/training/coverage`) and gap-filling backlog (`/training/coverage/backlog`)
- [x] **Coverage reproduces from the rule.**
  - Each FS05 role profile is scored 0-100 for now and 2030. The ceiling is level 2, because levels 3 and 4 are built on the job.
  - target = min(need, 2), and credit = min(taught, target) × 2 / target.
  - Core skills have weight 2 and important skills weight 1. The score is the weighted credit as a percentage, rounded half away from zero.
  - Path-only roles are not scored.
  - The RPC returns exactly `coverage()` over the live tables, and SQL `kafaa_cov_roles` equals it for 59 profiles.
  - Tests:
    - `fs64-skill-change-coverage` "acceptance FS57-1: coverage reproduces from the rule (the RPC returns exactly coverage() over the live tables)" (recomputes every score by hand)
    - validator "acceptance (FS57): coverage reproduces from the rule: SQL kafaa_cov_roles equals coverage() for 59 role profiles …", plus the `kafaa_cov_taught` and `kafaa_cov_report` parity checks
- [x] **Every uncovered skill appears in the backlog with an owner.**
  - The backlog has one row per skill and target level (`gb:<skill>:<level>`). It covers every uncovered role requirement plus every open FS17 gap; that is 91 rows on the seed.
  - The owner function is the FS02 skill owner (default `nuclear_training`). An optional lead must be active staff.
  - `syncGapBacklog` adds rows for new needs and is idempotent.
  - The live state is open, planned (decided) or covered (no longer needed).
  - Tests:
    - `fs64-skill-change-coverage` "acceptance FS57-2: every uncovered skill appears in the backlog with an owner (seed, and after a new FS17 gap is synced)"
    - `fs64-pages` "every row has an owner; planned rows are the decided ones; decide and sync are for the training manager only"
    - validator "acceptance (FS57): every uncovered skill (and open FS17 gap) appears in the backlog with an owner (91 of 91 rows)" and "syncGapBacklog: … a new open FS17 gap gets a backlog row with the skill's owner function"
- [x] **A what-if course raises the score by exactly the amount the rule predicts, and is not saved unless confirmed.**
  - The what-if runs in memory (`whatIf()`). Choosing a skill and level shows the per-role moves and the total, marked "not saved".
  - "Record as a decision" opens the decision drawer, which checks the input live. Only ConfirmDialog → `decideGap` writes. The decision stores route, owner, due date (no later than 2030), rationale, plan and the predicted moves, and writes ledger `kafaa.coverage.gap_decision`.
  - Once a course teaching that skill at that level exists, every predicted role moves by exactly the predicted delta, and no other role moves. This holds on the local path (unit test) and in SQL (validator: +13 +2 +3 +5 +8 +10).
  - Tests:
    - `fs64-skill-change-coverage` "acceptance FS57-3: a what-if course raises the score by exactly the amount the rule predicts and is not saved unless confirmed"
    - `fs64-pages` "acceptance FS57-3 (page): the what-if shows exactly the predicted rise, saves nothing until the decision is confirmed, then records it"
    - validator "acceptance (FS57): a planned course raises the scores by exactly the amount the rule predicted …"
- [x] **Extras.**
  - Build, partner or buy routes; a Donut of routes.
  - Six seeded decisions with EN and AR rationale. Their predictions match the final seed (validator "seed: 6 decisions carry …").
  - Supplier-audience courses and security skills never count.
  - BenchmarkChips FS57 (LIGHTCAST, UPKEEP); `<WhyThis>` on requirements and backlog rows; EN and AR.

### RBAC (both backends)
- Reads (`skillChangeReport`, `curriculumCoverage`, both tables' RLS) require learning_analytics Agg, R or A. That covers managers, instructors, HR analysts and directors, auditors and the training manager.
- Staff with Own only, partners and anonymous visitors are refused or see 0 rows.
- `computeSkillChange`, `syncGapBacklog` and `decideGap` require learning_analytics A (the training manager). Refusals are audited.
- The staff list for the lead picker is returned only to editors.
- Tests: `fs64-skill-change-coverage` "reads are for learning-analytics aggregate holders; only the training manager recomputes, syncs and decides"; validator RLS, RPC and grants checks.

## Routes (new, M25)
| id | path | guard | nav |
|---|---|---|---|
| `training-skill-change` | `/training/skill-change` | learning_analytics Agg/R/A | my › training 48.55 |
| `training-coverage` | `/training/coverage` | learning_analytics Agg/R/A | my › training 48.8 |
| `training-coverage-backlog` | `/training/coverage/backlog` | learning_analytics Agg/R/A | parent `training-coverage` |

Links were added from `/training/effectiveness` (`m25-to-skill-change`) and `/training/needs` (`m25-needs-to-coverage`). `/training/effectiveness/:courseId` shows `SkillChangeCard`.

## Tables and RPCs
- **Migration** `supabase/migrations/20261010264001_kafaa_fs64_skill_change_coverage.sql`. It is additive and idempotent, and creates kafaa_* objects only. The destructive words never appear in it.
- **Tables:**
  - `kafaa_skill_change_measures` and `kafaa_gap_backlog`, with FKs, checks and indexes.
  - New index `kafaa_skill_evidence_person_skill_fs64_idx` on `kafaa_skill_evidence (person_id, skill_id)`.
  - RLS in the per-statement form `(select kafaa_has_grant('learning_analytics', array['Agg','R','W','A']))`. Writes go through RPCs only.
- **RPCs** (granted to `authenticated` only): `kafaa_skill_change_report()`, `kafaa_compute_skill_change()`, `kafaa_curriculum_coverage()`, `kafaa_sync_gap_backlog()`, `kafaa_decide_gap(jsonb)`.
- **Helpers** (revoked from anon, authenticated and public): `kafaa_cov_*`, `kafaa_sc_compute`, `kafaa_sc_report`.
- **TS:** `Fs56Rpc` in `src/modules/m25/backend/rpc.ts`; LocalBackend `makeLocalFs56` in `backend/local.fs56.ts`; Supabase mappings in `backend/supabase.ts`.
- **Rules (import-free):** `src/modules/m25/skillChange.ts` and `src/modules/m25/coverage.ts`.

### Local function md5s (`md5(prosrc)`, PGlite, this migration)
No shared function was redefined.

| function | md5 |
|---|---|
| `kafaa_compute_skill_change()` | `3fd0a3c4043a4e4ee6837d93f2f545ae` |
| `kafaa_cov_course_skills(p_course text)` | `d5e5aeadbf70b662548906d945fa3448` |
| `kafaa_cov_decision_problem(p jsonb, p_found boolean, p_today date)` | `6082e5a100148e683ead37330c8ee91e` |
| `kafaa_cov_int_between(p jsonb, p_min integer, p_max integer)` | `4bb49bd4e148707a1ce13c14d85eea88` |
| `kafaa_cov_is_date(p text)` | `be6e004ce48ab5468e02bb8f83acb8d5` |
| `kafaa_cov_needs(p_roles jsonb)` | `1095202ed491262163878e01f95aeccc` |
| `kafaa_cov_owner(p_role text)` | `5c81a4fcf173c6ae0838eaab532d0846` |
| `kafaa_cov_reasons(p_need jsonb, p_taught integer)` | `52d08df3b3f8bbd2819bf642e93a30b3` |
| `kafaa_cov_report(p_today date, p_can boolean)` | `2c7c47602fe8f73143233f1c7503b61a` |
| `kafaa_cov_reqs(p_reqs jsonb)` | `c809c0de5e8186d074d522688ae76172` |
| `kafaa_cov_restricted()` | `374f650f01cd96d410531579ee033d6d` |
| `kafaa_cov_roles(p_skill text, p_level integer)` | `09dc1a8e579567dd62241907528f02c0` |
| `kafaa_cov_score(p_reqs jsonb, p_taught jsonb)` | `f8418085996ba445f3347dc1afa40196` |
| `kafaa_cov_taught()` | `7c80f3f8d22647ccaf8b1e71a6ecd675` |
| `kafaa_cov_ts(p timestamp with time zone)` | `d539481eb0df716d88c4edefbb8835e4` |
| `kafaa_cov_whatif(p_roles jsonb, p_skill text, p_level integer)` | `afab9a60168e839dce1d3e0f59639cfa` |
| `kafaa_curriculum_coverage()` | `dc0ce1f99017022c4086530c93fb2e39` |
| `kafaa_decide_gap(p jsonb)` | `0b3d51641208fdeb4cf128c924f09bab` |
| `kafaa_sc_compute(p_as_of date)` | `699938ce10caeca4098ad2b109560cbd` |
| `kafaa_sc_report(p_can boolean)` | `2437952013ae4c7a06259d7e6ddc3ec6` |
| `kafaa_skill_change_report()` | `7854294dc6c8fea0a24a0520d4c11228` |
| `kafaa_sync_gap_backlog()` | `338b56d66c4e8c50720af27a69a602a4` |

(Other `kafaa_sc_*` functions in the database, such as `kafaa_sc_available` and `kafaa_sc_pool`, belong to an earlier module and are unchanged.)

### Table digests (`count(*)`, `left(md5(string_agg(to_jsonb(t)::text,'|' order by t.id)),8)`)
| table | rows | digest |
|---|---|---|
| `kafaa_skill_change_measures` | 26 | `7de4617f` |
| `kafaa_gap_backlog` | 91 | `fbb6651d` |

## Seed
- `scripts/seed/ext/fs56-skill-change.mjs` (FINALIZE_LAST). It computes the measures as of DEMO_TODAY 2026-10-08.
- The backlog is built on the final view. It reads fsqa1 `remapRequirements` and fsqa4 `refreshGaps` read-only, on copies, so the predictions still hold after those builders run.
- Six decisions: build ×2, partner ×2, buy ×2, one of them without a plan.
- All rows load with `on conflict (id) do nothing`.
- Log line: `fs56/57: 26 learning items measured as of 2026-10-08 (12 with 10+ measured, 5 move skills); backlog 91 rows, 6 decisions`.
- After `npm run gen`: 34,523 rows across 314 tables.

## Tests
- `tests/unit/fs64-skill-change-coverage.test.ts`: 19 tests. They cover the acceptance criteria, the rules, RBAC and refusals, schema, routes, guards and EN/AR keys.
- `tests/unit/fs64-pages.test.tsx`: 8 jsdom tests. They cover the skill-change table, drawer, recompute, the course card, Arabic, the coverage tabs, heatmap and drawer, what-if → decision → ledger, the backlog, sync and Arabic.
- PGlite validator `scripts/validate/fs64-skill-change-coverage.mjs`: 28 checks, run by `migrations:validate`.
- Both unit files were run one at a time with `TMPDIR=/dev/shm npx vitest run --maxWorkers=1 --minWorkers=1`. Both pass, and my vitest temp folders were cleaned up.

## Gates (run in `kafaa/`)
- `npm run gen`: no unexpected diff (only my two new tables and their seed rows in the generated files).
- `npm run check:i18n`: passes (40 namespaces, en/ar in parity).
- `npm run typecheck`: clean.
- Unit tests: `fs64-skill-change-coverage` 19/19 and `fs64-pages` 8/8.
- `npm run migrations:validate`: "All migration checks passed" (full chain, about 11 minutes; my block has 28 checks, all passing).
- `npm run check:public`: passes.
- `npx vite build`: built.

## Gaps and hand-offs for the integration lead
- **Route-count pins:** the 3 new routes move them from 315 to 318 (`w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa1/2/3/4-integration`, `tests/e2e/sweep.spec.ts`). I left them alone, as instructed.
- **Shared rule for FS54 and FS66:** import `courseSkills` / `taughtBy` / `coverage` / `whatIf` from `src/modules/m25/coverage.ts` (SQL `kafaa_cov_taught()` / `kafaa_cov_course_skills(text)`) instead of copying them. This is logged in the CONTRACT changelog.
- **No engine card:** the pages rank content and skills, not people (FS49 precedent). Tell the FS55 lint, if it lists ranking pages.
- **Validator residue:** earlier validators in the chain leave rows behind, for example pathway enrolments. My SQL = TS parity therefore reads the live tables, and the stored rows are checked against the seed tables.
- **Future-role note:** coverage reads FS05 versions as remapped by fsqa1. If a later wave changes role requirements or the FS17 gap set, run `syncGapBacklog` (or replay it in the wave QA migration). Stored `predicted` values are a record of the decision at the time it was made and are not recomputed.
- **Live apply:** not applied (no live Supabase). Add the migration to the wave F live-apply bundle.
